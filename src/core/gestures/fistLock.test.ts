import { describe, expect, it } from 'vitest'
import { fist, frame, openPalm } from './fixtures'
import { createFistLockState, FIST_LOCK_HOLD_MS, fistLockProgress, stepFistLock } from './fistLock'

const FIST = 0.95

function runFrames(frames: Array<{ hands: ReturnType<typeof fist>[]; t: number }>) {
  let state = createFistLockState()
  let toggles = 0
  for (const f of frames) {
    const r = stepFistLock(state, frame(f.hands, f.t), FIST)
    state = r.next
    if (r.toggled) toggles++
  }
  return { state, toggles }
}

const holdFist = (from: number, to: number, step = 33) => {
  const out = []
  for (let t = from; t <= to; t += step) out.push({ hands: [fist()], t })
  return out
}

describe('fist lock toggle', () => {
  it('a fist held long enough toggles exactly once', () => {
    expect(runFrames(holdFist(0, FIST_LOCK_HOLD_MS + 100)).toggles).toBe(1)
  })

  it('a brief fist does nothing', () => {
    expect(runFrames(holdFist(0, FIST_LOCK_HOLD_MS - 200)).toggles).toBe(0)
  })

  it('holding the fist far longer still only toggles once', () => {
    expect(runFrames(holdFist(0, FIST_LOCK_HOLD_MS * 5)).toggles).toBe(1)
  })

  it('release then a second hold toggles again', () => {
    const frames = [
      ...holdFist(0, FIST_LOCK_HOLD_MS + 50),
      { hands: [openPalm()], t: FIST_LOCK_HOLD_MS + 100 },
      ...holdFist(FIST_LOCK_HOLD_MS + 150, 2 * FIST_LOCK_HOLD_MS + 300),
    ]
    expect(runFrames(frames).toggles).toBe(2)
  })

  it('an open hand interrupting the hold resets it', () => {
    const half = FIST_LOCK_HOLD_MS / 2
    const frames = [...holdFist(0, half), { hands: [openPalm()], t: half + 10 }, ...holdFist(half + 20, half + 20 + half)]
    expect(runFrames(frames).toggles).toBe(0)
  })

  it('a fist alongside a second hand (the Grab-mode anchor) never toggles', () => {
    const frames = []
    for (let t = 0; t <= FIST_LOCK_HOLD_MS * 2; t += 33) frames.push({ hands: [fist(), openPalm()], t })
    expect(runFrames(frames).toggles).toBe(0)
  })

  it('reports hold progress for the on-screen ring', () => {
    const r = stepFistLock(createFistLockState(), frame([fist()], 1000), FIST)
    expect(fistLockProgress(r.next, 1000 + FIST_LOCK_HOLD_MS / 2)).toBeCloseTo(0.5, 5)
  })
})
