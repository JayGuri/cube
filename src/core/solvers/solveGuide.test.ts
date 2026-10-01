import { beforeAll, describe, expect, it } from 'vitest'
import { Alg } from 'cubing/alg'
import { applyMove, createInitialState, initCube3Logic, isSolved } from '../puzzles/cube3/logic'
import { createGuide, describeStep, expandSteps, followMove } from './solveGuide'

const mv = (s: string) => ({ alg: new Alg(s), snapAngleDeg: 90 })

describe('solve guide', () => {
  beforeAll(async () => {
    await initCube3Logic()
  })

  it('splits double turns into two quarter turns, one per sign', () => {
    expect(expandSteps(['R2', "U'", 'F'].map(mv))).toEqual(['R', 'R', "U'", 'F'])
  })

  it("REGRESSION: a double turn written U2' is not silently dropped", () => {
    expect(expandSteps(["U2'"].map(mv))).toEqual(['U', 'U'])
  })

  it("following every step of a real scramble's inverse solves the real cube", () => {
    const scramble = "R U2 F' L D2 B R'".split(' ')
    let state = createInitialState()
    for (const s of scramble) state = applyMove(state, mv(s))
    const solution = new Alg(scramble.join(' ')).invert()
    let guide = createGuide([...solution.childAlgNodes()].map((n) => mv(new Alg([n]).toString())))
    let last = 'advanced'
    for (const step of [...guide.steps]) {
      state = applyMove(state, mv(step))
      const r = followMove(guide, step)
      guide = r.guide
      last = r.outcome
    }
    expect(last).toBe('finished')
    expect(isSolved(state)).toBe(true)
  })

  it('a different move is reported off-track and does not advance', () => {
    const guide = createGuide(['R', 'U'].map(mv))
    const r = followMove(guide, "R'")
    expect(r.outcome).toBe('off-track')
    expect(r.guide.index).toBe(0)
  })

  it('describes moves in plain words', () => {
    expect(describeStep('R')).toBe('Turn the Right face clockwise')
    expect(describeStep("U'")).toBe('Turn the Top face counter-clockwise')
  })
})
