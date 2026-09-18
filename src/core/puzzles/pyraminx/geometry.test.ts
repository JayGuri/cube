import { describe, expect, it } from 'vitest'
import { buildPyraminxGeometry } from './geometry'

describe('pyraminx geometry', () => {
  it('produces 14 visible pieces (4 tips + 6 edges + 4 axial centers)', () => {
    expect(buildPyraminxGeometry().pieces.length).toBe(14)
  })

  it('classifies pieces into exactly 4 tips, 6 edges, 4 axial centers', () => {
    const ids = buildPyraminxGeometry().pieces.map((p) => p.pieceId)
    expect(ids.filter((id) => id.includes('-tip-')).length).toBe(4)
    expect(ids.filter((id) => id.includes('-edge-')).length).toBe(6)
    expect(ids.filter((id) => id.includes('-axial-')).length).toBe(4)
  })

  it('gives every piece a unique id', () => {
    const ids = buildPyraminxGeometry().pieces.map((p) => p.pieceId)
    expect(new Set(ids).size).toBe(14)
  })

  it('caches: two calls return the identical object', () => {
    expect(buildPyraminxGeometry()).toBe(buildPyraminxGeometry())
  })
})
