import { describe, expect, it } from 'vitest'
import { moveFromKey } from './KeyboardAdapter'

const chord = (key: string, shiftKey = false, altKey = false) => ({ key, shiftKey, altKey })

describe('moveFromKey', () => {
  it('maps a plain letter key to the matching clockwise face turn', () => {
    expect(moveFromKey(chord('u'), 90)?.alg.toString()).toBe('U')
    expect(moveFromKey(chord('R'), 90)?.alg.toString()).toBe('R')
  })

  it('Shift gives the prime (counter-clockwise) direction', () => {
    expect(moveFromKey(chord('f', true), 90)?.alg.toString()).toBe("F'")
  })

  it('Alt gives a double turn', () => {
    expect(moveFromKey(chord('b', false, true), 90)?.alg.toString()).toBe('B2')
  })

  it('ignores keys with no mapped face', () => {
    expect(moveFromKey(chord('q'), 90)).toBeNull()
    expect(moveFromKey(chord('Enter'), 90)).toBeNull()
  })

  it('carries the given snap angle through', () => {
    expect(moveFromKey(chord('u'), 120)?.snapAngleDeg).toBe(120)
  })
})
