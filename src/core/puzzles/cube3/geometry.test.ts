import { describe, expect, it } from 'vitest'
import { buildCube3Geometry, facesOfSlot, FACE_ORDER, INNER_GROUP } from './geometry'

describe('cube3 geometry', () => {
  it('produces 26 visible pieces (27 cells minus the hidden core)', () => {
    expect(buildCube3Geometry().pieces.length).toBe(26)
  })

  it('has 6 centres, 12 edges and 8 corners by sticker count', () => {
    const counts = { 1: 0, 2: 0, 3: 0 } as Record<number, number>
    for (const p of buildCube3Geometry().pieces) {
      counts[facesOfSlot(p.slot).length]++
    }
    expect(counts).toEqual({ 1: 6, 2: 12, 3: 8 })
  })

  it('gives every piece unique slot-derived id', () => {
    const ids = buildCube3Geometry().pieces.map((p) => p.pieceId)
    expect(new Set(ids).size).toBe(26)
  })

  it('assigns a material group per outer face plus an interior group', () => {
    const piece = buildCube3Geometry().pieces[0]
    const groups = piece.geometry.groups
    expect(groups.length).toBe(FACE_ORDER.length + 1)
    expect(groups[INNER_GROUP].materialIndex).toBe(INNER_GROUP)
  })

  it('gives a corner piece exactly 3 non-empty sticker groups', () => {
    const corner = buildCube3Geometry().pieces.find(
      (p) => facesOfSlot(p.slot).length === 3,
    )!
    const stickerGroups = corner.geometry.groups
      .filter((g) => g.materialIndex !== INNER_GROUP && g.count > 0)
    expect(stickerGroups.length).toBe(3)
  })

  it('caches: two calls return the identical object (CSG runs once)', () => {
    expect(buildCube3Geometry()).toBe(buildCube3Geometry())
  })
})
