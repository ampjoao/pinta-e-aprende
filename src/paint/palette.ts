/**
 * 12 colours. Each has a symbol so colour-blind children can tell them apart,
 * and an `ink` colour for drawing that symbol with enough contrast.
 */
export type SymbolName =
  | 'heart' | 'triangle' | 'star' | 'leaf' | 'drop' | 'square'
  | 'diamond' | 'flower' | 'moon' | 'circle' | 'plus' | 'hexagon'

export interface PaletteColor {
  id: string
  hex: string
  symbol: SymbolName
  ink: string
}

export const PALETTE: PaletteColor[] = [
  { id: 'red', hex: '#EF4444', symbol: 'heart', ink: '#ffffff' },
  { id: 'orange', hex: '#F97316', symbol: 'triangle', ink: '#ffffff' },
  { id: 'yellow', hex: '#FACC15', symbol: 'star', ink: '#7a5b00' },
  { id: 'green', hex: '#22C55E', symbol: 'leaf', ink: '#ffffff' },
  { id: 'lightblue', hex: '#7DD3FC', symbol: 'drop', ink: '#075985' },
  { id: 'blue', hex: '#2563EB', symbol: 'square', ink: '#ffffff' },
  { id: 'purple', hex: '#9333EA', symbol: 'diamond', ink: '#ffffff' },
  { id: 'pink', hex: '#F9A8D4', symbol: 'flower', ink: '#9d174d' },
  { id: 'brown', hex: '#A0522D', symbol: 'moon', ink: '#ffffff' },
  { id: 'black', hex: '#1F2937', symbol: 'circle', ink: '#ffffff' },
  { id: 'grey', hex: '#9CA3AF', symbol: 'plus', ink: '#ffffff' },
  { id: 'white', hex: '#FFFFFF', symbol: 'hexagon', ink: '#6b7280' },
]

export function getColor(id: string): PaletteColor | undefined {
  return PALETTE.find((c) => c.id === id)
}
