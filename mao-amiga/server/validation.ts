/** Validações de identificadores portugueses e europeus usadas contra fraude. */

/** NIF português: 9 dígitos, dígito de controlo módulo 11. */
export function isValidNif(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false
  let sum = 0
  for (let i = 0; i < 8; i++) sum += Number(nif[i]) * (9 - i)
  const check = 11 - (sum % 11)
  return (check >= 10 ? 0 : check) === Number(nif[8])
}

/** Só pessoas singulares (NIF começado por 1, 2 ou 3) podem criar conta. */
export const isPersonalNif = (nif: string) => isValidNif(nif) && '123'.includes(nif[0])

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

export const isValidEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

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
