import { describe, expect, it } from 'vitest'
import { locales, pickLocale, translate, translateDrawing } from './locales'

describe('locales', () => {
  it('loads pt-PT from content/', () => {
    expect(locales['pt-PT'].name).toBe('Português (Portugal)')
    expect(locales['pt-PT'].dir).toBe('ltr')
  })

  it('translates UI keys', () => {
    expect(translate('pt-PT', 'colors.yellow')).toBe('Amarelo')
  })

  it('falls back to pt-PT for unknown languages', () => {
    expect(translate('xx', 'colors.red')).toBe('Vermelho')
  })

  it('returns the key when missing everywhere', () => {
    expect(translate('pt-PT', 'nope.nothing')).toBe('nope.nothing')
  })

  it('translates drawing keys', () => {
    expect(translateDrawing('pt-PT', 'leao', 'title')).toBe('O Leão')
    expect(translateDrawing('pt-PT', 'leao', 'parts.juba')).toBe('Isto é a juba do leão!')
  })

  it('picks exact, then same-language, then fallback', () => {
    const available = ['pt-PT', 'en-GB']
    expect(pickLocale(['en-GB'], available)).toBe('en-GB')
    expect(pickLocale(['pt_BR'], available)).toBe('pt-PT')
    expect(pickLocale(['en-US'], available)).toBe('en-GB')
    expect(pickLocale(['fr-FR'], available)).toBe('pt-PT')
    expect(pickLocale([], available)).toBe('pt-PT')
  })
})
