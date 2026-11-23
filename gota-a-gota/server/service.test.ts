import type { AddressInfo } from 'node:net'
import { createApp } from './http.ts'
import type { User } from './service.ts'
import { makeCpf, makeIban, makeNif, makeTestService } from './testing.ts'

const PNG = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64')
const PDF = (text: string) => Buffer.from('%PDF-1.4 ' + text).toString('base64')

function setup(overrides: Record<string, string> = {}) {
  const t = makeTestService(overrides)
  const { service, db } = t
  let n = 0
  let payoutSeed = 1000
  const userOf = (token: string) => service.authenticate(token) as User

  const newUser = async (role: 'donor' | 'beneficiary', country = 'PT', verify = true) => {
    n++
    const { token } = service.register({ email: `${role}${n}@exemplo.org`, password: 'palavra-passe-segura', role })
    const user = userOf(token)
    const nationalId = country === 'BR' ? makeCpf(n) : country === 'PT' ? makeNif(n) : `ID${100000 + n}`
    if (verify) await service.verifyIdentity(user, { legalName: `Pessoa Teste ${n}`, country, nationalId, birthDate: '1980-01-01' })
    return user
  }

  const newReviewer = (countries: string[] = []) => {
    n++
    service.ensureAdmin('admin@exemplo.org', 'palavra-passe-admin')
    const admin = userOf(service.login({ email: 'admin@exemplo.org', password: 'palavra-passe-admin' }).token)
    service.createReviewer(admin, { email: `revisor${n}@exemplo.org`, password: 'palavra-passe-segura', countries })
    return { reviewer: userOf(service.login({ email: `revisor${n}@exemplo.org`, password: 'palavra-passe-segura' }).token), admin }
  }

  const fileApplication = (user: User, opts: { payout?: object; requestedMinor?: number } = {}) => {
    const seed = payoutSeed++
    service.saveApplication(user, {
      householdAdults: 1,
      householdChildren: 2,
      monthlyIncomeMinor: 500_00,
      monthlyExpensesMinor: 900_00,
      category: 'food',
      description: 'Mãe sozinha com dois filhos, salário mínimo em part-time.',
      requestedMinor: opts.requestedMinor ?? 200_00,
      payout: opts.payout ?? { type: 'iban', iban: makeIban(seed) },
    })
    service.addDocument(user, { kind: 'income_proof', filename: 'irs.pdf', mime: 'application/pdf', dataBase64: PDF('irs ' + seed) })
    service.addDocument(user, { kind: 'address_proof', filename: 'fatura.png', mime: 'image/png', dataBase64: PNG + seed })
    return service.submitApplication(user)
  }

  const approve = (user: User, reviewers: User[]) => {
    for (const r of reviewers) service.vote(r, appIdOf(user), { decision: 'approve', note: 'Documentos conferem.' })
  }

  const appIdOf = (user: User) => String((db.prepare('SELECT id FROM applications WHERE user_id = ?').get(user.id) as { id: string }).id)

  return { ...t, newUser, newReviewer, fileApplication, approve, appIdOf }
}

describe('identidade e contas', () => {
  it('não deixa o mesmo documento em duas contas, mas o mesmo número noutro país é outra pessoa', async () => {
    const { service, newUser } = setup()
    await newUser('donor', 'PT')
    const other = await newUser('donor', 'PT', false)
    await expect(service.verifyIdentity(other, { legalName: 'Outra Pessoa', country: 'PT', nationalId: makeNif(1), birthDate: '1990-01-01' })).rejects.toThrow(
      'id_duplicate',
    )
    await expect(service.verifyIdentity(other, { legalName: 'Outra Pessoa', country: 'KE', nationalId: makeNif(1), birthDate: '1990-01-01' })).resolves.toBeTruthy()
  })

  it('valida o documento de cada país e a maioridade', async () => {
    const { service, newUser } = setup()
    const u = await newUser('beneficiary', 'BR', false)
    await expect(service.verifyIdentity(u, { legalName: 'Jovem Teste', country: 'BR', nationalId: makeCpf(99), birthDate: '2015-01-01' })).rejects.toThrow('underage')
    await expect(service.verifyIdentity(u, { legalName: 'Nome Teste', country: 'BR', nationalId: '111.111.111-11', birthDate: '1980-01-01' })).rejects.toThrow('id_invalid')
    await expect(service.verifyIdentity(u, { legalName: 'Nome Teste', country: 'ZZ', nationalId: 'ABC12345', birthDate: '1980-01-01' })).rejects.toThrow(
      'country_unavailable',
    )
  })

  it('não permite que alguém se registe como revisor', () => {
    const { service } = setup()
    expect(() => service.register({ email: 'x@exemplo.org', password: 'palavra-passe-segura', role: 'reviewer' })).toThrow('role_required')
  })
})

