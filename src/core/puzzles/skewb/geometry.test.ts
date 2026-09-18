import { describe, expect, it } from 'vitest'
import { buildSkewbGeometry } from './geometry'

describe('skewb geometry', () => {
  it('produces 14 visible pieces (8 corners + 6 centres)', () => {
    expect(buildSkewbGeometry().pieces.length).toBe(14)
  })

  it('classifies into exactly 8 corners and 6 centres', () => {
    const ids = buildSkewbGeometry().pieces.map((p) => p.pieceId)
    expect(ids.filter((id) => id.includes('corner')).length).toBe(8)
    expect(ids.filter((id) => id.includes('center')).length).toBe(6)
  })

  it('gives every piece a unique id', () => {
    const ids = buildSkewbGeometry().pieces.map((p) => p.pieceId)
    expect(new Set(ids).size).toBe(14)
  })

  it('caches: two calls return the identical object', () => {
    expect(buildSkewbGeometry()).toBe(buildSkewbGeometry())
  })
})

describe('skewb face touching', () => {
  it('a corner piece touches exactly 3 outer faces', () => {
    const corner = buildSkewbGeometry().pieces.find((p) => p.pieceId.includes('corner'))!
    const visible = corner.geometry.groups.filter((g) => (g.materialIndex ?? 6) < 6 && g.count > 0)
    expect(visible.length).toBe(3)
  })

  it('a centre piece touches exactly 1 outer face', () => {
    const center = buildSkewbGeometry().pieces.find((p) => p.pieceId.includes('center'))!
    const visible = center.geometry.groups.filter((g) => (g.materialIndex ?? 6) < 6 && g.count > 0)
    expect(visible.length).toBe(1)
  })
})
