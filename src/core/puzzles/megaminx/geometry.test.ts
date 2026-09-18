import { describe, expect, it } from 'vitest'
import { buildMegaminxGeometry } from './geometry'

describe('megaminx geometry', () => {
  it('produces 62 visible pieces (20 corners + 30 edges + 12 centres)', () => {
    expect(buildMegaminxGeometry().pieces.length).toBe(62)
  })

  it('classifies into exactly 20 corners, 30 edges, 12 centres', () => {
    const ids = buildMegaminxGeometry().pieces.map((p) => p.pieceId)
    expect(ids.filter((id) => id.includes('-corner-')).length).toBe(20)
    expect(ids.filter((id) => id.includes('-edge-')).length).toBe(30)
    expect(ids.filter((id) => id.includes('-center-')).length).toBe(12)
  })

  it('gives every piece a unique id', () => {
    const ids = buildMegaminxGeometry().pieces.map((p) => p.pieceId)
    expect(new Set(ids).size).toBe(62)
  })

  it('caches: two calls return the identical object', () => {
    expect(buildMegaminxGeometry()).toBe(buildMegaminxGeometry())
  })
})
