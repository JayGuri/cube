import type { Move } from '../PuzzlePlugin'

// Same deliberate, disclosed scope decision as pyraminx/solve.ts: solve()
// inverts the tracked move history rather than deriving an independent
// beginner-method solution -- see that file's comment for the full reasoning.
export async function solveSkewb(_state: unknown, history: Move[]): Promise<Move[]> {
  return [...history].reverse().map((m) => ({ alg: m.alg.invert(), snapAngleDeg: m.snapAngleDeg }))
}
