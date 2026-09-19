import { describe, expect, it } from 'vitest'
import {
  createControllerState,
  DEFAULT_PROFILE,
  handleIntent,
  intentFromGestureEvent,
  twistAxisFor,
  type ControllerEvent,
  type ControllerProfile,
  type ControllerState,
  type InputIntent,
} from './InteractionController'
import { moveFromDrag, type DragInput } from './MouseDragAdapter'
import type { GestureEvent } from './GestureRecognizer'

const run = (intents: InputIntent[], profile: ControllerProfile = DEFAULT_PROFILE) => {
  let state = createControllerState()
  const events: ControllerEvent[] = []
  for (const intent of intents) {
    const r = handleIntent(state, intent, profile)
    state = r.nextState
    events.push(...r.events)
  }
  return { state, events }
}

const moves = (events: ControllerEvent[]) =>
  events
    .filter((e) => e.type === 'MOVE')
    .map((e) => (e as { move: { alg: { toString(): string } } }).move.alg.toString())

const axisScreenDirs: DragInput['axisScreenDirs'] = { x: [1, 0], y: [0, -1], z: [0.5, 0.5] }
const slot = (x: number, y: number, z: number): [number, number, number] => [x, y, z]
const normal = (x: number, y: number, z: number): [number, number, number] => [x, y, z]

