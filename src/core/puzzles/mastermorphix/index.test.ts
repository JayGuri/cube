import { Alg } from 'cubing/alg'
import { describe, expect, it } from 'vitest'
import { createMastermorphixPlugin } from './index'

describe('mastermorphix plugin', () => {
  it('is solved initially, unsolved after a move, has 26 geometry pieces', async () => {
    const plugin = await createMastermorphixPlugin()
    const solved = plugin.createInitialState()
    expect(plugin.isSolved(solved)).toBe(true)
    expect(plugin.buildGeometry().pieces.length).toBe(26)
    expect(plugin.isSolved(plugin.applyMove(solved, { alg: new Alg('R'), snapAngleDeg: 90 }))).toBe(false)
  })

  it('solve() actually solves it, reusing the real cube3 Kociemba solver', async () => {
    const plugin = await createMastermorphixPlugin()
    let state = plugin.createInitialState()
    const scrambleMoves = await plugin.scramble()
    for (const m of scrambleMoves) state = plugin.applyMove(state, m)
    const solution = await plugin.solve(state, scrambleMoves)
    for (const m of solution) state = plugin.applyMove(state, m)
    expect(plugin.isSolved(state)).toBe(true)
  }, 20_000)

  it('teaches the cube3 cross track unchanged', async () => {
    const plugin = await createMastermorphixPlugin()
    expect(plugin.tutorial.tracks[0].name).toBe('Cross')
  })
})
