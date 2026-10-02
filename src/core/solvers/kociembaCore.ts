// Pure, worker-agnostic solver entry point (kociemba.worker.ts is a thin shim
// over it, so everything here can be unit tested directly).
//
// The search itself lives in twoPhase.ts. This layer accepts what the app has
// to offer -- the history of moves that produced the current cube, which may
// include slice turns (M E S) and rotations -- and hands the solver plain face
// turns (see frame.ts), then relabels its answer for the cube as it is held.

import { fromOriginalFrame, toFaceTurns } from './frame'
import { initTwoPhase, isTwoPhaseReady, solveTwoPhase } from './twoPhase'

// Building the move and pruning tables costs about a second, so the app warms
// this up at startup in a worker rather than on the first Solve press.
export async function initSolverCore(): Promise<void> {
  initTwoPhase()
}

export function isSolverReady(): boolean {
  return isTwoPhaseReady()
}

const ALG_PATTERN = /^([FRUBLDxyzMSE][2']?\s*)+$/
// Exactly 54 face letters with no separators, primes or doubles: a facelet
// string, never an algorithm. It is made of the letters U R F D L B, so it
// would pass the pattern above and silently produce a meaningless answer.
const FACELET_PATTERN = /^[URFDLB]{54}$/

/**
 * Returns a short solution for the cube reached by applying `scrambleAlg` to a
 * solved cube, as a space-separated algorithm string. An empty scramble means
 * the cube is already solved, so the solution is empty too.
 *
 * `timeMs` is how long to keep hunting for a shorter solution once one exists.
 */
export async function solveScramble(scrambleAlg: string, timeMs?: number): Promise<string> {
  const alg = scrambleAlg.trim()
  if (alg.length === 0) return ''
  if (!ALG_PATTERN.test(alg)) {
    throw new Error(`not a valid algorithm for the solver: ${alg.slice(0, 60)}`)
  }
  if (FACELET_PATTERN.test(alg)) {
    throw new Error('received a 54-character facelet string; this solver takes a scramble algorithm, not facelets')
  }
  const { turns, frame } = toFaceTurns(alg)
  return fromOriginalFrame(solveTwoPhase(turns, { timeMs }), frame)
}
