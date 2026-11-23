/**
 * Línguas da app. Para acrescentar uma: criar src/i18n/<código>.ts com todas as chaves de en.ts
 * (o TypeScript avisa se faltar alguma), juntar aqui em LANGUAGES e no servidor em server/messages.ts.
 * Línguas da direita para a esquerda (árabe, hebraico, persa, urdu) já ficam com dir="rtl".
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { setApiLanguage } from '../api'
import { en, type Dict, type Key } from './en'
import { es } from './es'
import { fr } from './fr'
import { ptBR } from './pt-BR'
import { ptPT } from './pt-PT'

export const LANGUAGES: { code: string; label: string; dict: Dict }[] = [
  { code: 'en', label: 'English', dict: en },
  { code: 'es', label: 'Español', dict: es },
  { code: 'fr', label: 'Français', dict: fr },
  { code: 'pt-BR', label: 'Português (Brasil)', dict: ptBR },
  { code: 'pt-PT', label: 'Português (Portugal)', dict: ptPT },
]
const RTL = ['ar', 'he', 'fa', 'ur']
const STORAGE_KEY = 'mao-amiga.language'

/** Escolhe a língua guardada, senão a do aparelho, senão inglês. */
export function detectLanguage(preferred: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages ?? []): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved
  } catch {
    /* sem armazenamento */
  }
  for (const p of preferred) {
    const exact = LANGUAGES.find((l) => l.code.toLowerCase() === p.toLowerCase())
    if (exact) return exact.code
    const base = p.split('-')[0].toLowerCase()
    if (base === 'pt') return p.toUpperCase().endsWith('BR') ? 'pt-BR' : 'pt-PT'
    const prefix = LANGUAGES.find((l) => l.code.split('-')[0] === base)
    if (prefix) return prefix.code
  }
  return 'en'
}

type Params = Record<string, string | number>

const decimalsOf = (currency: string) =>
  new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2

export function makeLocale(lang: string) {
  const dict = LANGUAGES.find((l) => l.code === lang)?.dict ?? en
  const t = (key: Key, params: Params = {}) =>
    (dict[key] ?? en[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => (params[name] === undefined ? `{${name}}` : String(params[name])))
  const regions = new Intl.DisplayNames([lang, 'en'], { type: 'region' })
  const currencies = new Intl.DisplayNames([lang, 'en'], { type: 'currency' })
  const dateFmt = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' })
  return {
    lang,
    t,
    /** Valor em unidades mínimas (cêntimos, centavos...) → texto com moeda. */
    money: (minor: number, currency: string) =>
      new Intl.NumberFormat(lang, { style: 'currency', currency }).format(minor / 10 ** decimalsOf(currency)),
    /** "12,50" ou "12.50" → unidades mínimas. null se não for um valor válido. */
    parseMoney: (text: string, currency: string): number | null => {
      const decimals = decimalsOf(currency)
      const clean = text.replace(/[\s ']/g, '').replace(/[^\d.,]/g, '')
      // A última vírgula ou ponto com 1-2 dígitos a seguir é o separador decimal; os outros são milhares.
      const m = /^(.*?)(?:[.,](\d{1,2}))?$/.exec(clean)
      if (!m || !/^[\d.,]*$/.test(m[1]) || !m[1].replace(/[.,]/g, '')) return null
      const whole = m[1].replace(/[.,]/g, '')
      const frac = decimals === 0 ? '' : (m[2] ?? '').padEnd(decimals, '0').slice(0, decimals)
      if (decimals === 0 && m[2]) return null
      return Number(whole + frac)
    },
    date: (ms: number) => dateFmt.format(new Date(ms)),
    country: (code: string) => regions.of(code) ?? code,
    currencyName: (code: string) => currencies.of(code) ?? code,
  }
}

export type Locale = ReturnType<typeof makeLocale> & { setLang: (code: string) => void }

const LocaleContext = createContext<Locale | null>(null)

export function LocaleProvider({ children, initial }: { children: ReactNode; initial?: string }) {
  const [lang, setLangState] = useState(() => initial ?? detectLanguage())
  const value = useMemo(() => ({ ...makeLocale(lang), setLang: setLangState }), [lang])
  useEffect(() => {
    setApiLanguage(lang)
    document.documentElement.lang = lang
    document.documentElement.dir = RTL.includes(lang.split('-')[0]) ? 'rtl' : 'ltr'
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* sem armazenamento */
    }
  }, [lang])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): Locale {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale fora de LocaleProvider')
  return ctx
}
