import * as THREE from 'three'

// Every puzzle is scaled (see the `scale` useMemo in PuzzleCanvas below) to
// this same on-screen half-diagonal, so one constant bounding-sphere radius
// describes every puzzle's actual on-screen footprint regardless of shape.
const PUZZLE_TARGET_RADIUS = 2.6

// The gesture cursor is a raw fraction of the WEBCAM frame (where the hand
// sits within the camera's view), but the puzzle only fills part of the
// actual browser viewport -- and a much SMALLER part on a wide window than a
// narrow one, since the camera's fixed position/fov were tuned for the
// puzzle's own aspect, not the window's. Mapping cursor 0..1 straight across
// the full viewport meant a real hand -- which naturally roams closer to the
// camera frame's own edges than the puzzle does to the window's -- could
// only ever raycast-hit the puzzle from within an uncomfortably narrow,
// precisely centred band. Confirmed by projecting the puzzle's bounding
// sphere at the real camera config: on a typical wide window the puzzle only
// spans about a quarter of the screen's width. A real user report: grabbing
// a layer essentially never worked, only camera orbit/zoom (which need no
// raycast hit at all) did.
//
// Fixed by remapping the cursor's comfortable range within the camera frame
// (leaving a margin near the frame's own edges, where a hand is awkward to
// hold anyway) onto the puzzle's actual on-screen bounding box, computed
// fresh from the live camera every time so it stays correct across every
// window size and through every orbit/zoom the user does. CAMERA_FRAME_MARGIN
// is tuned by feel, not measured against a real camera -- if grabbing still
// feels like it needs the hand kept too close to frame-centre (or too close
// to the frame's edge) once someone can test it live, this is the number to
// adjust.
const CAMERA_FRAME_MARGIN = 0.18

// The puzzle's bounding SPHERE (used below, since it needs no orientation
// tracking) circumscribes the actual cube -- touching it only at the 8
// corners and sitting outside the cube's flat faces everywhere else, and
// perspective projection doesn't distribute that gap evenly between screen
// x and y. Mapping the usable camera-frame range straight onto the sphere's
// projected radius therefore overshoots past the cube near the mapped
// edges (confirmed by a grid-scan raycast sweep: several points inside the
// margin still missed). Shrinking the mapped radius keeps the full usable
// range safely inside the cube's real footprint instead -- also tuned
// empirically via the same grid-scan, not derived, since the cube's exact
// silhouette in screen space depends on perspective in a way a closed-form
// correction isn't worth deriving for an approximation this coarse already.
const RADIUS_SAFETY_SHRINK = 0.55

export function puzzleBoundsNdc(camera: THREE.Camera, radius: number) {
  const rightDir = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize()
  const upDir = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize()
  const origin = new THREE.Vector3(0, 0, 0)
  const centerNdc = origin.clone().project(camera)
  const rightNdc = origin.clone().addScaledVector(rightDir, radius).project(camera)
  const upNdc = origin.clone().addScaledVector(upDir, radius).project(camera)
  return {
    x: centerNdc.x,
    y: centerNdc.y,
    radiusX: Math.abs(rightNdc.x - centerNdc.x),
    radiusY: Math.abs(upNdc.y - centerNdc.y),
  }
}

export function cursorToNdc(cursor: { x: number; y: number }, camera: THREE.Camera): THREE.Vector2 {
  const bounds = puzzleBoundsNdc(camera, PUZZLE_TARGET_RADIUS)
  const usable = 1 - 2 * CAMERA_FRAME_MARGIN
  const normX = (cursor.x - CAMERA_FRAME_MARGIN) / usable
  const normY = (cursor.y - CAMERA_FRAME_MARGIN) / usable
  return new THREE.Vector2(
    bounds.x + (normX * 2 - 1) * bounds.radiusX * RADIUS_SAFETY_SHRINK,
    bounds.y - (normY * 2 - 1) * bounds.radiusY * RADIUS_SAFETY_SHRINK, // screen y grows downward; NDC y grows upward
  )
}
