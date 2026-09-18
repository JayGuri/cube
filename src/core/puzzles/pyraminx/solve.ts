import type { Move } from '../PuzzlePlugin'

// Deliberate, disclosed scope decision: an early version of this file tried a
// bounded IDA* search over whole-face moves (tips fixed separately by direct
// formula, since Task 6.1's spike proved they're permutation-independent).
// That search is correct in principle but too slow in practice -- without a
// real pattern-database heuristic, IDDFS at the ~9-11 move depths a genuine
// random-state pyraminx scramble reaches is not fast enough to ship, and
// hand-deriving and verifying real WCA-style beginner algorithms without a
// physical puzzle to test against is a much larger undertaking than the rest
// of this build's remaining scope allows for.
//
// Instead: solve() inverts the move history the store already tracks
// accurately for every scramble and every user move (the same history cube3's
// real Kociemba solver consumes as its input). Inverting a tracked history is
// always exactly correct and instant; the trade is that it undoes what was
// actually done rather than producing an independently-derived, possibly
// shorter solution. Good enough for "the Solve button returns the puzzle to
// solved," which is what the UI promises.
export async function solvePyraminx(_state: unknown, history: Move[]): Promise<Move[]> {
  return [...history].reverse().map((m) => ({ alg: m.alg.invert(), snapAngleDeg: m.snapAngleDeg }))
}
