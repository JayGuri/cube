import { Alg } from 'cubing/alg'
import { beforeAll, describe, expect, it } from 'vitest'
import { applyMove, createInitialState, initSkewbLogic, isSolved, scramble } from './logic'

const move = (s: string) => ({ alg: new Alg(s), snapAngleDeg: 120 })

describe('skewb logic', () => {
  beforeAll(async () => {
    await initSkewbLogic()
  })

  it('starts solved', () => {
    expect(isSolved(createInitialState())).toBe(true)
  })

  it('a single corner turn is not solved', () => {
    expect(isSolved(applyMove(createInitialState(), move('R')))).toBe(false)
  })

  it('a corner turn applied 3 times returns to solved (order-3)', () => {
    let state = createInitialState()
    for (let i = 0; i < 3; i++) state = applyMove(state, move('R'))
    expect(isSolved(state)).toBe(true)
  })

  it('a move and its inverse round-trip to solved', () => {
    let state = applyMove(createInitialState(), move('U'))
    state = applyMove(state, move("U'"))
    expect(isSolved(state)).toBe(true)
  })

  it('scramble unsolves, and its inverse restores solved', async () => {
    const moves = await scramble()
    expect(moves.length).toBeGreaterThan(0)
    let state = createInitialState()
    for (const m of moves) state = applyMove(state, m)
    expect(isSolved(state)).toBe(false)
    for (const m of [...moves].reverse()) {
      state = applyMove(state, { alg: m.alg.invert(), snapAngleDeg: 120 })
    }
    expect(isSolved(state)).toBe(true)
  })
})
