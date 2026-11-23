/** Validação de documentos de identificação e formas de receber dinheiro, por país. */
import type { IdType, PayoutType } from './countries.ts'

/** NIF português: 9 dígitos, dígito de controlo módulo 11. */
export function isValidNif(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false
  let sum = 0
  for (let i = 0; i < 8; i++) sum += Number(nif[i]) * (9 - i)
  const check = 11 - (sum % 11)
  return (check >= 10 ? 0 : check) === Number(nif[8])
}

/** Só pessoas singulares (NIF começado por 1, 2 ou 3). */
export const isPersonalNif = (nif: string) => isValidNif(nif) && '123'.includes(nif[0])

/** CPF brasileiro: 11 dígitos, dois dígitos verificadores. */
export function isValidCpf(raw: string): boolean {
  const cpf = raw.replace(/\D/g, '')
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  const digit = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

/** DNI ou NIE espanhol: número + letra de controlo. */
export function isValidDni(raw: string): boolean {
  const v = raw.toUpperCase().replace(/[\s-]/g, '')
  const m = /^([XYZ]?)(\d{7,8})([A-Z])$/.exec(v)
  if (!m) return false
  const prefix = { '': '', X: '0', Y: '1', Z: '2' }[m[1]] ?? ''
  const n = Number(prefix + m[2])
  return 'TRWAGMYFPDXBNJZSQVHLCKE'[n % 23] === m[3]
}

/** Normaliza e valida o número de identificação. Devolve null se for inválido. */
export function normalizeNationalId(idType: IdType, raw: string): string | null {
  const v = String(raw ?? '').toUpperCase().replace(/[\s.\-/]/g, '')
  switch (idType) {
    case 'nif':
      return isPersonalNif(v) ? v : null
    case 'cpf':
      return isValidCpf(v) ? v : null
    case 'dni':
      return isValidDni(v) ? v : null
    default:
      return /^[A-Z0-9]{4,30}$/.test(v) ? v : null
  }
}

export const normalizeIban = (iban: string) => iban.replace(/\s+/g, '').toUpperCase()

/** IBAN: verificação módulo 97 (ISO 13616). */
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false
  if (iban.startsWith('PT') && iban.length !== 25) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const ch of rearranged) {
    const digits = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97
  }
  return remainder === 1
}

/** Telefone em formato internacional E.164 (+258841234567). */
export const normalizePhone = (raw: string) => {
  const v = String(raw ?? '').replace(/[\s()-]/g, '')
  return /^\+[1-9]\d{6,14}$/.test(v) ? v : null
}

export const isValidEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export interface PayoutMethod {
  type: PayoutType
  /** Valores normalizados (IBAN, chave Pix, telefone, conta...). */
  fields: Record<string, string>
}

const clean = (v: unknown, max = 60) => String(v ?? '').trim().slice(0, max)

/** Valida uma forma de receber dinheiro. Devolve null se for inválida. */
export function normalizePayout(input: unknown): PayoutMethod | null {
  if (!input || typeof input !== 'object') return null
  const o = input as Record<string, unknown>
  switch (o.type) {
    case 'iban': {
      const iban = normalizeIban(clean(o.iban, 40))
      return isValidIban(iban) ? { type: 'iban', fields: { iban } } : null
    }
    case 'pix': {
      const key = clean(o.pixKey, 80)
      const digits = key.replace(/\D/g, '')
      if (isValidCpf(digits) && /^[\d.\-\s]+$/.test(key)) return { type: 'pix', fields: { pixKey: digits } }
      if (isValidEmail(key.toLowerCase())) return { type: 'pix', fields: { pixKey: key.toLowerCase() } }
      const phone = normalizePhone(key)
      if (phone?.startsWith('+55')) return { type: 'pix', fields: { pixKey: phone } }
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return { type: 'pix', fields: { pixKey: key.toLowerCase() } }
      return null
    }
    case 'mobile_money': {
      const phone = normalizePhone(clean(o.phone, 20))
      const operator = clean(o.operator, 40)
      return phone && operator.length >= 2 ? { type: 'mobile_money', fields: { phone, operator } } : null
    }
    case 'bank_account': {
      const accountNumber = clean(o.accountNumber, 40).replace(/[\s-]/g, '').toUpperCase()
      const bankCode = clean(o.bankCode, 40).replace(/[\s-]/g, '').toUpperCase()
      const bankName = clean(o.bankName, 80)
      if (!/^[A-Z0-9]{5,34}$/.test(accountNumber) || !/^[A-Z0-9]{2,20}$/.test(bankCode) || bankName.length < 2) return null
      return { type: 'bank_account', fields: { accountNumber, bankCode, bankName } }
    }
    case 'wallet': {
      const provider = clean(o.provider, 40)
      const handle = clean(o.handle, 100).toLowerCase()
      return provider.length >= 2 && handle.length >= 3 && !/\s/.test(handle) ? { type: 'wallet', fields: { provider, handle } } : null
    }
    default:
      return null
  }
}

/** Valor usado para detetar a mesma conta de destino em pessoas diferentes. */
export const payoutIdentity = (m: PayoutMethod) => {
  const f = m.fields
  return `${m.type}:` + (f.iban ?? f.pixKey ?? f.phone ?? (f.accountNumber ? `${f.bankCode}/${f.accountNumber}` : `${f.provider}/${f.handle}`))
}

/** Versão mascarada para mostrar (só os últimos caracteres). */
export function maskPayout(m: PayoutMethod): string {
  const f = m.fields
  const last = (s: string) => '•••• ' + s.slice(-4)
  switch (m.type) {
    case 'iban':
      return `${f.iban.slice(0, 4)} ${last(f.iban)}`
    case 'pix':
      return `Pix ${last(f.pixKey)}`
    case 'mobile_money':
      return `${f.operator} ${last(f.phone)}`
    case 'bank_account':
      return `${f.bankName} ${last(f.accountNumber)}`
    case 'wallet':
      return `${f.provider} ${last(f.handle)}`
  }
}

/** Idade completa numa data (data de nascimento em AAAA-MM-DD). */
export function ageOn(birthDate: string, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  let age = now.getUTCFullYear() - y
  const month = now.getUTCMonth() + 1
  if (month < mo || (month === mo && now.getUTCDate() < d)) age--
  return age
}
