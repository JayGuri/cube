import { beforeAll, describe, expect, it } from 'vitest'
import { applyMove, createInitialState, initCube3Logic, isSolved } from '../puzzles/cube3/logic'
import type { Handedness, HandFrame, Landmark, LandmarkFrame } from './landmarks'
import {
  activeSigns,
  createSignState,
  DEFAULT_SIGN_OPTIONS,
  POSE_FOR,
  readSign,
  signForNotation,
  stepSigns,
  type SignEvent,
  type SignLayer,
  type SignOptions,
  type SignState,
} from './signGestures'

// A hand held up to the camera with an exact set of fingers extended, in raw
// camera coordinates, labelled the way MediaPipe labels it: with the user's
// real hand (confirmed live -- see realHandedness).
function signHand(pose: string, real: Handedness, cx = 0.5, cy = 0.5): HandFrame {
  const s = 0.06
  const at = (x: number, y: number): Landmark => ({ x: cx + x * s, y: cy + y * s, z: 0 })
  const lm: Landmark[] = Array.from({ length: 21 }, () => at(0, 0))
  lm[0] = at(0, 1)
  const xs = [-0.3, -0.1, 0.1, 0.3]
  ;[5, 9, 13, 17].forEach((i, k) => (lm[i] = at(xs[k], 0)))
  ;[8, 12, 16, 20].forEach((i, k) => (lm[i] = pose[k] === '1' ? at(xs[k] * 1.2, -1) : at(xs[k], 0.4)))
  lm[4] = at(-0.6, 0.5)
  return { landmarks: lm, handedness: real, score: 0.95 }
}

function run(frames: LandmarkFrame[], opts: SignOptions = DEFAULT_SIGN_OPTIONS) {
  let state: SignState = createSignState()
  const events: SignEvent[] = []
  for (const f of frames) {
    const r = stepSigns(state, f, opts)
    state = r.next
    events.push(...r.events)
  }
  return { state, events }
}

const frames = (build: (i: number) => HandFrame[], n: number, t0 = 0): LandmarkFrame[] =>
  Array.from({ length: n }, (_, i) => ({ hands: build(i), timestampMs: t0 + i * 33 }))

// Long enough to recognise the pose and pass the hold.
const HOLD_FRAMES = Math.ceil(DEFAULT_SIGN_OPTIONS.holdMs / 33) + DEFAULT_SIGN_OPTIONS.votesToSelect + 2

const turns = (events: SignEvent[]) => events.map((e) => e.move.alg.toString())

describe('the nine poses', () => {
  it.each(Object.entries(POSE_FOR))('%s is read from its pose, on either hand', (layer, pose) => {
    expect(readSign(signHand(pose, 'Right'))).toBe(layer)
    expect(readSign(signHand(pose, 'Left'))).toBe(layer)
  })

  it('every pose is distinct', () => {
    expect(new Set(Object.values(POSE_FOR)).size).toBe(9)
  })

  it('an open hand and a fist are never signs (they orbit and lock)', () => {
    expect(readSign(signHand('1111', 'Right'))).toBeNull()
    expect(readSign(signHand('0000', 'Right'))).toBeNull()
  })
})

describe('all 18 quarter turns: the pose picks the layer, the hand picks the direction', () => {
  const cases = (Object.keys(POSE_FOR) as SignLayer[]).flatMap((layer) => [
    { layer, hand: 'Right' as Handedness, expected: layer },
    { layer, hand: 'Left' as Handedness, expected: `${layer}'` },
  ])

  it.each(cases)('$layer held with the $hand hand turns $expected', ({ layer, hand, expected }) => {
    const { events } = run(frames(() => [signHand(POSE_FOR[layer], hand)], HOLD_FRAMES))
    expect(turns(events)).toEqual([expected])
    expect(signForNotation(expected)).toEqual({ hand, layer })
  })

  describe('on the real cube, the left hand exactly undoes the right hand', () => {
    beforeAll(async () => {
      await initCube3Logic()
    })
    it.each(Object.keys(POSE_FOR) as SignLayer[])('%s then its prime is back to solved', (layer) => {
      const right = run(frames(() => [signHand(POSE_FOR[layer], 'Right')], HOLD_FRAMES)).events[0].move
      const left = run(frames(() => [signHand(POSE_FOR[layer], 'Left')], HOLD_FRAMES)).events[0].move
      let s = applyMove(createInitialState(), right)
      expect(isSolved(s)).toBe(false)
      s = applyMove(s, left)
      expect(isSolved(s)).toBe(true)
    })
  })
})

