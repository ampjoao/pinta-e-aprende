import { allocate } from './allocation.ts'
import { makeIban, makeNif } from './testing.ts'
import { ageOn, isPersonalNif, isValidIban, isValidNif } from './validation.ts'

describe('NIF', () => {
  it('aceita NIFs com dígito de controlo certo e rejeita os outros', () => {
    expect(isValidNif('123456789')).toBe(true)
    expect(isValidNif('123456780')).toBe(false)
    expect(isValidNif('12345678')).toBe(false)
    expect(isPersonalNif(makeNif(42))).toBe(true)
    expect(isPersonalNif('500000000')).toBe(false) // empresa
  })
})

describe('IBAN', () => {
  it('valida o módulo 97', () => {
    expect(isValidIban('GB82 WEST 1234 5698 7654 32')).toBe(true)
    expect(isValidIban(makeIban(7))).toBe(true)
    expect(isValidIban(makeIban(7).slice(0, -1) + '9')).toBe(false)
    expect(isValidIban('PT50123')).toBe(false)
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
    expect(r.carryOverCents).toBe(0)
  })

  it('respeita o máximo mensal', () => {
    const r = allocate(10_000_00, [{ id: 'a', requestedCents: 5_000_00 }], 300_00)
    expect(r.payouts.get('a')).toBe(300_00)
  })
})
