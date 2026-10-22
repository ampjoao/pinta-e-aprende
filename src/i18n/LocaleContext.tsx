import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { locales, pickLocale, translate, translateDrawing } from './locales'
import type { SpeechLine } from '../audio/narrators'

interface LocaleValue {
  lang: string
  setLang: (lang: string) => void
  t: (key: string) => string
  dt: (drawingId: string, key: string) => string
  /** A speakable line for a UI key. */
  line: (key: string) => SpeechLine
  /** A speakable line for a drawing key. */
  drawingLine: (drawingId: string, key: string) => SpeechLine
}

const LocaleContext = createContext<LocaleValue | null>(null)

function browserLocale(): string {
  return pickLocale(typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [])
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState(browserLocale)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = locales[lang]?.dir ?? 'ltr'
  }, [lang])

  const value = useMemo<LocaleValue>(
    () => ({
      lang,
      setLang,
      t: (key) => translate(lang, key),
      dt: (id, key) => translateDrawing(lang, id, key),
      line: (key) => ({ id: key, text: translate(lang, key), lang }),
      drawingLine: (id, key) => ({ id: `drawings.${id}.${key}`, text: translateDrawing(lang, id, key), lang }),
    }),
    [lang],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used inside LocaleProvider')
  return ctx
}
