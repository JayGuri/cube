import { describe, expect, it } from 'vitest'
import { fist, frame, hold, makeHand, openPalm, pinching } from './fixtures'
import {
  applySensitivity,
  createInitialGestureState,
  DEFAULT_THRESHOLDS,
  runGestureSequence,
  stepGesture,
  type GestureEvent,
  type GestureThresholds,
} from './GestureRecognizer'
import type { HandFrame, LandmarkFrame } from './landmarks'

// Explicit thresholds so the fixtures stay deterministic regardless of any
// calibration defaults (Task 4.3).
const T: GestureThresholds = { ...DEFAULT_THRESHOLDS }

const types = (events: GestureEvent[]) => events.map((e) => e.type)
const at = (x: number, y: number) => ({ x, y, z: 0 })

// A fist held perfectly still, long enough to anchor.
const anchorFrames = (fromMs: number, toMs: number): LandmarkFrame[] =>
  hold(() => [fist(at(-1, 0))], fromMs, toMs)

// Anchor hand plus an actuator hand in the given pose.
const bothHands = (actuator: HandFrame): HandFrame[] => [fist(at(-1, 0)), actuator]

// Tilts a hand so its palm normal lies in the xy plane, then rotates it there
// by `degrees`. Rotating the hand within the xy plane instead would leave the
// palm normal pointing along z, where wristRoll is degenerate and never moves.
function rolled(hand: HandFrame, degrees: number): HandFrame {
  const a = (degrees * Math.PI) / 180
  return {
    ...hand,
    landmarks: hand.landmarks.map((p) => {
      // Rotate -90 degrees about x: the palm plane becomes xz, normal along y.
      const tilted = { x: p.x, y: p.z, z: -p.y }
      // Then rotate about z, sweeping the normal through the xy plane.
      return {
        x: tilted.x * Math.cos(a) - tilted.y * Math.sin(a),
        y: tilted.x * Math.sin(a) + tilted.y * Math.cos(a),
        z: tilted.z,
      }
    }),
  }
}

