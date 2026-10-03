import { Alg } from 'cubing/alg'
import { describe, expect, it } from 'vitest'
import { createCube3Plugin } from './index'

describe('cube3 plugin', () => {
  it('is solved initially, unsolved after a move, and has 26 geometry pieces', async () => {
    const plugin = await createCube3Plugin()
    const solved = plugin.createInitialState()
    expect(plugin.isSolved(solved)).toBe(true)
    expect(plugin.buildGeometry().pieces.length).toBe(26)

    const turned = plugin.applyMove(solved, { alg: new Alg('R'), snapAngleDeg: 90 })
    expect(plugin.isSolved(turned)).toBe(false)
  })

  it('scrambles then verifies the scramble is undone by its inverse', async () => {
    const plugin = await createCube3Plugin()
    let state = plugin.createInitialState()
    const moves = await plugin.scramble()
    for (const m of moves) state = plugin.applyMove(state, m)
    expect(plugin.isSolved(state)).toBe(false)
    for (const m of [...moves].reverse()) {
      state = plugin.applyMove(state, { alg: m.alg.invert(), snapAngleDeg: 90 })
    }
    expect(plugin.isSolved(state)).toBe(true)
  })

  it('exposes the standard colours and quarter-turn snapping', async () => {
    const plugin = await createCube3Plugin()
    expect(plugin.colorScheme.U).toBe('#FFFFFF')
    expect(plugin.snapAngleDeg).toBe(90)
  })

  it('solve() returns moves that actually solve a scrambled cube', async () => {
    const plugin = await createCube3Plugin()
    let state = plugin.createInitialState()
    const scramble = await plugin.scramble()
    for (const m of scramble) state = plugin.applyMove(state, m)
    expect(plugin.isSolved(state)).toBe(false)

    const { moves: solution } = await plugin.solve(state, scramble)
    expect(solution.length).toBeGreaterThan(0)
    for (const m of solution) state = plugin.applyMove(state, m)
    expect(plugin.isSolved(state)).toBe(true)
  }, 60_000)

  it('solve() on an already-solved cube returns no moves', async () => {
    const plugin = await createCube3Plugin()
    await expect(plugin.solve(plugin.createInitialState(), [])).resolves.toEqual({ moves: [], optimal: true })
  })
})
