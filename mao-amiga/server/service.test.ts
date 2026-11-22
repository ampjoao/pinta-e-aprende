import type { AddressInfo } from 'node:net'
import { createApp } from './http.ts'
import type { User } from './service.ts'
import { makeIban, makeNif, makeTestService } from './testing.ts'

const PNG = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64')
const PDF = (text: string) => Buffer.from('%PDF-1.4 ' + text).toString('base64')

function setup(overrides: Record<string, string> = {}) {
  const t = makeTestService(overrides)
  const { service, db } = t
  let n = 0
  const userOf = (token: string) => service.authenticate(token) as User

  const newUser = async (role: 'donor' | 'beneficiary', verify = true) => {
    n++
    const { token } = service.register({ email: `${role}${n}@exemplo.pt`, password: 'palavra-passe-segura', role })
    const user = userOf(token)
    if (verify) await service.verifyIdentity(user, { legalName: `Pessoa Teste ${n}`, nif: makeNif(n), birthDate: '1980-01-01' })
    return user
  }

  const newReviewer = () => {
    n++
    service.ensureAdmin('admin@exemplo.pt', 'palavra-passe-admin')
    const admin = userOf(service.login({ email: 'admin@exemplo.pt', password: 'palavra-passe-admin' }).token)
    service.createReviewer(admin, { email: `revisor${n}@exemplo.pt`, password: 'palavra-passe-segura' })
    return { reviewer: userOf(service.login({ email: `revisor${n}@exemplo.pt`, password: 'palavra-passe-segura' }).token), admin }
  }

  let ibanSeed = 1000
  const fileApplication = (user: User, seed = ibanSeed++) => {
    service.saveApplication(user, {
      householdAdults: 1,
      householdChildren: 2,
      monthlyIncomeCents: 500_00,
      monthlyExpensesCents: 900_00,
      category: 'alimentacao',
      description: 'Mãe sozinha com dois filhos, salário mínimo em part-time.',
      requestedCents: 200_00,
      iban: makeIban(seed),
    })
    service.addDocument(user, { kind: 'rendimentos', filename: 'irs.pdf', mime: 'application/pdf', dataBase64: PDF('irs ' + seed) })
    service.addDocument(user, { kind: 'morada', filename: 'fatura.png', mime: 'image/png', dataBase64: PNG + seed })
    return service.submitApplication(user)
  }

  const appIdOf = (user: User) => String((db.prepare('SELECT id FROM applications WHERE user_id = ?').get(user.id) as { id: string }).id)

  return { ...t, newUser, newReviewer, fileApplication, appIdOf }
}

describe('identidade e contas', () => {
  it('não deixa o mesmo NIF em duas contas', async () => {
    const { service, newUser } = setup()
    await newUser('donor')
    const other = await newUser('donor', false)
    await expect(
      service.verifyIdentity(other, { legalName: 'Outra Pessoa', nif: makeNif(1), birthDate: '1990-01-01' }),
    ).rejects.toThrow(/já está associado/)
  })

  it('exige maioridade e NIF de pessoa singular', async () => {
    const { service, newUser } = setup()
    const u = await newUser('beneficiary', false)
    await expect(service.verifyIdentity(u, { legalName: 'Jovem Teste', nif: makeNif(9), birthDate: '2015-01-01' })).rejects.toThrow(/18 anos/)
    await expect(service.verifyIdentity(u, { legalName: 'Empresa Teste', nif: '500000000', birthDate: '1980-01-01' })).rejects.toThrow()
  })

  it('não permite que alguém se registe como revisor', () => {
    const { service } = setup()
    expect(() => service.register({ email: 'x@exemplo.pt', password: 'palavra-passe-segura', role: 'reviewer' })).toThrow()
  })
})

