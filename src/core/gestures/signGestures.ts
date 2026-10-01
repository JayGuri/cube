import { Alg } from 'cubing/alg'
import type { Move } from '../puzzles/PuzzlePlugin'
import { centroid, distance, handScale } from './landmarkMath'
import type { Handedness, HandFrame, Landmark, LandmarkFrame } from './landmarks'
import type { Axis } from './MouseDragAdapter'

// "Signs": HandCube's primary hand-control scheme. A finger pose SELECTS a
// layer, then moving the hand PUSHES that layer the way you want it to go.
//
// Selection is discrete (which fingers are extended, and which hand), so it
// doesn't depend on aiming a cursor at a small target or on reading a subtle
// wrist roll -- the two things continuous hand tracking is worst at. A pose
// only selects once it wins a majority vote over the last few frames, so a
// single mis-tracked frame never turns anything. Direction comes from the
// hand's own motion, so the layer always moves the way the hand did.

export type SignLayer = 'R' | 'L' | 'U' | 'D' | 'F' | 'B' | 'M' | 'E' | 'S'

// Fingers in order index, middle, ring, pinky (the thumb is ignored: it is
// the least reliable finger to track and the hardest to hold still).
type FingerMask = string

const SIGN_FOR: Record<Handedness, Record<FingerMask, SignLayer>> = {
  Right: { '1000': 'R', '1100': 'U', '1110': 'F', '0001': 'M', '1001': 'S' },
  Left: { '1000': 'L', '1100': 'D', '1110': 'B', '0001': 'E', '1001': 'S' },
}

// How each layer is pushed, seen from the default front view, and which
// notation that push is. `positive` is the notation for a swipe right
// (horizontal layers) or up (vertical layers). Each pairing is checked
// against the real plugin in signGestures.test: the stickers you can see on
// the front of that layer travel the same way the hand did.
export const LAYER_PUSH: Record<SignLayer, { swipe: 'horizontal' | 'vertical'; positive: string; negative: string }> = {
  U: { swipe: 'horizontal', positive: "U'", negative: 'U' },
  E: { swipe: 'horizontal', positive: 'E', negative: "E'" },
  D: { swipe: 'horizontal', positive: 'D', negative: "D'" },
  R: { swipe: 'vertical', positive: 'R', negative: "R'" },
  M: { swipe: 'vertical', positive: "M'", negative: 'M' },
  L: { swipe: 'vertical', positive: "L'", negative: 'L' },
  F: { swipe: 'horizontal', positive: 'F', negative: "F'" },
  S: { swipe: 'horizontal', positive: 'S', negative: "S'" },
  B: { swipe: 'horizontal', positive: "B'", negative: 'B' },
}

// Which pieces a layer turns, for the on-cube preview glow.
export const LAYER_SLICE: Record<SignLayer, { axis: Axis; layer: -1 | 0 | 1 }> = {
  R: { axis: 'x', layer: 1 },
  M: { axis: 'x', layer: 0 },
  L: { axis: 'x', layer: -1 },
  U: { axis: 'y', layer: 1 },
  E: { axis: 'y', layer: 0 },
  D: { axis: 'y', layer: -1 },
  F: { axis: 'z', layer: 1 },
  S: { axis: 'z', layer: 0 },
  B: { axis: 'z', layer: -1 },
}

const FINGERS: Array<{ tip: number }> = [{ tip: 8 }, { tip: 12 }, { tip: 16 }, { tip: 20 }]

export interface SignOptions {
  // A fingertip this many hand-scales from the wrist counts as extended.
  extendedRatio: number
  // Votes needed out of the last `voteWindow` frames to select a sign.
  voteWindow: number
  votesToSelect: number
  // Hand travel, as a fraction of the camera frame, that commits a turn.
  swipeDistance: number
  // After a turn, the hand must pause this long before the next one, so the
  // return stroke of a swipe can't be read as a second, opposite turn.
  cooldownMs: number
  minScore: number
  // MediaPipe labels hands as if the image were mirrored; our camera frames
  // are not, so its "Left" is the user's right hand. Exposed in Settings in
  // case a particular camera/driver already mirrors.
  swapHands: boolean
}

export const DEFAULT_SIGN_OPTIONS: SignOptions = {
  extendedRatio: 1.4,
  voteWindow: 6,
  votesToSelect: 4,
  swipeDistance: 0.12,
  cooldownMs: 450,
  minScore: 0.5,
  swapHands: false,
}

export function realHandedness(label: Handedness, swapHands: boolean): Handedness {
  const flipped: Handedness = label === 'Left' ? 'Right' : 'Left'
  return swapHands ? label : flipped
}