describe('pedido de ajuda e revisão', () => {
  it('precisa de documentos de rendimentos e morada', async () => {
    const { service, newUser } = setup()
    const b = await newUser('beneficiary')
    service.saveApplication(b, {
      householdAdults: 1, householdChildren: 0, monthlyIncomeMinor: 0, monthlyExpensesMinor: 400_00,
      category: 'housing', description: 'Desempregado há oito meses, sem subsídio.', requestedMinor: 150_00,
      payout: { type: 'iban', iban: makeIban(99) },
    })
    expect(() => service.submitApplication(b)).toThrow('missing_documents')
  })

  it('só aceita formas de receber do país e respeita o máximo do país', async () => {
    const { service, newUser } = setup()
    const pt = await newUser('beneficiary', 'PT')
    expect(() => service.saveApplication(pt, { payout: { type: 'pix', pixKey: '529.982.247-25' } })).toThrow('payout_not_allowed')
    expect(() => service.saveApplication(pt, { requestedMinor: 301_00 })).toThrow('invalid_value')
    const br = await newUser('beneficiary', 'BR')
    expect(service.saveApplication(br, { payout: { type: 'pix', pixKey: '529.982.247-25' }, requestedMinor: 600_00 }).application?.currency).toBe('BRL')
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
    expect(detail.country).toBe('PT')
    expect(service.vote(r1, id, { decision: 'approve', note: 'Documentos conferem.' }).status).toBe('pending')
    expect(() => service.vote(r1, id, { decision: 'approve', note: 'Outra vez.' })).toThrow('already_voted')
    expect(service.vote(r2, id, { decision: 'approve', note: 'Confirmo a necessidade.' }).status).toBe('approved')
    expect(service.getApplication(b).application?.status).toBe('approved')
    expect(db.prepare('SELECT COUNT(*) AS n FROM documents').get()).toEqual({ n: 0 })
  })

  it('revisores só veem os países que lhes foram atribuídos', async () => {
    const { service, newUser, newReviewer, fileApplication, appIdOf } = setup()
    const br = await newUser('beneficiary', 'BR')
    fileApplication(br, { payout: { type: 'pix', pixKey: makeCpf(500) }, requestedMinor: 300_00 })
    const { reviewer: ptOnly } = newReviewer(['PT'])
    const { reviewer: brOnly } = newReviewer(['BR'])
    expect(service.reviewQueue(ptOnly)).toHaveLength(0)
    expect(() => service.reviewDetail(ptOnly, appIdOf(br))).toThrow('not_found')
    expect(service.reviewQueue(brOnly)).toHaveLength(1)
  })

  it('assinala documentos repetidos noutra conta e bloqueia contas de destino repetidas', async () => {
    const { service, newUser, newReviewer, fileApplication, appIdOf } = setup()
    const a = await newUser('beneficiary')
    fileApplication(a, { payout: { type: 'iban', iban: makeIban(500) } })
    const b = await newUser('beneficiary')
    service.saveApplication(b, {
      householdAdults: 1, householdChildren: 0, monthlyIncomeMinor: 0, monthlyExpensesMinor: 400_00,
      category: 'health', description: 'Tentativa com o mesmo IBAN de outra pessoa.', requestedMinor: 100_00,
      payout: { type: 'iban', iban: makeIban(500) },
    })
    service.addDocument(b, { kind: 'income_proof', filename: 'irs.pdf', mime: 'application/pdf', dataBase64: PDF('irs 1000') })
    service.addDocument(b, { kind: 'address_proof', filename: 'm.png', mime: 'image/png', dataBase64: PNG + 'x' })
    expect(() => service.submitApplication(b)).toThrow('payout_duplicate')
    const { reviewer } = newReviewer()
    expect(service.reviewDetail(reviewer, appIdOf(a)).checks.documentsSeenInOtherAccounts).toBe(1)
  })

  it('uma rejeição fecha o pedido e a pessoa vê o motivo', async () => {
    const { service, newUser, newReviewer, fileApplication, appIdOf } = setup()
    const b = await newUser('beneficiary')
    fileApplication(b)
    const { reviewer } = newReviewer()
    service.vote(reviewer, appIdOf(b), { decision: 'reject', note: 'Rendimento declarado não confere com o IRS.' })
    const app = service.getApplication(b).application
    expect(app?.status).toBe('rejected')
    expect(app?.decisionNote).toMatch(/IRS/)
  })
})

