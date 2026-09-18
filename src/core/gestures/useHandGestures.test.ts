import { describe, expect, it } from 'vitest'
import { fist, openPalm, pinching } from './fixtures'
import { pickActuator } from './useHandGestures'

describe('pickActuator', () => {
  it('returns null with no hands', () => {
    expect(pickActuator([], 0.95)).toBeNull()
  })

  it('returns the only hand when just one is present', () => {
    const hand = openPalm()
    expect(pickActuator([hand], 0.95)).toBe(hand)
  })

  it('picks the non-fist hand as actuator when two hands are present', () => {
    const anchor = fist()
    const actuator = pinching()
    expect(pickActuator([anchor, actuator], 0.95)).toBe(actuator)
    expect(pickActuator([actuator, anchor], 0.95)).toBe(actuator)
  })

  it('falls back to the first hand if neither reads as a fist', () => {
    const a = openPalm()
    const b = pinching()
    expect(pickActuator([a, b], 0.95)).toBe(a)
  })
})
