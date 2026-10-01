import { fingerCurl } from './landmarkMath'
import type { LandmarkFrame } from './landmarks'

// Holding a single closed fist steady toggles the camera lock. A fist is
// already meaningless to both gesture modes on its own (Signs needs extended
// fingers, Grab needs a pinch, orbit needs an open palm), so it can't be
// confused with a move. One hand only: in Grab mode a second-hand fist is the
// optional "anchor", and that must never flip the lock by accident.

export interface FistLockState {
  fistSinceMs: number | null
  // After a toggle the fist must be released before it can toggle again, so
  // holding it longer never flickers the lock on/off.
  armed: boolean
}

export const FIST_LOCK_HOLD_MS = 900

export function createFistLockState(): FistLockState {
  return { fistSinceMs: null, armed: true }
}

/** Progress (0..1) toward the next toggle, for an on-screen hold ring. */
export function fistLockProgress(state: FistLockState, nowMs: number): number {
  if (!state.armed || state.fistSinceMs === null) return 0
  return Math.min(1, (nowMs - state.fistSinceMs) / FIST_LOCK_HOLD_MS)
}

export function stepFistLock(
  state: FistLockState,
  frame: LandmarkFrame,
  fistThreshold: number,
  minScore = 0.5,
): { next: FistLockState; toggled: boolean } {
  const hands = frame.hands.filter((h) => h.score >= minScore)
  const isFist = hands.length === 1 && fingerCurl(hands[0].landmarks) < fistThreshold

  if (!isFist) return { next: { fistSinceMs: null, armed: true }, toggled: false }
  if (!state.armed) return { next: state, toggled: false }
  if (state.fistSinceMs === null) return { next: { fistSinceMs: frame.timestampMs, armed: true }, toggled: false }
  if (frame.timestampMs - state.fistSinceMs >= FIST_LOCK_HOLD_MS) {
    return { next: { fistSinceMs: null, armed: false }, toggled: true }
  }
  return { next: state, toggled: false }
}
