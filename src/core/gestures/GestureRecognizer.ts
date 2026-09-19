import type { HandFrame, Landmark, LandmarkFrame } from './landmarks'
import {
  angleDelta,
  centroid,
  fingerCurl,
  palmNormal,
  pinchDistance,
  wristRoll,
} from './landmarkMath'

// The gesture state machine from spec 8.3.
//
// Deliberately pure: zero imports from three, react, the DOM or MediaPipe. It is
// a function (prevState, frame) -> { nextState, events }, which is what lets the
// whole gesture vocabulary be tested against synthetic landmark sequences with
// no camera, no WebGL and no flakiness in CI.

export type GestureStateName = 'IDLE' | 'ORBITING' | 'ANCHORED' | 'GRABBING' | 'COMMITTING'

export type GestureEvent =
  | { type: 'ORBIT'; dx: number; dy: number }
  | { type: 'ANCHOR_HOLD' }
  | { type: 'ANCHOR_RELEASE' }
  | { type: 'GRAB'; at: Landmark }
  | { type: 'TWIST'; angleDelta: number; totalAngle: number }
  | { type: 'RELEASE' }
  | { type: 'COMMIT'; snappedAngle: number; rawAngle: number }
  | { type: 'ZOOM'; delta: number }
  | { type: 'UNDO' }

export interface GestureThresholds {
  // Below this normalised thumb-index distance counts as a pinch.
  pinch: number
  // Below this mean normalised fingertip extension counts as a fist.
  fist: number
  // Above this counts as an open palm.
  openPalm: number
  // A pinch must survive this long before it becomes a GRAB (spec 4.4).
  pinchHoldMs: number
  // A fist must be held this still, this long, to ANCHOR.
  anchorHoldMs: number
  // Positional drift allowed while anchoring, in hand-scale units.
  anchorJitter: number
  // Two pinch taps closer together than this mean UNDO, not two grabs.
  doubleTapMs: number
  // Movement below this is noise, not an orbit.
  orbitDeadzone: number
  // A release further than this from a snap angle commits nothing.
  snapToleranceDeg: number
  snapAngleDeg: number
  // Detections below this confidence are ignored entirely.
  minScore: number
}

/**
 * Applies the user's Settings > Gesture sensitivity slider (0..1, default
 * 0.5) to a base set of thresholds, loosening pinch/fist/open-palm detection
 * as sensitivity rises. Found while manually checking Settings: the slider
 * was stored and displayed but never actually consumed anywhere, so moving
 * it did nothing -- this is what the FreePlay screen calls to fix that.
 */
export function applySensitivity(base: GestureThresholds, sensitivity: number): GestureThresholds {
  const s = Math.max(0, Math.min(1, sensitivity))
  // 0 -> 0.7x (stricter), 0.5 -> 1x (unchanged), 1 -> 1.3x (loosest).
  const scale = 0.7 + s * 0.6
  return {
    ...base,
    pinch: base.pinch * scale,
    fist: base.fist * scale,
    openPalm: base.openPalm / scale,
  }
}

export const DEFAULT_THRESHOLDS: GestureThresholds = {
  pinch: 0.28,
  fist: 0.95,
  openPalm: 1.3,
  pinchHoldMs: 120,
  anchorHoldMs: 300,
  anchorJitter: 0.08,
  doubleTapMs: 320,
  orbitDeadzone: 0.004,
  snapToleranceDeg: 40,
  snapAngleDeg: 90,
  minScore: 0.5,
}

export interface GestureState {
  name: GestureStateName
  // When the current pinch began, or null if not pinching.
  pinchStartMs: number | null
  // When the last short pinch tap ended, for double-tap detection.
  lastTapEndMs: number | null
  // Whether the current pinch has already produced a GRAB.
  grabEmitted: boolean
  anchorSinceMs: number | null
  anchorOrigin: Landmark | null
  // Palm roll when the grab began, plus how far it has turned since.
  twistStartAngle: number | null
  twistAngle: number
  lastOrbitPoint: Landmark | null
  lastTwoHandSpan: number | null
  lastTimestampMs: number
}

