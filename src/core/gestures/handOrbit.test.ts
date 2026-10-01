import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { orbitFromHand } from './handOrbit'

// Where a point on the cube's front face appears on screen (NDC) after the
// camera has orbited -- i.e. what the user actually sees move.
function screenPosOfFront(cameraPos: THREE.Vector3) {
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100)
  camera.position.copy(cameraPos)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  return new THREE.Vector3(0, 0, 1.5).project(camera)
}

const START = new THREE.Vector3(5.5, 5, 6.5)
const TARGET = new THREE.Vector3(0, 0, 0)
// Raw camera frame: the user's own right is -x.
const HAND_RIGHT = -0.02
const HAND_LEFT = 0.02

describe("orbiting by hand follows the hand, from the user's perspective", () => {
  it('REGRESSION: hand moves right -> the cube turns right (its front slides right on screen)', () => {
    const before = screenPosOfFront(START)
    const after = screenPosOfFront(orbitFromHand(START, TARGET, HAND_RIGHT, 0))
    expect(after.x).toBeGreaterThan(before.x)
  })

  it('hand moves left -> the cube turns left', () => {
    const before = screenPosOfFront(START)
    const after = screenPosOfFront(orbitFromHand(START, TARGET, HAND_LEFT, 0))
    expect(after.x).toBeLessThan(before.x)
  })

  it('keeps the same distance from the cube', () => {
    const after = orbitFromHand(START, TARGET, 0.05, 0.03)
    expect(after.length()).toBeCloseTo(START.length(), 6)
  })
})
