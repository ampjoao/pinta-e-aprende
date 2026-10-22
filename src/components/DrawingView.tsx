import { useLayoutEffect, useMemo, useRef, type MouseEvent } from 'react'
import { getColor } from '../paint/palette'
import type { Fills } from '../paint/state'

interface Props {
  svg: string
  fills: Fills
  label: string
  /** When set, zones are tappable. */
  onZoneTap?: (zone: string) => void
}

export function DrawingView({ svg, fills, label, onZoneTap }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const html = useMemo(() => ({ __html: svg }), [svg])

  useLayoutEffect(() => {
    ref.current?.querySelectorAll('[data-zone]').forEach((el) => {
      const color = fills[el.getAttribute('data-zone')!]
      el.setAttribute('fill', (color && getColor(color)?.hex) || '#FFFFFF')
    })
  }, [fills, svg])

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    const zone = (e.target as Element).closest('[data-zone]')
    if (!zone || !onZoneTap) return
    // restart the "pop" animation
    zone.classList.remove('pop')
    zone.getBoundingClientRect()
    zone.classList.add('pop')
    onZoneTap(zone.getAttribute('data-zone')!)
  }

  return (
    <div
      ref={ref}
      className={`drawing${onZoneTap ? ' interactive' : ''}`}
      role="img"
      aria-label={label}
      onClick={handleClick}
      dangerouslySetInnerHTML={html}
    />
  )
}
