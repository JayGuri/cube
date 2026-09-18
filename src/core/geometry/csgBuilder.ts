import * as THREE from 'three'
import { Brush, Evaluator, INTERSECTION } from 'three-bvh-csg'

export interface CutPlane {
  // Plane normal; need not be unit length.
  normal: THREE.Vector3
  // Signed distance from the origin along `normal`.
  offset: number
}

// A big box whose face sits exactly on `plane`, covering the kept half-space.
function halfSpaceBrush(plane: CutPlane, size: number, keepPositiveSide: boolean): Brush {
  const n = plane.normal.clone().normalize()
  const brush = new Brush(new THREE.BoxGeometry(size, size, size))
  brush.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
  const sign = keepPositiveSide ? 1 : -1
  brush.position.copy(n).multiplyScalar(plane.offset + (sign * size) / 2)
  brush.updateMatrixWorld()
  return brush
}

const EMPTY_VOLUME_EPS = 1e-6

function boundingVolume(geo: THREE.BufferGeometry): number {
  geo.computeBoundingBox()
  const b = geo.boundingBox
  if (!b) return 0
  return (b.max.x - b.min.x) * (b.max.y - b.min.y) * (b.max.z - b.min.z)
}

// Cuts `base` by every plane, returning one geometry per non-empty cell of the
// resulting arrangement.
//
// Implemented as successive splitting rather than enumerating all 2^n sign
// combinations: empty cells are discarded as soon as they appear, so a 6-plane
// 3x3 cut costs ~78 boolean evaluations instead of 384 for the same 27 cells.
//
// Run once per puzzle type at load time -- never per move (spec 12.1).
export function cutSolidByPlanes(
  base: THREE.BufferGeometry,
  planes: CutPlane[],
): THREE.BufferGeometry[] {
  const evaluator = new Evaluator()
  evaluator.useGroups = false
  const boundingSize = 100 // generously larger than any puzzle's base solid

  let pieces: THREE.BufferGeometry[] = [base.clone()]

  for (const plane of planes) {
    const next: THREE.BufferGeometry[] = []
    for (const geo of pieces) {
      for (const keepPositiveSide of [true, false]) {
        const brush = new Brush(geo.clone())
        brush.updateMatrixWorld()
        const half = halfSpaceBrush(plane, boundingSize, keepPositiveSide)
        const result = evaluator.evaluate(brush, half, INTERSECTION)
        const out = result.geometry
        const count = out.getAttribute('position')?.count ?? 0
        if (count > 0 && boundingVolume(out) > EMPTY_VOLUME_EPS) {
          next.push(out.clone())
        }
      }
    }
    pieces = next
  }

  return pieces
}

// Centre of a piece's bounding box -- its slot position in puzzle space.
export function centroidOf(geo: THREE.BufferGeometry): THREE.Vector3 {
  geo.computeBoundingBox()
  const b = geo.boundingBox
  if (!b) return new THREE.Vector3()
  return b.min.clone().add(b.max).multiplyScalar(0.5)
}
