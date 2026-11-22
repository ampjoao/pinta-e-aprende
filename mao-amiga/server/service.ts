/**
 * Regras da plataforma. As rotas HTTP (http.ts) só traduzem pedidos para estas funções.
 *
 * Quem vê o quê:
 *  - Doador: as suas doações e estatísticas globais. Nunca vê beneficiários.
 *  - Beneficiário: o seu pedido e os apoios recebidos ("da comunidade"). Nunca vê doadores.
 *  - Revisor: pedidos e documentos para verificar (com registo de cada consulta). Nunca vê doadores.
 *  - Administração: ciclos de distribuição e criação de revisores. Os registos de doações existem
 *    porque a lei obriga (fiscal e branqueamento de capitais), mas não estão ligados a pagamentos.
 */
import { allocate } from './allocation.ts'
import type { Config } from './config.ts'
import { hashPassword, randomId, randomToken, sha256, verifyPassword, type Crypto } from './crypto.ts'
import { tx, type Db } from './db.ts'
import type { KycProvider, PaymentProvider } from './providers.ts'
import { ageOn, isValidEmail, isValidIban, normalizeIban } from './validation.ts'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type Role = 'donor' | 'beneficiary' | 'reviewer' | 'admin'

export interface User {
  id: string
  email: string
  role: Role
  suspended: boolean
}

export interface Deps {
  db: Db
  crypto: Crypto
  config: Config
  payments: PaymentProvider
  kyc: KycProvider
  now?: () => number
}

export const CATEGORIES = ['alimentacao', 'habitacao', 'saude', 'educacao', 'energia', 'transportes', 'outro'] as const
export const DOCUMENT_KINDS = ['rendimentos', 'morada', 'despesas', 'outro'] as const
const REQUIRED_DOCUMENTS = ['rendimentos', 'morada'] as const
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024
const MAX_DOCUMENTS = 10
const SESSION_DAYS = 30
/** Abaixo deste número, as estatísticas públicas não mostram contagens nem valores (evita identificar pessoas). */
const STATS_MIN_GROUP = 5
const DAY = 24 * 60 * 60 * 1000

type Row = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'bigint' ? Number(v) : 0)
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : num(v))

/** Pseudónimo curto e estável para um pedido (os revisores não precisam do id interno). */
export const aliasOf = (id: string) => 'P-' + sha256(id).slice(0, 6).toUpperCase()

/** Escala de equivalência da OCDE modificada (a mesma que o INE usa para o limiar de pobreza). */
export const equivalentAdults = (adults: number, children: number) => 1 + 0.5 * Math.max(0, adults - 1) + 0.3 * children

function requireInt(v: unknown, name: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    throw new HttpError(400, `${name}: valor inválido.`)
  }
  return v
}

function requireText(v: unknown, name: string, min: number, max: number): string {
  if (typeof v !== 'string') throw new HttpError(400, `${name}: em falta.`)
  const s = v.trim()
  if (s.length < min || s.length > max) throw new HttpError(400, `${name}: entre ${min} e ${max} caracteres.`)
  return s
}

