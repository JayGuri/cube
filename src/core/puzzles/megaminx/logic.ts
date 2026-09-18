import { Alg } from 'cubing/alg'
import type { KPattern, KPuzzle } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'
import { randomScrambleForEvent } from 'cubing/scramble'
import type { Move, PuzzleState } from '../PuzzlePlugin'

// Task 8.2 spike confirmed: megaminx via the `puzzles` dictionary; notation
// is WCA face letters with ++/-- amount modifiers for the 5-fold (72 degree)
// turns (e.g. "R++"), verified against the real scrambler's own output.

let kpuzzle: KPuzzle | null = null
let solvedPattern: KPattern | null = null

export async function initMegaminxLogic(): Promise<void> {
  if (solvedPattern) return
  kpuzzle = await puzzles['megaminx'].kpuzzle()
  solvedPattern = kpuzzle.defaultPattern()
}

function requireSolved(): KPattern {
  if (!solvedPattern) throw new Error('megaminx logic not initialised - call initMegaminxLogic() first')
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

export function isSolved(state: PuzzleState): boolean {
  return patternOf(state).isIdentical(requireSolved())
}

export function movesFromAlg(alg: Alg, snapAngleDeg = 72): Move[] {
  return [...alg.childAlgNodes()].map((node) => ({ alg: new Alg([node]), snapAngleDeg }))
}

export async function scramble(): Promise<Move[]> {
  return movesFromAlg(await randomScrambleForEvent('minx'))
}
