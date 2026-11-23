/** Cliente do servidor. O endereço vem de VITE_API_URL (ver README). */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8787'

const TOKEN_KEY = 'gota-a-gota.token'
let language = 'en'

/** Língua pedida ao servidor para as mensagens de erro. */
export const setApiLanguage = (lang: string) => {
  language = lang
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* sem armazenamento: a sessão dura só enquanto a app estiver aberta */
  }
}

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'accept-language': language }
  const token = getToken()
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  let res: Response
  try {
    res = await fetch(API_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'network', '')
  }
  const data = (await res.json().catch(() => null)) as { code?: string; error?: string } | null
  if (!res.ok) {
    if (res.status === 401) setToken(null)
    throw new ApiError(res.status, data?.code ?? 'unexpected', data?.error ?? '')
  }
  return data as T
}

// Tipos das respostas
export type Role = 'donor' | 'beneficiary' | 'reviewer' | 'admin'
export type PayoutType = 'iban' | 'pix' | 'mobile_money' | 'bank_account' | 'wallet'
export type IdType = 'nif' | 'cpf' | 'dni' | 'national_id'

export interface Me {
  email: string
  role: Role
  suspended: boolean
  identityVerified: boolean
  country: string | null
  reviewCountries: string[]
}
export interface Country {
  code: string
  currency: string
  idType: IdType
  payoutMethods: PayoutType[]
  maxMonthlyMinor: number
  ageOfMajority: number
}
export interface Catalog {
  baseCurrency: string
  donationCurrencies: string[]
  donationPresets: Record<string, number[]>
  minDonationMinor: number
  maxDonationMinor: number
  countries: Country[]
}
export interface Stats {
  currency: string
  donors: number | null
  donatedMinor: number | null
  peopleHelped: number | null
  distributedMinor: number | null
  cycles: number
  minGroup: number
}
export interface Note {
  text: string
  createdAt: number
}
export interface DocumentMeta {
  id: string
  kind: string
  filename: string
  mime: string
  size: number
}
export type ApplicationStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended' | 'expired'
export interface Application {
  status: ApplicationStatus
  currency: string
  householdAdults: number | null
  householdChildren: number | null
  monthlyIncomeMinor: number | null
  monthlyExpensesMinor: number | null
  category: string | null
  description: string | null
  requestedMinor: number | null
  payoutType: PayoutType | null
  payoutMasked: string | null
  decisionNote: string | null
  validUntil: number | null
  documents: DocumentMeta[]
}
export interface ApplicationResponse {
  country: Country | null
  application: Application | null
}
export interface Donation {
  id: string
  amountMinor: number
  currency: string
  baseAmountMinor: number
  baseCurrency: string
  createdAt: number
  distributed: boolean
}
export interface Payout {
  baseAmountMinor: number
  baseCurrency: string
  localAmountMinor: number
  localCurrency: string
  status: string
  createdAt: number
}
export interface QueueItem {
  id: string
  alias: string
  country: string
  currency: string
  category: string
  householdAdults: number
  householdChildren: number
  requestedMinor: number
  submittedAt: number
  approvals: number
  approvalsRequired: number
  myVote: string | null
}
export interface ReviewDetail {
  id: string
  alias: string
  status: string
  country: string
  currency: string
  legalName: string | null
  age: number | null
  householdAdults: number
  householdChildren: number
  monthlyIncomeMinor: number
  monthlyExpensesMinor: number
  category: string
  description: string
  requestedMinor: number
  payoutType: PayoutType | null
  payoutMasked: string | null
  documents: DocumentMeta[]
  myVote: string | null
  checks: {
    equivalentIncomeMinor: number
    povertyLineMinor: number
    povertyLineIsExample: boolean
    belowPovertyLine: boolean
    expensesExceedIncome: boolean
    documentsSeenInOtherAccounts: number
    previousRejections: number
  }
}
export interface Cycle {
  id: string
  runAt: number
  currency: string
  poolMinor: number
  distributedMinor: number
  donorCount: number
  beneficiaryCount: number
}
