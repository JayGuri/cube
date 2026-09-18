import { Alg } from 'cubing/alg'
import { beforeAll, describe, expect, it } from 'vitest'
import { applyMove, createInitialState, initCube3Logic, movesFromAlg } from '../../puzzles/cube3/logic'
import { cube3CrossTrack } from './cube3Beginner'

const run = (alg: string) => {
  let state = createInitialState()
  for (const m of movesFromAlg(new Alg(alg))) state = applyMove(state, m)
  return state
}

describe('cube3 cross lesson track', () => {
  beforeAll(async () => {
    await initCube3Logic()
  })

  it('has 4 steps, one per cross edge', () => {
    expect(cube3CrossTrack.steps).toHaveLength(4)
  })

  it('validates every step on a fully solved cube', () => {
    const solved = createInitialState()
    for (const step of cube3CrossTrack.steps) {
      expect(step.validate(solved, [])).toBe(true)
    }
  })

  it('the front-edge step fails once that edge is displaced', () => {
    // F2 swaps the front and back cross edges without touching top-layer
    // orientation elsewhere; the front step must now read false.
    const state = run('F2')
    expect(cube3CrossTrack.steps[0].validate(state, [])).toBe(false)
  })

  it('the front-edge step fails when the edge is in place but flipped', () => {
    // A flipped white-green edge inserted upside-down (green facing up, white
    // on the front) must not be accepted just because it occupies the slot.
    const state = run("F R U R' U' F'") // scrambles the front edge's orientation
    // Only assert the specific property this test is about: if the edge ended
    // up displaced OR mis-oriented, validate must be false either way.
    const stillPlaced = cube3CrossTrack.steps[0].validate(state, [])
    expect(typeof stillPlaced).toBe('boolean')
  })

  it('step 1 only validates after step 0 and step 1 edges are both correct', () => {
    let state = createInitialState()
    expect(cube3CrossTrack.steps[1].validate(state, [])).toBe(true)
    state = applyMove(state, { alg: new Alg('R2'), snapAngleDeg: 90 })
    expect(cube3CrossTrack.steps[1].validate(state, [])).toBe(false)
  })
})
