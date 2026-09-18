import { Alg } from 'cubing/alg'
import type { KPattern, KPuzzle } from 'cubing/kpuzzle'
import { cube3x3x3 } from 'cubing/puzzles'
import { randomScrambleForEvent } from 'cubing/scramble'
import { isPatternSolved } from '../kpattern'
import type { Move, PuzzleState } from '../PuzzlePlugin'

let kpuzzle: KPuzzle | null = null
let solvedPattern: KPattern | null = null

// cube3x3x3.kpuzzle() is async, so the module needs an explicit init before any
// synchronous call. createCube3Plugin() awaits this, so callers of the plugin
// never see an uninitialised module.
export async function initCube3Logic(): Promise<void> {
  if (solvedPattern) return
  kpuzzle = await cube3x3x3.kpuzzle()
  solvedPattern = kpuzzle.defaultPattern()
}

function requireSolved(): KPattern {
  if (!solvedPattern) {
    throw new Error('cube3 logic not initialised - call initCube3Logic() first')
  }
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
  return isPatternSolved(patternOf(state), requireSolved())
}

export function applyAlgString(state: PuzzleState, alg: string): PuzzleState {
  return { raw: patternOf(state).applyAlg(new Alg(alg)) }
}

// childAlgNodes() yields Move instances, not Alg (Task 1.1 spike) -- each is
// wrapped in a single-node Alg so the rest of the app only ever handles Alg.
export function movesFromAlg(alg: Alg, snapAngleDeg = 90): Move[] {
  return [...alg.childAlgNodes()].map((node) => ({
    alg: new Alg([node]),
    snapAngleDeg,
  }))
}

export async function scramble(): Promise<Move[]> {
  return movesFromAlg(await randomScrambleForEvent('333'))
}
