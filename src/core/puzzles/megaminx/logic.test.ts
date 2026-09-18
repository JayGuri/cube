import { Alg } from 'cubing/alg'
import { beforeAll, describe, expect, it } from 'vitest'
import { applyMove, createInitialState, initMegaminxLogic, isSolved, scramble } from './logic'

const move = (s: string) => ({ alg: new Alg(s), snapAngleDeg: 72 })

describe('megaminx logic', () => {
  beforeAll(async () => {
    await initMegaminxLogic()
  }, 20_000)

  it('starts solved', () => {
    expect(isSolved(createInitialState())).toBe(true)
  })

  it('a single whole-face turn is not solved', () => {
    expect(isSolved(applyMove(createInitialState(), move('R++')))).toBe(false)
  })

  it('a whole-face turn applied 5 times returns to solved (order-5)', () => {
    let state = createInitialState()
    for (let i = 0; i < 5; i++) state = applyMove(state, move('R++'))
    expect(isSolved(state)).toBe(true)
  })

  it('scramble unsolves, and its inverse restores solved', async () => {
    const moves = await scramble()
    expect(moves.length).toBeGreaterThan(0)
    let state = createInitialState()
    for (const m of moves) state = applyMove(state, m)
    expect(isSolved(state)).toBe(false)
    for (const m of [...moves].reverse()) {
      state = applyMove(state, { alg: m.alg.invert(), snapAngleDeg: 72 })
    }
    expect(isSolved(state)).toBe(true)
  }, 15_000)
})
