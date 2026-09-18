import { describe, expect, it } from 'vitest'
import { buildMastermorphixGeometry } from './geometry'

describe('mastermorphix geometry', () => {
  it('has 26 visible pieces, same mechanism as cube3', () => {
    expect(buildMastermorphixGeometry().pieces.length).toBe(26)
  })

  it('reuses cube3 slot ids unchanged (sync.ts depends on this)', () => {
    const ids = buildMastermorphixGeometry().pieces.map((p) => p.pieceId)
    expect(ids.every((id) => id.startsWith('cube3-slot-'))).toBe(true)
  })

  it('actually reshapes the geometry (vertices are not still cube-shaped)', () => {
    const piece = buildMastermorphixGeometry().pieces[0]
    piece.geometry.computeBoundingBox()
    const box = piece.geometry.boundingBox!
    // A cube3 piece's bounding box has axis-aligned extents of exactly 1 unit
    // per cut cell; after the radial remap it should not coincide with that.
    const size = box.max.clone().sub(box.min)
    expect(size.x === 1 && size.y === 1 && size.z === 1).toBe(false)
  })

  it('caches: two calls return the identical object', () => {
    expect(buildMastermorphixGeometry()).toBe(buildMastermorphixGeometry())
  })
})
