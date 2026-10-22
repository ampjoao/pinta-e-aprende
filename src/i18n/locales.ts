/**
 * Locales live in content/locales/<code>/ui.json (+ drawings.json).
 * Adding a folder adds a language. Missing strings fall back to pt-PT.
 */
type Json = { [key: string]: unknown }

export interface Locale {
  code: string
  name: string
  dir: 'ltr' | 'rtl'
  ui: Json
  drawings: Json
}

export const FALLBACK_LOCALE = 'pt-PT'

const uiFiles = import.meta.glob<Json>('../../content/locales/*/ui.json', { eager: true, import: 'default' })
const drawingFiles = import.meta.glob<Json>('../../content/locales/*/drawings.json', {
  eager: true,
  import: 'default',
})

function codeFromPath(path: string): string {
  return path.split('/').slice(-2, -1)[0]
}

export const locales: Record<string, Locale> = Object.fromEntries(
  Object.entries(uiFiles).map(([path, ui]) => {
    const code = codeFromPath(path)
    const meta = (ui.meta ?? {}) as Json
    const drawings = drawingFiles[path.replace('ui.json', 'drawings.json')] ?? {}
    return [code, { code, name: String(meta.name ?? code), dir: meta.dir === 'rtl' ? 'rtl' : 'ltr', ui, drawings }]
  }),
)

function lookup(obj: Json, key: string): string | undefined {
  let cur: unknown = obj
  for (const part of key.split('.')) {
    if (cur === undefined || typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Json)[part]
  }
  return typeof cur === 'string' ? cur : undefined
}

/** UI string, e.g. translate('pt-PT', 'colors.red'). Returns the key if missing everywhere. */
export function translate(lang: string, key: string): string {
  return lookup(locales[lang]?.ui ?? {}, key) ?? lookup(locales[FALLBACK_LOCALE]?.ui ?? {}, key) ?? key
}

/** Drawing string, e.g. translateDrawing('pt-PT', 'leao', 'parts.juba'). */
export function translateDrawing(lang: string, drawingId: string, key: string): string {
  const full = `${drawingId}.${key}`
  return (
    lookup(locales[lang]?.drawings ?? {}, full) ??
    lookup(locales[FALLBACK_LOCALE]?.drawings ?? {}, full) ??
    full
  )
}

/** Picks the best available locale for the browser's language list. */
export function pickLocale(
  preferred: readonly string[],
  available: string[] = Object.keys(locales),
  fallback: string = FALLBACK_LOCALE,
): string {
  const lower = available.map((c) => c.toLowerCase())
  for (const pref of preferred) {
    const p = pref.toLowerCase().replace('_', '-')
    const exact = lower.indexOf(p)
    if (exact >= 0) return available[exact]
    const base = p.split('-')[0]
    const partial = lower.findIndex((c) => c.split('-')[0] === base)
    if (partial >= 0) return available[partial]
  }
  return fallback
}
