import { beforeAll, describe, expect, it } from 'vitest'
import { Alg } from 'cubing/alg'
import { applyMove, createInitialState, initCube3Logic, isSolved } from '../puzzles/cube3/logic'
import { quarterTurns, solveFromHistory } from './kociemba'

const mv = (s: string) => ({ alg: new Alg(s), snapAngleDeg: 90 })
const apply = (moves: string[]) => moves.reduce((s, m) => applyMove(s, mv(m)), createInitialState())

describe('solveFromHistory picks the shorter way back', () => {
  beforeAll(async () => {
    await initCube3Logic()
  })

  it('REGRESSION: a 3-move position is solved in 3 turns, not ~21', async () => {
    const history = ['R', 'U', 'F'].map(mv)
    const solution = await solveFromHistory(history)
    expect(solution.map((m) => m.alg.toString())).toEqual(["F'", "U'", "R'"])
  })

  it('cancelling moves are merged, so R then R-prime needs nothing', async () => {
    expect(await solveFromHistory(['R', "R'", 'U', "U'"].map(mv))).toEqual([])
  })

  it('on a real scramble the result still solves the real cube, and is never longer than undoing', async () => {
    const scramble = "R U2 F' L D2 B R' U F2 D' L2 B' U R2 F D".split(' ')
    const solution = await solveFromHistory(scramble.map(mv))
    let state = apply(scramble)
    for (const m of solution) state = applyMove(state, m)
    expect(isSolved(state)).toBe(true)
    expect(quarterTurns(solution)).toBeLessThanOrEqual(quarterTurns(scramble.map(mv)))
  }, 30_000)
})
