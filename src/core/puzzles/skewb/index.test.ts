import { Alg } from 'cubing/alg'
import { describe, expect, it } from 'vitest'
import { createSkewbPlugin } from './index'

describe('skewb plugin', () => {
  it('is solved initially, unsolved after a move, has 14 geometry pieces', async () => {
    const plugin = await createSkewbPlugin()
    const solved = plugin.createInitialState()
    expect(plugin.isSolved(solved)).toBe(true)
    expect(plugin.buildGeometry().pieces.length).toBe(14)
    expect(plugin.isSolved(plugin.applyMove(solved, { alg: new Alg('R'), snapAngleDeg: 120 }))).toBe(false)
  })

  it('exposes the spec 8.5 gesture profile row for skewb (body-diagonal twist axis)', async () => {
    const plugin = await createSkewbPlugin()
    expect(plugin.gestureProfile).toEqual({
      snapAngleDeg: 120,
      grabMode: 'instant',
      twistAxisMode: 'body-diagonal',
    })
  })

  it('solve() inverts the scramble and returns to solved', async () => {
    const plugin = await createSkewbPlugin()
    let state = plugin.createInitialState()
    const scrambleMoves = await plugin.scramble()
    for (const m of scrambleMoves) state = plugin.applyMove(state, m)
    expect(plugin.isSolved(state)).toBe(false)
    const solution = await plugin.solve(state, scrambleMoves)
    for (const m of solution) state = plugin.applyMove(state, m)
    expect(plugin.isSolved(state)).toBe(true)
  })

  it('has a beginner lesson track', async () => {
    const plugin = await createSkewbPlugin()
    expect(plugin.tutorial.tracks.length).toBeGreaterThan(0)
  })
})
