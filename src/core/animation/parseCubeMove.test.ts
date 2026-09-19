import { describe, expect, it } from 'vitest'
import { parseCubeMove } from './parseCubeMove'

describe('parseCubeMove', () => {
  it('maps each outer face letter to its axis and layer', () => {
    expect(parseCubeMove('R')).toMatchObject({ axis: 'x', layer: 1 })
    expect(parseCubeMove('L')).toMatchObject({ axis: 'x', layer: -1 })
    expect(parseCubeMove('U')).toMatchObject({ axis: 'y', layer: 1 })
    expect(parseCubeMove('D')).toMatchObject({ axis: 'y', layer: -1 })
    expect(parseCubeMove('F')).toMatchObject({ axis: 'z', layer: 1 })
    expect(parseCubeMove('B')).toMatchObject({ axis: 'z', layer: -1 })
  })

  it('maps slice letters to layer 0 on their axis', () => {
    expect(parseCubeMove('M')).toMatchObject({ axis: 'x', layer: 0 })
    expect(parseCubeMove('E')).toMatchObject({ axis: 'y', layer: 0 })
    expect(parseCubeMove('S')).toMatchObject({ axis: 'z', layer: 0 })
  })

  it('a prime move animates the opposite direction of its plain move', () => {
    const plain = parseCubeMove('R')!
    const prime = parseCubeMove("R'")!
    expect(prime.axis).toBe(plain.axis)
    expect(prime.layer).toBe(plain.layer)
    expect(prime.angle).toBeCloseTo(-plain.angle, 6)
  })

  it('a double move is twice the angle of a plain move, same direction', () => {
    const plain = parseCubeMove('R')!
    const double = parseCubeMove('R2')!
    expect(double.angle).toBeCloseTo(plain.angle * 2, 6)
  })

  it('returns null for notation it does not understand (other puzzles)', () => {
    expect(parseCubeMove('u')).toBeNull() // pyraminx tip
    expect(parseCubeMove('')).toBeNull()
  })

  it('returns null for a letter that collides with cube3 but an unknown modifier', () => {
    // megaminx reuses letters like D and R for its own layers, with
    // modifiers ("++", "--") cube3 never produces -- a real user-visible bug
    // where these were wrongly accepted as ordinary cube3 turns and made a
    // megaminx solve animate (wrongly, and 40+ seconds slower) instead of
    // resolving instantly like every other non-cube3 move.
    expect(parseCubeMove('D++')).toBeNull()
    expect(parseCubeMove('R--')).toBeNull()
  })

  it('every returned angle is a right-angle multiple, never zero', () => {
    for (const notation of ['R', "R'", 'R2', 'L', "L'", 'L2', 'M', "M'", 'M2']) {
      const parsed = parseCubeMove(notation)!
      expect(parsed.angle).not.toBe(0)
      expect(Math.abs(parsed.angle) % (Math.PI / 2)).toBeCloseTo(0, 6)
    }
  })
})