describe('InteractionController', () => {
  it('a gesture grab-twist-release commits one move', () => {
    const { events } = run([
      { kind: 'GRAB', slot: slot(1, 1, 1), hitNormal: normal(1, 0, 0), atMs: 0 },
      { kind: 'TWIST', totalAngle: 88 },
      { kind: 'RELEASE', atMs: 400 },
    ])
    // Empirically verified against the real cube3 plugin (applying R/R' via
    // cubing.js's kpuzzle and checking which face's stickers land where):
    // this physical twist direction commits R', not R -- see the comment on
    // moveFromTwist's turnSign for why the raw physical rotation sign has to
    // be corrected before it becomes real WCA notation.
    expect(moves(events)).toEqual(["R'"])
  })

  it('mouse and gesture paths produce the identical move', () => {
    // This is the guarantee the whole adapter design exists for: CI drives the
    // mouse path, and that stands in for the gesture path it cannot drive.
    const gesture = run([
      { kind: 'GRAB', slot: slot(1, 1, 1), hitNormal: normal(0, 1, 0), atMs: 0 },
      { kind: 'TWIST', totalAngle: 90 },
      { kind: 'RELEASE', atMs: 300 },
    ])
    const mouse = run([
      {
        kind: 'DRAG',
        // Same physical action as the gesture above: grab the top layer and
        // turn it. Dragging across the FRONT face along +x rotates about y.
        drag: { hitNormal: normal(0, 0, 1), slot: slot(1, 1, 1), dragScreen: [40, 0], axisScreenDirs },
      },
    ])
    // Empirically verified against the real cube3 plugin: this physical
    // motion commits U', not U.
    expect(moves(gesture.events)).toEqual(["U'"])
    expect(moves(mouse.events)).toEqual(["U'"])
  })

  describe('middle-slice turns (M/E/S) via gesture', () => {
    // A real cube has no face to grab for M/E/S either -- you grab one of the
    // pieces the slice is made of, from an adjacent face. Grabbing an EDGE
    // piece that sits in the middle row/column of one of the OTHER two axes
    // (not a corner) has no outer layer of its own to turn, so twisting it
    // turns that slice instead. Each case here was cross-checked against
    // moveFromDrag for the equivalent grab (dragging whichever screen
    // direction makes the mouse path pick the same rotation axis) rather than
    // hand-derived, since there is no camera in this environment to verify
    // against a real twist -- see MouseDragAdapter.test.ts's REGRESSION test
    // for how the underlying `followsNegative` sign was itself established.
    it('a front-top edge (x=0) grabbed on F turns M', () => {
      const { events } = run([
        { kind: 'GRAB', slot: slot(0, 1, 1), hitNormal: normal(0, 0, 1), atMs: 0 },
        { kind: 'TWIST', totalAngle: 90 },
        { kind: 'RELEASE', atMs: 300 },
      ])
      expect(moves(events)).toEqual(["M'"])
      const mouse = moveFromDrag({
        hitNormal: normal(0, 0, 1),
        slot: slot(0, 1, 1),
        dragScreen: [0, -40], // along y, so mouse's rotationAxis is x too
        axisScreenDirs,
      })
      expect(mouse!.alg.toString()).toEqual("M'")
    })

    it('a front-right edge (y=0) grabbed on F turns E', () => {
      const { events } = run([
        { kind: 'GRAB', slot: slot(1, 0, 1), hitNormal: normal(0, 0, 1), atMs: 0 },
        { kind: 'TWIST', totalAngle: 90 },
        { kind: 'RELEASE', atMs: 300 },
      ])
      expect(moves(events)).toEqual(['E'])
      const mouse = moveFromDrag({
        hitNormal: normal(0, 0, 1),
        slot: slot(1, 0, 1),
        dragScreen: [40, 0], // along x, so mouse's rotationAxis is y too
        axisScreenDirs,
      })
      expect(mouse!.alg.toString()).toEqual('E')
    })

    it('a top-right edge (z=0) grabbed on U turns S', () => {
      const { events } = run([
        { kind: 'GRAB', slot: slot(1, 1, 0), hitNormal: normal(0, 1, 0), atMs: 0 },
        { kind: 'TWIST', totalAngle: 90 },
        { kind: 'RELEASE', atMs: 300 },
      ])
      expect(moves(events)).toEqual(['S'])
      const mouse = moveFromDrag({
        hitNormal: normal(0, 1, 0),
        slot: slot(1, 1, 0),
        dragScreen: [40, 0],
        axisScreenDirs,
      })
      expect(mouse!.alg.toString()).toEqual('S')
    })

    it('twisting the other way inverts the slice too', () => {
      const { events } = run([
        { kind: 'GRAB', slot: slot(1, 1, 0), hitNormal: normal(0, 1, 0), atMs: 0 },
        { kind: 'TWIST', totalAngle: -90 },
        { kind: 'RELEASE', atMs: 300 },
      ])
      expect(moves(events)).toEqual(["S'"])
    })

    it('REGRESSION: grabbing a face CENTRE stays an outer turn, not an arbitrary slice', () => {
      // A face centre has BOTH other axes at 0 (e.g. the U centre is
      // [0,1,0]), which is ambiguous between the two slices that cross
      // there. An earlier version of this logic picked the first matching
      // axis by iteration order instead of noticing the ambiguity, so
      // grabbing a face by its centre dot -- the single most natural way to
      // say "turn this whole face" -- silently turned a slice instead.
      const { events } = run([
        { kind: 'GRAB', slot: slot(0, 1, 0), hitNormal: normal(0, 1, 0), atMs: 0 },
        { kind: 'TWIST', totalAngle: 90 },
        { kind: 'RELEASE', atMs: 300 },
      ])
      expect(moves(events)).toEqual(["U'"])
    })

    it('a skewb (body-diagonal) grab is unaffected: still no slice logic runs', () => {
      const skewbProfile: ControllerProfile = { ...DEFAULT_PROFILE, twistAxisMode: 'body-diagonal' }
      const { events } = run(
        [
          { kind: 'GRAB', slot: slot(1, 1, 1), hitNormal: normal(0, 1, 0), atMs: 0 },
          { kind: 'TWIST', totalAngle: 90 },
          { kind: 'RELEASE', atMs: 300 },
        ],
        skewbProfile,
      )
      // Unchanged from before this session's slice work: body-diagonal mode
      // never runs the new slice-detection branch at all (it returns early).
      expect(moves(events)).toEqual(["R'"])
    })
  })

  it('twisting without a grab does nothing', () => {
    const { events } = run([{ kind: 'TWIST', totalAngle: 90 }, { kind: 'RELEASE', atMs: 10 }])
    expect(events).toEqual([])
  })

  it('a release short of a snap angle commits nothing', () => {
    const { events } = run([
      { kind: 'GRAB', slot: slot(1, 1, 1), hitNormal: normal(1, 0, 0), atMs: 0 },
      { kind: 'TWIST', totalAngle: 20 },
      { kind: 'RELEASE', atMs: 200 },
    ])
    expect(moves(events)).toEqual([])
  })

  it('a double turn becomes a single 180 degree move', () => {
    const { events } = run([
      { kind: 'GRAB', slot: slot(1, 1, 1), hitNormal: normal(1, 0, 0), atMs: 0 },
      { kind: 'TWIST', totalAngle: 181 },
      { kind: 'RELEASE', atMs: 400 },
    ])
    expect(moves(events)).toEqual(['R2'])
  })

  it('twisting the other way gives the inverse move', () => {
    const { events } = run([
      { kind: 'GRAB', slot: slot(1, 1, 1), hitNormal: normal(1, 0, 0), atMs: 0 },
      { kind: 'TWIST', totalAngle: -90 },
      { kind: 'RELEASE', atMs: 400 },
    ])
    // The inverse of the R' this same slot/normal gives at +90 (see above).
    expect(moves(events)).toEqual(['R'])
  })

  it('emits a live preview while twisting', () => {
    const { events } = run([
      { kind: 'GRAB', slot: slot(1, 1, 1), hitNormal: normal(1, 0, 0), atMs: 0 },
      { kind: 'TWIST', totalAngle: 45 },
    ])
    expect(events.some((e) => e.type === 'PREVIEW')).toBe(true)
  })

  it('CANCEL abandons a grab without committing', () => {
    const { state, events } = run([
      { kind: 'GRAB', slot: slot(1, 1, 1), hitNormal: normal(1, 0, 0), atMs: 0 },
      { kind: 'TWIST', totalAngle: 90 },
      { kind: 'CANCEL' },
    ])
    expect(moves(events)).toEqual([])
    expect(state.grabbed).toBeNull()
  })

  it('passes UNDO straight through', () => {
    expect(run([{ kind: 'UNDO' }]).events).toEqual([{ type: 'UNDO' }])
  })

  describe('twist axis modes (spec 8.5)', () => {
    it('screen-relative uses the grabbed face normal', () => {
      expect(twistAxisFor('screen-relative', slot(1, 1, 1), normal(0, 1, 0))).toEqual([0, 1, 0])
    })

    it('body-diagonal uses the diagonal through the grabbed corner', () => {
      const axis = twistAxisFor('body-diagonal', slot(1, 1, 1), normal(0, 1, 0))
      const expected = 1 / Math.sqrt(3)
      expect(axis[0]).toBeCloseTo(expected, 6)
      expect(axis[1]).toBeCloseTo(expected, 6)
      expect(axis[2]).toBeCloseTo(expected, 6)
    })

    it('the two modes give different axes for the same input', () => {
      expect(twistAxisFor('screen-relative', slot(1, -1, 1), normal(0, 1, 0))).not.toEqual(
        twistAxisFor('body-diagonal', slot(1, -1, 1), normal(0, 1, 0)),
      )
    })
  })

  describe('hover-then-confirm grab mode (megaminx, spec 8.5)', () => {
    const hoverProfile: ControllerProfile = {
      ...DEFAULT_PROFILE,
      grabMode: 'hover-then-confirm',
      hoverConfirmWindowMs: 1000,
    }

    it('hovering highlights and does not grab', () => {
      const { state, events } = run(
        [{ kind: 'HOVER', slot: slot(1, 1, 1), hitNormal: normal(0, 1, 0), atMs: 0 }],
        hoverProfile,
      )
      expect(events.map((e) => e.type)).toEqual(['HIGHLIGHT'])
      expect(state.grabbed).toBeNull()
    })

    it('hover then pinch inside the window grabs', () => {
      const { state } = run(
        [
          { kind: 'HOVER', slot: slot(1, 1, 1), hitNormal: normal(0, 1, 0), atMs: 0 },
          { kind: 'GRAB', slot: slot(1, 1, 1), hitNormal: normal(0, 1, 0), atMs: 500 },
        ],
        hoverProfile,
      )
      expect(state.grabbed).not.toBeNull()
    })

    it('hover then pinch after the window expires does not grab', () => {
      const { state, events } = run(
        [
          { kind: 'HOVER', slot: slot(1, 1, 1), hitNormal: normal(0, 1, 0), atMs: 0 },
          { kind: 'GRAB', slot: slot(1, 1, 1), hitNormal: normal(0, 1, 0), atMs: 5000 },
        ],
        hoverProfile,
      )
      expect(state.grabbed).toBeNull()
      expect(events.map((e) => e.type)).toContain('CLEAR_HIGHLIGHT')
    })

    it('a pinch with no hover at all does not grab', () => {
      const { state } = run(
        [{ kind: 'GRAB', slot: slot(1, 1, 1), hitNormal: normal(0, 1, 0), atMs: 0 }],
        hoverProfile,
      )
      expect(state.grabbed).toBeNull()
    })

    it('instant mode ignores hover and grabs directly', () => {
      const { state, events } = run([
        { kind: 'HOVER', slot: slot(1, 1, 1), hitNormal: normal(0, 1, 0), atMs: 0 },
        { kind: 'GRAB', slot: slot(1, 1, 1), hitNormal: normal(0, 1, 0), atMs: 5000 },
      ])
      expect(events.map((e) => e.type)).not.toContain('HIGHLIGHT')
      expect(state.grabbed).not.toBeNull()
    })
  })

  it('maps gesture FSM events onto controller intents', () => {
    const ctx = { slot: slot(1, 1, 1), hitNormal: normal(0, 1, 0), atMs: 5 }
    expect(intentFromGestureEvent({ type: 'GRAB', at: { x: 0, y: 0, z: 0 } }, ctx)?.kind).toBe('GRAB')
    expect(intentFromGestureEvent({ type: 'TWIST', angleDelta: 5, totalAngle: 90 }, ctx)?.kind).toBe('TWIST')
    expect(intentFromGestureEvent({ type: 'COMMIT', snappedAngle: 90, rawAngle: 88 }, ctx)?.kind).toBe('RELEASE')
    // A plain FSM RELEASE (spring-back, no commit) still maps to the
    // controller's own RELEASE intent, not CANCEL -- see the regression test
    // below for why CANCEL was wrong.
    expect(intentFromGestureEvent({ type: 'RELEASE' }, ctx)?.kind).toBe('RELEASE')
    expect(intentFromGestureEvent({ type: 'ORBIT', dx: 1, dy: 1 }, ctx)).toBeNull()
  })

  it('REGRESSION: a real gesture-driven grab+twist+commit actually turns the puzzle', () => {
    // Reproduces a real user report: hand tracking worked (GRAB/TWIST fired)
    // but the cube never turned. Root cause: GestureRecognizer.stepGesture
    // pushes RELEASE, then (if the angle qualifies) COMMIT, into the SAME
    // tick's event array -- exactly as PuzzleCanvas's bridge receives it,
    // processing every event in that array through intentFromGestureEvent in
    // order. This test drives that exact sequence, not a simplified one.
    const ctx = { slot: slot(1, 1, 1), hitNormal: normal(1, 0, 0), atMs: 0 }
    const tickEvents: GestureEvent[] = [
      { type: 'GRAB', at: { x: 0, y: 0, z: 0 } },
      { type: 'TWIST', angleDelta: 90, totalAngle: 90 },
      { type: 'RELEASE' },
      { type: 'COMMIT', snappedAngle: 90, rawAngle: 91 },
    ]

    let state: ControllerState = createControllerState()
    const events: ControllerEvent[] = []
    for (const gestureEvent of tickEvents) {
      const intent = intentFromGestureEvent(gestureEvent, ctx)
      if (!intent) continue
      const result = handleIntent(state, intent)
      state = result.nextState
      events.push(...result.events)
    }

    // Same physical twist as the first test in this file -> same R' (see the
    // comment there for the empirical verification against the real plugin).
    expect(moves(events)).toEqual(["R'"])
  })
})
