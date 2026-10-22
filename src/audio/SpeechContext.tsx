import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import manifest from '../../content/audio/manifest.json'
import { ChainNarrator, RecordedNarrator, SpeechSynthesisNarrator, type SpeechLine } from './narrators'
import { audioSettings } from './settings'
import { createSfx } from './sfx'

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined

export const narrator = new ChainNarrator([
  new RecordedNarrator(new Set(manifest.files as string[]), audioSettings.get),
  new SpeechSynthesisNarrator(synth, audioSettings.get),
])

export const sfx = createSfx(audioSettings.get)

interface SpeechValue {
  /** Speaks a line and shows it as a caption. */
  say: (line: SpeechLine) => void
  /** Repeats the last line. Returns false if nothing was said yet. */
  repeat: () => boolean
  caption: string | null
}

const SpeechContext = createContext<SpeechValue | null>(null)

export function SpeechProvider({ children }: { children: ReactNode }) {
  const [caption, setCaption] = useState<string | null>(null)
  const last = useRef<SpeechLine | null>(null)
  const seq = useRef(0)

  const say = useCallback((line: SpeechLine) => {
    last.current = line
    const id = ++seq.current
    setCaption(line.text)
    void narrator.speak(line).then((spoken) => {
      // Without a voice, keep the caption up longer so it can be read.
      setTimeout(() => {
        if (seq.current === id) setCaption(null)
      }, spoken ? 800 : 4000)
    })
  }, [])

  const repeat = useCallback(() => {
    if (!last.current) return false
    say(last.current)
    return true
  }, [say])

  const value = useMemo(() => ({ say, repeat, caption }), [say, repeat, caption])
  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>
}

export function useSpeech(): SpeechValue {
  const ctx = useContext(SpeechContext)
  if (!ctx) throw new Error('useSpeech must be used inside SpeechProvider')
  return ctx
}
