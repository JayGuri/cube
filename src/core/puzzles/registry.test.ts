import { describe, expect, it } from 'vitest'
import { AVAILABLE_PUZZLE_IDS, isPuzzleAvailable, PUZZLE_REGISTRY } from './registry'

describe('puzzle registry', () => {
  it('lists only the 3x3', () => {
    expect(AVAILABLE_PUZZLE_IDS).toEqual(['cube3'])
  })

  it('isPuzzleAvailable rejects the removed puzzles', () => {
    expect(isPuzzleAvailable('cube3')).toBe(true)
    expect(isPuzzleAvailable('megaminx')).toBe(false)
    expect(isPuzzleAvailable('pyraminx')).toBe(false)
  })

  it('the 3x3 loader produces a plugin with a matching id', async () => {
    const plugin = await PUZZLE_REGISTRY.cube3()
    expect(plugin.id).toBe('cube3')
  })
})
