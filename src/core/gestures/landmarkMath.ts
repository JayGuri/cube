import {
  FINGERTIPS,
  INDEX_MCP,
  INDEX_TIP,
  MIDDLE_MCP,
  PINKY_MCP,
  THUMB_TIP,
  WRIST,
  type Landmark,
} from './landmarks'

// Pure geometry over MediaPipe landmarks. No camera, no DOM, no Three.js -- so
// every gesture rule built on top of this is unit-testable without hardware.

export const subtract = (a: Landmark, b: Landmark): Landmark => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
})

export const cross = (a: Landmark, b: Landmark): Landmark => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

export const dot = (a: Landmark, b: Landmark): number => a.x * b.x + a.y * b.y + a.z * b.z

export const length = (a: Landmark): number => Math.sqrt(dot(a, a))

export const distance = (a: Landmark, b: Landmark): number => length(subtract(a, b))

export function normalize(a: Landmark): Landmark {
  const len = length(a)
  if (len === 0) return { x: 0, y: 0, z: 0 }
  return { x: a.x / len, y: a.y / len, z: a.z / len }
}

/**
 * Wrist-to-middle-knuckle distance. Every other threshold is divided by this so
 * gestures behave the same whether the hand is near or far from the camera
 * (spec 8.4).
 */
export function handScale(landmarks: Landmark[]): number {
  const scale = distance(landmarks[WRIST], landmarks[MIDDLE_MCP])
  // Guard against a degenerate frame producing Infinity downstream.
  return scale > 1e-6 ? scale : 1e-6
}

/** Thumb-tip to index-tip distance, normalised by hand size. */
export function pinchDistance(landmarks: Landmark[]): number {
  return distance(landmarks[THUMB_TIP], landmarks[INDEX_TIP]) / handScale(landmarks)
}

/** Outward normal of the palm (spec 8.2). */
export function palmNormal(landmarks: Landmark[]): Landmark {
  return normalize(
    cross(
      subtract(landmarks[PINKY_MCP], landmarks[INDEX_MCP]),
      subtract(landmarks[WRIST], landmarks[INDEX_MCP]),
    ),
  )
}

/** Mean fingertip-to-wrist distance, normalised. Low means a closed fist. */
export function fingerCurl(landmarks: Landmark[]): number {
  const scale = handScale(landmarks)
  const total = FINGERTIPS.reduce((sum, tip) => sum + distance(landmarks[tip], landmarks[WRIST]), 0)
  return total / FINGERTIPS.length / scale
}

/**
 * Signed roll of the palm about `axis`, in degrees. This is what a wrist twist
 * drives while a layer is grabbed.
 */
export function wristRoll(normal: Landmark, axis: Landmark = { x: 0, y: 0, z: 1 }): number {
  const a = normalize(axis)
  // Project the palm normal into the plane perpendicular to the axis, then read
  // its angle there.
  const along = dot(normal, a)
  const planar = normalize({
    x: normal.x - a.x * along,
    y: normal.y - a.y * along,
    z: normal.z - a.z * along,
  })
  return (Math.atan2(planar.y, planar.x) * 180) / Math.PI
}

/** Smallest signed difference between two angles, in degrees. */
export function angleDelta(from: number, to: number): number {
  let delta = (to - from) % 360
  if (delta > 180) delta -= 360
  if (delta < -180) delta += 360
  return delta
}

/** Nearest multiple of `snapAngleDeg`, and how far the angle was from it. */
export function snapAngle(angleDeg: number, snapAngleDeg: number): { snapped: number; error: number } {
  const steps = Math.round(angleDeg / snapAngleDeg)
  const snapped = steps * snapAngleDeg
  return { snapped, error: Math.abs(angleDeg - snapped) }
}

export const centroid = (points: Landmark[]): Landmark => {
  const sum = points.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y, z: a.z + p.z }), {
    x: 0,
    y: 0,
    z: 0,
  })
  return { x: sum.x / points.length, y: sum.y / points.length, z: sum.z / points.length }
}
