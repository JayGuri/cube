import * as THREE from 'three'
import { centroidOf, cutSolidByPlanes } from '../../geometry/csgBuilder'
import { assignFaceGroups, type OuterFace } from '../../geometry/faceGroups'
import type { PieceMesh, PuzzleMesh } from '../PuzzlePlugin'

export const SIZE = 3
const HALF = SIZE / 2

// spec 7.3: 4 planes through the centre, each perpendicular to one of the
// cube's 4 body diagonals.
const DIAGONALS = [
  new THREE.Vector3(1, 1, 1),
  new THREE.Vector3(1, 1, -1),
  new THREE.Vector3(1, -1, 1),
  new THREE.Vector3(-1, 1, 1),
].map((v) => v.normalize())

function skewbPlanes() {
  return DIAGONALS.map((n) => ({ normal: n, offset: 0 }))
}

// Outer faces reuse the same 6-face convention as cube3.
export const FACE_ORDER = ['U', 'D', 'F', 'B', 'R', 'L'] as const
export type Face = (typeof FACE_ORDER)[number]

const FACE_NORMALS: Record<Face, THREE.Vector3> = {
  U: new THREE.Vector3(0, 1, 0),
  D: new THREE.Vector3(0, -1, 0),
  F: new THREE.Vector3(0, 0, 1),
  B: new THREE.Vector3(0, 0, -1),
  R: new THREE.Vector3(1, 0, 0),
  L: new THREE.Vector3(-1, 0, 0),
}

export const OUTER_FACES: OuterFace[] = FACE_ORDER.map((f) => ({
  id: f,
  normal: FACE_NORMALS[f],
  offset: HALF,
}))
export const INTERIOR_GROUP = OUTER_FACES.length

// spec 11.1: same WCA scheme as cube3/skewb.
export const SKEWB_COLORS: Record<Face, string> = {
  U: '#FFFFFF',
  D: '#FFD500',
  F: '#009E60',
  B: '#0051BA',
  R: '#C41E3A',
  L: '#FF5800',
}

export type SkewbKind = 'corner' | 'center'
export interface SkewbSlot {
  kind: SkewbKind
  // Which diagonal-sign octant (corner) or face (center) this piece is at.
  index: number
}

// Corners sit at one of the 8 sign-octants of the 3 coordinate axes; centres
// sit at the middle of one of the 6 faces (position along exactly one axis).
export function classifySkewbPiece(centroid: THREE.Vector3): SkewbSlot {
  const q = (v: number) => (Math.abs(v) < 0.35 ? 0 : v > 0 ? 1 : -1)
  const signs: [number, number, number] = [q(centroid.x), q(centroid.y), q(centroid.z)]
  const nonZero = signs.filter((s) => s !== 0).length

  if (nonZero === 3) {
    const octant = ((signs[0] > 0 ? 1 : 0) << 2) | ((signs[1] > 0 ? 1 : 0) << 1) | (signs[2] > 0 ? 1 : 0)
    return { kind: 'corner', index: octant }
  }
  // Centre: exactly one axis non-zero.
  if (signs[1] > 0) return { kind: 'center', index: 0 } // U
  if (signs[1] < 0) return { kind: 'center', index: 1 } // D
  if (signs[2] > 0) return { kind: 'center', index: 2 } // F
  if (signs[2] < 0) return { kind: 'center', index: 3 } // B
  if (signs[0] > 0) return { kind: 'center', index: 4 } // R
  return { kind: 'center', index: 5 } // L
}

export function skewbSlotId(slot: SkewbSlot): string {
  return `skewb-${slot.kind}-${slot.index}`
}

let cached: PuzzleMesh | null = null

export function buildSkewbGeometry(): PuzzleMesh {
  if (cached) return cached
  const box = new THREE.BoxGeometry(SIZE, SIZE, SIZE)
  const cells = cutSolidByPlanes(box, skewbPlanes())

  const pieces: PieceMesh[] = []
  for (const cell of cells) {
    const centroid = centroidOf(cell)
    const slot = classifySkewbPiece(centroid)
    pieces.push({
      pieceId: skewbSlotId(slot),
      geometry: assignFaceGroups(cell, OUTER_FACES),
      slot: [centroid.x, centroid.y, centroid.z],
    })
  }

  cached = { pieces }
  return cached
}
