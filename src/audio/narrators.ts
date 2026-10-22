import { effectiveVolume, type AudioSettings } from './settings'

/** Something the app wants to say. `id` is the translation key (used for recorded files). */
export interface SpeechLine {
  id: string
  text: string
  lang: string
}

export interface Narrator {
  canSpeak(line: SpeechLine): boolean
  /** Resolves true if the line was spoken. */
  speak(line: SpeechLine): Promise<boolean>
  stop(): void
}

const norm = (lang: string) => lang.replace('_', '-').toLowerCase()

/** Picks a voice: exact language match first, then same base language; prefers on-device voices. */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
): { voice: SpeechSynthesisVoice; match: 'exact' | 'language' } | null {
  const target = norm(lang)
  const base = target.split('-')[0]
  const best = (list: SpeechSynthesisVoice[]) => list.find((v) => v.localService) ?? list[0]
  const exact = voices.filter((v) => norm(v.lang) === target)
  if (exact.length) return { voice: best(exact), match: 'exact' }
  const sameBase = voices.filter((v) => norm(v.lang).split('-')[0] === base)
  if (sameBase.length) return { voice: best(sameBase), match: 'language' }
  return null
}

/** Uses the device's built-in text-to-speech. */
export class SpeechSynthesisNarrator implements Narrator {
  constructor(
    private synth: SpeechSynthesis | undefined,
    private getSettings: () => AudioSettings,
    private rate = 0.9,
  ) {}

  private voices(): SpeechSynthesisVoice[] {
    return this.synth?.getVoices() ?? []
  }

  canSpeak(line: SpeechLine): boolean {
    if (!this.synth) return false
    const voices = this.voices()
    // Some browsers load voices lazily: an empty list means "try anyway".
    return voices.length === 0 || pickVoice(voices, line.lang) !== null
  }

  speak(line: SpeechLine): Promise<boolean> {
    const synth = this.synth
    if (!synth || !this.canSpeak(line)) return Promise.resolve(false)
    synth.cancel()
    const u = new SpeechSynthesisUtterance(line.text)
    u.lang = line.lang
    const picked = pickVoice(this.voices(), line.lang)
    if (picked) u.voice = picked.voice
    u.volume = effectiveVolume(this.getSettings())
    u.rate = this.rate
    u.pitch = 1.1
    return new Promise((resolve) => {
      let done = false
      const finish = (ok: boolean) => {
        if (done) return
        done = true
        clearTimeout(timer)
        resolve(ok)
      }
      // Safety net: some engines never fire onend.
      const timer = setTimeout(() => finish(true), 2500 + line.text.length * 120)
      u.onend = () => finish(true)
      u.onerror = (e) => finish(e.error === 'interrupted' || e.error === 'canceled')
      synth.speak(u)
    })
  }

  stop() {
    this.synth?.cancel()
  }
}

/** Plays recorded voice files: public/audio/<lang>/<id>.mp3, listed in content/audio/manifest.json. */
export class RecordedNarrator implements Narrator {
  private current: HTMLAudioElement | null = null

  constructor(
    private available: Set<string>,
    private getSettings: () => AudioSettings,
    private baseUrl = './audio',
    private createAudio: () => HTMLAudioElement = () => new Audio(),
  ) {}

  static fileKey(line: SpeechLine): string {
    return `${line.lang}/${line.id}`
  }

  canSpeak(line: SpeechLine): boolean {
    return this.available.has(RecordedNarrator.fileKey(line))
  }

  speak(line: SpeechLine): Promise<boolean> {
    if (!this.canSpeak(line)) return Promise.resolve(false)
    this.stop()
    const audio = this.createAudio()
    this.current = audio
    audio.src = `${this.baseUrl}/${RecordedNarrator.fileKey(line)}.mp3`
    audio.volume = effectiveVolume(this.getSettings())
    return new Promise((resolve) => {
      audio.onended = () => resolve(true)
      audio.onerror = () => resolve(false)
      audio.play().catch(() => resolve(false))
    })
  }

  stop() {
    this.current?.pause()
    this.current = null
  }
}

/** Tries each narrator in order (recorded voice first, then text-to-speech). */
export class ChainNarrator implements Narrator {
  constructor(private narrators: Narrator[]) {}

  canSpeak(line: SpeechLine): boolean {
    return this.narrators.some((n) => n.canSpeak(line))
  }

  async speak(line: SpeechLine): Promise<boolean> {
    this.stop()
    for (const n of this.narrators) {
      if (n.canSpeak(line) && (await n.speak(line))) return true
    }
    return false
  }

  stop() {
    this.narrators.forEach((n) => n.stop())
  }
}
