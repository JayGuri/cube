import { Alg } from 'cubing/alg'
import type { KPattern, KPuzzle } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'
import { randomScrambleForEvent } from 'cubing/scramble'
import type { Move, PuzzleState } from '../PuzzlePlugin'

// Task 6.1 spike confirmed: skewb via the `puzzles` dictionary; standard WCA
// notation U/L/R/B (each order-3, since a corner turn is 120 degrees) matches
// the real scrambler's own output.

let kpuzzle: KPuzzle | null = null
let solvedPattern: KPattern | null = null

export async function initSkewbLogic(): Promise<void> {
  if (solvedPattern) return
  kpuzzle = await puzzles['skewb'].kpuzzle()
  solvedPattern = kpuzzle.defaultPattern()
}

function requireSolved(): KPattern {
  if (!solvedPattern) throw new Error('skewb logic not initialised - call initSkewbLogic() first')
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

// Skewb's centre orbit does not support experimentalIsPatternSolved (Task 1.1
// spike found this throws for skewb); isIdentical is exact but skewb has no
// whole-puzzle-rotation ambiguity the way cube3 does; safe as-is.
export function isSolved(state: PuzzleState): boolean {
  return patternOf(state).isIdentical(requireSolved())
}

export function movesFromAlg(alg: Alg, snapAngleDeg = 120): Move[] {
  return [...alg.childAlgNodes()].map((node) => ({ alg: new Alg([node]), snapAngleDeg }))
}

export async function scramble(): Promise<Move[]> {
  return movesFromAlg(await randomScrambleForEvent('skewb'))
}
