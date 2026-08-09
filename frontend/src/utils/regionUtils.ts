import type { Region, RegionLabel } from '../types'

export const LABELS: RegionLabel[] = [
  'wall',
  'window',
  'door',
  'balcony',
  'pillar',
  'parapet',
  'gate',
  'roof_edge',
  'floor',
]

export const LABEL_TEXT: Record<RegionLabel, string> = {
  wall: 'Wall',
  window: 'Window',
  door: 'Door',
  balcony: 'Balcony',
  pillar: 'Pillar',
  parapet: 'Parapet',
  gate: 'Gate',
  roof_edge: 'Roof edge',
  floor: 'Floor',
}

const OPENING_LABELS = new Set<RegionLabel>(['window', 'door', 'gate'])

export const isOpening = (label: string | null | undefined): boolean =>
  !!label && OPENING_LABELS.has(label as RegionLabel)

export const REGION_COLORS: Record<RegionLabel, string> = {
  wall: '#3b82f6',
  window: '#22c55e',
  door: '#84cc16',
  balcony: '#f59e0b',
  pillar: '#a855f7',
  parapet: '#ef4444',
  gate: '#14b8a6',
  roof_edge: '#f97316',
  floor: '#64748b',
}

export function distance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function shoelaceArea(points: [number, number][]): number {
  const n = points.length
  if (n < 3) return 0
  let area = 0
  for (let i = 0; i < n; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % n]
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area) / 2
}

export function centroid(points: [number, number][]): [number, number] {
  if (points.length === 0) return [0, 0]
  let x = 0
  let y = 0
  for (const [px, py] of points) {
    x += px
    y += py
  }
  return [x / points.length, y / points.length]
}

export function pointInPolygon(
  pt: [number, number],
  poly: [number, number][],
): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    const intersect =
      yi > pt[1] !== yj > pt[1] &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function polygonInside(
  inner: [number, number][],
  outer: [number, number][],
): boolean {
  if (inner.length < 3) return false
  return inner.every((pt) => pointInPolygon(pt, outer))
}

export function polygonsOverlap(
  a: [number, number][],
  b: [number, number][],
): boolean {
  if (a.length < 3 || b.length < 3) return false
  return (
    a.some((pt) => pointInPolygon(pt, b)) ||
    b.some((pt) => pointInPolygon(pt, a))
  )
}

export function findCutouts(region: Region, all: Region[]): Region[] {
  return all.filter((c) => {
    if (c.id === region.id) return false
    if (isOpening(region.label)) return false
    if (isOpening(c.label)) {
      return polygonsOverlap(c.points, region.points)
    }
    return polygonInside(c.points, region.points)
  })
}

function effectiveAreaPx(
  points: [number, number][],
  cutouts: [number, number][][],
): number {
  const area = shoelaceArea(points)
  const holes = cutouts.reduce((sum, c) => sum + shoelaceArea(c), 0)
  return Math.max(0, area - holes)
}

export function areaSqftEffective(
  points: [number, number][],
  cutouts: [number, number][][],
  scaleFt: number | null,
  scalePx: number | null,
): number | null {
  if (!scaleFt || !scalePx) return null
  const fpp = scaleFt / scalePx
  return effectiveAreaPx(points, cutouts) * fpp * fpp
}
