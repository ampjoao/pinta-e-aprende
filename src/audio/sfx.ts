import { effectiveVolume, type AudioSettings } from './settings'

interface Note {
  freq: number
  at: number
  dur: number
  type?: OscillatorType
}

/** Small sound effects generated in code (no audio files, no licences). */
export function createSfx(getSettings: () => AudioSettings) {
  let ctx: AudioContext | null = null

  function context(): AudioContext | null {
    if (typeof window === 'undefined' || !('AudioContext' in window)) return null
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }

  function play(notes: Note[], gain = 0.25) {
    const volume = effectiveVolume(getSettings())
    const ac = volume > 0 ? context() : null
    if (!ac) return
    const now = ac.currentTime
    for (const n of notes) {
      const osc = ac.createOscillator()
      const g = ac.createGain()
      osc.type = n.type ?? 'sine'
      osc.frequency.setValueAtTime(n.freq, now + n.at)
      g.gain.setValueAtTime(0.0001, now + n.at)
      g.gain.exponentialRampToValueAtTime(gain * volume, now + n.at + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + n.at + n.dur)
      osc.connect(g).connect(ac.destination)
      osc.start(now + n.at)
      osc.stop(now + n.at + n.dur + 0.05)
    }
  }

  return {
    pop() {
      play([
        { freq: 520, at: 0, dur: 0.12 },
        { freq: 780, at: 0.05, dur: 0.15 },
      ])
    },
    soft() {
      play([{ freq: 440, at: 0, dur: 0.18, type: 'triangle' }], 0.15)
    },
    sparkle() {
      play(
        [523, 659, 784, 1047].map((freq, i) => ({ freq, at: i * 0.09, dur: 0.25, type: 'triangle' as const })),
        0.2,
      )
    },
  }
}
