/** Configuração do servidor, lida das variáveis de ambiente (ver .env.example). */
export interface Config {
  port: number
  dbPath: string
  masterKeyHex: string
  allowedOrigins: string[]
  adminEmail?: string
  adminPassword?: string
  /** Máximo que um beneficiário pode receber por mês, em cêntimos. */
  maxMonthlyCents: number
  /** Um ciclo de distribuição só corre com pelo menos este número de doadores diferentes (anonimato). */
  minDonorsPerCycle: number
  /** Limiar de pobreza mensal, em cêntimos. Atualizar com o valor oficial mais recente do INE. */
  povertyLineCents: number
  /** Número de revisores diferentes que têm de aprovar um pedido (mínimo 2). */
  approvalsRequired: number
  /** Validade de uma aprovação, em dias. Depois disso o beneficiário volta a provar a necessidade. */
  approvalValidDays: number
  /** Doação mínima e máxima por operação, em cêntimos. */
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
      console.warn('[mao-amiga] AVISO: a usar uma chave de desenvolvimento. Nunca usar assim em produção.')
    }
    masterKeyHex = DEV_KEY
  }
  const int = (name: string, fallback: number) => {
    const v = env[name]
    const n = v === undefined || v === '' ? fallback : Number(v)
    if (!Number.isInteger(n) || n < 0) throw new Error(`${name} tem de ser um número inteiro.`)
    return n
  }
  return {
    port: int('PORT', 8787),
    dbPath: env.DB_PATH || './data/mao-amiga.db',
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
    maxMonthlyCents: int('MAX_MONTHLY_CENTS', 30000),
    minDonorsPerCycle: int('MIN_DONORS_PER_CYCLE', 5),
    povertyLineCents: int('POVERTY_LINE_CENTS', 63600),
    approvalsRequired: Math.max(2, int('APPROVALS_REQUIRED', 2)),
    approvalValidDays: int('APPROVAL_VALID_DAYS', 180),
    minDonationCents: int('MIN_DONATION_CENTS', 500),
    maxDonationCents: int('MAX_DONATION_CENTS', 1000000),
  }
}
