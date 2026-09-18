import { Alg } from 'cubing/alg'
import { beforeAll, describe, expect, it } from 'vitest'
import { applyMove, createInitialState, initCube3Logic, movesFromAlg } from './logic'
import { CUBE3_COLORS, facesOfSlot, type Face } from './geometry'
import { ALL_SLOTS, faceletColors, pieceIdForFacelet, syncMeshToState } from './sync'
import { slotId } from './geometry'
import type { PuzzleState } from '../PuzzlePlugin'

const move = (s: string) => ({ alg: new Alg(s), snapAngleDeg: 90 })
const run = (alg: string) => {
  let state = createInitialState()
  for (const m of movesFromAlg(new Alg(alg))) state = applyMove(state, m)
  return state
}

// Colour on a given face of the cubie at a given slot.
function colorAt(state: PuzzleState, slot: [number, number, number], face: Face): string {
  return faceletColors(state).get(slotId(slot))![face]
}

describe('cube3 sync', () => {
  beforeAll(async () => {
    await initCube3Logic()
  })

  it('tracks a corner piece through a single move consistently', () => {
    const solved = createInitialState()
    const idBefore = pieceIdForFacelet(solved, 'URF')
    const idAfter = pieceIdForFacelet(applyMove(solved, move('R')), 'URF')
    expect(idAfter).toBeDefined()
    expect(idAfter).not.toBe(idBefore)
  })

  it('accepts facelet labels in any order', () => {
    const s = createInitialState()
    expect(pieceIdForFacelet(s, 'URF')).toBe(pieceIdForFacelet(s, 'UFR'))
    expect(pieceIdForFacelet(s, 'RFU')).toBe(pieceIdForFacelet(s, 'FUR'))
  })

  it('rejects a facelet that is not a real slot', () => {
    expect(() => pieceIdForFacelet(createInitialState(), 'UUU')).toThrow(/unknown/)
  })

  it('covers every one of the 26 cubies', () => {
    expect(faceletColors(createInitialState()).size).toBe(26)
    expect(ALL_SLOTS.length).toBe(26)
  })

  it('a solved cube shows one uniform colour per face', () => {
    const colors = faceletColors(createInitialState())
    for (const [id, faces] of colors) {
      for (const [face, hex] of Object.entries(faces)) {
        expect(`${id}:${face}:${hex}`).toBe(`${id}:${face}:${CUBE3_COLORS[face as Face]}`)
      }
    }
  })

  it('after R, the U face right column shows the FRONT colour', () => {
    // R cycles F -> U on the right layer, so every U sticker with x = +1
    // must become green. This is the assertion that catches an off-by-one in
    // the orientation rule, which a piece-count test never would.
    const state = run('R')
    for (const z of [-1, 0, 1] as const) {
      expect(colorAt(state, [1, 1, z], 'U')).toBe(CUBE3_COLORS.F)
    }
    // ...and the left two columns are untouched.
    for (const z of [-1, 0, 1] as const) {
      expect(colorAt(state, [-1, 1, z], 'U')).toBe(CUBE3_COLORS.U)
    }
  })

  it('after R, the corner at UFR shows F/D/R colours in slot order U,F,R', () => {
    // DRF travels to UFR: its F sticker lands on U, its D sticker on F,
    // its R sticker stays on R.
    const state = run('R')
    expect(colorAt(state, [1, 1, 1], 'U')).toBe(CUBE3_COLORS.F)
    expect(colorAt(state, [1, 1, 1], 'F')).toBe(CUBE3_COLORS.D)
    expect(colorAt(state, [1, 1, 1], 'R')).toBe(CUBE3_COLORS.R)
  })

  it('after U, the F face top row shows the RIGHT colour', () => {
    const state = run('U')
    for (const x of [-1, 0, 1] as const) {
      expect(colorAt(state, [x, 1, 1], 'F')).toBe(CUBE3_COLORS.R)
    }
  })

  it('a move and its inverse restore every sticker', () => {
    const before = faceletColors(createInitialState())
    const after = faceletColors(run("R U R' U' U R U' R'"))
    for (const [id, faces] of before) {
      expect(after.get(id)).toEqual(faces)
    }
  })

  it('a scrambled cube does not read as solved colours', () => {
    const scrambled = faceletColors(run("R U R' U'"))
    const solved = faceletColors(createInitialState())
    let differences = 0
    for (const [id, faces] of solved) {
      if (JSON.stringify(after(scrambled, id)) !== JSON.stringify(faces)) differences++
    }
    expect(differences).toBeGreaterThan(0)
  })

  it('syncMeshToState maps every slot label to a piece id', () => {
    const map = syncMeshToState(createInitialState())
    expect(map.size).toBe(26)
    for (const id of map.values()) expect(id).toMatch(/^cube3-(CORNERS|EDGES|CENTERS)-\d+$/)
  })

  it('facesOfSlot agrees with the slot table', () => {
    for (const def of ALL_SLOTS) {
      expect(facesOfSlot(def.slot).sort()).toEqual([...def.faces].sort())
    }
  })
})

function after(
  map: Map<string, Record<string, string>>,
  id: string,
): Record<string, string> | undefined {
  return map.get(id)
}
