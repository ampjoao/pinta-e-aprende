/** Pure paint state: which colour each zone has, plus an undo history. */
export type Fills = Record<string, string>

export interface PaintState {
  fills: Fills
  history: Fills[]
}

export type PaintAction =
  | { type: 'paint'; zone: string; color: string | null }
  | { type: 'undo' }
  | { type: 'reset' }

export const MAX_HISTORY = 100

export function createPaintState(fills: Fills = {}): PaintState {
  return { fills, history: [] }
}

function commit(state: PaintState, fills: Fills): PaintState {
  return { fills, history: [...state.history, state.fills].slice(-MAX_HISTORY) }
}

/** color === null erases the zone. Painting the same colour is a no-op. */
export function paintZone(state: PaintState, zone: string, color: string | null): PaintState {
  if ((state.fills[zone] ?? null) === color) return state
  const fills = { ...state.fills }
  if (color === null) delete fills[zone]
  else fills[zone] = color
  return commit(state, fills)
}

export function canUndo(state: PaintState): boolean {
  return state.history.length > 0
}

export function undo(state: PaintState): PaintState {
  if (!canUndo(state)) return state
  return { fills: state.history[state.history.length - 1], history: state.history.slice(0, -1) }
}

/** Clears everything, but stays undoable so nothing is lost by accident. */
export function reset(state: PaintState): PaintState {
  if (Object.keys(state.fills).length === 0) return state
  return commit(state, {})
}

export function paintReducer(state: PaintState, action: PaintAction): PaintState {
  switch (action.type) {
    case 'paint':
      return paintZone(state, action.zone, action.color)
    case 'undo':
      return undo(state)
    case 'reset':
      return reset(state)
  }
}