describe('turning on a hold', () => {
  it('a pose shown only briefly turns nothing, but shows as pending', () => {
    const { events, state } = run(frames(() => [signHand(POSE_FOR.R, 'Right')], 8))
    expect(events).toEqual([])
    expect(activeSigns(state, 8 * 33)[0]).toMatchObject({ layer: 'R', notation: 'R', fired: false })
  })

  it('REGRESSION: a sign dropped just before the hold completes never turns after the hand is gone', () => {
    const almost = Math.floor(DEFAULT_SIGN_OPTIONS.holdMs / 33) + 2
    const shown = frames(() => [signHand(POSE_FOR.R, 'Right')], almost)
    // The hand leaves; the next frames arrive after the hold time has passed.
    const gone = frames(() => [], 6, almost * 33 + 400)
    expect(run([...shown, ...gone]).events).toEqual([])
  })

  it('holding a pose far longer still turns only once', () => {
    expect(turns(run(frames(() => [signHand(POSE_FOR.U, 'Right')], HOLD_FRAMES * 4)).events)).toEqual(['U'])
  })

  it('relax, then sign again: a second turn (that is how a double turn is made)', () => {
    const a = frames(() => [signHand(POSE_FOR.F, 'Right')], HOLD_FRAMES)
    const relax = frames(() => [signHand('1111', 'Right')], 8, a.length * 33)
    const b = frames(() => [signHand(POSE_FOR.F, 'Right')], HOLD_FRAMES, (a.length + 8) * 33)
    expect(turns(run([...a, ...relax, ...b]).events)).toEqual(['F', 'F'])
  })

  it('a single stray frame of a different pose neither turns it nor resets the hold', () => {
    const fs = frames((i) => [signHand(i === 6 ? POSE_FOR.U : POSE_FOR.R, 'Right')], HOLD_FRAMES)
    expect(turns(run(fs).events)).toEqual(['R'])
  })

  it('both hands work at once, independently', () => {
    const fs = frames(() => [signHand(POSE_FOR.R, 'Right', 0.3), signHand(POSE_FOR.L, 'Left', 0.7)], HOLD_FRAMES)
    expect(turns(run(fs).events).sort()).toEqual(["L'", 'R'].sort())
  })

  it('moving between poses, none held long enough, turns nothing', () => {
    const short = Math.floor(DEFAULT_SIGN_OPTIONS.holdMs / 33) - 2
    const fs = [
      ...frames(() => [signHand(POSE_FOR.R, 'Right')], short),
      ...frames(() => [signHand(POSE_FOR.U, 'Right')], short, short * 33),
      ...frames(() => [signHand(POSE_FOR.F, 'Right')], short, 2 * short * 33),
    ]
    expect(run(fs).events).toEqual([])
  })

  it('swapHands covers a camera that already mirrors its frames', () => {
    const fs = frames(() => [signHand(POSE_FOR.R, 'Right')], HOLD_FRAMES)
    expect(turns(run(fs).events)).toEqual(['R'])
    expect(turns(run(fs, { ...DEFAULT_SIGN_OPTIONS, swapHands: true }).events)).toEqual(["R'"])
  })

  it('signForNotation rejects moves no single sign makes', () => {
    expect(signForNotation('R2')).toBeNull()
    expect(signForNotation('x')).toBeNull()
  })
})