describe('GestureRecognizer', () => {
  it('starts IDLE and emits nothing for an empty frame', () => {
    const r = stepGesture(createInitialGestureState(), frame([], 0), T)
    expect(r.nextState.name).toBe('IDLE')
    expect(r.events).toEqual([])
  })

  it('ignores hands below the confidence threshold', () => {
    const r = stepGesture(createInitialGestureState(), frame([makeHand({ score: 0.1 })], 0), T)
    expect(r.events).toEqual([])
    expect(r.nextState.name).toBe('IDLE')
  })

  it('emits ORBIT while one open hand moves, and never GRAB', () => {
    const frames: LandmarkFrame[] = []
    for (let i = 0; i < 10; i++) frames.push(frame([openPalm(at(i * 0.05, 0))], i * 33))
    const { events } = runGestureSequence(frames, T)
    expect(types(events)).toContain('ORBIT')
    expect(types(events)).not.toContain('GRAB')
  })

  it('does not emit ORBIT for a hand sitting still', () => {
    const { events } = runGestureSequence(hold(() => [openPalm(at(0, 0))], 0, 330), T)
    expect(types(events)).not.toContain('ORBIT')
  })

  it('enters ANCHORED after a fist is held still for the hold window', () => {
    const { state, events } = runGestureSequence(anchorFrames(0, 400), T)
    expect(types(events)).toContain('ANCHOR_HOLD')
    expect(state.name).toBe('ANCHORED')
  })

  it('does not anchor on a fist held for less than the hold window', () => {
    const { events } = runGestureSequence(anchorFrames(0, 200), T)
    expect(types(events)).not.toContain('ANCHOR_HOLD')
  })

  it('does not anchor on a fist that keeps moving', () => {
    const frames: LandmarkFrame[] = []
    for (let i = 0; i < 20; i++) frames.push(frame([fist(at(i * 0.05, 0))], i * 33))
    const { events } = runGestureSequence(frames, T)
    expect(types(events)).not.toContain('ANCHOR_HOLD')
  })

  it('releases the anchor when the fist opens', () => {
    const frames = [...anchorFrames(0, 400), ...hold(() => [openPalm(at(-1, 0))], 433, 466)]
    expect(types(runGestureSequence(frames, T).events)).toContain('ANCHOR_RELEASE')
  })

  it('requires a sustained pinch before GRAB, rejecting a one-frame flicker', () => {
    const frames = [
      ...anchorFrames(0, 400),
      frame(bothHands(pinching(at(1, 0))), 433), // single-frame spike
      ...hold(() => bothHands(openPalm(at(1, 0))), 466, 560),
    ]
    expect(types(runGestureSequence(frames, T).events)).not.toContain('GRAB')
  })

  it('emits GRAB exactly once when the pinch survives the hold window', () => {
    const frames = [...anchorFrames(0, 400), ...hold(() => bothHands(pinching(at(1, 0))), 433, 700)]
    const { state, events } = runGestureSequence(frames, T)
    expect(types(events).filter((t) => t === 'GRAB')).toHaveLength(1)
    expect(state.name).toBe('GRABBING')
  })

  it('does not GRAB without an anchor hand, however long the pinch is held', () => {
    // The two-handed metaphor is the point: one hand holds, the other turns.
    const { events } = runGestureSequence(hold(() => [pinching(at(1, 0))], 0, 900), T)
    expect(types(events)).not.toContain('GRAB')
  })

  it('GRAB then twist then release near a snap angle commits exactly one move', () => {
    const frames: LandmarkFrame[] = [...anchorFrames(0, 400)]
    for (let t = 433; t <= 600; t += 33) {
      frames.push(frame([fist(at(-1, 0)), rolled(pinching(at(1, 0)), 0)], t))
    }
    for (let i = 1; i <= 9; i++) {
      frames.push(frame([fist(at(-1, 0)), rolled(pinching(at(1, 0)), i * 10)], 600 + i * 33))
    }
    frames.push(frame(bothHands(openPalm(at(1, 0))), 960))

    const { events } = runGestureSequence(frames, T)
    expect(types(events)).toContain('GRAB')
    expect(types(events)).toContain('TWIST')
    expect(types(events)).toContain('RELEASE')

    const commits = events.filter((e) => e.type === 'COMMIT')
    expect(commits).toHaveLength(1)
    // The committed angle is the snapped one, never the raw dragged angle.
    const { snappedAngle } = commits[0] as { snappedAngle: number }
    expect(snappedAngle % 90).toBe(0)
    expect(snappedAngle).not.toBe(0)
  })

  it('a grab released without twisting commits nothing', () => {
    const frames = [
      ...anchorFrames(0, 400),
      ...hold(() => bothHands(pinching(at(1, 0))), 433, 700),
      frame(bothHands(openPalm(at(1, 0))), 733),
    ]
    const { events } = runGestureSequence(frames, T)
    expect(types(events)).toContain('RELEASE')
    expect(types(events)).not.toContain('COMMIT')
  })

  it('a twist too far from a snap angle springs back instead of committing', () => {
    const frames: LandmarkFrame[] = [...anchorFrames(0, 400)]
    for (let t = 433; t <= 600; t += 33) {
      frames.push(frame([fist(at(-1, 0)), rolled(pinching(at(1, 0)), 0)], t))
    }
    // Roll only ~45 degrees: exactly between two snap angles.
    for (let i = 1; i <= 9; i++) {
      frames.push(frame([fist(at(-1, 0)), rolled(pinching(at(1, 0)), i * 5)], 600 + i * 33))
    }
    frames.push(frame(bothHands(openPalm(at(1, 0))), 960))
    const { events } = runGestureSequence(frames, T)
    expect(types(events)).toContain('RELEASE')
    expect(types(events)).not.toContain('COMMIT')
  })

  it('losing tracking mid-grab releases without committing', () => {
    const frames = [
      ...anchorFrames(0, 400),
      ...hold(() => bothHands(pinching(at(1, 0))), 433, 700),
      frame([], 733),
    ]
    const { state, events } = runGestureSequence(frames, T)
    expect(types(events)).toContain('RELEASE')
    expect(types(events)).not.toContain('COMMIT')
    expect(state.name).toBe('IDLE')
  })

  it('a double pinch-tap emits UNDO rather than two grabs', () => {
    const frames: LandmarkFrame[] = [
      frame([pinching(at(1, 0))], 0),
      frame([openPalm(at(1, 0))], 60), // tap 1 ends, shorter than the grab hold
      frame([pinching(at(1, 0))], 120),
      frame([openPalm(at(1, 0))], 180), // tap 2 ends, inside the double-tap window
    ]
    const { events } = runGestureSequence(frames, T)
    expect(types(events)).toContain('UNDO')
    expect(types(events)).not.toContain('GRAB')
  })

  it('two slow, separate taps are not an undo', () => {
    const frames: LandmarkFrame[] = [
      frame([pinching(at(1, 0))], 0),
      frame([openPalm(at(1, 0))], 60),
      frame([pinching(at(1, 0))], 1000),
      frame([openPalm(at(1, 0))], 1060),
    ]
    expect(types(runGestureSequence(frames, T).events)).not.toContain('UNDO')
  })

  it('two open hands moving apart emit ZOOM', () => {
    const frames: LandmarkFrame[] = []
    for (let i = 0; i < 6; i++) {
      frames.push(frame([openPalm(at(-i * 0.1, 0)), openPalm(at(i * 0.1, 0))], i * 33))
    }
    expect(types(runGestureSequence(frames, T).events)).toContain('ZOOM')
  })

  it('is pure: stepping does not mutate the state it was given', () => {
    const state = createInitialGestureState()
    const snapshot = JSON.stringify(state)
    stepGesture(state, frame([pinching(at(1, 0))], 100), T)
    expect(JSON.stringify(state)).toBe(snapshot)
  })

  it('honours caller-supplied thresholds instead of the defaults', () => {
    // With an impossible pinch threshold nothing can ever grab.
    const strict: GestureThresholds = { ...T, pinch: 0.0001 }
    const frames = [...anchorFrames(0, 400), ...hold(() => bothHands(pinching(at(1, 0))), 433, 900)]
    expect(types(runGestureSequence(frames, strict).events)).not.toContain('GRAB')
  })
})

