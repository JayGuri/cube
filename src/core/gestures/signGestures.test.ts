import { beforeAll, describe, expect, it } from 'vitest'
import { applyMove, createInitialState, initCube3Logic } from '../puzzles/cube3/logic'
import { faceletColors } from '../puzzles/cube3/sync'
import { CUBE3_COLORS, slotId, type Face } from '../puzzles/cube3/geometry'
import type { Handedness, HandFrame, Landmark, LandmarkFrame } from './landmarks'
import {
  createSignState,
  DEFAULT_SIGN_OPTIONS,
  LAYER_PUSH,
  readSign,
  stepSigns,
  swipeProgress,
  type SignEvent,
  type SignLayer,
  type SignState,
} from './signGestures'

// A hand held up to the camera with an exact set of fingers extended, in raw
// (unmirrored) camera coordinates, labelled the way MediaPipe would label it.
// `real` is the user's actual hand; MediaPipe reports the opposite label
// because our frames aren't mirrored.
function signHand(mask: string, real: Handedness, cx: number, cy: number): HandFrame {
  const s = 0.06 // hand scale in frame units
  const at = (x: number, y: number): Landmark => ({ x: cx + x * s, y: cy + y * s, z: 0 })
  const lm: Landmark[] = Array.from({ length: 21 }, () => at(0, 0))
  lm[0] = at(0, 1) // wrist below the knuckles (screen y grows downward)
  const mcps = [5, 9, 13, 17]
  const tips = [8, 12, 16, 20]
  const xs = [-0.3, -0.1, 0.1, 0.3]
  mcps.forEach((i, k) => (lm[i] = at(xs[k], 0)))
  tips.forEach((i, k) => (lm[i] = mask[k] === '1' ? at(xs[k] * 1.2, -1) : at(xs[k], 0.4)))
  lm[4] = at(-0.6, 0.5) // thumb, ignored
  return { landmarks: lm, handedness: real === 'Right' ? 'Left' : 'Right', score: 0.95 }
}

const MASK: Record<SignLayer, [string, Handedness]> = {
  R: ['1000', 'Right'],
  U: ['1100', 'Right'],
  F: ['1110', 'Right'],
  M: ['0001', 'Right'],
  S: ['1001', 'Right'],
  L: ['1000', 'Left'],
  D: ['1100', 'Left'],
  B: ['1110', 'Left'],
  E: ['0001', 'Left'],
}

function run(frames: LandmarkFrame[], state: SignState = createSignState()) {
  const events: SignEvent[] = []
  for (const f of frames) {
    const r = stepSigns(state, f)
    state = r.next
    events.push(...r.events)
  }
  return { state, events }
}

// Hold a sign still long enough to select it, then move the hand by
// (dxUser, dyUser): + is the user's own right / up.
function signThenSwipe(layer: SignLayer, dxUser: number, dyUser: number, t0 = 0) {
  const [mask, real] = MASK[layer]
  const frames: LandmarkFrame[] = []
  let t = t0
  for (let i = 0; i < 8; i++, t += 33) frames.push({ hands: [signHand(mask, real, 0.5, 0.5)], timestampMs: t })
  for (let i = 1; i <= 6; i++, t += 33) {
    // The user's right is raw camera -x; up is raw -y.
    frames.push({ hands: [signHand(mask, real, 0.5 - (dxUser * i) / 6, 0.5 - (dyUser * i) / 6)], timestampMs: t })
  }
  return frames
}

const turns = (events: SignEvent[]) =>
  events.filter((e) => e.type === 'TURN').map((e) => (e as { move: { alg: { toString(): string } } }).move.alg.toString())

describe('reading a sign', () => {
  it.each(Object.entries(MASK))('%s is read from its finger pattern and hand', (layer, [mask, real]) => {
    expect(readSign(signHand(mask, real, 0.5, 0.5))).toBe(layer)
  })

  it('an open palm, a fist, or an unassigned pattern is not a sign', () => {
    expect(readSign(signHand('1111', 'Right', 0.5, 0.5))).toBeNull()
    expect(readSign(signHand('0000', 'Right', 0.5, 0.5))).toBeNull()
    expect(readSign(signHand('0110', 'Right', 0.5, 0.5))).toBeNull()
  })

  it('swapHands covers a camera that already mirrors its frames', () => {
    const hand = signHand('1000', 'Right', 0.5, 0.5)
    expect(readSign(hand)).toBe('R')
    expect(readSign(hand, { ...DEFAULT_SIGN_OPTIONS, swapHands: true })).toBe('L')
  })
})

