import { beforeAll, describe, expect, it } from 'vitest'
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
import { Alg } from 'cubing/alg'
import { applyMove, createInitialState, initCube3Logic, isSolved } from '../puzzles/cube3/logic'
import { faceletColors } from '../puzzles/cube3/sync'
import { CUBE3_COLORS, slotId, type Face } from '../puzzles/cube3/geometry'

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

  describe('every outer face turns the real cube correctly by gesture (all 6, not just R/U)', () => {
    beforeAll(async () => {
      await initCube3Logic()
    })

    // Read directly from the real plugin (applyMove + faceletColors on a
    // solved cube), not hand-derived: for CYCLE_UNPRIMED[X] = [a,b,c,d], a
    // real unprimed X sends a's material to b, b's to c, c's to d, d's to a.
    // Only R, U and F's own axis had ever been checked against real colours
    // before this (via MouseDragAdapter's regression tests); D, L and B were
    // only ever assumed correct by structural symmetry with their opposite
    // face. This closes that gap for all six at once.
    const CYCLE_UNPRIMED: Record<Face, Face[]> = {
      U: ['B', 'R', 'F', 'L'],
      D: ['F', 'R', 'B', 'L'],
      L: ['B', 'U', 'F', 'D'],
      R: ['U', 'B', 'D', 'F'],
      F: ['U', 'R', 'D', 'L'],
      B: ['U', 'L', 'D', 'R'],
    }
    const AXIS_FOR_FACE: Record<Face, [number, number, number]> = {
      U: [0, 1, 0],
      D: [0, -1, 0],
      F: [0, 0, 1],
      B: [0, 0, -1],
      R: [1, 0, 0],
      L: [-1, 0, 0],
    }
    // Builds a corner touching every given face, filling any axis neither
    // face constrains with +1 (any real corner there works equally well).
    const cornerWith = (faces: Face[]): [number, number, number] => {
      const slot: [number, number, number] = [0, 0, 0]
      for (const f of faces) {
        const v = AXIS_FOR_FACE[f]
        for (let i = 0; i < 3; i++) if (v[i] !== 0) slot[i] = v[i]
      }
      for (let i = 0; i < 3; i++) if (slot[i] === 0) slot[i] = 1
      return slot
    }

    const OUTER: Array<{ letter: Face; slot: [number, number, number]; hitNormal: [number, number, number] }> = [
      { letter: 'R', slot: [1, 1, 1], hitNormal: [1, 0, 0] },
      { letter: 'U', slot: [1, 1, 1], hitNormal: [0, 1, 0] },
      { letter: 'F', slot: [1, 1, 1], hitNormal: [0, 0, 1] },
      { letter: 'L', slot: [-1, -1, -1], hitNormal: [-1, 0, 0] },
      { letter: 'D', slot: [-1, -1, -1], hitNormal: [0, -1, 0] },
      { letter: 'B', slot: [-1, -1, -1], hitNormal: [0, 0, -1] },
    ]

    it.each(OUTER)('grabbing $letter and twisting +90 commits a real, correctly-directed $letter turn', ({ letter, slot, hitNormal }) => {
      const { events } = run([
        { kind: 'GRAB', slot, hitNormal, atMs: 0 },
        { kind: 'TWIST', totalAngle: 90 },
        { kind: 'RELEASE', atMs: 300 },
      ])
      const notation = moves(events)[0]
      expect(notation).toBeDefined()
      expect(notation.replace(/[2']/g, '')).toBe(letter)

      const isPrime = notation.endsWith("'")
      const cycle = CYCLE_UNPRIMED[letter]
      const f1 = cycle[1]
      const checkCorner = cornerWith([letter, f1])
      const after = applyMove(createInitialState(), { alg: new Alg(notation), snapAngleDeg: 90 })
      const colors = faceletColors(after)
      const stickerColor = colors.get(slotId(checkCorner))![f1]
      // Unprimed sends cycle[0] -> cycle[1]; primed runs the cycle backwards.
      const expectedSourceFace = isPrime ? cycle[2] : cycle[0]
      expect(stickerColor, `${notation}: ${f1} sticker should now show ${expectedSourceFace}'s colour`).toBe(
        CUBE3_COLORS[expectedSourceFace],
      )
      expect(isSolved(after)).toBe(false)
    })

    it.each(OUTER)('twisting the other way on $letter gives the exact inverse move', ({ slot, hitNormal }) => {
      const plus = run([
        { kind: 'GRAB', slot, hitNormal, atMs: 0 },
        { kind: 'TWIST', totalAngle: 90 },
        { kind: 'RELEASE', atMs: 300 },
      ])
      const minus = run([
        { kind: 'GRAB', slot, hitNormal, atMs: 0 },
        { kind: 'TWIST', totalAngle: -90 },
        { kind: 'RELEASE', atMs: 300 },
      ])
      expect(moves(minus.events)[0]).toBe(new Alg(moves(plus.events)[0]).invert().toString())
    })

    it.each(OUTER)('a 180-degree twist on $letter gives the double-turn notation, same either direction', ({ letter, slot, hitNormal }) => {
      const plus = run([
        { kind: 'GRAB', slot, hitNormal, atMs: 0 },
        { kind: 'TWIST', totalAngle: 181 },
        { kind: 'RELEASE', atMs: 300 },
      ])
      const minus = run([
        { kind: 'GRAB', slot, hitNormal, atMs: 0 },
        { kind: 'TWIST', totalAngle: -181 },
        { kind: 'RELEASE', atMs: 300 },
      ])
      expect(moves(plus.events)).toEqual([`${letter}2`])
      expect(moves(minus.events)).toEqual([`${letter}2`])
    })
  })

  describe('every middle slice turns the real cube correctly by gesture (M, E, S)', () => {
    beforeAll(async () => {
      await initCube3Logic()
    })

    // Read directly from the real plugin the same way as the outer-face
    // cycles above: M's cycle matches L's exactly, E's matches D's, S's
    // matches F's -- empirically confirming the "M follows L, E follows D, S
    // follows F" WCA convention MouseDragAdapter's SLICE_FOR table already
    // assumed, for the gesture path specifically.
    const SLICES: Array<{
      letter: string
      slot: [number, number, number]
      hitNormal: [number, number, number]
      cycle: Face[]
      checkFace: Face
      checkSlot: [number, number, number]
    }> = [
      { letter: 'M', slot: [0, 1, 1], hitNormal: [0, 0, 1], cycle: ['B', 'U', 'F', 'D'], checkFace: 'U', checkSlot: [0, 1, 1] },
      { letter: 'E', slot: [1, 0, 1], hitNormal: [0, 0, 1], cycle: ['F', 'R', 'B', 'L'], checkFace: 'R', checkSlot: [1, 0, 1] },
      { letter: 'S', slot: [1, 1, 0], hitNormal: [0, 1, 0], cycle: ['U', 'R', 'D', 'L'], checkFace: 'R', checkSlot: [1, 1, 0] },
    ]

    it.each(SLICES)('grabbing an edge on the $letter slice and twisting +90 turns it the real, correctly-directed way', ({ letter, slot, hitNormal, cycle, checkFace, checkSlot }) => {
      const { events } = run([
        { kind: 'GRAB', slot, hitNormal, atMs: 0 },
        { kind: 'TWIST', totalAngle: 90 },
        { kind: 'RELEASE', atMs: 300 },
      ])
      const notation = moves(events)[0]
      expect(notation).toBeDefined()
      expect(notation.replace(/[2']/g, '')).toBe(letter)

      const isPrime = notation.endsWith("'")
      const after = applyMove(createInitialState(), { alg: new Alg(notation), snapAngleDeg: 90 })
      const colors = faceletColors(after)
      const stickerColor = colors.get(slotId(checkSlot))![checkFace]
      const expectedSourceFace = isPrime ? cycle[2] : cycle[0]
      expect(stickerColor, `${notation}: ${checkFace} sticker should now show ${expectedSourceFace}'s colour`).toBe(
        CUBE3_COLORS[expectedSourceFace],
      )
      expect(isSolved(after)).toBe(false)
    })

    it.each(SLICES)('twisting the other way on the $letter slice gives the exact inverse move', ({ slot, hitNormal }) => {
      const plus = run([
        { kind: 'GRAB', slot, hitNormal, atMs: 0 },
        { kind: 'TWIST', totalAngle: 90 },
        { kind: 'RELEASE', atMs: 300 },
      ])
      const minus = run([
        { kind: 'GRAB', slot, hitNormal, atMs: 0 },
        { kind: 'TWIST', totalAngle: -90 },
        { kind: 'RELEASE', atMs: 300 },
      ])
      expect(moves(minus.events)[0]).toBe(new Alg(moves(plus.events)[0]).invert().toString())
    })

    it.each(SLICES)('a 180-degree twist on the $letter slice gives the double-turn notation, same either direction', ({ letter, slot, hitNormal }) => {
      const plus = run([
        { kind: 'GRAB', slot, hitNormal, atMs: 0 },
        { kind: 'TWIST', totalAngle: 181 },
        { kind: 'RELEASE', atMs: 300 },
      ])
      const minus = run([
        { kind: 'GRAB', slot, hitNormal, atMs: 0 },
        { kind: 'TWIST', totalAngle: -181 },
        { kind: 'RELEASE', atMs: 300 },
      ])
      expect(moves(plus.events)).toEqual([`${letter}2`])
      expect(moves(minus.events)).toEqual([`${letter}2`])
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
