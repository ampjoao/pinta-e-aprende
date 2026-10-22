import { describe, expect, it, vi } from 'vitest'
import { ChainNarrator, RecordedNarrator, pickVoice, type Narrator, type SpeechLine } from './narrators'
import { effectiveVolume } from './settings'

const voice = (lang: string, localService = false) => ({ lang, localService, name: lang }) as SpeechSynthesisVoice
const line: SpeechLine = { id: 'colors.red', text: 'Vermelho', lang: 'pt-PT' }

describe('pickVoice', () => {
  it('prefers an exact match', () => {
    expect(pickVoice([voice('pt-BR'), voice('pt-PT')], 'pt-PT')).toMatchObject({ match: 'exact', voice: { lang: 'pt-PT' } })
  })

  it('falls back to the same language', () => {
    expect(pickVoice([voice('en-US'), voice('pt_BR')], 'pt-PT')).toMatchObject({ match: 'language' })
  })

  it('prefers on-device voices', () => {
    expect(pickVoice([voice('pt-PT'), voice('pt-PT', true)], 'pt-PT')?.voice.localService).toBe(true)
  })

  it('returns null when nothing matches', () => {
    expect(pickVoice([voice('en-US')], 'pt-PT')).toBeNull()
  })
})

describe('RecordedNarrator', () => {
  it('only speaks lines that have a recording', () => {
    const n = new RecordedNarrator(new Set(['pt-PT/colors.red']), () => ({ volume: 1, muted: false }))
    expect(n.canSpeak(line)).toBe(true)
    expect(n.canSpeak({ ...line, id: 'colors.blue' })).toBe(false)
  })

  it('plays the right file at the right volume', async () => {
    const audio = { play: vi.fn(() => Promise.resolve()), pause: vi.fn() } as unknown as HTMLAudioElement
    const n = new RecordedNarrator(new Set(['pt-PT/colors.red']), () => ({ volume: 0.5, muted: false }), './audio', () => audio)
    const p = n.speak(line)
    expect(audio.src).toBe('./audio/pt-PT/colors.red.mp3')
    expect(audio.volume).toBe(0.5)
    audio.onended!(new Event('ended'))
    await expect(p).resolves.toBe(true)
  })
})

describe('ChainNarrator', () => {
  const fake = (can: boolean, ok: boolean): Narrator => ({
    canSpeak: () => can,
    speak: vi.fn(() => Promise.resolve(ok)),
    stop: vi.fn(),
  })

  it('uses the first narrator that can speak', async () => {
    const a = fake(false, true)
    const b = fake(true, true)
    expect(await new ChainNarrator([a, b]).speak(line)).toBe(true)
    expect(a.speak).not.toHaveBeenCalled()
    expect(b.speak).toHaveBeenCalled()
  })

  it('falls through when a narrator fails', async () => {
    const a = fake(true, false)
    const b = fake(true, true)
    expect(await new ChainNarrator([a, b]).speak(line)).toBe(true)
    expect(b.speak).toHaveBeenCalled()
  })

  it('returns false when nobody can speak', async () => {
    expect(await new ChainNarrator([fake(false, false)]).speak(line)).toBe(false)
  })
})

describe('effectiveVolume', () => {
  it('is 0 when muted and clamped otherwise', () => {
    expect(effectiveVolume({ volume: 0.7, muted: true })).toBe(0)
    expect(effectiveVolume({ volume: 2, muted: false })).toBe(1)
    expect(effectiveVolume({ volume: -1, muted: false })).toBe(0)
  })
})
