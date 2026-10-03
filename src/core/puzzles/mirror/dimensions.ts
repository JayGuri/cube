import type { Vec3 } from './pieces'

// The Mirror Cube's sizes, kept free of any 3D library so the home page's CSS
// cube can use them without downloading three.js.

// Outer layer thicknesses. Middle layers stay 1.0 thick and centred, so centres
// are 1x1 squares and their rotation is never visible.
export const MIRROR_EXTENTS = { R: 1.4, L: 0.6, U: 1.25, D: 0.75, F: 1.15, B: 0.85 } as const

const POS = [MIRROR_EXTENTS.R, MIRROR_EXTENTS.U, MIRROR_EXTENTS.F]
const NEG = [MIRROR_EXTENTS.L, MIRROR_EXTENTS.D, MIRROR_EXTENTS.B]

function slabRange(axis: 0 | 1 | 2, layer: number): [number, number] {
  if (layer === 1) return [0.5, 0.5 + POS[axis]]
  if (layer === -1) return [-0.5 - NEG[axis], -0.5]
  return [-0.5, 0.5]
}

/** The block a piece is when it sits in its home slot: its size and where its centre is. */
export function pieceBox(home: Vec3): { size: Vec3; center: Vec3 } {
  const ranges = ([0, 1, 2] as const).map((a) => slabRange(a, home[a]))
  return {
    size: ranges.map(([lo, hi]) => hi - lo) as Vec3,
    center: ranges.map(([lo, hi]) => (lo + hi) / 2) as Vec3,
  }
}
