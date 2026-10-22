/** Volume / mute, remembered on this device. */
export interface AudioSettings {
  volume: number
  muted: boolean
}

const KEY = 'pinta.audio'
const DEFAULTS: AudioSettings = { volume: 0.9, muted: false }

function load(): AudioSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* storage unavailable: use defaults */
  }
  return DEFAULTS
}

let current = load()
const listeners = new Set<() => void>()

export const audioSettings = {
  get(): AudioSettings {
    return current
  },
  set(patch: Partial<AudioSettings>) {
    current = { ...current, ...patch }
    try {
      localStorage.setItem(KEY, JSON.stringify(current))
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l())
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export function effectiveVolume(s: AudioSettings): number {
  return s.muted ? 0 : Math.min(1, Math.max(0, s.volume))
}
