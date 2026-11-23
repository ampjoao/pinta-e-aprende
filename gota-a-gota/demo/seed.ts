/** Dados fictícios para a demonstração: pessoas de vários países em várias fases. */
import type { Service, User } from '../server/service.ts'

export const DEMO_PASSWORD = 'demonstracao-123'

export const ACCOUNTS = {
  donor: 'doador@demo.org',
  approved: 'maria@demo.org',
  pending: 'ana@demo.org',
  reviewer: 'revisor@demo.org',
  admin: 'admin@demo.org',
} as const

/** PDF mínimo com uma linha de texto, para o revisor poder abrir um documento de exemplo. */
function samplePdf(text: string) {
  const stream = `BT /F1 18 Tf 60 760 Td (${text}) Tj ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(out).toString('base64')
}

function cpf(seed: number) {
  const d = String(100000000 + seed).slice(-9)
  const digit = (s: string) => {
    let sum = 0
    for (let i = 0; i < s.length; i++) sum += Number(s[i]) * (s.length + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  const a = digit(d)
  return d + a + digit(d + a)
}

function nif(seed: number) {
  const base = '2' + String(seed).padStart(7, '0')
  let sum = 0
  for (let i = 0; i < 8; i++) sum += Number(base[i]) * (9 - i)
  const c = 11 - (sum % 11)
  return base + (c >= 10 ? 0 : c)
}

function dni(seed: number) {
  const n = 10000000 + seed
  return String(n) + 'TRWAGMYFPDXBNJZSQVHLCKE'[n % 23]
}

function iban(country: string, bban: string) {
  const numeric = (bban + country + '00').replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  let rem = 0
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97
  return country + String(98 - rem).padStart(2, '0') + bban
}

interface Person {
  email: string
  name: string
  country: string
  nationalId: string
  birthDate: string
}

interface Need {
  adults: number
  children: number
  income: number
  expenses: number
  requested: number
  category: string
  description: string
  payout: Record<string, string>
}

export async function seedDemo(service: Service) {
  let n = 0
  const login = (email: string) => service.authenticate(service.login({ email, password: DEMO_PASSWORD }).token) as User

  const person = async (role: 'donor' | 'beneficiary', p: Person) => {
    service.register({ email: p.email, password: DEMO_PASSWORD, role })
    const user = login(p.email)
    await service.verifyIdentity(user, { legalName: p.name, country: p.country, nationalId: p.nationalId, birthDate: p.birthDate })
    return user
  }

  const apply = (user: User, need: Need) => {
    n++
    service.saveApplication(user, {
      householdAdults: need.adults,
      householdChildren: need.children,
      monthlyIncomeMinor: need.income * 100,
      monthlyExpensesMinor: need.expenses * 100,
      requestedMinor: need.requested * 100,
      category: need.category,
      description: need.description,
      payout: need.payout,
    })
    service.addDocument(user, { kind: 'income_proof', filename: 'rendimentos.pdf', mime: 'application/pdf', dataBase64: samplePdf(`Income proof - example ${n}`) })
    service.addDocument(user, { kind: 'address_proof', filename: 'morada.pdf', mime: 'application/pdf', dataBase64: samplePdf(`Address proof - example ${n}`) })
    service.submitApplication(user)
  }

  // Equipa
  service.ensureAdmin(ACCOUNTS.admin, DEMO_PASSWORD)
  const admin = login(ACCOUNTS.admin)
  service.createReviewer(admin, { email: ACCOUNTS.reviewer, password: DEMO_PASSWORD, countries: [] })
  service.createReviewer(admin, { email: 'revisora2@demo.org', password: DEMO_PASSWORD, countries: [] })
  const reviewers = [login(ACCOUNTS.reviewer), login('revisora2@demo.org')]

  // Pessoas que já foram aprovadas e vão receber no primeiro ciclo
  const approved: [Person, Need][] = [
    [
      { email: ACCOUNTS.approved, name: 'Maria Exemplo Santos', country: 'PT', nationalId: nif(101), birthDate: '1986-04-12' },
      { adults: 1, children: 2, income: 760, expenses: 980, requested: 200, category: 'food', description: 'Mãe sozinha com dois filhos. Trabalho em part-time numa cantina e a renda subiu este ano.', payout: { type: 'iban', iban: iban('PT', '003500000000000101002') } },
    ],
    [
      { email: 'lucia@demo.org', name: 'Lucía Ejemplo García', country: 'ES', nationalId: dni(202), birthDate: '1979-09-30' },
      { adults: 2, children: 1, income: 1100, expenses: 1350, requested: 250, category: 'housing', description: 'Mi pareja perdió el trabajo y con mi sueldo no llegamos al alquiler y la luz.', payout: { type: 'iban', iban: iban('ES', '21000418450200051332') } },
    ],
    [
      { email: 'grace@demo.org', name: 'Grace Example Wanjiku', country: 'KE', nationalId: '30123456', birthDate: '1991-01-20' },
      { adults: 1, children: 3, income: 6000, expenses: 9000, requested: 6000, category: 'education', description: 'Market vendor, three children in school. School fees and uniforms are due this term.', payout: { type: 'mobile_money', phone: '+254712345678', operator: 'M-Pesa' } },
    ],
    [
      { email: 'rosa@demo.org', name: 'Rosa Example Dela Cruz', country: 'PH', nationalId: 'PSN1234567890', birthDate: '1975-07-03' },
      { adults: 2, children: 2, income: 9000, expenses: 12000, requested: 2500, category: 'health', description: 'My husband needs daily medicine after a stroke and cannot work anymore.', payout: { type: 'mobile_money', phone: '+639171234567', operator: 'GCash' } },
    ],
    [
      { email: 'carlos@demo.org', name: 'Carlos Ejemplo Hernández', country: 'MX', nationalId: 'HEGC800101HDFRRL09', birthDate: '1980-01-01' },
      { adults: 1, children: 1, income: 5000, expenses: 7200, requested: 2500, category: 'utilities', description: 'Trabajo por días en la construcción; este mes no hubo obra y debo la luz y el agua.', payout: { type: 'bank_account', accountNumber: '012180001234567897', bankCode: 'BBVAMX', bankName: 'BBVA México' } },
    ],
  ]
  const approvedUsers: User[] = []
  for (const [p, need] of approved) {
    const u = await person('beneficiary', p)
    apply(u, need)
    approvedUsers.push(u)
  }
  for (const q of service.reviewQueue(reviewers[0])) {
    for (const r of reviewers) service.vote(r, q.id, { decision: 'approve', note: 'Documentos conferem com a identidade e a situação descrita.' })
  }

  // Doadores de vários países e moedas
  const donors: [Person, number, string][] = [
    [{ email: ACCOUNTS.donor, name: 'Pedro Doador Exemplo', country: 'PT', nationalId: nif(301), birthDate: '1968-02-02' }, 25000, 'EUR'],
    [{ email: 'emma@demo.org', name: 'Emma Donor Example', country: 'GB', nationalId: 'QQ123456C', birthDate: '1972-05-05' }, 20000, 'GBP'],
    [{ email: 'john@demo.org', name: 'John Donor Example', country: 'US', nationalId: 'A12345678', birthDate: '1965-03-03' }, 30000, 'USD'],
    [{ email: 'claire@demo.org', name: 'Claire Donatrice Exemple', country: 'FR', nationalId: 'FR123456789', birthDate: '1970-08-08' }, 10000, 'EUR'],
    [{ email: 'rafael@demo.org', name: 'Rafael Doador Exemplo', country: 'BR', nationalId: cpf(401), birthDate: '1975-11-11' }, 150000, 'BRL'],
    [{ email: 'javier@demo.org', name: 'Javier Donante Ejemplo', country: 'ES', nationalId: dni(402), birthDate: '1969-12-12' }, 15000, 'EUR'],
  ]
  const donorUsers: User[] = []
  for (const [p, amount, currency] of donors) {
    const u = await person('donor', p)
    await service.donate(u, { amountMinor: amount, currency })
    donorUsers.push(u)
  }

  // Primeira distribuição mensal
  await service.runCycle(admin)

  // Agradecimentos
  service.submitNote(approvedUsers[0], { text: 'Este mês consegui pagar a renda e comprar o material escolar. Obrigada a quem ajudou, seja quem for.' })
  service.submitNote(approvedUsers[2], { text: 'Asante sana. My children are back in school this term.' })
  service.submitNote(approvedUsers[3], { text: 'Salamat po. The medicine for my husband is paid for this month.' })
  for (const note of service.pendingNotes(reviewers[0]).slice(0, 2)) service.moderateNote(reviewers[0], note.id, { decision: 'approve' })

  // Novas doações à espera do próximo ciclo
  await service.donate(donorUsers[0], { amountMinor: 5000, currency: 'EUR' })
  await service.donate(donorUsers[2], { amountMinor: 10000, currency: 'USD' })
  await service.donate(donorUsers[4], { amountMinor: 30000, currency: 'BRL' })

  // Pedidos à espera de revisão
  const ana = await person('beneficiary', { email: ACCOUNTS.pending, name: 'Ana Exemplo Souza', country: 'BR', nationalId: cpf(501), birthDate: '1989-06-15' })
  apply(ana, { adults: 1, children: 3, income: 1200, expenses: 1650, requested: 500, category: 'food', description: 'Sou diarista, tenho três filhos e o aluguel subiu. Falta dinheiro para a comida no fim do mês.', payout: { type: 'pix', pixKey: '529.982.247-25' } })
  const joao = await person('beneficiary', { email: 'joao@demo.org', name: 'João Exemplo Machava', country: 'MZ', nationalId: '110100123456B', birthDate: '1983-10-02' })
  apply(joao, { adults: 2, children: 2, income: 2500, expenses: 3800, requested: 3000, category: 'food', description: 'Sou agricultor e perdi a colheita com as cheias. Tenho dois filhos na escola.', payout: { type: 'mobile_money', phone: '+258841234567', operator: 'M-Pesa' } })
  const joaoApp = service.reviewQueue(reviewers[1]).find((q) => q.country === 'MZ')
  if (joaoApp) service.vote(reviewers[1], joaoApp.id, { decision: 'approve', note: 'Comprovativos da associação de agricultores conferem.' })
}
