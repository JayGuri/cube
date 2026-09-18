import { Alg } from 'cubing/alg'
import { beforeAll, describe, expect, it } from 'vitest'
import { applyMove, createInitialState, initCube3Logic, isSolved, movesFromAlg } from '../../puzzles/cube3/logic'
import { CUBE3_ALGO_DECK } from './cube3Deck'

describe('cube3 algorithm deck', () => {
  beforeAll(async () => {
    await initCube3Logic()
  })

  it.each(CUBE3_ALGO_DECK)('$id: setupAlg then solutionAlg returns to solved', ({ setupAlg, solutionAlg }) => {
    let state = createInitialState()
    if (setupAlg) for (const m of movesFromAlg(new Alg(setupAlg))) state = applyMove(state, m)
    if (solutionAlg) for (const m of movesFromAlg(new Alg(solutionAlg))) state = applyMove(state, m)
    expect(isSolved(state)).toBe(true)
  })

  it('every card has a unique id', () => {
    const ids = CUBE3_ALGO_DECK.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
