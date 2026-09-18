import { Alg } from 'cubing/alg'
import type { KPattern, KPuzzle } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'
import { randomScrambleForEvent } from 'cubing/scramble'
import { orbitsOf } from '../kpattern'
import type { Move, PuzzleState } from '../PuzzlePlugin'

// Confirmed via the Task 6.1 spike against cubing@0.56.0: pyraminx is reached
// through the `puzzles` dictionary (NOT a named export), and the real,
// human-facing notation is standard WCA/SiGN -- U/L/R/B for whole-face turns,
// u/l/r/b for tip-only turns -- verified against the real scrambler's own
// output, NOT the internal move-family names cubing generates internally
// (which are unrelated strings like "2r"/"BL" and are not meant to be typed).

let kpuzzle: KPuzzle | null = null
let solvedPattern: KPattern | null = null

export async function initPyraminxLogic(): Promise<void> {
  if (solvedPattern) return
  kpuzzle = await puzzles['pyraminx'].kpuzzle()
  solvedPattern = kpuzzle.defaultPattern()
}

function requireSolved(): KPattern {
  if (!solvedPattern) throw new Error('pyraminx logic not initialised - call initPyraminxLogic() first')
  return solvedPattern
}

export function createInitialState(): PuzzleState {
  return { raw: requireSolved() }
}

export function patternOf(state: PuzzleState): KPattern {
  return state.raw as KPattern
}

export function applyMove(state: PuzzleState, move: Move): PuzzleState {
  return { raw: patternOf(state).applyAlg(move.alg) }
}

// Tips and axial centres never permute -- verified in the Task 6.1 spike --
// so isIdentical (exact) is safe here; there is no whole-puzzle-orientation
// ambiguity the way there is for cube3, since pyraminx has no even/whole
// rotations that read as "the same puzzle held differently" independent of
// piece identity.
export function isSolved(state: PuzzleState): boolean {
  return patternOf(state).isIdentical(requireSolved())
}

export function movesFromAlg(alg: Alg, snapAngleDeg = 120): Move[] {
  return [...alg.childAlgNodes()].map((node) => ({ alg: new Alg([node]), snapAngleDeg }))
}

export async function scramble(): Promise<Move[]> {
  return movesFromAlg(await randomScrambleForEvent('pyram'))
}

export { orbitsOf }
