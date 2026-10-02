import * as THREE from 'three'
import type { PuzzleMesh } from '../PuzzlePlugin'
import { createPieces, type Vec3 } from './pieces'

// Outer layer thicknesses. Middle layers stay 1.0 thick and centred, so centres
// are 1x1 squares and their rotation is never visible (see the plan doc).
export const MIRROR_EXTENTS = { R: 1.4, L: 0.6, U: 1.25, D: 0.75, F: 1.15, B: 0.85 } as const

const POS = [MIRROR_EXTENTS.R, MIRROR_EXTENTS.U, MIRROR_EXTENTS.F]
const NEG = [MIRROR_EXTENTS.L, MIRROR_EXTENTS.D, MIRROR_EXTENTS.B]

export function slabRange(axis: 0 | 1 | 2, layer: number): [number, number] {
  if (layer === 1) return [0.5, 0.5 + POS[axis]]
  if (layer === -1) return [-0.5 - NEG[axis], -0.5]
  return [-0.5, 0.5]
}

export function pieceBox(home: Vec3): { size: Vec3; center: Vec3 } {
  const ranges = ([0, 1, 2] as const).map((a) => slabRange(a, home[a]))
  return {
    size: ranges.map(([lo, hi]) => hi - lo) as Vec3,
    center: ranges.map(([lo, hi]) => (lo + hi) / 2) as Vec3,
  }
}

export const mirrorPieceId = (home: Vec3) => `mirror-${home[0]}_${home[1]}_${home[2]}`

export function buildMirrorGeometry(): PuzzleMesh {
  return {
    pieces: createPieces().map(({ home }) => ({
      pieceId: mirrorPieceId(home),
      geometry: new THREE.BoxGeometry(...pieceBox(home).size),
      slot: home,
    })),
  }
}