export function createService(deps: Deps) {
  const { db, crypto, config, payments, kyc } = deps
  const now = deps.now ?? (() => Date.now())

  const audit = (actorId: string | null, action: string, target: string | null = null) => {
    db.prepare('INSERT INTO audit (actor_id, action, target, created_at) VALUES (?, ?, ?, ?)').run(actorId, action, target, now())
  }

  const userFromRow = (r: Row): User => ({
    id: str(r.id),
    email: str(r.email),
    role: str(r.role) as Role,
    suspended: num(r.suspended) === 1,
  })

  const requireRole = (user: User, ...roles: Role[]) => {
    if (!roles.includes(user.role)) throw new HttpError(403, 'Sem permissão para esta ação.')
  }
  const requireActive = (user: User) => {
    if (user.suspended) throw new HttpError(403, 'Conta suspensa. Contacte o apoio.')
  }
  const hasIdentity = (userId: string) => Boolean(db.prepare('SELECT 1 FROM identities WHERE user_id = ?').get(userId))
  const requireIdentity = (user: User) => {
    if (!hasIdentity(user.id)) throw new HttpError(403, 'Precisa de verificar a identidade primeiro.')
  }

  function createSession(userId: string) {
    const token = randomToken()
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
      sha256(token),
      userId,
      now() + SESSION_DAYS * DAY,
    )
    return token
  }

  function insertUser(email: string, password: string, role: Role) {
    const normalized = email.trim().toLowerCase()
    if (!isValidEmail(normalized)) throw new HttpError(400, 'Email inválido.')
    if (typeof password !== 'string' || password.length < 10 || password.length > 200) {
      throw new HttpError(400, 'A palavra-passe precisa de pelo menos 10 caracteres.')
    }
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(normalized)) {
      throw new HttpError(409, 'Já existe uma conta com este email.')
    }
    const id = randomId()
    db.prepare('INSERT INTO users (id, email, pass_hash, role, created_at) VALUES (?, ?, ?, ?, ?)').run(
      id,
      normalized,
      hashPassword(password),
      role,
      now(),
    )
    return id
  }

  const DUMMY_HASH = hashPassword('nunca-usada-' + randomToken())

  function latestApplication(userId: string): Row | undefined {
    return db.prepare('SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(userId) as
      | Row
      | undefined
  }

  function documentsOf(applicationId: string) {
    return (
      db
        .prepare('SELECT id, kind, filename, mime, size, created_at FROM documents WHERE application_id = ? ORDER BY created_at')
        .all(applicationId) as Row[]
    ).map((d) => ({ id: str(d.id), kind: str(d.kind), filename: str(d.filename), mime: str(d.mime), size: num(d.size) }))
  }

  /** Apaga os documentos de prova assim que deixam de ser necessários (RGPD: minimização). */
  const purgeDocuments = (applicationId: string) => db.prepare('DELETE FROM documents WHERE application_id = ?').run(applicationId)

  const expireOld = () => {
    db.prepare("UPDATE applications SET status = 'expired' WHERE status = 'approved' AND valid_until < ?").run(now())
  }

  return {
    // ───────────── Contas ─────────────
    register(input: { email?: unknown; password?: unknown; role?: unknown }) {
      if (input.role !== 'donor' && input.role !== 'beneficiary') throw new HttpError(400, 'Escolha: quero ajudar ou preciso de ajuda.')
      const id = insertUser(String(input.email ?? ''), String(input.password ?? ''), input.role)
      audit(id, 'user.register', input.role)
      return { token: createSession(id) }
    },

    login(input: { email?: unknown; password?: unknown }) {
      const email = String(input.email ?? '').trim().toLowerCase()
      const password = String(input.password ?? '')
      const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Row | undefined
      const ok = verifyPassword(password, row ? str(row.pass_hash) : DUMMY_HASH) && Boolean(row)
      if (!ok || !row) throw new HttpError(401, 'Email ou palavra-passe errados.')
      audit(str(row.id), 'user.login')
      return { token: createSession(str(row.id)) }
    },

    authenticate(token: string | undefined): User | null {
      if (!token) return null
      const row = db
        .prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
        .get(sha256(token), now()) as Row | undefined
      return row ? userFromRow(row) : null
    },

    logout(token: string) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token))
    },

    me(user: User) {
      return { email: user.email, role: user.role, suspended: user.suspended, identityVerified: hasIdentity(user.id) }
    },

    /** Elimina a conta e os dados pessoais. Doações e pagamentos ficam (obrigação legal), sem ligação ao email. */
    deleteAccount(user: User) {
      requireRole(user, 'donor', 'beneficiary')
      tx(db, () => {
        const anon = `eliminado-${randomId()}@invalid`
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)
        db.prepare('DELETE FROM notes WHERE author_id = ?').run(user.id)
        db.prepare("UPDATE applications SET status = 'expired', iban_enc = NULL, description = NULL WHERE user_id = ?").run(user.id)
        for (const a of db.prepare('SELECT id FROM applications WHERE user_id = ?').all(user.id) as Row[]) purgeDocuments(str(a.id))
        db.prepare("UPDATE users SET email = ?, pass_hash = 'x', suspended = 1 WHERE id = ?").run(anon, user.id)
        audit(user.id, 'user.delete')
      })
    },

    async verifyIdentity(user: User, input: { legalName?: unknown; nif?: unknown; birthDate?: unknown }) {
      requireRole(user, 'donor', 'beneficiary')
      requireActive(user)
      if (hasIdentity(user.id)) throw new HttpError(409, 'A identidade já está verificada.')
      const legalName = requireText(input.legalName, 'Nome completo', 3, 200)
      const nif = String(input.nif ?? '').replace(/\s+/g, '')
      const birthDate = String(input.birthDate ?? '')
      const age = ageOn(birthDate, new Date(now()))
      if (age === null) throw new HttpError(400, 'Data de nascimento inválida.')
      if (age < 18) throw new HttpError(400, 'É preciso ter 18 anos ou mais.')
      const nifFp = crypto.fingerprint('nif', nif)
      if (db.prepare('SELECT 1 FROM identities WHERE nif_fp = ?').get(nifFp)) {
        audit(user.id, 'kyc.duplicate_nif')
        throw new HttpError(409, 'Este NIF já está associado a outra conta.')
      }
      const result = await kyc.verify({ legalName, nif, birthDate })
      if (!result.ok) {
        audit(user.id, 'kyc.failed', result.reason ?? null)
        throw new HttpError(422, `Não foi possível verificar a identidade: ${result.reason ?? 'dados não confirmados'}.`)
      }
      db.prepare(
        'INSERT INTO identities (user_id, legal_name_enc, nif_fp, birth_date_enc, provider_ref, verified_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(user.id, crypto.encrypt(legalName), nifFp, crypto.encrypt(birthDate), result.ref, now())
      audit(user.id, 'kyc.verified')
      return { identityVerified: true }
    },

    ensureAdmin(email: string, password: string) {
      if (db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) return false
      insertUser(email, password, 'admin')
      return true
    },

    createReviewer(admin: User, input: { email?: unknown; password?: unknown }) {
      requireRole(admin, 'admin')
      const id = insertUser(String(input.email ?? ''), String(input.password ?? ''), 'reviewer')
      audit(admin.id, 'reviewer.create', id)
      return { ok: true }
    },

    // ───────────── Doador ─────────────
    async donate(user: User, input: { amountCents?: unknown }) {
      requireRole(user, 'donor')
      requireActive(user)
      requireIdentity(user)
      const amount = requireInt(input.amountCents, 'Valor', config.minDonationCents, config.maxDonationCents)
      const id = randomId()
      const { ref } = await payments.chargeDonation({ amountCents: amount, idempotencyKey: id })
      db.prepare('INSERT INTO donations (id, donor_id, amount_cents, provider_ref, created_at) VALUES (?, ?, ?, ?, ?)').run(
        id,
        user.id,
        amount,
        ref,
        now(),
      )
      audit(user.id, 'donation.create', id)
      return { id, amountCents: amount }
    },

    listDonations(user: User) {
      requireRole(user, 'donor')
      return (
        db.prepare('SELECT id, amount_cents, created_at, cycle_id FROM donations WHERE donor_id = ? ORDER BY created_at DESC').all(user.id) as Row[]
      ).map((d) => ({ id: str(d.id), amountCents: num(d.amount_cents), createdAt: num(d.created_at), distributed: d.cycle_id !== null }))
    },

    // ───────────── Beneficiário ─────────────
    getApplication(user: User) {
      requireRole(user, 'beneficiary')
      expireOld()
      const a = latestApplication(user.id)
      if (!a) return null
      const iban = a.iban_enc ? crypto.decryptText(str(a.iban_enc)) : null
      return {
        status: str(a.status),
        householdAdults: numOrNull(a.household_adults),
        householdChildren: numOrNull(a.household_children),
        monthlyIncomeCents: numOrNull(a.monthly_income_cents),
        monthlyExpensesCents: numOrNull(a.monthly_expenses_cents),
        category: a.category ?? null,
        description: a.description ?? null,
        requestedCents: numOrNull(a.requested_cents),
        ibanLast4: iban ? iban.slice(-4) : null,
        decisionNote: a.status === 'rejected' || a.status === 'suspended' ? (a.decision_note ?? null) : null,
        validUntil: numOrNull(a.valid_until),
        documents: documentsOf(str(a.id)),
        maxMonthlyCents: config.maxMonthlyCents,
      }
    },

    saveApplication(user: User, input: Record<string, unknown>) {
      requireRole(user, 'beneficiary')
      requireActive(user)
      expireOld()
      let a = latestApplication(user.id)
      if (a && ['pending', 'approved', 'suspended'].includes(str(a.status))) {
        throw new HttpError(409, 'O pedido já foi enviado e não pode ser alterado.')
      }
      if (!a || str(a.status) !== 'draft') {
        const id = randomId()
        db.prepare("INSERT INTO applications (id, user_id, status, created_at) VALUES (?, ?, 'draft', ?)").run(id, user.id, now())
        a = { id }
      }
      const id = str(a.id)
      const set = (column: string, value: unknown) => db.prepare(`UPDATE applications SET ${column} = ? WHERE id = ?`).run(value as never, id)
      if (input.householdAdults !== undefined) set('household_adults', requireInt(input.householdAdults, 'Adultos', 1, 15))
      if (input.householdChildren !== undefined) set('household_children', requireInt(input.householdChildren, 'Crianças', 0, 15))
      if (input.monthlyIncomeCents !== undefined) set('monthly_income_cents', requireInt(input.monthlyIncomeCents, 'Rendimento', 0, 100_000_00))
      if (input.monthlyExpensesCents !== undefined) set('monthly_expenses_cents', requireInt(input.monthlyExpensesCents, 'Despesas', 0, 100_000_00))
      if (input.requestedCents !== undefined) set('requested_cents', requireInt(input.requestedCents, 'Valor pedido', 100, config.maxMonthlyCents))
      if (input.category !== undefined) {
        if (!CATEGORIES.includes(input.category as never)) throw new HttpError(400, 'Categoria inválida.')
        set('category', input.category)
      }
      if (input.description !== undefined) set('description', requireText(input.description, 'Descrição', 20, 2000))
      if (input.iban !== undefined) {
        const iban = normalizeIban(String(input.iban))
        if (!isValidIban(iban)) throw new HttpError(400, 'IBAN inválido.')
        set('iban_enc', crypto.encrypt(iban))
        set('iban_fp', crypto.fingerprint('iban', iban))
      }
      return this.getApplication(user)
    },

    addDocument(user: User, input: { kind?: unknown; filename?: unknown; mime?: unknown; dataBase64?: unknown }) {
      requireRole(user, 'beneficiary')
      requireActive(user)
      const a = latestApplication(user.id)
      if (!a || str(a.status) !== 'draft') throw new HttpError(409, 'Guarde primeiro os dados do pedido.')
      if (!DOCUMENT_KINDS.includes(input.kind as never)) throw new HttpError(400, 'Tipo de documento inválido.')
      if (!ALLOWED_MIME.includes(String(input.mime))) throw new HttpError(400, 'Só se aceitam PDF, JPEG ou PNG.')
      const filename = requireText(input.filename, 'Nome do ficheiro', 1, 200)
      const data = Buffer.from(String(input.dataBase64 ?? ''), 'base64')
      if (data.length === 0) throw new HttpError(400, 'Ficheiro vazio.')
      if (data.length > MAX_DOCUMENT_BYTES) throw new HttpError(413, 'Ficheiro maior que 5 MB.')
      const count = num((db.prepare('SELECT COUNT(*) AS n FROM documents WHERE application_id = ?').get(str(a.id)) as Row).n)
      if (count >= MAX_DOCUMENTS) throw new HttpError(400, `No máximo ${MAX_DOCUMENTS} documentos.`)
      const contentFp = crypto.fingerprint('doc', sha256(data))
      const id = randomId()
      db.prepare(
        'INSERT INTO documents (id, application_id, kind, filename, mime, size, content_fp, data_enc, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(id, str(a.id), String(input.kind), filename, String(input.mime), data.length, contentFp, crypto.encrypt(data), now())
      db.prepare('INSERT OR IGNORE INTO document_fingerprints (content_fp, user_id) VALUES (?, ?)').run(contentFp, user.id)
      return { id }
    },

    deleteDocument(user: User, documentId: string) {
      requireRole(user, 'beneficiary')
      const a = latestApplication(user.id)
      if (!a || str(a.status) !== 'draft') throw new HttpError(409, 'O pedido já foi enviado.')
      db.prepare('DELETE FROM documents WHERE id = ? AND application_id = ?').run(documentId, str(a.id))
      return { ok: true }
    },

    submitApplication(user: User) {
      requireRole(user, 'beneficiary')
      requireActive(user)
      requireIdentity(user)
      const a = latestApplication(user.id)
      if (!a || str(a.status) !== 'draft') throw new HttpError(409, 'Não há nenhum pedido por enviar.')
      const missing = (
        [
          ['household_adults', 'agregado familiar'],
          ['household_children', 'crianças'],
          ['monthly_income_cents', 'rendimento'],
          ['monthly_expenses_cents', 'despesas'],
          ['category', 'categoria'],
          ['description', 'descrição'],
          ['requested_cents', 'valor pedido'],
          ['iban_enc', 'IBAN'],
        ] as const
      ).filter(([col]) => a[col] === null || a[col] === undefined)
      if (missing.length) throw new HttpError(400, `Falta preencher: ${missing.map(([, label]) => label).join(', ')}.`)
      const kinds = new Set(documentsOf(str(a.id)).map((d) => d.kind))
      const missingDocs = REQUIRED_DOCUMENTS.filter((k) => !kinds.has(k))
      if (missingDocs.length) throw new HttpError(400, `Faltam documentos: ${missingDocs.join(', ')}.`)
      const ibanInUse = db
        .prepare("SELECT 1 FROM applications WHERE iban_fp = ? AND user_id != ? AND status IN ('pending','approved','suspended')")
        .get(str(a.iban_fp), user.id)
      if (ibanInUse) {
        audit(user.id, 'application.duplicate_iban', str(a.id))
        throw new HttpError(409, 'Este IBAN já está associado a outra conta.')
      }
      db.prepare("UPDATE applications SET status = 'pending', submitted_at = ? WHERE id = ?").run(now(), str(a.id))
      audit(user.id, 'application.submit', str(a.id))
      return this.getApplication(user)
    },

    listPayouts(user: User) {
      requireRole(user, 'beneficiary')
      return (
        db.prepare("SELECT amount_cents, status, created_at FROM payouts WHERE beneficiary_id = ? AND status != 'failed' ORDER BY created_at DESC").all(user.id) as Row[]
      ).map((p) => ({ amountCents: num(p.amount_cents), status: str(p.status), createdAt: num(p.created_at), from: 'Comunidade Mão Amiga' }))
    },

    submitNote(user: User, input: { text?: unknown }) {
      requireRole(user, 'beneficiary')
      requireActive(user)
      const received = db.prepare("SELECT 1 FROM payouts WHERE beneficiary_id = ? AND status = 'sent'").get(user.id)
      if (!received) throw new HttpError(403, 'Pode deixar uma mensagem depois de receber o primeiro apoio.')
      const text = requireText(input.text, 'Mensagem', 5, 500)
      db.prepare("INSERT INTO notes (id, author_id, text, status, created_at) VALUES (?, ?, ?, 'pending', ?)").run(randomId(), user.id, text, now())
      return { ok: true }
    },

    // ───────────── Revisão ─────────────
    reviewQueue(reviewer: User) {
      requireRole(reviewer, 'reviewer', 'admin')
      const rows = db
        .prepare(
          `SELECT a.id, a.category, a.household_adults, a.household_children, a.requested_cents, a.submitted_at,
             (SELECT COUNT(*) FROM reviews r WHERE r.application_id = a.id AND r.decision = 'approve') AS approvals,
             (SELECT decision FROM reviews r WHERE r.application_id = a.id AND r.reviewer_id = ?) AS my_vote
           FROM applications a WHERE a.status = 'pending' AND a.user_id != ? ORDER BY a.submitted_at`,
        )
        .all(reviewer.id, reviewer.id) as Row[]
      return rows.map((r) => ({
        id: str(r.id),
        alias: aliasOf(str(r.id)),
        category: str(r.category),
        householdAdults: num(r.household_adults),
        householdChildren: num(r.household_children),
        requestedCents: num(r.requested_cents),
        submittedAt: num(r.submitted_at),
        approvals: num(r.approvals),
        approvalsRequired: config.approvalsRequired,
        myVote: r.my_vote ?? null,
      }))
    },

    reviewDetail(reviewer: User, applicationId: string) {
      requireRole(reviewer, 'reviewer', 'admin')
      const a = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId) as Row | undefined
      if (!a || str(a.user_id) === reviewer.id) throw new HttpError(404, 'Pedido não encontrado.')
      const ident = db.prepare('SELECT * FROM identities WHERE user_id = ?').get(str(a.user_id)) as Row | undefined
      const adults = num(a.household_adults)
      const children = num(a.household_children)
      const income = num(a.monthly_income_cents)
      const equivalentIncome = Math.round(income / equivalentAdults(adults, children))
      const sharedDocs = num(
        (
          db
            .prepare(
              `SELECT COUNT(DISTINCT f.user_id) AS n FROM documents d JOIN document_fingerprints f ON f.content_fp = d.content_fp
               WHERE d.application_id = ? AND f.user_id != ?`,
            )
            .get(applicationId, str(a.user_id)) as Row
        ).n,
      )
      const previousRejections = num(
        (db.prepare("SELECT COUNT(*) AS n FROM applications WHERE user_id = ? AND status = 'rejected'").get(str(a.user_id)) as Row).n,
      )
      const iban = a.iban_enc ? crypto.decryptText(str(a.iban_enc)) : ''
      const myVote = db.prepare('SELECT decision FROM reviews WHERE application_id = ? AND reviewer_id = ?').get(applicationId, reviewer.id) as
        | Row
        | undefined
      audit(reviewer.id, 'review.view', applicationId)
      return {
        id: applicationId,
        alias: aliasOf(applicationId),
        status: str(a.status),
        legalName: ident ? crypto.decryptText(str(ident.legal_name_enc)) : null,
        age: ident ? ageOn(crypto.decryptText(str(ident.birth_date_enc)), new Date(now())) : null,
        householdAdults: adults,
        householdChildren: children,
        monthlyIncomeCents: income,
        monthlyExpensesCents: num(a.monthly_expenses_cents),
        category: str(a.category),
        description: str(a.description),
        requestedCents: num(a.requested_cents),
        ibanMasked: iban ? `${iban.slice(0, 4)} •••• ${iban.slice(-4)}` : null,
        documents: documentsOf(applicationId),
        myVote: myVote ? str(myVote.decision) : null,
        checks: {
          equivalentIncomeCents: equivalentIncome,
          povertyLineCents: config.povertyLineCents,
          belowPovertyLine: equivalentIncome < config.povertyLineCents,
          expensesExceedIncome: num(a.monthly_expenses_cents) > income,
          documentsSeenInOtherAccounts: sharedDocs,
          previousRejections,
        },
      }
    },

    getDocument(reviewer: User, documentId: string) {
      requireRole(reviewer, 'reviewer', 'admin')
      const d = db
        .prepare('SELECT d.*, a.user_id FROM documents d JOIN applications a ON a.id = d.application_id WHERE d.id = ?')
        .get(documentId) as Row | undefined
      if (!d || str(d.user_id) === reviewer.id) throw new HttpError(404, 'Documento não encontrado.')
      audit(reviewer.id, 'document.view', documentId)
      return { filename: str(d.filename), mime: str(d.mime), dataBase64: crypto.decrypt(str(d.data_enc)).toString('base64') }
    },

    vote(reviewer: User, applicationId: string, input: { decision?: unknown; note?: unknown }) {
      requireRole(reviewer, 'reviewer', 'admin')
      if (input.decision !== 'approve' && input.decision !== 'reject') throw new HttpError(400, 'Decisão inválida.')
      const decision = input.decision
      const note = requireText(input.note, 'Justificação', 5, 1000)
      return tx(db, () => {
        const a = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId) as Row | undefined
        if (!a || str(a.user_id) === reviewer.id) throw new HttpError(404, 'Pedido não encontrado.')
        if (str(a.status) !== 'pending') throw new HttpError(409, 'Este pedido já foi decidido.')
        if (db.prepare('SELECT 1 FROM reviews WHERE application_id = ? AND reviewer_id = ?').get(applicationId, reviewer.id)) {
          throw new HttpError(409, 'Já votou neste pedido.')
        }
        db.prepare('INSERT INTO reviews (application_id, reviewer_id, decision, note, created_at) VALUES (?, ?, ?, ?, ?)').run(
          applicationId,
          reviewer.id,
          decision,
          note,
          now(),
        )
        audit(reviewer.id, `review.${decision}`, applicationId)
        let status = 'pending'
        if (decision === 'reject') {
          status = 'rejected'
          db.prepare("UPDATE applications SET status = 'rejected', decision_note = ?, decided_at = ? WHERE id = ?").run(note, now(), applicationId)
          purgeDocuments(applicationId)
        } else {
          const approvals = num(
            (db.prepare("SELECT COUNT(*) AS n FROM reviews WHERE application_id = ? AND decision = 'approve'").get(applicationId) as Row).n,
          )
          if (approvals >= config.approvalsRequired) {
            status = 'approved'
            db.prepare("UPDATE applications SET status = 'approved', decided_at = ?, valid_until = ? WHERE id = ?").run(
              now(),
              now() + config.approvalValidDays * DAY,
              applicationId,
            )
            purgeDocuments(applicationId)
          }
        }
        return { status }
      })
    },

    suspend(reviewer: User, applicationId: string, input: { note?: unknown }) {
      requireRole(reviewer, 'reviewer', 'admin')
      const note = requireText(input.note, 'Motivo', 5, 1000)
      const r = db
        .prepare("UPDATE applications SET status = 'suspended', decision_note = ?, decided_at = ? WHERE id = ? AND status IN ('pending','approved') AND user_id != ?")
        .run(note, now(), applicationId, reviewer.id)
      if (r.changes === 0) throw new HttpError(404, 'Pedido não encontrado ou já fechado.')
      purgeDocuments(applicationId)
      audit(reviewer.id, 'application.suspend', applicationId)
      return { status: 'suspended' }
    },

    pendingNotes(reviewer: User) {
      requireRole(reviewer, 'reviewer', 'admin')
      return (db.prepare("SELECT id, text, created_at FROM notes WHERE status = 'pending' ORDER BY created_at").all() as Row[]).map((n) => ({
        id: str(n.id),
        text: str(n.text),
        createdAt: num(n.created_at),
      }))
    },

    moderateNote(reviewer: User, noteId: string, input: { decision?: unknown }) {
      requireRole(reviewer, 'reviewer', 'admin')
      const status = input.decision === 'approve' ? 'approved' : input.decision === 'reject' ? 'rejected' : null
      if (!status) throw new HttpError(400, 'Decisão inválida.')
      db.prepare("UPDATE notes SET status = ? WHERE id = ? AND status = 'pending'").run(status, noteId)
      audit(reviewer.id, `note.${status}`, noteId)
      return { ok: true }
    },

    // ───────────── Administração ─────────────
    /**
     * Ciclo de distribuição (por exemplo, uma vez por mês). Junta todas as doações ainda não
     * contadas e divide o saldo do fundo por quem está aprovado. Só corre com pelo menos
     * MIN_DONORS_PER_CYCLE doadores diferentes, para que ninguém consiga deduzir quem doou
     * comparando datas e valores.
     */
    async runCycle(admin: User) {
      requireRole(admin, 'admin')
      expireOld()
      const donorCount = num(
        (db.prepare('SELECT COUNT(DISTINCT donor_id) AS n FROM donations WHERE cycle_id IS NULL').get() as Row).n,
      )
      if (donorCount < config.minDonorsPerCycle) {
        throw new HttpError(
          409,
          `Ainda só há ${donorCount} doador(es) novos neste ciclo; são precisos ${config.minDonorsPerCycle} para proteger o anonimato.`,
        )
      }
      const donated = num((db.prepare('SELECT COALESCE(SUM(amount_cents), 0) AS s FROM donations').get() as Row).s)
      const paid = num((db.prepare("SELECT COALESCE(SUM(amount_cents), 0) AS s FROM payouts WHERE status != 'failed'").get() as Row).s)
      const pool = donated - paid
      const approved = db
        .prepare(
          `SELECT a.user_id, a.requested_cents, a.iban_enc, i.legal_name_enc FROM applications a
           JOIN users u ON u.id = a.user_id JOIN identities i ON i.user_id = a.user_id
           WHERE a.status = 'approved' AND u.suspended = 0`,
        )
        .all() as Row[]
      const result = allocate(
        pool,
        approved.map((a) => ({ id: str(a.user_id), requestedCents: num(a.requested_cents) })),
        config.maxMonthlyCents,
      )
      const cycleId = randomId()
      const payoutIds = new Map<string, string>()
      tx(db, () => {
        db.prepare(
          'INSERT INTO cycles (id, run_at, pool_cents, distributed_cents, donor_count, beneficiary_count) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(cycleId, now(), pool, result.distributedCents, donorCount, result.payouts.size)
        db.prepare('UPDATE donations SET cycle_id = ? WHERE cycle_id IS NULL').run(cycleId)
        for (const [userId, amount] of result.payouts) {
          const id = randomId()
          payoutIds.set(userId, id)
          db.prepare("INSERT INTO payouts (id, cycle_id, beneficiary_id, amount_cents, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)").run(
            id,
            cycleId,
            userId,
            amount,
            now(),
          )
        }
      })
      let failed = 0
      for (const a of approved) {
        const userId = str(a.user_id)
        const payoutId = payoutIds.get(userId)
        if (!payoutId) continue
        try {
          const { ref } = await payments.payout({
            iban: crypto.decryptText(str(a.iban_enc)),
            holderName: crypto.decryptText(str(a.legal_name_enc)),
            amountCents: result.payouts.get(userId)!,
            reference: 'Mao Amiga - apoio comunitario',
          })
          db.prepare("UPDATE payouts SET status = 'sent', provider_ref = ? WHERE id = ?").run(ref, payoutId)
        } catch {
          failed++
          db.prepare("UPDATE payouts SET status = 'failed' WHERE id = ?").run(payoutId)
        }
      }
      audit(admin.id, 'cycle.run', cycleId)
      return {
        id: cycleId,
        poolCents: pool,
        distributedCents: result.distributedCents,
        carryOverCents: result.carryOverCents,
        beneficiaryCount: result.payouts.size,
        donorCount,
        failed,
      }
    },

    listCycles(admin: User) {
      requireRole(admin, 'admin')
      return (db.prepare('SELECT * FROM cycles ORDER BY run_at DESC').all() as Row[]).map((c) => ({
        id: str(c.id),
        runAt: num(c.run_at),
        poolCents: num(c.pool_cents),
        distributedCents: num(c.distributed_cents),
        donorCount: num(c.donor_count),
        beneficiaryCount: num(c.beneficiary_count),
      }))
    },

    // ───────────── Público ─────────────
    stats() {
      const donors = num((db.prepare('SELECT COUNT(DISTINCT donor_id) AS n FROM donations').get() as Row).n)
      const helped = num((db.prepare("SELECT COUNT(DISTINCT beneficiary_id) AS n FROM payouts WHERE status = 'sent'").get() as Row).n)
      const donated = num((db.prepare('SELECT COALESCE(SUM(amount_cents), 0) AS s FROM donations').get() as Row).s)
      const distributed = num((db.prepare("SELECT COALESCE(SUM(amount_cents), 0) AS s FROM payouts WHERE status = 'sent'").get() as Row).s)
      const cycles = num((db.prepare('SELECT COUNT(*) AS n FROM cycles').get() as Row).n)
      const enoughDonors = donors >= STATS_MIN_GROUP
      const enoughHelped = helped >= STATS_MIN_GROUP
      return {
        donors: enoughDonors ? donors : null,
        donatedCents: enoughDonors ? donated : null,
        peopleHelped: enoughHelped ? helped : null,
        distributedCents: enoughHelped ? distributed : null,
        cycles,
        minGroup: STATS_MIN_GROUP,
      }
    },

    approvedNotes() {
      return (db.prepare("SELECT text, created_at FROM notes WHERE status = 'approved' ORDER BY created_at DESC LIMIT 50").all() as Row[]).map(
        (n) => ({ text: str(n.text), createdAt: num(n.created_at) }),
      )
    },
  }
}

export type Service = ReturnType<typeof createService>