describe('pedido de ajuda e revisão', () => {
  it('precisa de documentos de rendimentos e morada', async () => {
    const { service, newUser } = setup()
    const b = await newUser('beneficiary')
    service.saveApplication(b, {
      householdAdults: 1, householdChildren: 0, monthlyIncomeCents: 0, monthlyExpensesCents: 400_00,
      category: 'habitacao', description: 'Desempregado há oito meses, sem subsídio.', requestedCents: 150_00, iban: makeIban(99),
    })
    expect(() => service.submitApplication(b)).toThrow(/Faltam documentos/)
  })

  it('só aprova com dois revisores diferentes e apaga os documentos depois', async () => {
    const { service, newUser, newReviewer, fileApplication, appIdOf, db } = setup()
    const b = await newUser('beneficiary')
    fileApplication(b)
    const id = appIdOf(b)
    const { reviewer: r1 } = newReviewer()
    const { reviewer: r2 } = newReviewer()

    const detail = service.reviewDetail(r1, id)
    expect(detail.checks.belowPovertyLine).toBe(true)
    expect(detail.legalName).toMatch(/Pessoa Teste/)

    expect(service.vote(r1, id, { decision: 'approve', note: 'Documentos conferem.' }).status).toBe('pending')
    expect(() => service.vote(r1, id, { decision: 'approve', note: 'Outra vez.' })).toThrow(/Já votou/)
    expect(service.vote(r2, id, { decision: 'approve', note: 'Confirmo a necessidade.' }).status).toBe('approved')
    expect(service.getApplication(b)?.status).toBe('approved')
    expect(db.prepare('SELECT COUNT(*) AS n FROM documents').get()).toEqual({ n: 0 })
  })

  it('assinala documentos repetidos noutra conta e bloqueia IBAN repetido', async () => {
    const { service, newUser, newReviewer, fileApplication, appIdOf } = setup()
    const a = await newUser('beneficiary')
    fileApplication(a, 500)
    const b = await newUser('beneficiary')
    service.saveApplication(b, {
      householdAdults: 1, householdChildren: 0, monthlyIncomeCents: 0, monthlyExpensesCents: 400_00,
      category: 'saude', description: 'Tentativa com o mesmo IBAN de outra pessoa.', requestedCents: 100_00, iban: makeIban(500),
    })
    service.addDocument(b, { kind: 'rendimentos', filename: 'irs.pdf', mime: 'application/pdf', dataBase64: PDF('irs 500') })
    service.addDocument(b, { kind: 'morada', filename: 'm.png', mime: 'image/png', dataBase64: PNG + 'x' })
    expect(() => service.submitApplication(b)).toThrow(/IBAN já está associado/)

    const { reviewer } = newReviewer()
    expect(service.reviewDetail(reviewer, appIdOf(a)).checks.documentsSeenInOtherAccounts).toBe(1)
  })

  it('uma rejeição fecha o pedido e a pessoa vê o motivo', async () => {
    const { service, newUser, newReviewer, fileApplication, appIdOf } = setup()
    const b = await newUser('beneficiary')
    fileApplication(b)
    const { reviewer } = newReviewer()
    service.vote(reviewer, appIdOf(b), { decision: 'reject', note: 'Rendimento declarado não confere com o IRS.' })
    const app = service.getApplication(b)
    expect(app?.status).toBe('rejected')
    expect(app?.decisionNote).toMatch(/IRS/)
  })
})

