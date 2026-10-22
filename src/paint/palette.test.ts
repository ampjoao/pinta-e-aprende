import { describe, expect, it } from 'vitest'
import { translate } from '../i18n/locales'
import { PALETTE, getColor } from './palette'

describe('palette', () => {
  it('has 12 colours, each with a unique symbol', () => {
    expect(PALETTE).toHaveLength(12)
    expect(new Set(PALETTE.map((c) => c.symbol)).size).toBe(12)
  })

  it('every colour has a pt-PT name', () => {
    for (const c of PALETTE) expect(translate('pt-PT', `colors.${c.id}`)).not.toBe(`colors.${c.id}`)
  })

  it('looks colours up by id', () => {
    expect(getColor('yellow')?.hex).toBe('#FACC15')
    expect(getColor('nope')).toBeUndefined()
  })
})