describe('fundo comum mundial e anonimato', () => {
  async function fundedScenario() {
    const s = setup()
    const { service, newUser, newReviewer, fileApplication, approve } = s
    const pt = await newUser('beneficiary', 'PT')
    const br = await newUser('beneficiary', 'BR')
    const { reviewer: r1, admin } = newReviewer()
    const { reviewer: r2 } = newReviewer()
    fileApplication(pt, { requestedMinor: 200_00 }) // 200 EUR
    fileApplication(br, { payout: { type: 'pix', pixKey: makeCpf(777) }, requestedMinor: 600_00 }) // 600 BRL ≈ 96,77 EUR
    approve(pt, [r1, r2])
    approve(br, [r1, r2])
    const donors = [await newUser('donor', 'US'), await newUser('donor', 'PT')]
    await service.donate(donors[0], { amountMinor: 330_00, currency: 'USD' }) // 300 EUR
    await service.donate(donors[1], { amountMinor: 50_00, currency: 'EUR' })
    return { ...s, beneficiaries: [pt, br], donors, admin, r1 }
  }

  it('não corre um ciclo com poucos doadores', async () => {
    const { service, newUser, newReviewer } = setup({ MIN_DONORS_PER_CYCLE: '3' })
    const { admin } = newReviewer()
    await service.donate(await newUser('donor'), { amountMinor: 100_00, currency: 'EUR' })
    await expect(service.runCycle(admin)).rejects.toThrow('cycle_min_donors')
  })

  it('converte doações e pedidos para a moeda base e paga na moeda de cada país', async () => {
    const { service, beneficiaries, admin, payments } = await fundedScenario()
    const cycle = await service.runCycle(admin)
    expect(cycle.poolMinor).toBe(350_00)
    expect(cycle.beneficiaryCount).toBe(2)
    const [ptPayout, brPayout] = [service.listPayouts(beneficiaries[0])[0], service.listPayouts(beneficiaries[1])[0]]
    expect(ptPayout).toMatchObject({ baseAmountMinor: 200_00, localCurrency: 'EUR', localAmountMinor: 200_00 })
    expect(brPayout.localCurrency).toBe('BRL')
    expect(brPayout.localAmountMinor).toBeGreaterThanOrEqual(599_90)
    expect(brPayout.localAmountMinor).toBeLessThanOrEqual(600_10)
    expect(payments.payouts.map((p) => p.method.type).sort()).toEqual(['iban', 'pix'])
    expect(payments.payouts.every((p) => p.reference === 'Gota a Gota')).toBe(true)
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
    const payoutColumns = (db.prepare('PRAGMA table_info(payouts)').all() as { name: string }[]).map((c) => c.name)
    expect(payoutColumns.some((c) => /donor|donation/.test(c))).toBe(false)
  })

  it('esconde estatísticas quando os grupos são pequenos', async () => {
    const { service } = await fundedScenario()
    expect(service.stats().donors).toBeNull()
    expect(service.stats().donatedMinor).toBeNull()
  })

  it('a aprovação caduca e é preciso provar de novo', async () => {
    const { service, beneficiaries, advance, config } = await fundedScenario()
    advance((config.approvalValidDays + 1) * 24 * 60 * 60 * 1000)
    expect(service.getApplication(beneficiaries[0]).application?.status).toBe('expired')
  })

  it('recusa moedas sem câmbio', async () => {
    const { service, donors } = await fundedScenario()
    await expect(service.donate(donors[0], { amountMinor: 1000, currency: 'XYZ' })).rejects.toThrow('currency_unsupported')
  })
})

describe('HTTP', () => {
  it('responde, exige sessão, aplica CORS e traduz os erros', async () => {
    const { service } = makeTestService()
    const server = createApp(service, { allowedOrigins: ['capacitor://localhost'] })
    await new Promise<void>((r) => server.listen(0, r))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    try {
      const health = await fetch(`${base}/api/health`, { headers: { origin: 'capacitor://localhost' } })
      expect(health.headers.get('access-control-allow-origin')).toBe('capacitor://localhost')
      const evil = await fetch(`${base}/api/health`, { headers: { origin: 'https://mau.exemplo' } })
      expect(evil.headers.get('access-control-allow-origin')).toBeNull()
      const unauth = await fetch(`${base}/api/me`, { headers: { 'accept-language': 'es-ES' } })
      expect(unauth.status).toBe(401)
      expect(await unauth.json()).toEqual({ code: 'session_expired', error: 'La sesión ha caducado. Vuelva a entrar.' })
      const catalog = (await (await fetch(`${base}/api/catalog`)).json()) as { countries: { code: string }[] }
      expect(catalog.countries.map((c) => c.code)).toContain('BR')
      const reg = await fetch(`${base}/api/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@exemplo.org', password: 'palavra-passe-segura', role: 'donor' }),
      })
      const { token } = (await reg.json()) as { token: string }
      const me = await fetch(`${base}/api/me`, { headers: { authorization: `Bearer ${token}` } })
      expect(await me.json()).toMatchObject({ role: 'donor', identityVerified: false })
    } finally {
      server.close()
    }
  })
})