export function createInitialGestureState(): GestureState {
  return {
    name: 'IDLE',
    pinchStartMs: null,
    lastTapEndMs: null,
    grabEmitted: false,
    anchorSinceMs: null,
    anchorOrigin: null,
    twistStartAngle: null,
    twistAngle: 0,
    lastOrbitPoint: null,
    lastTwoHandSpan: null,
    lastTimestampMs: 0,
  }
}

const isPinching = (h: HandFrame, t: GestureThresholds) => pinchDistance(h.landmarks) < t.pinch
const isFist = (h: HandFrame, t: GestureThresholds) => fingerCurl(h.landmarks) < t.fist
const isOpen = (h: HandFrame, t: GestureThresholds) => fingerCurl(h.landmarks) > t.openPalm

const palmCentre = (h: HandFrame): Landmark =>
  centroid([h.landmarks[0], h.landmarks[5], h.landmarks[17]])

const dist3 = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

// Picks the anchor hand (a fist) and the actuator hand (the other one). This
// mirrors real cube handling: one hand holds, the other turns (spec 4.1).
function splitRoles(hands: HandFrame[], t: GestureThresholds) {
  const anchor = hands.find((h) => isFist(h, t)) ?? null
  const actuator = hands.find((h) => h !== anchor) ?? null
  return { anchor, actuator }
}

export interface StepResult {
  nextState: GestureState
  events: GestureEvent[]
}

