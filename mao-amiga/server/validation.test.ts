import { allocate } from './allocation.ts'
import { convertMinor, DEFAULT_CATALOG } from './countries.ts'
import { pickLanguage, translate } from './messages.ts'
import { makeCpf, makeIban, makeNif } from './testing.ts'
import { ageOn, isPersonalNif, isValidCpf, isValidDni, isValidIban, isValidNif, normalizeNationalId, normalizePayout } from './validation.ts'

describe('documentos de identificação', () => {
  it('NIF (Portugal)', () => {
    expect(isValidNif('123456789')).toBe(true)
    expect(isValidNif('123456780')).toBe(false)
    expect(isPersonalNif(makeNif(42))).toBe(true)
    expect(isPersonalNif('500000000')).toBe(false)
  })
  it('CPF (Brasil)', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf(makeCpf(7))).toBe(true)
  })
  it('DNI e NIE (Espanha)', () => {
    expect(isValidDni('12345678Z')).toBe(true)
    expect(isValidDni('12345678A')).toBe(false)
    expect(isValidDni('X1234567L')).toBe(true)
  })
  it('outros países: formato alfanumérico', () => {
    expect(normalizeNationalId('national_id', 'ab 123-456')).toBe('AB123456')
    expect(normalizeNationalId('national_id', '12')).toBeNull()
  })
})

describe('formas de receber', () => {
  it('IBAN', () => {
    expect(isValidIban('GB82 WEST 1234 5698 7654 32')).toBe(true)
    expect(isValidIban(makeIban(7))).toBe(true)
    expect(normalizePayout({ type: 'iban', iban: 'PT50123' })).toBeNull()
  })
  it('Pix, mobile money, conta bancária e carteira', () => {
    expect(normalizePayout({ type: 'pix', pixKey: '529.982.247-25' })).toEqual({ type: 'pix', fields: { pixKey: '52998224725' } })
    expect(normalizePayout({ type: 'pix', pixKey: 'Maria@Exemplo.com' })?.fields.pixKey).toBe('maria@exemplo.com')
    expect(normalizePayout({ type: 'pix', pixKey: 'qualquer coisa' })).toBeNull()
    expect(normalizePayout({ type: 'mobile_money', phone: '+258 84 123 4567', operator: 'M-Pesa' })?.fields.phone).toBe('+258841234567')
    expect(normalizePayout({ type: 'mobile_money', phone: '841234567', operator: 'M-Pesa' })).toBeNull()
    expect(normalizePayout({ type: 'bank_account', accountNumber: '000123456789', bankCode: '021000021', bankName: 'Banco' })).not.toBeNull()
    expect(normalizePayout({ type: 'wallet', provider: 'UPI', handle: 'nome@banco' })).not.toBeNull()
    expect(normalizePayout({ type: 'crypto', address: 'x' })).toBeNull()
  })
})

describe('idade', () => {
  it('conta anos completos', () => {
    const d = new Date(Date.UTC(2026, 5, 15))
    expect(ageOn('2008-06-15', d)).toBe(18)
    expect(ageOn('2008-06-16', d)).toBe(17)
    expect(ageOn('2008-13-01', d)).toBeNull()
  })
})

describe('moedas', () => {
  it('converte com as casas decimais certas', () => {
    const fx = { EUR: 1, USD: 1.1, JPY: 160 }
    expect(convertMinor(110_00, 'USD', 'EUR', fx)).toBe(100_00)
    expect(convertMinor(100_00, 'EUR', 'JPY', fx)).toBe(16000) // o iene não tem cêntimos
  })
  it('todos os países de exemplo têm câmbio', () => {
    for (const c of DEFAULT_CATALOG.countries) expect(DEFAULT_CATALOG.fxPerBase[c.currency]).toBeGreaterThan(0)
  })
})

describe('mensagens', () => {
  it('escolhe a língua e traduz campos', () => {
    expect(pickLanguage('pt-BR,pt;q=0.9')).toBe('pt-BR')
    expect(pickLanguage('pt')).toBe('pt-PT')
    expect(pickLanguage('es-MX')).toBe('es')
    expect(pickLanguage('de-DE')).toBe('en')
    expect(translate('fr', 'missing_fields', { fields: ['income', 'payout'] })).toBe('Il manque : Revenus et moyen de réception.')
    expect(translate('en', 'underage', { age: 18 })).toBe('You must be 18 or older.')
  })
})

describe('divisão do fundo', () => {
  it('dá a cada um o que pediu quando o fundo chega, e guarda o resto', () => {
    const r = allocate(100_00, [{ id: 'a', requestedCents: 30_00 }, { id: 'b', requestedCents: 50_00 }], 300_00)
    expect(Object.fromEntries(r.payouts)).toEqual({ a: 30_00, b: 50_00 })
    expect(r.carryOverCents).toBe(20_00)
  })
  it('divide em proporção quando não chega, sem perder cêntimos', () => {
    const r = allocate(100, [{ id: 'a', requestedCents: 100 }, { id: 'b', requestedCents: 100 }, { id: 'c', requestedCents: 100 }], 1000)
    const values = [...r.payouts.values()]
    expect(values.reduce((s, v) => s + v, 0)).toBe(100)
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1)
  })
})