export function fingerMask(landmarks: Landmark[], extendedRatio: number): FingerMask {
  const wrist = landmarks[0]
  const scale = handScale(landmarks)
  return FINGERS.map((f) => (distance(landmarks[f.tip], wrist) / scale > extendedRatio ? '1' : '0')).join('')
}

/** The layer a single hand is signing right now, or null. */
export function readSign(hand: HandFrame, opts: SignOptions = DEFAULT_SIGN_OPTIONS): SignLayer | null {
  const who = realHandedness(hand.handedness, opts.swapHands)
  return SIGN_FOR[who][fingerMask(hand.landmarks, opts.extendedRatio)] ?? null
}

// Palm position in the user's own left/right: raw camera x runs opposite to
// the user's physical left/right, so it is flipped once here (the same flip
// the raycast cursor uses). y is left as-is.
function palmPoint(hand: HandFrame): { x: number; y: number } {
  const c = centroid([hand.landmarks[0], hand.landmarks[5], hand.landmarks[17]])
  return { x: 1 - c.x, y: c.y }
}

export interface SignState {
  votes: Array<SignLayer | null>
  selected: SignLayer | null
  anchor: { x: number; y: number } | null
  cooldownUntilMs: number
}

export function createSignState(): SignState {
  return { votes: [], selected: null, anchor: null, cooldownUntilMs: 0 }
}

export type SignEvent =
  | { type: 'SELECT'; layer: SignLayer }
  | { type: 'CLEAR' }
  | { type: 'TURN'; layer: SignLayer; move: Move }

// Signed travel along the selected layer's swipe axis: + is right / up.
function travel(state: SignState, p: { x: number; y: number }): number {
  if (!state.selected || !state.anchor) return 0
  return LAYER_PUSH[state.selected].swipe === 'horizontal' ? p.x - state.anchor.x : state.anchor.y - p.y
}

/** -1..1 of the way to committing a turn (sign = direction), for the HUD. */
export function swipeProgress(state: SignState, frame: LandmarkFrame, opts: SignOptions = DEFAULT_SIGN_OPTIONS) {
  const hand = frame.hands.find((h) => h.score >= opts.minScore)
  if (!hand || frame.timestampMs < state.cooldownUntilMs) return 0
  return Math.max(-1, Math.min(1, travel(state, palmPoint(hand)) / opts.swipeDistance))
}

function mostVoted(votes: Array<SignLayer | null>): { layer: SignLayer | null; count: number } {
  const counts = new Map<SignLayer, number>()
  for (const v of votes) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: SignLayer | null = null
  let count = 0
  for (const [layer, n] of counts) if (n > count) [best, count] = [layer, n]
  return { layer: best, count }
}

export function stepSigns(
  state: SignState,
  frame: LandmarkFrame,
  opts: SignOptions = DEFAULT_SIGN_OPTIONS,
): { next: SignState; events: SignEvent[] } {
  const events: SignEvent[] = []
  // Exactly one hand: two hands is the zoom gesture, never a sign.
  const hands = frame.hands.filter((h) => h.score >= opts.minScore)
  const hand = hands.length === 1 ? hands[0] : null
  const sign = hand ? readSign(hand, opts) : null

  const votes = [...state.votes, sign].slice(-opts.voteWindow)
  const { layer: winner, count } = mostVoted(votes)
  const next: SignState = { ...state, votes }

  // A selection is sticky: it survives a stray frame or two and only
  // changes once a different sign wins the vote, or every recent frame lost
  // the sign (hand gone, or relaxed into a non-sign).
  if (!hand || votes.every((v) => v === null)) {
    if (state.selected) events.push({ type: 'CLEAR' })
    return { next: { ...next, selected: null, anchor: null }, events }
  }
  if (winner && count >= opts.votesToSelect && winner !== state.selected) {
    events.push({ type: 'SELECT', layer: winner })
    return { next: { ...next, selected: winner, anchor: palmPoint(hand) }, events }
  }
  if (!state.selected || !state.anchor) return { next, events }

  const p = palmPoint(hand)
  if (frame.timestampMs < state.cooldownUntilMs) {
    // Re-anchor while cooling down, so the next swipe is measured from
    // wherever the hand comes to rest, not from before the last one.
    return { next: { ...next, anchor: p }, events }
  }

  const along = travel(state, p)
  if (Math.abs(along) >= opts.swipeDistance) {
    const push = LAYER_PUSH[state.selected]
    const notation = along > 0 ? push.positive : push.negative
    events.push({ type: 'TURN', layer: state.selected, move: { alg: new Alg(notation), snapAngleDeg: 90 } })
    return { next: { ...next, anchor: p, cooldownUntilMs: frame.timestampMs + opts.cooldownMs }, events }
  }
  return { next, events }
}
