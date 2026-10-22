import { describe, expect, it } from 'vitest'
import { translateDrawing } from '../i18n/locales'
import { drawings, getDrawing } from './registry'

describe('drawings', () => {
  it('loads the lion', () => {
    const leao = getDrawing('leao')
    expect(leao?.category).toBe('animais')
    expect(leao?.svg).toContain('<svg')
  })

  it.each(drawings.map((d) => [d.id, d] as const))('%s: every zone exists in the SVG and vice versa', (_, d) => {
    const doc = new DOMParser().parseFromString(d.svg, 'image/svg+xml')
    const inSvg = [...doc.querySelectorAll('[data-zone]')].map((el) => el.getAttribute('data-zone'))
    expect(new Set(inSvg)).toEqual(new Set(d.zones.map((z) => z.id)))
  })

  it.each(drawings.map((d) => [d.id, d] as const))('%s: has a title and a sentence for every zone', (_, d) => {
    expect(translateDrawing('pt-PT', d.id, 'title')).not.toBe(`${d.id}.title`)
    for (const z of d.zones) {
      expect(translateDrawing('pt-PT', d.id, `parts.${z.id}`)).not.toBe(`${d.id}.parts.${z.id}`)
    }
  })
})
