/**
 * Regras da plataforma. As rotas HTTP (http.ts) só traduzem pedidos para estas funções.
 *
 * Quem vê o quê:
 *  - Doador: as suas doações e estatísticas globais. Nunca vê beneficiários.
 *  - Beneficiário: o seu pedido e os apoios recebidos ("da comunidade"). Nunca vê doadores.
 *  - Revisor: pedidos dos países que lhe foram atribuídos, com registo de cada consulta. Nunca vê doadores.
 *  - Administração: ciclos de distribuição e revisores. Os registos de doações existem porque a lei
 *    obriga (fiscal e branqueamento de capitais), mas não estão ligados a pagamentos.
 *
 * Dinheiro: o fundo comum está numa moeda base (BASE_CURRENCY). Os pedidos são feitos na moeda
 * do país de quem pede; as doações podem ser em qualquer moeda suportada.
 */
import { allocate } from './allocation.ts'
import type { Config } from './config.ts'
import { convertMinor, toMinor, type CountryRule } from './countries.ts'
import { hashPassword, randomId, randomToken, sha256, verifyPassword, type Crypto } from './crypto.ts'
import { tx, type Db } from './db.ts'
import type { Params } from './messages.ts'
import type { KycProvider, PaymentProvider } from './providers.ts'
import {
  ageOn,
  isValidEmail,
  maskPayout,
  normalizeNationalId,
  normalizePayout,
  payoutIdentity,
  type PayoutMethod,
} from './validation.ts'

/** Erro com código traduzível (ver messages.ts). */
export class HttpError extends Error {
  status: number
  code: string
  params: Params
  constructor(status: number, code: string, params: Params = {}) {
    super(code)
    this.status = status
    this.code = code
    this.params = params
  }
}

export type Role = 'donor' | 'beneficiary' | 'reviewer' | 'admin'

export interface User {
  id: string
  email: string
  role: Role
  suspended: boolean
  reviewCountries: string[]
}

export interface Deps {
  db: Db
  crypto: Crypto
  config: Config
  payments: PaymentProvider
  kyc: KycProvider
  now?: () => number
}

export const CATEGORIES = ['food', 'housing', 'health', 'education', 'utilities', 'transport', 'other'] as const
export const DOCUMENT_KINDS = ['income_proof', 'address_proof', 'expenses', 'other'] as const
const REQUIRED_DOCUMENTS = ['income_proof', 'address_proof'] as const
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024
const MAX_DOCUMENTS = 10
const SESSION_DAYS = 30
/** Abaixo deste número, as estatísticas públicas não mostram contagens nem valores (evita identificar pessoas). */
const STATS_MIN_GROUP = 5
const DAY = 24 * 60 * 60 * 1000
const MAX_LOCAL_AMOUNT = 1e12

type Row = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'bigint' ? Number(v) : 0)
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : num(v))

/** Pseudónimo curto e estável para um pedido (os revisores não precisam do id interno). */
export const aliasOf = (id: string) => 'P-' + sha256(id).slice(0, 6).toUpperCase()

/** Escala de equivalência da OCDE modificada (usada pelo Eurostat e por muitos institutos de estatística). */
export const equivalentAdults = (adults: number, children: number) => 1 + 0.5 * Math.max(0, adults - 1) + 0.3 * children

function requireInt(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new HttpError(400, 'invalid_value', { field })
  return v
}

function requireText(v: unknown, field: string, min: number, max: number): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (s.length < min || s.length > max) throw new HttpError(400, 'text_length', { field, min, max })
  return s
}

