import { detectLanguage, LANGUAGES, makeLocale } from '.'
import { en } from './en'

it('todas as línguas têm as mesmas variáveis {x} que o inglês', () => {
  for (const { code, dict } of LANGUAGES) {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()
      expect(vars(dict[key]), `${code} ${key}`).toBe(vars(en[key]))
    }
  }
})

it('deteta a língua do aparelho', () => {
  expect(detectLanguage(['pt-BR'])).toBe('pt-BR')
  expect(detectLanguage(['pt-AO'])).toBe('pt-PT')
  expect(detectLanguage(['es-MX', 'en'])).toBe('es')
  expect(detectLanguage(['de-DE'])).toBe('en')
})

it('formata e lê valores em várias moedas', () => {
  const pt = makeLocale('pt-PT')
  expect(pt.parseMoney('1.234,56', 'EUR')).toBe(123456)
  expect(pt.parseMoney('1,234.56', 'USD')).toBe(123456)
  expect(pt.parseMoney('1.500', 'AOA')).toBe(150000)
  expect(pt.parseMoney('450', 'BRL')).toBe(45000)
  expect(pt.parseMoney('abc', 'EUR')).toBeNull()
  expect(pt.parseMoney('100', 'JPY')).toBe(100)
  expect(pt.money(123456, 'EUR')).toMatch(/1\s?234,56\s?€/)
  expect(makeLocale('en').country('MZ')).toBe('Mozambique')
})
