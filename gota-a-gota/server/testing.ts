/** Ajudas para os testes: gera documentos válidos e um serviço em memória. */
import { loadConfig } from './config.ts'
import { createCrypto } from './crypto.ts'
import { openDb } from './db.ts'
import { MockKycProvider, MockPaymentProvider } from './providers.ts'
import { createService } from './service.ts'

export function makeNif(seed: number): string {
  const base = '2' + String(seed).padStart(7, '0').slice(-7)
  let sum = 0
  for (let i = 0; i < 8; i++) sum += Number(base[i]) * (9 - i)
  const check = 11 - (sum % 11)
  return base + (check >= 10 ? 0 : check)
}

export function makeCpf(seed: number): string {
  const d = String(100000000 + seed).slice(-9)
  const digit = (s: string) => {
    let sum = 0
    for (let i = 0; i < s.length; i++) sum += Number(s[i]) * (s.length + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  const d1 = digit(d)
  return d + d1 + digit(d + d1)
}

export function makeIban(seed: number): string {
  const bban = '0035' + '0000' + String(seed).padStart(11, '0') + '00'
  const numeric = (bban + 'PT00').replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  let rem = 0
  for (const d of numeric) rem = (rem * 10 + Number(d)) % 97
  return 'PT' + String(98 - rem).padStart(2, '0') + bban
}

export function makeTestService(overrides: Record<string, string> = {}) {
  let clock = Date.UTC(2026, 0, 1)
  const config = loadConfig({ NODE_ENV: 'test', MIN_DONORS_PER_CYCLE: '2', ...overrides })
  const payments = new MockPaymentProvider()
  const db = openDb(':memory:')
  const service = createService({ db, crypto: createCrypto('11'.repeat(32)), config, payments, kyc: new MockKycProvider(), now: () => clock })
  return { service, payments, db, config, advance: (ms: number) => (clock += ms) }
}
