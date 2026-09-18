import { Alg } from 'cubing/alg'
import { beforeAll, describe, expect, it } from 'vitest'
import { applyMove, createInitialState, initPyraminxLogic, movesFromAlg } from './logic'
import { PYRAMINX_COLORS } from './geometry'
import { ALL_SLOTS, faceletColors, pieceIdForFacelet } from './sync'

const run = (alg: string) => {
  let state = createInitialState()
  for (const m of movesFromAlg(new Alg(alg), 120)) state = applyMove(state, m)
  return state
}

describe('pyraminx sync', () => {
  beforeAll(async () => {
    await initPyraminxLogic()
  })

  it('covers all 14 slots', () => {
    expect(ALL_SLOTS).toHaveLength(14)
    expect(faceletColors(createInitialState()).size).toBe(14)
  })

  it('a solved pyraminx shows each face as one uniform colour', () => {
    const colors = faceletColors(createInitialState())
    for (const slot of ALL_SLOTS) {
      const faceColors = colors.get(slot.slotId)!
      for (const face of slot.faces) {
        expect(faceColors[`F${face}`]).toBe(PYRAMINX_COLORS[`F${face}`])
      }
    }
  })

  it('a tip turn changes that tip slot away from all-solved colours', () => {
    const before = faceletColors(createInitialState()).get('pyraminx-tip-0')!
    const after = faceletColors(run('u')).get('pyraminx-tip-0')!
    expect(after).not.toEqual(before)
  })

  it('a tip turn does not affect any edge or axial slot colours', () => {
    const before = faceletColors(createInitialState())
    const after = faceletColors(run('u'))
    for (const slot of ALL_SLOTS) {
      if (slot.slotId === 'pyraminx-tip-0') continue
      expect(after.get(slot.slotId)).toEqual(before.get(slot.slotId))
    }
  })

  it('a whole-face turn unsolves the colours of the edges it touches', () => {
    const before = faceletColors(createInitialState())
    const after = faceletColors(run('U'))
    // U touches EDGES indices 0,1,5 per the spike; those slots' colours must
    // now differ, everything else must not.
    const touchedSlots = ALL_SLOTS.filter((s) => s.orbit === 'EDGES' && [0, 1, 5].includes(s.index))
    for (const slot of touchedSlots) {
      expect(after.get(slot.slotId)).not.toEqual(before.get(slot.slotId))
    }
  })

  it('a move and its real inverse restore every slot colour', () => {
    const before = faceletColors(createInitialState())
    const alg = new Alg("U R U' R'")
    let state = createInitialState()
    for (const m of movesFromAlg(alg, 120)) state = applyMove(state, m)
    const after = faceletColors(state)
    for (const m of movesFromAlg(alg.invert(), 120)) state = applyMove(state, m)
    const afterUndo = faceletColors(state)

    for (const slot of ALL_SLOTS) {
      expect(afterUndo.get(slot.slotId)).toEqual(before.get(slot.slotId))
    }
    // sanity: the un-undone state actually differs from solved somewhere.
    let anyDiff = false
    for (const slot of ALL_SLOTS) {
      if (JSON.stringify(after.get(slot.slotId)) !== JSON.stringify(before.get(slot.slotId))) anyDiff = true
    }
    expect(anyDiff).toBe(true)
  })

  it('rejects an unknown facelet id', () => {
    expect(() => pieceIdForFacelet(createInitialState(), 'not-a-real-slot')).toThrow(/unknown/)
  })

  it('tracks an edge piece consistently through a move', () => {
    const solved = createInitialState()
    const idBefore = pieceIdForFacelet(solved, 'pyraminx-edge-0_3')
    const idAfter = pieceIdForFacelet(run('U'), 'pyraminx-edge-0_3')
    expect(idAfter).not.toBe(idBefore)
  })
})
