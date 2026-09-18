import { describe, expect, it } from 'vitest'
import { fist, makeHand, openPalm, pinching } from './fixtures'
import {
  angleDelta,
  cross,
  distance,
  fingerCurl,
  handScale,
  normalize,
  palmNormal,
  pinchDistance,
  snapAngle,
  wristRoll,
} from './landmarkMath'

describe('landmarkMath', () => {
  it('measures distance', () => {
    expect(distance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBe(5)
  })

  it('computes a cross product with the right-hand rule', () => {
    expect(cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toEqual({ x: 0, y: 0, z: 1 })
  })

  it('normalises to unit length and survives a zero vector', () => {
    const n = normalize({ x: 0, y: 3, z: 4 })
    expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 6)
    expect(normalize({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('uses wrist-to-middle-knuckle as the hand scale', () => {
    expect(handScale(openPalm().landmarks)).toBeCloseTo(1, 6)
  })

  it('normalises thresholds against camera distance', () => {
    // The same pose twice as far from the camera must measure the same,
    // otherwise every threshold would need retuning as the user leans in.
    const near = makeHand({ pinch: 0.5 }).landmarks
    const far = makeHand({ pinch: 0.5 }).landmarks.map((p) => ({
      x: p.x * 0.5,
      y: p.y * 0.5,
      z: p.z * 0.5,
    }))
    expect(pinchDistance(far)).toBeCloseTo(pinchDistance(near), 6)
  })

  it('reads a pinch as much closer than an open hand', () => {
    expect(pinchDistance(pinching().landmarks)).toBeLessThan(0.15)
    expect(pinchDistance(openPalm().landmarks)).toBeGreaterThan(0.5)
  })

  it('reads a fist as much more curled than an open palm', () => {
    expect(fingerCurl(fist().landmarks)).toBeLessThan(fingerCurl(openPalm().landmarks))
  })

  it('gives a flat hand facing the camera a palm normal along an axis', () => {
    const n = palmNormal(openPalm().landmarks)
    expect(Math.abs(n.z)).toBeCloseTo(1, 6)
    expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 6)
  })

  it('reads wrist roll as an angle in degrees', () => {
    expect(wristRoll({ x: 1, y: 0, z: 0 })).toBeCloseTo(0, 6)
    expect(wristRoll({ x: 0, y: 1, z: 0 })).toBeCloseTo(90, 6)
    expect(wristRoll({ x: -1, y: 0, z: 0 })).toBeCloseTo(180, 6)
  })

  it('takes the short way round when comparing angles', () => {
    expect(angleDelta(350, 10)).toBeCloseTo(20, 6)
    expect(angleDelta(10, 350)).toBeCloseTo(-20, 6)
    expect(angleDelta(0, 180)).toBeCloseTo(180, 6)
  })

  it('snaps to the nearest valid turn and reports the error', () => {
    expect(snapAngle(83, 90)).toEqual({ snapped: 90, error: 7 })
    expect(snapAngle(-95, 90)).toEqual({ snapped: -90, error: 5 })
    expect(snapAngle(45, 90).error).toBe(45)
    expect(snapAngle(110, 120)).toEqual({ snapped: 120, error: 10 })
  })
})
