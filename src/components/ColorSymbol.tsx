import type { SymbolName } from '../paint/palette'

const SYMBOLS: Record<SymbolName, string> = {
  heart: 'M12 21C5 15 2 11.5 2 8a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 3.5-3 7-10 13Z',
  triangle: 'M12 3 22 20H2Z',
  star: 'M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7Z',
  leaf: 'M4 20C4 9 10 4 21 3c-1 11-6 17-17 17Z',
  drop: 'M12 2s-7 8-7 13a7 7 0 0 0 14 0c0-5-7-13-7-13Z',
  square: 'M4 4h16v16H4Z',
  diamond: 'M12 2l9 10-9 10-9-10Z',
  flower:
    'M12 7.5a3.5 3.5 0 1 1 0-.01ZM7 11a3.5 3.5 0 1 1 0-.01ZM17 11a3.5 3.5 0 1 1 0-.01ZM9 17a3.5 3.5 0 1 1 0-.01ZM15 17a3.5 3.5 0 1 1 0-.01Z',
  moon: 'M15 2.5A9.5 9.5 0 1 0 21.5 16 7.5 7.5 0 1 1 15 2.5Z',
  circle: 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z',
  plus: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z',
  hexagon: 'M12 2l9 5v10l-9 5-9-5V7Z',
}

export function ColorSymbol({ symbol, color, size = 28 }: { symbol: SymbolName; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={SYMBOLS[symbol]} fill={color} />
    </svg>
  )
}