export function stepGesture(
  state: GestureState,
  frame: LandmarkFrame,
  thresholds: GestureThresholds = DEFAULT_THRESHOLDS,
): StepResult {
  const t = thresholds
  const events: GestureEvent[] = []
  const next: GestureState = { ...state, lastTimestampMs: frame.timestampMs }

  const hands = frame.hands.filter((h) => h.score >= t.minScore)

  // No usable hand: drop everything and go quiet. A grab in progress is
  // abandoned rather than committed, so losing tracking never turns a layer.
  if (hands.length === 0) {
    if (state.name === 'GRABBING') events.push({ type: 'RELEASE' })
    if (state.anchorSinceMs !== null) events.push({ type: 'ANCHOR_RELEASE' })
    return {
      nextState: {
        ...createInitialGestureState(),
        lastTapEndMs: state.lastTapEndMs,
        lastTimestampMs: frame.timestampMs,
      },
      events,
    }
  }

  // Two open hands moving apart or together zoom the camera (spec 4.2).
  if (hands.length === 2 && hands.every((h) => !isPinching(h, t) && !isFist(h, t))) {
    const span = Math.hypot(
      hands[0].landmarks[0].x - hands[1].landmarks[0].x,
      hands[0].landmarks[0].y - hands[1].landmarks[0].y,
    )
    if (state.lastTwoHandSpan !== null) {
      const delta = span - state.lastTwoHandSpan
      if (Math.abs(delta) > t.orbitDeadzone) events.push({ type: 'ZOOM', delta })
    }
    next.lastTwoHandSpan = span
  } else {
    next.lastTwoHandSpan = null
  }

  const { anchor, actuator } = splitRoles(hands, t)

  // --- anchor hand ---------------------------------------------------------
  if (anchor) {
    const here = palmCentre(anchor)
    if (state.anchorOrigin === null || state.anchorSinceMs === null) {
      next.anchorOrigin = here
      next.anchorSinceMs = frame.timestampMs
    } else if (dist3(here, state.anchorOrigin) > t.anchorJitter) {
      // Drifted too far to count as held: restart the hold timer.
      next.anchorOrigin = here
      next.anchorSinceMs = frame.timestampMs
    } else if (
      frame.timestampMs - state.anchorSinceMs >= t.anchorHoldMs &&
      state.name !== 'ANCHORED' &&
      state.name !== 'GRABBING' &&
      state.name !== 'COMMITTING'
    ) {
      events.push({ type: 'ANCHOR_HOLD' })
      next.name = 'ANCHORED'
    }
  } else {
    if (state.anchorSinceMs !== null) events.push({ type: 'ANCHOR_RELEASE' })
    next.anchorSinceMs = null
    next.anchorOrigin = null
    if (state.name === 'ANCHORED') next.name = 'IDLE'
  }

  const anchored =
    next.name === 'ANCHORED' || next.name === 'GRABBING' || next.name === 'COMMITTING'

  // --- actuator hand -------------------------------------------------------
  if (!actuator) return { nextState: next, events }

  const pinched = isPinching(actuator, t)
  const roll = wristRoll(palmNormal(actuator.landmarks))

  if (pinched) {
    if (state.pinchStartMs === null) {
      next.pinchStartMs = frame.timestampMs
      next.grabEmitted = false
      next.twistStartAngle = roll
      next.twistAngle = 0
    } else if (!state.grabEmitted) {
      // A pinch only becomes a grab once it has survived the hold window, which
      // is what stops an incidental finger brush from turning a layer. It also
      // requires the other hand to be anchoring, per the two-handed metaphor.
      if (frame.timestampMs - state.pinchStartMs >= t.pinchHoldMs && anchored) {
        events.push({ type: 'GRAB', at: palmCentre(actuator) })
        next.grabEmitted = true
        next.name = 'GRABBING'
        next.twistStartAngle = roll
        next.twistAngle = 0
      }
    } else if (state.twistStartAngle !== null) {
      // Accumulate against the angle reached so far, so a twist can pass 180deg
      // without wrapping around and reversing sign.
      const reached = state.twistStartAngle + state.twistAngle
      const frameDelta = angleDelta(reached, roll)
      if (Math.abs(frameDelta) > 0.01) {
        const accumulated = state.twistAngle + frameDelta
        events.push({ type: 'TWIST', angleDelta: frameDelta, totalAngle: accumulated })
        next.twistAngle = accumulated
      }
    }
  } else {
    // Pinch released.
    if (state.pinchStartMs !== null) {
      const tapDuration = frame.timestampMs - state.pinchStartMs
      const sinceLastTap =
        state.lastTapEndMs === null ? Infinity : frame.timestampMs - state.lastTapEndMs

      if (state.grabEmitted) {
        events.push({ type: 'RELEASE' })
        const steps = Math.round(state.twistAngle / t.snapAngleDeg)
        const snapped = steps * t.snapAngleDeg
        const error = Math.abs(state.twistAngle - snapped)
        // Only a release near a valid snap angle commits a move; anything else
        // springs back, exactly like a real puzzle that was not turned far
        // enough to click over.
        if (steps !== 0 && error <= t.snapToleranceDeg) {
          events.push({ type: 'COMMIT', snappedAngle: snapped, rawAngle: state.twistAngle })
        }
        next.name = anchored ? 'ANCHORED' : 'IDLE'
      } else if (tapDuration < t.pinchHoldMs && sinceLastTap < t.doubleTapMs) {
        // Two quick taps in a row mean undo, not two grabs (spec 4.2).
        events.push({ type: 'UNDO' })
        next.lastTapEndMs = null
      } else if (tapDuration < t.pinchHoldMs) {
        next.lastTapEndMs = frame.timestampMs
      }
    }
    next.pinchStartMs = null
    next.grabEmitted = false
    next.twistStartAngle = null
    next.twistAngle = 0

    // --- orbit -------------------------------------------------------------
    // One open hand, not pinching, with no anchor held: move the camera.
    if (!anchored && isOpen(actuator, t)) {
      const here = palmCentre(actuator)
      if (state.lastOrbitPoint) {
        const dx = here.x - state.lastOrbitPoint.x
        const dy = here.y - state.lastOrbitPoint.y
        if (Math.hypot(dx, dy) > t.orbitDeadzone) {
          events.push({ type: 'ORBIT', dx, dy })
          next.name = 'ORBITING'
        }
      }
      next.lastOrbitPoint = here
    } else {
      next.lastOrbitPoint = null
    }
  }

  return { nextState: next, events }
}

// Convenience for tests and for the render loop: run a whole sequence.
export function runGestureSequence(
  frames: LandmarkFrame[],
  thresholds: GestureThresholds = DEFAULT_THRESHOLDS,
  initial: GestureState = createInitialGestureState(),
): { state: GestureState; events: GestureEvent[] } {
  let state = initial
  const events: GestureEvent[] = []
  for (const frame of frames) {
    const result = stepGesture(state, frame, thresholds)
    state = result.nextState
    events.push(...result.events)
  }
  return { state, events }
}
