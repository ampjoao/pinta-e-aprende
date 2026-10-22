import { PALETTE } from '../paint/palette'
import { ColorSymbol } from './ColorSymbol'
import { Icon } from './Icon'

export type Tool = { kind: 'color'; color: string } | { kind: 'eraser' }

interface Props {
  tool: Tool
  colorName: (id: string) => string
  eraserLabel: string
  onPick: (tool: Tool) => void
}

export function Palette({ tool, colorName, eraserLabel, onPick }: Props) {
  return (
    <div className="palette" role="toolbar">
      {PALETTE.map((c) => {
        const selected = tool.kind === 'color' && tool.color === c.id
        return (
          <button
            key={c.id}
            className={`swatch${selected ? ' selected' : ''}`}
            style={{ background: c.hex }}
            aria-label={colorName(c.id)}
            aria-pressed={selected}
            onClick={() => onPick({ kind: 'color', color: c.id })}
          >
            <ColorSymbol symbol={c.symbol} color={c.ink} />
          </button>
        )
      })}
      <button
        className={`swatch eraser${tool.kind === 'eraser' ? ' selected' : ''}`}
        aria-label={eraserLabel}
        aria-pressed={tool.kind === 'eraser'}
        onClick={() => onPick({ kind: 'eraser' })}
      >
        <Icon name="eraser" size={34} />
      </button>
    </div>
  )
}
