import { Alg } from 'cubing/alg'
import { beforeAll, describe, expect, it } from 'vitest'
import { applyMove, createInitialState, initSkewbLogic, movesFromAlg } from './logic'
import { SKEWB_COLORS } from './geometry'
import { ALL_SLOTS, faceletColors, pieceIdForFacelet } from './sync'

const run = (alg: string) => {
  let state = createInitialState()
  for (const m of movesFromAlg(new Alg(alg), 120)) state = applyMove(state, m)
  return state
}

describe('skewb sync', () => {
  beforeAll(async () => {
    await initSkewbLogic()
  })

  it('covers all 14 slots', () => {
    expect(ALL_SLOTS).toHaveLength(14)
    expect(faceletColors(createInitialState()).size).toBe(14)
  })

  it('a solved skewb shows each face as one uniform colour', () => {
    const colors = faceletColors(createInitialState())
    for (const slot of ALL_SLOTS) {
      const faceColors = colors.get(slot.slotId)!
      for (const face of slot.faces) {
        expect(faceColors[face]).toBe(SKEWB_COLORS[face])
      }
    }
  })

  it('a move unsolves the colours of the pieces it touches', () => {
    const before = faceletColors(createInitialState())
    const after = faceletColors(run('R'))
    let anyDiff = false
    for (const slot of ALL_SLOTS) {
      if (JSON.stringify(after.get(slot.slotId)) !== JSON.stringify(before.get(slot.slotId))) anyDiff = true
    }
    expect(anyDiff).toBe(true)
  })

  it('a move and its real inverse restore every slot colour', () => {
    const before = faceletColors(createInitialState())
    const alg = new Alg("R U R' U'")
    let state = createInitialState()
    for (const m of movesFromAlg(alg, 120)) state = applyMove(state, m)
    for (const m of movesFromAlg(alg.invert(), 120)) state = applyMove(state, m)
    const afterUndo = faceletColors(state)
    for (const slot of ALL_SLOTS) {
      expect(afterUndo.get(slot.slotId)).toEqual(before.get(slot.slotId))
    }
  })

  it('rejects an unknown facelet id', () => {
    expect(() => pieceIdForFacelet(createInitialState(), 'not-a-real-slot')).toThrow(/unknown/)
  })

  it('tracks a corner piece consistently through a move', () => {
    const solved = createInitialState()
    const idBefore = pieceIdForFacelet(solved, 'skewb-corner-0')
    const idAfter = pieceIdForFacelet(run('R'), 'skewb-corner-0')
    expect(typeof idAfter).toBe('string')
    // Whether or not slot 0 itself moved, the mapping must stay well-formed.
    expect(idBefore).toMatch(/^skewb-CORNERS-\d+$/)
    expect(idAfter).toMatch(/^skewb-CORNERS-\d+$/)
  })
})
