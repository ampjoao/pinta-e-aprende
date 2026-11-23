/**
 * Regras por país e câmbios.
 *
 * ATENÇÃO: os valores abaixo são EXEMPLOS aproximados para o protótipo funcionar. Antes de abrir
 * um país é obrigatório:
 *  - confirmar o limiar de pobreza no instituto de estatística oficial desse país;
 *  - definir o apoio máximo mensal com parceiros locais;
 *  - ter a operação legal nesse país (ver docs/legal.md);
 *  - usar câmbios reais do prestador de pagamentos (FxProvider), não esta tabela.
 *
 * Para usar outra lista, aponte COUNTRIES_FILE para um JSON com o mesmo formato
 * ({ "countries": [...], "fxPerBase": {...} }). ENABLED_COUNTRIES limita os países abertos.
 */
import { readFileSync } from 'node:fs'

export type PayoutType = 'iban' | 'pix' | 'mobile_money' | 'bank_account' | 'wallet'
export type IdType = 'nif' | 'cpf' | 'dni' | 'national_id'

export interface CountryRule {
  /** ISO 3166-1 alfa-2 */
  code: string
  /** ISO 4217 */
  currency: string
  idType: IdType
  /** Limiar de pobreza mensal para um adulto sozinho, em moeda local (unidades, não cêntimos). */
  povertyLineMonthly: number
  /** Apoio máximo mensal por pessoa, em moeda local (unidades). */
  maxMonthly: number
  payoutMethods: PayoutType[]
  ageOfMajority: number
  /** true enquanto os valores não forem confirmados por quem opera no país. */
  example: boolean
}

export interface CountryCatalog {
  countries: CountryRule[]
  /** Unidades de cada moeda por 1 unidade da moeda base. */
  fxPerBase: Record<string, number>
}

const c = (
  code: string,
  currency: string,
  idType: IdType,
  povertyLineMonthly: number,
  maxMonthly: number,
  payoutMethods: PayoutType[],
): CountryRule => ({ code, currency, idType, povertyLineMonthly, maxMonthly, payoutMethods, ageOfMajority: 18, example: true })

/** Catálogo de exemplo (base EUR). Valores aproximados, para confirmar. */
export const DEFAULT_CATALOG: CountryCatalog = {
  countries: [
    c('PT', 'EUR', 'nif', 636, 300, ['iban']),
    c('ES', 'EUR', 'dni', 916, 300, ['iban']),
    c('FR', 'EUR', 'national_id', 1216, 300, ['iban']),
    c('GB', 'GBP', 'national_id', 1100, 250, ['iban', 'bank_account']),
    c('US', 'USD', 'national_id', 1304, 300, ['bank_account']),
    c('BR', 'BRL', 'cpf', 759, 600, ['pix', 'bank_account']),
    c('MX', 'MXN', 'national_id', 4600, 3000, ['bank_account']),
    c('AO', 'AOA', 'national_id', 30000, 60000, ['iban', 'mobile_money']),
    c('MZ', 'MZN', 'national_id', 3000, 4000, ['mobile_money', 'iban']),
    c('KE', 'KES', 'national_id', 7000, 8000, ['mobile_money', 'bank_account']),
    c('IN', 'INR', 'national_id', 2500, 5000, ['bank_account', 'wallet']),
    c('PH', 'PHP', 'national_id', 2800, 3000, ['mobile_money', 'bank_account']),
  ],
  fxPerBase: {
    EUR: 1,
    GBP: 0.85,
    USD: 1.1,
    BRL: 6.2,
    MXN: 21,
    AOA: 1000,
    MZN: 70,
    KES: 145,
    INR: 95,
    PHP: 64,
  },
}

export function loadCatalog(env: NodeJS.ProcessEnv): CountryCatalog {
  const catalog: CountryCatalog = env.COUNTRIES_FILE ? JSON.parse(readFileSync(env.COUNTRIES_FILE, 'utf8')) : DEFAULT_CATALOG
  const enabled = (env.ENABLED_COUNTRIES ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  const countries = enabled.length ? catalog.countries.filter((x) => enabled.includes(x.code)) : catalog.countries
  for (const country of countries) {
    if (!catalog.fxPerBase[country.currency]) throw new Error(`Falta o câmbio de ${country.currency} (${country.code}).`)
  }
  return { countries, fxPerBase: catalog.fxPerBase }
}

/** Casas decimais de uma moeda (EUR 2, JPY 0, ...). */
export const currencyDecimals = (currency: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2

export const toMinor = (major: number, currency: string) => Math.round(major * 10 ** currencyDecimals(currency))

/** Converte entre moedas (valores em unidades mínimas: cêntimos, centavos...). */
export function convertMinor(amountMinor: number, from: string, to: string, fxPerBase: Record<string, number>): number {
  if (from === to) return amountMinor
  const rateFrom = fxPerBase[from]
  const rateTo = fxPerBase[to]
  if (!rateFrom || !rateTo) throw new Error(`Câmbio em falta: ${from} → ${to}`)
  const major = amountMinor / 10 ** currencyDecimals(from)
  return Math.round((major / rateFrom) * rateTo * 10 ** currencyDecimals(to))
}
