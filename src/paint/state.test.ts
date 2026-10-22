import { describe, expect, it } from 'vitest'
import { MAX_HISTORY, canUndo, createPaintState, paintReducer, paintZone, reset, undo } from './state'

describe('paint state', () => {
  it('starts empty and not undoable', () => {
    const s = createPaintState()
    expect(s.fills).toEqual({})
    expect(canUndo(s)).toBe(false)
  })

  it('paints a zone', () => {
    const s = paintZone(createPaintState(), 'juba', 'yellow')
    expect(s.fills).toEqual({ juba: 'yellow' })
    expect(canUndo(s)).toBe(true)
  })

  it('ignores painting the same colour twice', () => {
    const s1 = paintZone(createPaintState(), 'juba', 'yellow')
    expect(paintZone(s1, 'juba', 'yellow')).toBe(s1)
  })

  it('erases a zone with null', () => {
    const s = paintZone(paintZone(createPaintState(), 'juba', 'yellow'), 'juba', null)
    expect(s.fills).toEqual({})
  })

  it('erasing an empty zone does nothing', () => {
    const s = createPaintState()
    expect(paintZone(s, 'juba', null)).toBe(s)
  })

  it('undo restores the previous fills', () => {
    let s = paintZone(createPaintState(), 'juba', 'yellow')
    s = paintZone(s, 'juba', 'orange')
    s = undo(s)
    expect(s.fills).toEqual({ juba: 'yellow' })
    s = undo(s)
    expect(s.fills).toEqual({})
    expect(canUndo(s)).toBe(false)
  })

  it('undo with no history is a no-op', () => {
    const s = createPaintState()
    expect(undo(s)).toBe(s)
  })

  it('reset clears everything but can be undone', () => {
    let s = paintZone(paintZone(createPaintState(), 'juba', 'yellow'), 'corpo', 'orange')
    s = reset(s)
    expect(s.fills).toEqual({})
    s = undo(s)
    expect(s.fills).toEqual({ juba: 'yellow', corpo: 'orange' })
  })

  it('reset on an empty drawing does nothing', () => {
    const s = createPaintState()
    expect(reset(s)).toBe(s)
  })

  it('caps the history', () => {
    let s = createPaintState()
    for (let i = 0; i < MAX_HISTORY + 20; i++) s = paintZone(s, 'z', i % 2 ? 'red' : 'blue')
    expect(s.history.length).toBe(MAX_HISTORY)
  })

  it('reducer handles paint, undo and reset', () => {
    let s = paintReducer(createPaintState(), { type: 'paint', zone: 'sol', color: 'yellow' })
    expect(s.fills.sol).toBe('yellow')
    s = paintReducer(s, { type: 'reset' })
    expect(s.fills).toEqual({})
    s = paintReducer(s, { type: 'undo' })
    expect(s.fills.sol).toBe('yellow')
  })
})
