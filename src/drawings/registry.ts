/**
 * Every folder in content/drawings/<id>/ with a drawing.json + drawing.svg
 * becomes a drawing. Zones in the SVG are marked with data-zone="<zone id>".
 */
export interface Zone {
  id: string
  /** Optional sound effect played when this zone is tapped (future phases). */
  sound?: string
}

export interface DrawingMeta {
  id: string
  category: string
  zones: Zone[]
}

export interface Drawing extends DrawingMeta {
  svg: string
}

const metas = import.meta.glob<DrawingMeta>('../../content/drawings/*/drawing.json', {
  eager: true,
  import: 'default',
})
const svgs = import.meta.glob<string>('../../content/drawings/*/drawing.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
})

export const drawings: Drawing[] = Object.entries(metas).map(([path, meta]) => {
  const svg = svgs[path.replace('drawing.json', 'drawing.svg')]
  if (!svg) throw new Error(`Missing drawing.svg next to ${path}`)
  return { ...meta, svg }
})

export function getDrawing(id: string): Drawing | undefined {
  return drawings.find((d) => d.id === id)
}
