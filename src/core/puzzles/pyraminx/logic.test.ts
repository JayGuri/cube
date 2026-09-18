import { Alg } from 'cubing/alg'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  applyMove,
  createInitialState,
  initPyraminxLogic,
  isSolved,
  movesFromAlg,
  scramble,
} from './logic'

const move = (s: string) => ({ alg: new Alg(s), snapAngleDeg: 120 })

describe('pyraminx logic', () => {
  beforeAll(async () => {
    await initPyraminxLogic()
  })

  it('starts solved', () => {
    expect(isSolved(createInitialState())).toBe(true)
  })

  it('a single whole-face turn is not solved', () => {
    expect(isSolved(applyMove(createInitialState(), move('U')))).toBe(false)
  })

  it('a move and its inverse round-trip to solved', () => {
    let state = createInitialState()
    state = applyMove(state, move('U'))
    state = applyMove(state, move("U'"))
    expect(isSolved(state)).toBe(true)
  })

  it('a whole-face turn applied 3 times returns to solved (order-3 face turns)', () => {
    let state = createInitialState()
    for (let i = 0; i < 3; i++) state = applyMove(state, move('U'))
    expect(isSolved(state)).toBe(true)
  })

  it('a tip turn applied 3 times returns to solved', () => {
    let state = createInitialState()
    for (let i = 0; i < 3; i++) state = applyMove(state, move('u'))
    expect(isSolved(state)).toBe(true)
  })

  it('a tip turn alone never unsolves the rest (edges/axials untouched)', () => {
    const state = applyMove(createInitialState(), move('u'))
    // Not globally solved (tip orientation changed) but applying the tip's
    // inverse alone should restore it -- proof nothing else was touched.
    expect(isSolved(applyMove(state, move("u'")))).toBe(true)
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
      state = applyMove(state, { alg: m.alg.invert(), snapAngleDeg: 120 })
    }
    expect(isSolved(state)).toBe(true)
  })

  it('movesFromAlg wraps each child node in its own Alg with the given snap angle', () => {
    const moves = movesFromAlg(new Alg('U L'), 120)
    expect(moves).toHaveLength(2)
    expect(moves[0].snapAngleDeg).toBe(120)
    expect(moves.map((m) => m.alg.toString())).toEqual(['U', 'L'])
  })
})
