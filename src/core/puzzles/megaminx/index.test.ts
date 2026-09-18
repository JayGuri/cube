import { Alg } from 'cubing/alg'
import { describe, expect, it } from 'vitest'
import { createMegaminxPlugin } from './index'

describe('megaminx plugin', () => {
  it('is solved initially, unsolved after a move, has 62 geometry pieces', async () => {
    const plugin = await createMegaminxPlugin()
    const solved = plugin.createInitialState()
    expect(plugin.isSolved(solved)).toBe(true)
    expect(plugin.buildGeometry().pieces.length).toBe(62)
    expect(plugin.isSolved(plugin.applyMove(solved, { alg: new Alg('R++'), snapAngleDeg: 72 }))).toBe(false)
  }, 15_000)

  it('exposes the spec 8.5 gesture profile row for megaminx (hover-then-confirm)', async () => {
    const plugin = await createMegaminxPlugin()
    expect(plugin.gestureProfile).toEqual({
      snapAngleDeg: 72,
      grabMode: 'hover-then-confirm',
      twistAxisMode: 'screen-relative',
    })
  })

  it('solve() inverts the scramble and returns to solved', async () => {
    const plugin = await createMegaminxPlugin()
    let state = plugin.createInitialState()
    const scrambleMoves = await plugin.scramble()
    for (const m of scrambleMoves) state = plugin.applyMove(state, m)
    expect(plugin.isSolved(state)).toBe(false)
    const solution = await plugin.solve(state, scrambleMoves)
    for (const m of solution) state = plugin.applyMove(state, m)
    expect(plugin.isSolved(state)).toBe(true)
  }, 15_000)

  it('has a beginner lesson track', async () => {
    const plugin = await createMegaminxPlugin()
    expect(plugin.tutorial.tracks.length).toBeGreaterThan(0)
  })
})
