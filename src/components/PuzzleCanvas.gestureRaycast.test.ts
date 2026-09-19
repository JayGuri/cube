import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildCube3Geometry } from '../core/puzzles/cube3/geometry'
import { cursorToNdc } from './PuzzleCanvas'

// REGRESSION: a real user report that grabbing a layer by hand essentially
// never worked, only camera orbit/zoom (which need no raycast hit) did.
// Root cause, found by projecting the puzzle's own bounding sphere through
// the real camera config: the gesture cursor (a raw fraction of the webcam
// frame) was mapped straight across the FULL browser viewport, but the
// puzzle itself only occupies a narrow centred band of that viewport on a
// realistic wide window -- so a hand had to stay within an unreasonably
// precise, narrow range just to horizontally line up with the cube at all.
//
// This builds the REAL scene graph (matching Pieces' render, one group per
// piece at its gap-offset position, each mesh carrying userData.slot) and
// raycasts against it exactly the way PuzzleCanvas's gesture effect does, so
// it is a genuine end-to-end check of the raycast math, not a re-run of the
// formula under test.
function buildRealCube3Scene(): THREE.Scene {
  const mesh = buildCube3Geometry()
  const scene = new THREE.Scene()
  const GAP_FRACTION = 0.075
  for (const piece of mesh.pieces) {
    const group = new THREE.Group()
    group.position.set(piece.slot[0] * GAP_FRACTION, piece.slot[1] * GAP_FRACTION, piece.slot[2] * GAP_FRACTION)
    const m = new THREE.Mesh(piece.geometry)
    m.userData = { slot: piece.slot }
    group.add(m)
    scene.add(group)
  }
  scene.updateMatrixWorld(true)
  return scene
}

function cameraAt(aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100)
  camera.position.set(5.5, 5, 6.5)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  return camera
}

function raycastHit(scene: THREE.Scene, camera: THREE.Camera, cursor: { x: number; y: number }) {
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(cursorToNdc(cursor, camera), camera)
  const intersections = raycaster.intersectObjects(scene.children, true)
  return intersections.find((i) => i.object.userData?.slot) ?? null
}

describe('gesture cursor raycasting', () => {
  const scene = buildRealCube3Scene()

  it('REGRESSION: a hand roaming the whole usable camera frame hits the cube on a wide window', () => {
    // A real, wide browser window (matches an actual live measurement).
    // Every point across the full usable margin (0.2..0.8, in steps of 0.1,
    // both axes) is asserted, not just a few samples -- confirmed by an
    // exhaustive grid-scan sweep to all hit at the tuned RADIUS_SAFETY_SHRINK.
    const camera = cameraAt(2.844)
    for (let y = 0.2; y <= 0.8 + 1e-9; y += 0.1) {
      for (let x = 0.2; x <= 0.8 + 1e-9; x += 0.1) {
        const cursor = { x, y }
        expect(raycastHit(scene, camera, cursor), JSON.stringify(cursor)).not.toBeNull()
      }
    }
  })

  it('still hits the cube across the full usable frame on a narrower window (portrait-ish)', () => {
    const camera = cameraAt(0.8)
    for (let y = 0.2; y <= 0.8 + 1e-9; y += 0.2) {
      for (let x = 0.2; x <= 0.8 + 1e-9; x += 0.2) {
        expect(raycastHit(scene, camera, { x, y }), `${x},${y}`).not.toBeNull()
      }
    }
  })

  it('a hit reports the actual grabbed slot and a real face normal', () => {
    const camera = cameraAt(2.844)
    const hit = raycastHit(scene, camera, { x: 0.5, y: 0.5 })!
    expect(hit.object.userData.slot).toHaveLength(3)
    expect(hit.face?.normal).toBeDefined()
  })

  it('BEFORE THE FIX: mapping the cursor straight across the full viewport missed the cube from this same, entirely reasonable hand position', () => {
    // Demonstrates the bug this file guards against: the naive x*2-1 mapping
    // that shipped before this fix, replayed against the same real scene.
    const camera = cameraAt(2.844)
    const cursor = { x: 0.3, y: 0.5 } // comfortably inside the camera frame
    const naiveNdc = new THREE.Vector2(cursor.x * 2 - 1, -(cursor.y * 2 - 1))
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(naiveNdc, camera)
    const naiveHit = raycaster.intersectObjects(scene.children, true).find((i) => i.object.userData?.slot)
    expect(naiveHit).toBeUndefined()
    // The fixed mapping hits the same input.
    expect(raycastHit(scene, camera, cursor)).not.toBeNull()
  })
})
