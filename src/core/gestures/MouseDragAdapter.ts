import { Alg } from 'cubing/alg'
import type { Move } from '../puzzles/PuzzlePlugin'

// The "input adapter" pattern from spec 8.6 starts here, before any camera code
// exists: a pure function from a drag to a Move, so it can be tested exactly the
// way the gesture FSM is (Phase 4) -- with no real mouse and no WebGL.

export type Axis = 'x' | 'y' | 'z'

export interface DragInput {
  // Outward normal of the face the pointer hit, in puzzle space.
  hitNormal: [number, number, number]
  // Cubie slot that was hit, each component in {-1, 0, 1}.
  slot: [number, number, number]
  // Pointer travel in screen pixels (y grows downward, as the DOM reports it).
  dragScreen: [number, number]
  // Screen-space direction of each puzzle axis, from the live camera.
  axisScreenDirs: Record<Axis, [number, number]>
  // Below this the drag is treated as a click, not a turn.
  minDragPx?: number
}

export const AXES: Axis[] = ['x', 'y', 'z']
export const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 }

// Outer-layer face letter for each axis and sign. Exported so the move
// animator (parseCubeMove.ts) can invert this table back into an axis+layer
// from a move's notation, without redefining the same face-letter mapping.
export const FACE_FOR: Record<Axis, { positive: string; negative: string }> = {
  x: { positive: 'R', negative: 'L' },
  y: { positive: 'U', negative: 'D' },
  z: { positive: 'F', negative: 'B' },
}

// Middle-slice letter and whether its notation runs with or against the axis.
// M follows L, E follows D, S follows F -- the standard WCA convention.
export const SLICE_FOR: Record<Axis, { letter: string; followsNegative: boolean }> = {
  x: { letter: 'M', followsNegative: true },
  y: { letter: 'E', followsNegative: true },
  z: { letter: 'S', followsNegative: false },
}

function dominantAxis(n: [number, number, number]): Axis {
  const abs = n.map(Math.abs)
  const max = Math.max(...abs)
  return AXES[abs.indexOf(max)]
}

const dot2 = (a: [number, number], b: [number, number]) => a[0] * b[0] + a[1] * b[1]

/**
 * Maps a drag to the Move it should commit, or null when the drag is too small
 * or ambiguous (the caller then treats it as a camera orbit, not a turn).
 *
 * The rotation axis is the one perpendicular to both the grabbed face's normal
 * and the direction dragged across it -- the same rule a hand follows on a real
 * cube.
 */
export function moveFromDrag(input: DragInput): Move | null {
  const minDrag = input.minDragPx ?? 8
  const [dx, dy] = input.dragScreen
  if (Math.hypot(dx, dy) < minDrag) return null

  const faceAxis = dominantAxis(input.hitNormal)
  const faceSign = Math.sign(input.hitNormal[AXIS_INDEX[faceAxis]]) || 1

  // Of the two axes lying in the grabbed face, pick whichever the drag followed.
  const inPlane = AXES.filter((a) => a !== faceAxis)
  let dragAxis: Axis | null = null
  let dragAlong = 0
  for (const axis of inPlane) {
    const along = dot2(input.dragScreen, input.axisScreenDirs[axis])
    if (Math.abs(along) > Math.abs(dragAlong)) {
      dragAxis = axis
      dragAlong = along
    }
  }
  if (!dragAxis || dragAlong === 0) return null

  // rotationAxis = faceNormal x dragDirection, both being unit puzzle axes.
  const rotationAxis = AXES.find((a) => a !== faceAxis && a !== dragAxis)
  if (!rotationAxis) return null

  const layer = input.slot[AXIS_INDEX[rotationAxis]]

  // Sign of (faceAxis, dragAxis, rotationAxis) as a right-handed triple.
  const order = [faceAxis, dragAxis, rotationAxis].map((a) => AXIS_INDEX[a])
  const evenPermutation =
    (order[0] + 1) % 3 === order[1] && (order[1] + 1) % 3 === order[2]
  const handedness = evenPermutation ? 1 : -1
  // The leading minus is not a typo: v = omega x r (the physical "which way a
  // dragged point moves" relationship) gives the sign of a rotation about the
  // POSITIVE puzzle axis, but a real cube's WCA-notation "positive/unprimed"
  // turn (R, U, F, ...) is the rotation in the OPPOSITE sense from that --
  // confirmed empirically by applying R/U/F through cubing.js's real kpuzzle
  // and checking which face's stickers actually end up where (see
  // parseCubeMove.ts, which needs the identical correction to animate the
  // real move rather than its inverse). Without this, a mouse-dragged "U"
  // reliably committed as U' -- a real user report, and confirmed by the
  // animation (driven by the same omega x r reasoning) showing the intended
  // direction while the committed state showed the opposite.
  const turnSign = -Math.sign(dragAlong) * faceSign * handedness

  let letter: string
  let notationSign: number
  if (layer === 0) {
    const slice = SLICE_FOR[rotationAxis]
    letter = slice.letter
    notationSign = slice.followsNegative ? -turnSign : turnSign
  } else {
    const sign = layer > 0 ? 'positive' : 'negative'
    letter = FACE_FOR[rotationAxis][sign]
    // A negative-side face turns clockwise when viewed from its own outside,
    // which is the opposite sense along the shared axis.
    notationSign = layer > 0 ? turnSign : -turnSign
  }

  const notation = notationSign > 0 ? letter : `${letter}'`
  return { alg: new Alg(notation), snapAngleDeg: 90 }
}
