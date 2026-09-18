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

  it('exposes colours and a gesture profile matching the 3x3 spec row', async () => {
    const plugin = await createCube3Plugin()
    expect(plugin.colorScheme.U).toBe('#FFFFFF')
    expect(plugin.gestureProfile).toEqual({
      snapAngleDeg: 90,
      grabMode: 'instant',
      twistAxisMode: 'screen-relative',
    })
  })

  it('solve() is an explicit not-implemented until Phase 2, not a silent no-op', async () => {
    const plugin = await createCube3Plugin()
    await expect(plugin.solve(plugin.createInitialState())).rejects.toThrow(/Phase 2/)
  })
})
