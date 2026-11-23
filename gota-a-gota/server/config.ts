/** Configuração do servidor, lida das variáveis de ambiente (ver .env.example). */
import { loadCatalog, type CountryCatalog } from './countries.ts'

export interface Config {
  port: number
  dbPath: string
  masterKeyHex: string
  allowedOrigins: string[]
  adminEmail?: string
  adminPassword?: string
  /** Moeda do fundo comum (ISO 4217). Todas as contas internas são feitas nesta moeda. */
  baseCurrency: string
  /** Países abertos, com as suas regras, e câmbios. Ver countries.ts. */
  catalog: CountryCatalog
  /** Um ciclo de distribuição só corre com pelo menos este número de doadores diferentes (anonimato). */
  minDonorsPerCycle: number
  /** Número de revisores diferentes que têm de aprovar um pedido (mínimo 2). */
  approvalsRequired: number
  /** Validade de uma aprovação, em dias. Depois disso o beneficiário volta a provar a necessidade. */
  approvalValidDays: number
  /** Doação mínima e máxima por operação, em unidades mínimas da moeda base. */
  minDonationCents: number
  maxDonationCents: number
}

const DEV_KEY = '00'.repeat(32)

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production'
  let masterKeyHex = env.MASTER_KEY ?? ''
  if (!/^[0-9a-f]{64}$/i.test(masterKeyHex)) {
    if (production) throw new Error('MASTER_KEY em falta ou inválida (64 caracteres hexadecimais).')
    if (env.NODE_ENV !== 'test') {
      console.warn('[gota-a-gota] AVISO: a usar uma chave de desenvolvimento. Nunca usar assim em produção.')
    }
    masterKeyHex = DEV_KEY
  }
  const int = (name: string, fallback: number) => {
    const v = env[name]
    const n = v === undefined || v === '' ? fallback : Number(v)
    if (!Number.isInteger(n) || n < 0) throw new Error(`${name} tem de ser um número inteiro.`)
    return n
  }
  const baseCurrency = (env.BASE_CURRENCY || 'EUR').toUpperCase()
  const catalog = loadCatalog(env)
  if (catalog.fxPerBase[baseCurrency] !== 1) throw new Error(`O câmbio da moeda base (${baseCurrency}) tem de ser 1.`)
  return {
    port: int('PORT', 8787),
    dbPath: env.DB_PATH || './data/gota-a-gota.db',
    masterKeyHex,
    allowedOrigins: (
      env.ALLOWED_ORIGINS ||
      'http://localhost:5174,https://localhost,capacitor://localhost,tauri://localhost,http://tauri.localhost'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    adminEmail: env.ADMIN_EMAIL || undefined,
    adminPassword: env.ADMIN_PASSWORD || undefined,
    baseCurrency,
    catalog,
    minDonorsPerCycle: int('MIN_DONORS_PER_CYCLE', 5),
    approvalsRequired: Math.max(2, int('APPROVALS_REQUIRED', 2)),
    approvalValidDays: int('APPROVAL_VALID_DAYS', 180),
    minDonationCents: int('MIN_DONATION_CENTS', 500),
    maxDonationCents: int('MAX_DONATION_CENTS', 1000000),
  }
}
