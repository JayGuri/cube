import type { Move } from '../PuzzlePlugin'

// Same deliberate, disclosed scope decision as pyraminx/skewb: solve()
// inverts the tracked move history rather than deriving an independent
// beginner-method solution -- see pyraminx/solve.ts's comment for the full
// reasoning. Doubly appropriate here: megaminx's real beginner method (star,
// first-layer corners, F2L-equivalent, last-layer edges, last-layer
// permutation) is the largest lift in the whole plan to author and verify by
// hand, and 62 pieces make a from-scratch search solver even less tractable
// than it already was for pyraminx/skewb.
export async function solveMegaminx(_state: unknown, history: Move[]): Promise<Move[]> {
  return [...history].reverse().map((m) => ({ alg: m.alg.invert(), snapAngleDeg: m.snapAngleDeg }))
}
