import { describe, expect, it } from 'vitest'
import { AVAILABLE_PUZZLE_IDS, isPuzzleAvailable, PUZZLE_REGISTRY } from './registry'

describe('puzzle registry', () => {
  it('lists all 5 puzzles as available', () => {
    expect(AVAILABLE_PUZZLE_IDS.sort()).toEqual(
      ['cube3', 'pyraminx', 'skewb', 'mastermorphix', 'megaminx'].sort(),
    )
  })

  it('isPuzzleAvailable narrows correctly', () => {
    expect(isPuzzleAvailable('cube3')).toBe(true)
    expect(isPuzzleAvailable('megaminx')).toBe(true)
    expect(isPuzzleAvailable('not-a-puzzle')).toBe(false)
  })

  it('each registered loader produces a plugin with a matching id', async () => {
    for (const [id, loader] of Object.entries(PUZZLE_REGISTRY)) {
      const plugin = await loader!()
      expect(plugin.id).toBe(id)
    }
  })
})