describe('pushing a layer: the visible stickers travel the way the hand did (checked on the real cube)', () => {
  beforeAll(async () => {
    await initCube3Logic()
  })

  const SLICE_INDEX: Record<SignLayer, number> = { R: 1, M: 0, L: -1, U: 1, E: 0, D: -1, F: 1, S: 0, B: -1 }

  // For each layer and swipe, which visible sticker to inspect afterwards and
  // which face's colour must now be on it if the material moved the way the
  // hand did.
  function expectation(layer: SignLayer, positive: boolean): { slot: [number, number, number]; face: Face; from: Face } {
    const k = SLICE_INDEX[layer]
    if ('UED'.includes(layer)) {
      // Swipe right: the front row slides right, so the front now shows what was on the left.
      return { slot: [0, k, 1], face: 'F', from: positive ? 'L' : 'R' }
    }
    if ('RML'.includes(layer)) {
      // Swipe up: the front column slides up, so the front now shows what was below.
      return { slot: [k, 0, 1], face: 'F', from: positive ? 'D' : 'U' }
    }
    // F/S/B turn in the screen plane: swipe right carries the top toward the right side.
    return positive ? { slot: [1, 0, k], face: 'R', from: 'U' } : { slot: [-1, 0, k], face: 'L', from: 'U' }
  }

  const cases = (Object.keys(MASK) as SignLayer[]).flatMap((layer) => [
    { layer, positive: true },
    { layer, positive: false },
  ])

  it.each(cases)('$layer, positive swipe=$positive', ({ layer, positive }) => {
    const sign = positive ? 1 : -1
    const horizontal = LAYER_PUSH[layer].swipe === 'horizontal'
    const { events } = run(signThenSwipe(layer, horizontal ? 0.2 * sign : 0, horizontal ? 0 : 0.2 * sign))
    const committed = turns(events)
    expect(committed).toHaveLength(1)

    const turn = events.find((e) => e.type === 'TURN') as Extract<SignEvent, { type: 'TURN' }>
    const after = applyMove(createInitialState(), turn.move)
    const { slot, face, from } = expectation(layer, positive)
    expect(faceletColors(after).get(slotId(slot))![face], committed[0]).toBe(CUBE3_COLORS[from])
  })
})

describe('robustness', () => {
  it('a single stray frame of a sign never selects anything', () => {
    const [mask, real] = MASK.R
    const frames: LandmarkFrame[] = [
      { hands: [signHand('1111', 'Right', 0.5, 0.5)], timestampMs: 0 },
      { hands: [signHand(mask, real, 0.5, 0.5)], timestampMs: 33 },
      { hands: [signHand('1111', 'Right', 0.5, 0.5)], timestampMs: 66 },
      { hands: [signHand('1111', 'Right', 0.5, 0.5)], timestampMs: 99 },
    ]
    expect(run(frames).events.some((e) => e.type === 'SELECT')).toBe(false)
  })

  it('a held sign selects without turning anything until the hand moves', () => {
    const [mask, real] = MASK.U
    const frames: LandmarkFrame[] = []
    for (let t = 0; t < 1000; t += 33) frames.push({ hands: [signHand(mask, real, 0.5, 0.5)], timestampMs: t })
    const { events, state } = run(frames)
    expect(events).toEqual([{ type: 'SELECT', layer: 'U' }])
    expect(state.selected).toBe('U')
  })

  it('the return stroke of a swipe is not read as an opposite turn', () => {
    const go = signThenSwipe('R', 0, 0.2)
    const last = go[go.length - 1].timestampMs
    const [mask, real] = MASK.R
    const back: LandmarkFrame[] = []
    for (let i = 1; i <= 6; i++) back.push({ hands: [signHand(mask, real, 0.5, 0.3 + (0.2 * i) / 6)], timestampMs: last + i * 33 })
    expect(turns(run([...go, ...back]).events)).toEqual(['R'])
  })

  it('after a pause, a second swipe turns again (that is how a double turn is made)', () => {
    const first = signThenSwipe('F', 0.2, 0)
    const last = first[first.length - 1].timestampMs
    const [mask, real] = MASK.F
    const rest: LandmarkFrame[] = []
    for (let i = 1; i <= 18; i++) rest.push({ hands: [signHand(mask, real, 0.3, 0.5)], timestampMs: last + i * 33 })
    const restEnd = rest[rest.length - 1].timestampMs
    const second: LandmarkFrame[] = []
    for (let i = 1; i <= 6; i++) second.push({ hands: [signHand(mask, real, 0.3 - (0.2 * i) / 6, 0.5)], timestampMs: restEnd + i * 33 })
    expect(turns(run([...first, ...rest, ...second]).events)).toEqual(['F', 'F'])
  })

  it('two hands in view (the zoom gesture) never select or turn anything', () => {
    const [mask, real] = MASK.R
    const frames: LandmarkFrame[] = []
    for (let t = 0; t < 600; t += 33)
      frames.push({ hands: [signHand(mask, real, 0.4, 0.5), signHand(mask, real, 0.7, 0.5 - t / 3000)], timestampMs: t })
    expect(run(frames).events).toEqual([])
  })

  it('dropping the sign clears the selection', () => {
    const frames = signThenSwipe('S', 0, 0).slice(0, 8)
    for (let t = 300; t < 600; t += 33) frames.push({ hands: [], timestampMs: t })
    const { events, state } = run(frames)
    expect(events.map((e) => e.type)).toEqual(['SELECT', 'CLEAR'])
    expect(state.selected).toBeNull()
  })

  it('reports signed swipe progress for the HUD', () => {
    const frames = signThenSwipe('U', 0, 0).slice(0, 8)
    const { state } = run(frames)
    const [mask, real] = MASK.U
    const halfway: LandmarkFrame = { hands: [signHand(mask, real, 0.5 - 0.06, 0.5)], timestampMs: 400 }
    expect(swipeProgress(state, halfway)).toBeCloseTo(0.5, 1)
  })
})