describe('fundo comum e anonimato', () => {
  async function fundedScenario() {
    const s = setup()
    const { service, newUser, newReviewer, fileApplication, appIdOf } = s
    const beneficiaries = [await newUser('beneficiary'), await newUser('beneficiary')]
    const { reviewer: r1, admin } = newReviewer()
    const { reviewer: r2 } = newReviewer()
    for (const b of beneficiaries) {
      fileApplication(b)
      service.vote(r1, appIdOf(b), { decision: 'approve', note: 'Documentos conferem.' })
      service.vote(r2, appIdOf(b), { decision: 'approve', note: 'Documentos conferem.' })
    }
    const donors = [await newUser('donor'), await newUser('donor')]
    await service.donate(donors[0], { amountCents: 250_00 })
    await service.donate(donors[1], { amountCents: 50_00 })
    return { ...s, beneficiaries, donors, admin, r1 }
  }

  it('não corre um ciclo com poucos doadores', async () => {
    const { service, newUser, newReviewer } = setup({ MIN_DONORS_PER_CYCLE: '3' })
    const { admin } = newReviewer()
    await service.donate(await newUser('donor'), { amountCents: 100_00 })
    await expect(service.runCycle(admin)).rejects.toThrow(/proteger o anonimato/)
  })

  it('divide o fundo e o beneficiário só vê "comunidade"', async () => {
    const { service, beneficiaries, admin, payments } = await fundedScenario()
    const cycle = await service.runCycle(admin)
    expect(cycle.distributedCents).toBe(300_00)
    expect(cycle.beneficiaryCount).toBe(2)
    expect(payments.payouts.every((p) => !/doador|donor/i.test(p.reference))).toBe(true)
    const p = service.listPayouts(beneficiaries[0])
    expect(p).toEqual([{ amountCents: 150_00, status: 'sent', createdAt: expect.any(Number), from: 'Comunidade Mão Amiga' }])
  })

  it('nenhuma resposta a beneficiários ou revisores contém dados de doadores (e vice-versa)', async () => {
    const { service, beneficiaries, donors, admin, r1, db } = await fundedScenario()
    await service.runCycle(admin)
    const donorSecrets = donors.flatMap((d) => [d.id, d.email])
    const beneficiarySecrets = beneficiaries.flatMap((b) => [b.id, b.email, 'Pessoa Teste'])

    const forBeneficiary = JSON.stringify([service.getApplication(beneficiaries[0]), service.listPayouts(beneficiaries[0]), service.stats()])
    const forReviewer = JSON.stringify([service.reviewQueue(r1), service.pendingNotes(r1)])
    const forDonor = JSON.stringify([service.listDonations(donors[0]), service.stats(), service.approvedNotes()])
    for (const s of donorSecrets) {
      expect(forBeneficiary).not.toContain(s)
      expect(forReviewer).not.toContain(s)
    }
    for (const s of beneficiarySecrets) expect(forDonor).not.toContain(s)

    // Nem na base de dados existe ligação entre doações e pagamentos.
    const payoutColumns = (db.prepare('PRAGMA table_info(payouts)').all() as { name: string }[]).map((c) => c.name)
    expect(payoutColumns.some((c) => /donor|donation/.test(c))).toBe(false)
  })

  it('esconde estatísticas quando os grupos são pequenos', async () => {
    const { service } = await fundedScenario()
    expect(service.stats().donors).toBeNull()
    expect(service.stats().donatedCents).toBeNull()
  })

  it('a aprovação caduca e é preciso provar de novo', async () => {
    const { service, beneficiaries, advance, config } = await fundedScenario()
    advance((config.approvalValidDays + 1) * 24 * 60 * 60 * 1000)
    expect(service.getApplication(beneficiaries[0])?.status).toBe('expired')
  })
})

describe('HTTP', () => {
  it('responde, exige sessão e aplica CORS só às origens permitidas', async () => {
    const { service } = makeTestService()
    const server = createApp(service, { allowedOrigins: ['capacitor://localhost'] })
    await new Promise<void>((r) => server.listen(0, r))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    try {
      const health = await fetch(`${base}/api/health`, { headers: { origin: 'capacitor://localhost' } })
      expect(health.headers.get('access-control-allow-origin')).toBe('capacitor://localhost')
      const evil = await fetch(`${base}/api/health`, { headers: { origin: 'https://mau.exemplo' } })
      expect(evil.headers.get('access-control-allow-origin')).toBeNull()
      expect((await fetch(`${base}/api/me`)).status).toBe(401)
      const reg = await fetch(`${base}/api/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@exemplo.pt', password: 'palavra-passe-segura', role: 'donor' }),
      })
      const { token } = (await reg.json()) as { token: string }
      const me = await fetch(`${base}/api/me`, { headers: { authorization: `Bearer ${token}` } })
      expect(await me.json()).toMatchObject({ role: 'donor', identityVerified: false })
    } finally {
      server.close()
    }
  })
})