export function createService(deps: Deps) {
  const { db, crypto, config, payments, kyc } = deps
  const now = deps.now ?? (() => Date.now())
  const base = config.baseCurrency
  const fx = config.catalog.fxPerBase
  const countries = new Map(config.catalog.countries.map((c) => [c.code, c]))

  const audit = (actorId: string | null, action: string, target: string | null = null) => {
    db.prepare('INSERT INTO audit (actor_id, action, target, created_at) VALUES (?, ?, ?, ?)').run(actorId, action, target, now())
  }

  const userFromRow = (r: Row): User => ({
    id: str(r.id),
    email: str(r.email),
    role: str(r.role) as Role,
    suspended: num(r.suspended) === 1,
    reviewCountries: str(r.review_countries).split(',').filter(Boolean),
  })

  const requireRole = (user: User, ...roles: Role[]) => {
    if (!roles.includes(user.role)) throw new HttpError(403, 'forbidden')
  }
  const requireActive = (user: User) => {
    if (user.suspended) throw new HttpError(403, 'suspended')
  }
  const identityOf = (userId: string) => db.prepare('SELECT * FROM identities WHERE user_id = ?').get(userId) as Row | undefined
  const requireIdentity = (user: User) => {
    const ident = identityOf(user.id)
    if (!ident) throw new HttpError(403, 'identity_required')
    return ident
  }
  const countryRule = (code: string): CountryRule => {
    const rule = countries.get(code)
    if (!rule) throw new HttpError(400, 'country_unavailable')
    return rule
  }
  /** O revisor só vê pedidos dos países que lhe foram atribuídos (lista vazia = todos). */
  const canReviewCountry = (reviewer: User, country: string) =>
    reviewer.role === 'admin' || reviewer.reviewCountries.length === 0 || reviewer.reviewCountries.includes(country)

  function createSession(userId: string) {
    const token = randomToken()
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, now() + SESSION_DAYS * DAY)
    return token
  }

  function insertUser(email: string, password: string, role: Role, reviewCountries: string[] = []) {
    const normalized = email.trim().toLowerCase()
    if (!isValidEmail(normalized)) throw new HttpError(400, 'email_invalid')
    if (typeof password !== 'string' || password.length < 10 || password.length > 200) throw new HttpError(400, 'password_short')
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(normalized)) throw new HttpError(409, 'email_taken')
    const id = randomId()
    db.prepare('INSERT INTO users (id, email, pass_hash, role, review_countries, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      id,
      normalized,
      hashPassword(password),
      role,
      reviewCountries.join(','),
      now(),
    )
    return id
  }

  const DUMMY_HASH = hashPassword('nunca-usada-' + randomToken())

  const latestApplication = (userId: string) =>
    db.prepare('SELECT * FROM applications WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(userId) as Row | undefined

  function documentsOf(applicationId: string) {
    return (
      db.prepare('SELECT id, kind, filename, mime, size FROM documents WHERE application_id = ? ORDER BY created_at').all(applicationId) as Row[]
    ).map((d) => ({ id: str(d.id), kind: str(d.kind), filename: str(d.filename), mime: str(d.mime), size: num(d.size) }))
  }

  const payoutOf = (a: Row): PayoutMethod | null => (a.payout_enc ? (JSON.parse(crypto.decryptText(str(a.payout_enc))) as PayoutMethod) : null)

  /** Apaga os documentos de prova assim que deixam de ser necessários (minimização de dados). */
  const purgeDocuments = (applicationId: string) => db.prepare('DELETE FROM documents WHERE application_id = ?').run(applicationId)

  const expireOld = () => db.prepare("UPDATE applications SET status = 'expired' WHERE status = 'approved' AND valid_until < ?").run(now())

  const publicCountry = (c: CountryRule) => ({
    code: c.code,
    currency: c.currency,
    idType: c.idType,
    payoutMethods: c.payoutMethods,
    maxMonthlyMinor: toMinor(c.maxMonthly, c.currency),
    ageOfMajority: c.ageOfMajority,
  })

  return {
    // ───────────── Público ─────────────
    /** Países abertos e moedas aceites para doar. */
    catalog() {
      // Valores sugeridos em cada moeda: 10, 25, 50 e 100 da moeda base, arredondados a 2 algarismos.
      const nice = (minor: number) => {
        const p = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(minor, 1))) - 1)
        return Math.round(minor / p) * p
      }
      const presets = Object.fromEntries(
        Object.keys(fx).map((cur) => [cur, [1000, 2500, 5000, 10000].map((m) => nice(convertMinor(m, base, cur, fx)))]),
      )
      return {
        baseCurrency: base,
        donationCurrencies: Object.keys(fx).sort(),
        donationPresets: presets,
        minDonationMinor: config.minDonationCents,
        maxDonationMinor: config.maxDonationCents,
        countries: config.catalog.countries.map(publicCountry),
      }
    },

    stats() {
      const donors = num((db.prepare('SELECT COUNT(DISTINCT donor_id) AS n FROM donations').get() as Row).n)
      const helped = num((db.prepare("SELECT COUNT(DISTINCT beneficiary_id) AS n FROM payouts WHERE status = 'sent'").get() as Row).n)
      const donated = num((db.prepare('SELECT COALESCE(SUM(amount_cents), 0) AS s FROM donations').get() as Row).s)
      const distributed = num((db.prepare("SELECT COALESCE(SUM(amount_cents), 0) AS s FROM payouts WHERE status = 'sent'").get() as Row).s)
      const countriesHelped = num((db.prepare("SELECT COUNT(DISTINCT local_currency) AS n FROM payouts WHERE status = 'sent'").get() as Row).n)
      const cycles = num((db.prepare('SELECT COUNT(*) AS n FROM cycles').get() as Row).n)
      const enoughDonors = donors >= STATS_MIN_GROUP
      const enoughHelped = helped >= STATS_MIN_GROUP
      return {
        currency: base,
        donors: enoughDonors ? donors : null,
        donatedMinor: enoughDonors ? donated : null,
        peopleHelped: enoughHelped ? helped : null,
        distributedMinor: enoughHelped ? distributed : null,
        currenciesPaid: enoughHelped ? countriesHelped : null,
        cycles,
        minGroup: STATS_MIN_GROUP,
      }
    },

    approvedNotes() {
      return (db.prepare("SELECT text, created_at FROM notes WHERE status = 'approved' ORDER BY created_at DESC LIMIT 50").all() as Row[]).map((n) => ({
        text: str(n.text),
        createdAt: num(n.created_at),
      }))
    },

    // ───────────── Contas ─────────────
    register(input: { email?: unknown; password?: unknown; role?: unknown }) {
      if (input.role !== 'donor' && input.role !== 'beneficiary') throw new HttpError(400, 'role_required')
      const id = insertUser(String(input.email ?? ''), String(input.password ?? ''), input.role)
      audit(id, 'user.register', input.role)
      return { token: createSession(id) }
    },

    login(input: { email?: unknown; password?: unknown }) {
      const email = String(input.email ?? '').trim().toLowerCase()
      const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Row | undefined
      const ok = verifyPassword(String(input.password ?? ''), row ? str(row.pass_hash) : DUMMY_HASH) && Boolean(row)
      if (!ok || !row) throw new HttpError(401, 'login_failed')
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
      const ident = identityOf(user.id)
      return {
        email: user.email,
        role: user.role,
        suspended: user.suspended,
        identityVerified: Boolean(ident),
        country: ident ? str(ident.country) : null,
        reviewCountries: user.reviewCountries,
      }
    },

    /** Elimina a conta e os dados pessoais. Doações e pagamentos ficam (obrigação legal), sem ligação ao email. */
    deleteAccount(user: User) {
      requireRole(user, 'donor', 'beneficiary')
      tx(db, () => {
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)
        db.prepare('DELETE FROM notes WHERE author_id = ?').run(user.id)
        for (const a of db.prepare('SELECT id FROM applications WHERE user_id = ?').all(user.id) as Row[]) purgeDocuments(str(a.id))
        db.prepare("UPDATE applications SET status = 'expired', payout_enc = NULL, description = NULL WHERE user_id = ?").run(user.id)
        db.prepare("UPDATE users SET email = ?, pass_hash = 'x', suspended = 1 WHERE id = ?").run(`deleted-${randomId()}@invalid`, user.id)
        audit(user.id, 'user.delete')
      })
    },

    async verifyIdentity(user: User, input: { legalName?: unknown; country?: unknown; nationalId?: unknown; birthDate?: unknown }) {
      requireRole(user, 'donor', 'beneficiary')
      requireActive(user)
      if (identityOf(user.id)) throw new HttpError(409, 'identity_already')
      const legalName = requireText(input.legalName, 'legal_name', 3, 200)
      const rule = countryRule(String(input.country ?? '').toUpperCase())
      const nationalId = normalizeNationalId(rule.idType, String(input.nationalId ?? ''))
      if (!nationalId) throw new HttpError(400, 'id_invalid')
      const birthDate = String(input.birthDate ?? '')
      const age = ageOn(birthDate, new Date(now()))
      if (age === null || age > 120) throw new HttpError(400, 'birthdate_invalid')
      if (age < rule.ageOfMajority) throw new HttpError(400, 'underage', { age: rule.ageOfMajority })
      const idFp = crypto.fingerprint('id', `${rule.code}:${rule.idType}:${nationalId}`)
      if (db.prepare('SELECT 1 FROM identities WHERE id_fp = ?').get(idFp)) {
        audit(user.id, 'kyc.duplicate_id')
        throw new HttpError(409, 'id_duplicate')
      }
      const result = await kyc.verify({ legalName, country: rule.code, idType: rule.idType, nationalId, birthDate })
      if (!result.ok) {
        audit(user.id, 'kyc.failed', result.reason ?? null)
        throw new HttpError(422, 'kyc_failed', { reason: result.reason ?? '-' })
      }
      db.prepare(
        'INSERT INTO identities (user_id, country, legal_name_enc, id_fp, birth_date_enc, provider_ref, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(user.id, rule.code, crypto.encrypt(legalName), idFp, crypto.encrypt(birthDate), result.ref, now())
      audit(user.id, 'kyc.verified', rule.code)
      return { identityVerified: true }
    },

    ensureAdmin(email: string, password: string) {
      if (db.prepare("SELECT 1 FROM users WHERE role = 'admin'").get()) return false
      insertUser(email, password, 'admin')
      return true
    },

    createReviewer(admin: User, input: { email?: unknown; password?: unknown; countries?: unknown }) {
      requireRole(admin, 'admin')
      const list = Array.isArray(input.countries) ? input.countries.map((c) => String(c).toUpperCase()) : []
      for (const c of list) countryRule(c)
      const id = insertUser(String(input.email ?? ''), String(input.password ?? ''), 'reviewer', list)
      audit(admin.id, 'reviewer.create', id)
      return { ok: true }
    },

    // ───────────── Doador ─────────────
    async donate(user: User, input: { amountMinor?: unknown; currency?: unknown }) {
      requireRole(user, 'donor')
      requireActive(user)
      requireIdentity(user)
      const currency = String(input.currency ?? base).toUpperCase()
      if (!fx[currency]) throw new HttpError(400, 'currency_unsupported')
      const amount = requireInt(input.amountMinor, 'amount', 1, MAX_LOCAL_AMOUNT)
      const inBase = convertMinor(amount, currency, base, fx)
      if (inBase < config.minDonationCents || inBase > config.maxDonationCents) {
        throw new HttpError(400, 'donation_range', { min: `${config.minDonationCents / 100} ${base}`, max: `${config.maxDonationCents / 100} ${base}` })
      }
      const id = randomId()
      const { ref } = await payments.chargeDonation({ amountMinor: amount, currency, idempotencyKey: id })
      db.prepare(
        'INSERT INTO donations (id, donor_id, amount_cents, original_currency, original_amount, provider_ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(id, user.id, inBase, currency, amount, ref, now())
      audit(user.id, 'donation.create', id)
      return { id, amountMinor: amount, currency, baseAmountMinor: inBase, baseCurrency: base }
    },

    listDonations(user: User) {
      requireRole(user, 'donor')
      return (
        db
          .prepare('SELECT id, amount_cents, original_currency, original_amount, created_at, cycle_id FROM donations WHERE donor_id = ? ORDER BY created_at DESC')
          .all(user.id) as Row[]
      ).map((d) => ({
        id: str(d.id),
        amountMinor: num(d.original_amount),
        currency: str(d.original_currency),
        baseAmountMinor: num(d.amount_cents),
        baseCurrency: base,
        createdAt: num(d.created_at),
        distributed: d.cycle_id !== null,
      }))
    },

    // ───────────── Beneficiário ─────────────
    getApplication(user: User) {
      requireRole(user, 'beneficiary')
      expireOld()
      const ident = identityOf(user.id)
      const rule = ident ? countries.get(str(ident.country)) : undefined
      const a = latestApplication(user.id)
      const country = rule ? publicCountry(rule) : null
      if (!a) return { application: null, country }
      const payout = payoutOf(a)
      return {
        country,
        application: {
          status: str(a.status),
          currency: str(a.currency),
          householdAdults: numOrNull(a.household_adults),
          householdChildren: numOrNull(a.household_children),
          monthlyIncomeMinor: numOrNull(a.monthly_income_cents),
          monthlyExpensesMinor: numOrNull(a.monthly_expenses_cents),
          category: a.category ?? null,
          description: a.description ?? null,
          requestedMinor: numOrNull(a.requested_cents),
          payoutType: payout?.type ?? null,
          payoutMasked: payout ? maskPayout(payout) : null,
          decisionNote: a.status === 'rejected' || a.status === 'suspended' ? (a.decision_note ?? null) : null,
          validUntil: numOrNull(a.valid_until),
          documents: documentsOf(str(a.id)),
        },
      }
    },

    saveApplication(user: User, input: Record<string, unknown>) {
      requireRole(user, 'beneficiary')
      requireActive(user)
      const ident = requireIdentity(user)
      const rule = countryRule(str(ident.country))
      expireOld()
      let a = latestApplication(user.id)
      if (a && ['pending', 'approved', 'suspended'].includes(str(a.status))) throw new HttpError(409, 'application_locked')
      if (!a || str(a.status) !== 'draft') {
        const id = randomId()
        db.prepare("INSERT INTO applications (id, user_id, status, country, currency, created_at) VALUES (?, ?, 'draft', ?, ?, ?)").run(
          id,
          user.id,
          rule.code,
          rule.currency,
          now(),
        )
        a = { id }
      }
      const id = str(a.id)
      const set = (column: string, value: string | number) => db.prepare(`UPDATE applications SET ${column} = ? WHERE id = ?`).run(value, id)
      if (input.householdAdults !== undefined) set('household_adults', requireInt(input.householdAdults, 'adults', 1, 15))
      if (input.householdChildren !== undefined) set('household_children', requireInt(input.householdChildren, 'children', 0, 15))
      if (input.monthlyIncomeMinor !== undefined) set('monthly_income_cents', requireInt(input.monthlyIncomeMinor, 'income', 0, MAX_LOCAL_AMOUNT))
      if (input.monthlyExpensesMinor !== undefined) set('monthly_expenses_cents', requireInt(input.monthlyExpensesMinor, 'expenses', 0, MAX_LOCAL_AMOUNT))
      if (input.requestedMinor !== undefined) {
        set('requested_cents', requireInt(input.requestedMinor, 'requested', 1, toMinor(rule.maxMonthly, rule.currency)))
      }
      if (input.category !== undefined) {
        if (!CATEGORIES.includes(input.category as never)) throw new HttpError(400, 'category_invalid')
        set('category', String(input.category))
      }
      if (input.description !== undefined) set('description', requireText(input.description, 'description', 20, 2000))
      if (input.payout !== undefined) {
        const method = normalizePayout(input.payout)
        if (!method) throw new HttpError(400, 'payout_invalid')
        if (!rule.payoutMethods.includes(method.type)) throw new HttpError(400, 'payout_not_allowed')
        set('payout_type', method.type)
        set('payout_enc', crypto.encrypt(JSON.stringify(method)))
        set('payout_fp', crypto.fingerprint('payout', payoutIdentity(method)))
      }
      return this.getApplication(user)
    },

    addDocument(user: User, input: { kind?: unknown; filename?: unknown; mime?: unknown; dataBase64?: unknown }) {
      requireRole(user, 'beneficiary')
      requireActive(user)
      const a = latestApplication(user.id)
      if (!a || str(a.status) !== 'draft') throw new HttpError(409, 'save_first')
      if (!DOCUMENT_KINDS.includes(input.kind as never)) throw new HttpError(400, 'doc_kind_invalid')
      if (!ALLOWED_MIME.includes(String(input.mime))) throw new HttpError(400, 'doc_mime_invalid')
      const filename = requireText(input.filename, 'filename', 1, 200)
      const data = Buffer.from(String(input.dataBase64 ?? ''), 'base64')
      if (data.length === 0) throw new HttpError(400, 'doc_empty')
      if (data.length > MAX_DOCUMENT_BYTES) throw new HttpError(413, 'doc_too_big')
      const count = num((db.prepare('SELECT COUNT(*) AS n FROM documents WHERE application_id = ?').get(str(a.id)) as Row).n)
      if (count >= MAX_DOCUMENTS) throw new HttpError(400, 'doc_too_many', { max: MAX_DOCUMENTS })
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
      if (!a || str(a.status) !== 'draft') throw new HttpError(409, 'application_locked')
      db.prepare('DELETE FROM documents WHERE id = ? AND application_id = ?').run(documentId, str(a.id))
      return { ok: true }
    },

    submitApplication(user: User) {
      requireRole(user, 'beneficiary')
      requireActive(user)
      requireIdentity(user)
      const a = latestApplication(user.id)
      if (!a || str(a.status) !== 'draft') throw new HttpError(409, 'nothing_to_submit')
      const missing = (
        [
          ['household_adults', 'adults'],
          ['household_children', 'children'],
          ['monthly_income_cents', 'income'],
          ['monthly_expenses_cents', 'expenses'],
          ['category', 'category'],
          ['description', 'description'],
          ['requested_cents', 'requested'],
          ['payout_enc', 'payout'],
        ] as const
      )
        .filter(([col]) => a[col] === null || a[col] === undefined)
        .map(([, field]) => field)
      if (missing.length) throw new HttpError(400, 'missing_fields', { fields: missing })
      const kinds = new Set(documentsOf(str(a.id)).map((d) => d.kind))
      const missingDocs = REQUIRED_DOCUMENTS.filter((k) => !kinds.has(k))
      if (missingDocs.length) throw new HttpError(400, 'missing_documents', { docs: [...missingDocs] })
      const payoutInUse = db
        .prepare("SELECT 1 FROM applications WHERE payout_fp = ? AND user_id != ? AND status IN ('pending','approved','suspended')")
        .get(str(a.payout_fp), user.id)
      if (payoutInUse) {
        audit(user.id, 'application.duplicate_payout', str(a.id))
        throw new HttpError(409, 'payout_duplicate')
      }
      db.prepare("UPDATE applications SET status = 'pending', submitted_at = ? WHERE id = ?").run(now(), str(a.id))
      audit(user.id, 'application.submit', str(a.id))
      return this.getApplication(user)
    },

    listPayouts(user: User) {
      requireRole(user, 'beneficiary')
      return (
        db
          .prepare("SELECT amount_cents, local_currency, local_amount, status, created_at FROM payouts WHERE beneficiary_id = ? AND status != 'failed' ORDER BY created_at DESC")
          .all(user.id) as Row[]
      ).map((p) => ({
        baseAmountMinor: num(p.amount_cents),
        baseCurrency: base,
        localAmountMinor: num(p.local_amount),
        localCurrency: str(p.local_currency),
        status: str(p.status),
        createdAt: num(p.created_at),
      }))
    },

    submitNote(user: User, input: { text?: unknown }) {
      requireRole(user, 'beneficiary')
      requireActive(user)
      if (!db.prepare("SELECT 1 FROM payouts WHERE beneficiary_id = ? AND status = 'sent'").get(user.id)) throw new HttpError(403, 'thanks_after_payout')
      const text = requireText(input.text, 'message', 5, 500)
      db.prepare("INSERT INTO notes (id, author_id, text, status, created_at) VALUES (?, ?, ?, 'pending', ?)").run(randomId(), user.id, text, now())
      return { ok: true }
    },

    // ───────────── Revisão ─────────────
    reviewQueue(reviewer: User) {
      requireRole(reviewer, 'reviewer', 'admin')
      const rows = db
        .prepare(
          `SELECT a.id, a.country, a.currency, a.category, a.household_adults, a.household_children, a.requested_cents, a.submitted_at,
             (SELECT COUNT(*) FROM reviews r WHERE r.application_id = a.id AND r.decision = 'approve') AS approvals,
             (SELECT decision FROM reviews r WHERE r.application_id = a.id AND r.reviewer_id = ?) AS my_vote
           FROM applications a WHERE a.status = 'pending' AND a.user_id != ? ORDER BY a.submitted_at`,
        )
        .all(reviewer.id, reviewer.id) as Row[]
      return rows
        .filter((r) => canReviewCountry(reviewer, str(r.country)))
        .map((r) => ({
          id: str(r.id),
          alias: aliasOf(str(r.id)),
          country: str(r.country),
          currency: str(r.currency),
          category: str(r.category),
          householdAdults: num(r.household_adults),
          householdChildren: num(r.household_children),
          requestedMinor: num(r.requested_cents),
          submittedAt: num(r.submitted_at),
          approvals: num(r.approvals),
          approvalsRequired: config.approvalsRequired,
          myVote: r.my_vote ?? null,
        }))
    },

    reviewDetail(reviewer: User, applicationId: string) {
      requireRole(reviewer, 'reviewer', 'admin')
      const a = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId) as Row | undefined
      if (!a || str(a.user_id) === reviewer.id || !canReviewCountry(reviewer, str(a.country))) throw new HttpError(404, 'not_found')
      const ident = identityOf(str(a.user_id))
      const rule = countries.get(str(a.country))
      const adults = num(a.household_adults)
      const children = num(a.household_children)
      const income = num(a.monthly_income_cents)
      const equivalentIncome = Math.round(income / equivalentAdults(adults, children))
      const povertyLine = rule ? toMinor(rule.povertyLineMonthly, rule.currency) : 0
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
      const payout = payoutOf(a)
      const myVote = db.prepare('SELECT decision FROM reviews WHERE application_id = ? AND reviewer_id = ?').get(applicationId, reviewer.id) as Row | undefined
      audit(reviewer.id, 'review.view', applicationId)
      return {
        id: applicationId,
        alias: aliasOf(applicationId),
        status: str(a.status),
        country: str(a.country),
        currency: str(a.currency),
        legalName: ident ? crypto.decryptText(str(ident.legal_name_enc)) : null,
        age: ident ? ageOn(crypto.decryptText(str(ident.birth_date_enc)), new Date(now())) : null,
        householdAdults: adults,
        householdChildren: children,
        monthlyIncomeMinor: income,
        monthlyExpensesMinor: num(a.monthly_expenses_cents),
        category: str(a.category),
        description: str(a.description),
        requestedMinor: num(a.requested_cents),
        payoutType: payout?.type ?? null,
        payoutMasked: payout ? maskPayout(payout) : null,
        documents: documentsOf(applicationId),
        myVote: myVote ? str(myVote.decision) : null,
        checks: {
          equivalentIncomeMinor: equivalentIncome,
          povertyLineMinor: povertyLine,
          povertyLineIsExample: rule?.example ?? true,
          belowPovertyLine: equivalentIncome < povertyLine,
          expensesExceedIncome: num(a.monthly_expenses_cents) > income,
          documentsSeenInOtherAccounts: sharedDocs,
          previousRejections,
        },
      }
    },

    getDocument(reviewer: User, documentId: string) {
      requireRole(reviewer, 'reviewer', 'admin')
      const d = db
        .prepare('SELECT d.*, a.user_id, a.country FROM documents d JOIN applications a ON a.id = d.application_id WHERE d.id = ?')
        .get(documentId) as Row | undefined
      if (!d || str(d.user_id) === reviewer.id || !canReviewCountry(reviewer, str(d.country))) throw new HttpError(404, 'not_found')
      audit(reviewer.id, 'document.view', documentId)
      return { filename: str(d.filename), mime: str(d.mime), dataBase64: crypto.decrypt(str(d.data_enc)).toString('base64') }
    },

    vote(reviewer: User, applicationId: string, input: { decision?: unknown; note?: unknown }) {
      requireRole(reviewer, 'reviewer', 'admin')
      if (input.decision !== 'approve' && input.decision !== 'reject') throw new HttpError(400, 'decision_invalid')
      const decision = input.decision
      const note = requireText(input.note, 'note', 5, 1000)
      return tx(db, () => {
        const a = db.prepare('SELECT * FROM applications WHERE id = ?').get(applicationId) as Row | undefined
        if (!a || str(a.user_id) === reviewer.id || !canReviewCountry(reviewer, str(a.country))) throw new HttpError(404, 'not_found')
        if (str(a.status) !== 'pending') throw new HttpError(409, 'already_decided')
        if (db.prepare('SELECT 1 FROM reviews WHERE application_id = ? AND reviewer_id = ?').get(applicationId, reviewer.id)) {
          throw new HttpError(409, 'already_voted')
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
      const note = requireText(input.note, 'note', 5, 1000)
      const a = db.prepare('SELECT country FROM applications WHERE id = ?').get(applicationId) as Row | undefined
      if (!a || !canReviewCountry(reviewer, str(a.country))) throw new HttpError(404, 'not_found')
      const r = db
        .prepare("UPDATE applications SET status = 'suspended', decision_note = ?, decided_at = ? WHERE id = ? AND status IN ('pending','approved') AND user_id != ?")
        .run(note, now(), applicationId, reviewer.id)
      if (r.changes === 0) throw new HttpError(404, 'not_found')
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
      if (!status) throw new HttpError(400, 'decision_invalid')
      db.prepare("UPDATE notes SET status = ? WHERE id = ? AND status = 'pending'").run(status, noteId)
      audit(reviewer.id, `note.${status}`, noteId)
      return { ok: true }
    },

    // ───────────── Administração ─────────────
    /**
     * Ciclo de distribuição (por exemplo, uma vez por mês). Junta as doações ainda não contadas e
     * divide o saldo do fundo por quem está aprovado, em qualquer país. Só corre com pelo menos
     * MIN_DONORS_PER_CYCLE doadores diferentes, para que ninguém deduza quem doou por datas e valores.
     * O pedido de cada pessoa é convertido para a moeda base; o prestador converte de volta ao pagar.
     */
    async runCycle(admin: User) {
      requireRole(admin, 'admin')
      expireOld()
      const donorCount = num((db.prepare('SELECT COUNT(DISTINCT donor_id) AS n FROM donations WHERE cycle_id IS NULL').get() as Row).n)
      if (donorCount < config.minDonorsPerCycle) throw new HttpError(409, 'cycle_min_donors', { count: donorCount, min: config.minDonorsPerCycle })
      const donated = num((db.prepare('SELECT COALESCE(SUM(amount_cents), 0) AS s FROM donations').get() as Row).s)
      const paid = num((db.prepare("SELECT COALESCE(SUM(amount_cents), 0) AS s FROM payouts WHERE status != 'failed'").get() as Row).s)
      const pool = donated - paid
      const approved = (
        db
          .prepare(
            `SELECT a.user_id, a.country, a.currency, a.requested_cents, a.payout_enc, i.legal_name_enc FROM applications a
             JOIN users u ON u.id = a.user_id JOIN identities i ON i.user_id = a.user_id
             WHERE a.status = 'approved' AND u.suspended = 0`,
          )
          .all() as Row[]
      ).filter((a) => countries.has(str(a.country)))
      const needs = approved.map((a) => {
        const rule = countries.get(str(a.country))!
        const requested = Math.min(num(a.requested_cents), toMinor(rule.maxMonthly, rule.currency))
        return { id: str(a.user_id), requestedCents: convertMinor(requested, str(a.currency), base, fx) }
      })
      const result = allocate(pool, needs, Number.MAX_SAFE_INTEGER)
      const cycleId = randomId()
      const payoutIds = new Map<string, string>()
      tx(db, () => {
        db.prepare('INSERT INTO cycles (id, run_at, pool_cents, distributed_cents, donor_count, beneficiary_count) VALUES (?, ?, ?, ?, ?, ?)').run(
          cycleId,
          now(),
          pool,
          result.distributedCents,
          donorCount,
          result.payouts.size,
        )
        db.prepare('UPDATE donations SET cycle_id = ? WHERE cycle_id IS NULL').run(cycleId)
        for (const a of approved) {
          const amount = result.payouts.get(str(a.user_id))
          if (!amount) continue
          const id = randomId()
          payoutIds.set(str(a.user_id), id)
          db.prepare(
            "INSERT INTO payouts (id, cycle_id, beneficiary_id, amount_cents, local_currency, local_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)",
          ).run(id, cycleId, str(a.user_id), amount, str(a.currency), convertMinor(amount, base, str(a.currency), fx), now())
        }
      })
      let failed = 0
      for (const a of approved) {
        const payoutId = payoutIds.get(str(a.user_id))
        if (!payoutId) continue
        try {
          const { ref } = await payments.payout({
            method: payoutOf(a)!,
            holderName: crypto.decryptText(str(a.legal_name_enc)),
            country: str(a.country),
            amountMinor: result.payouts.get(str(a.user_id))!,
            baseCurrency: base,
            targetCurrency: str(a.currency),
            reference: 'Gota a Gota',
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
        currency: base,
        poolMinor: pool,
        distributedMinor: result.distributedCents,
        carryOverMinor: result.carryOverCents,
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
        currency: base,
        poolMinor: num(c.pool_cents),
        distributedMinor: num(c.distributed_cents),
        donorCount: num(c.donor_count),
        beneficiaryCount: num(c.beneficiary_count),
      }))
    },
  }
}

export type Service = ReturnType<typeof createService>
