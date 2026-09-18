import { Alg } from 'cubing/alg'
import { describe, expect, it } from 'vitest'
import { createPyraminxPlugin } from './index'

describe('pyraminx plugin', () => {
  it('is solved initially, unsolved after a move, and has 14 geometry pieces', async () => {
    const plugin = await createPyraminxPlugin()
    const solved = plugin.createInitialState()
    expect(plugin.isSolved(solved)).toBe(true)
    expect(plugin.buildGeometry().pieces.length).toBe(14)

    const turned = plugin.applyMove(solved, { alg: new Alg('U'), snapAngleDeg: 120 })
    expect(plugin.isSolved(turned)).toBe(false)
  })

  it('exposes the spec 8.5 gesture profile row for pyraminx', async () => {
    const plugin = await createPyraminxPlugin()
    expect(plugin.gestureProfile).toEqual({
      snapAngleDeg: 120,
      grabMode: 'instant',
      twistAxisMode: 'screen-relative',
    })
  })

  it('solve() on an already-solved puzzle returns no moves', async () => {
    const plugin = await createPyraminxPlugin()
    await expect(plugin.solve(plugin.createInitialState(), [])).resolves.toEqual([])
  })

  it('solve() finds a real solution for a scrambled puzzle within a reasonable time', async () => {
    const plugin = await createPyraminxPlugin()
    let state = plugin.createInitialState()
    const scrambleMoves = await plugin.scramble()
    for (const m of scrambleMoves) state = plugin.applyMove(state, m)
    expect(plugin.isSolved(state)).toBe(false)

    const t0 = Date.now()
    const solution = await plugin.solve(state, scrambleMoves)
    const elapsedMs = Date.now() - t0
    expect(elapsedMs).toBeLessThan(15_000)

    for (const m of solution) state = plugin.applyMove(state, m)
    expect(plugin.isSolved(state)).toBe(true)
  }, 20_000)

  it('solve() works for several independent scrambles, not just one lucky case', async () => {
    const plugin = await createPyraminxPlugin()
    for (let i = 0; i < 3; i++) {
      let state = plugin.createInitialState()
      const scrambleMoves = await plugin.scramble()
      for (const m of scrambleMoves) state = plugin.applyMove(state, m)
      const solution = await plugin.solve(state, scrambleMoves)
      for (const m of solution) state = plugin.applyMove(state, m)
      expect(plugin.isSolved(state)).toBe(true)
    }
  }, 30_000)
})