describe('applySensitivity', () => {
  it('leaves thresholds unchanged at the default 0.5 sensitivity', () => {
    const result = applySensitivity(DEFAULT_THRESHOLDS, 0.5)
    expect(result.pinch).toBeCloseTo(DEFAULT_THRESHOLDS.pinch, 6)
    expect(result.fist).toBeCloseTo(DEFAULT_THRESHOLDS.fist, 6)
    expect(result.openPalm).toBeCloseTo(DEFAULT_THRESHOLDS.openPalm, 6)
  })

  it('loosens pinch/fist and tightens open-palm as sensitivity rises', () => {
    const loose = applySensitivity(DEFAULT_THRESHOLDS, 1)
    expect(loose.pinch).toBeGreaterThan(DEFAULT_THRESHOLDS.pinch)
    expect(loose.fist).toBeGreaterThan(DEFAULT_THRESHOLDS.fist)
    expect(loose.openPalm).toBeLessThan(DEFAULT_THRESHOLDS.openPalm)
  })

  it('tightens thresholds at the lowest sensitivity', () => {
    const strict = applySensitivity(DEFAULT_THRESHOLDS, 0)
    expect(strict.pinch).toBeLessThan(DEFAULT_THRESHOLDS.pinch)
  })

  it('clamps out-of-range sensitivity rather than producing nonsense', () => {
    expect(applySensitivity(DEFAULT_THRESHOLDS, 5)).toEqual(applySensitivity(DEFAULT_THRESHOLDS, 1))
    expect(applySensitivity(DEFAULT_THRESHOLDS, -5)).toEqual(applySensitivity(DEFAULT_THRESHOLDS, 0))
  })

  it('leaves unrelated thresholds (timing, angles) untouched', () => {
    const result = applySensitivity(DEFAULT_THRESHOLDS, 1)
    expect(result.pinchHoldMs).toBe(DEFAULT_THRESHOLDS.pinchHoldMs)
    expect(result.snapAngleDeg).toBe(DEFAULT_THRESHOLDS.snapAngleDeg)
  })
})
