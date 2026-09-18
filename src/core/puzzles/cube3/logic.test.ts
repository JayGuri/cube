import { Alg } from 'cubing/alg'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  applyMove,
  createInitialState,
  initCube3Logic,
  isSolved,
  movesFromAlg,
  scramble,
} from './logic'

const move = (s: string) => ({ alg: new Alg(s), snapAngleDeg: 90 })

describe('cube3 logic', () => {
  beforeAll(async () => {
    await initCube3Logic()
  })

  it('starts solved', () => {
    expect(isSolved(createInitialState())).toBe(true)
  })

  it('a single quarter turn is not solved', () => {
    expect(isSolved(applyMove(createInitialState(), move('R')))).toBe(false)
  })

  it('a move and its inverse round-trip to solved', () => {
    let state = createInitialState()
    state = applyMove(state, move('R'))
    state = applyMove(state, move("R'"))
    expect(isSolved(state)).toBe(true)
  })

  it('a sexy move repeated six times returns to solved', () => {
    let state = createInitialState()
    for (let i = 0; i < 6; i++) {
      for (const m of movesFromAlg(new Alg("R U R' U'"))) state = applyMove(state, m)
    }
    expect(isSolved(state)).toBe(true)
  })

  it('treats a whole-cube rotation of a solved cube as solved', () => {
    // isIdentical() would say false here; experimentalIsSolved is what makes
    // "user solved it while holding the cube turned" report correctly.
    expect(isSolved(applyMove(createInitialState(), move('y')))).toBe(true)
  })

  it('scramble() returns a non-empty move list that unsolves the puzzle', async () => {
    const moves = await scramble()
    expect(moves.length).toBeGreaterThan(0)
    let state = createInitialState()
    for (const m of moves) state = applyMove(state, m)
    expect(isSolved(state)).toBe(false)
  })

  it('applying a scramble then its inverse returns to solved', async () => {
    const moves = await scramble()
    let state = createInitialState()
    for (const m of moves) state = applyMove(state, m)
    for (const m of [...moves].reverse()) {
      state = applyMove(state, { alg: m.alg.invert(), snapAngleDeg: 90 })
    }
    expect(isSolved(state)).toBe(true)
  })
})
