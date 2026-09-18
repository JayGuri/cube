import type { HandFrame, Landmark, LandmarkFrame } from './landmarks'

// Synthetic landmark builders. These do not imitate real MediaPipe output down
// to the decimal -- they exist to cross the exact thresholds the FSM checks,
// which is what makes the gesture tests deterministic and camera-free (spec 8.3).

const ORIGIN: Landmark = { x: 0, y: 0, z: 0 }

// Fingertip directions, fanned around +y. Tips are placed at an exact radius
// along these, because fingerCurl measures tip-to-wrist DISTANCE -- laying them
// out by y-extension alone leaves a "fist" as far from the wrist as open
// fingers and it never reads as curled.
const TIP_DIRECTIONS: Array<[number, number]> = [
  [-0.24, 0.97], // index
  [-0.05, 1.0], // middle
  [0.16, 0.99], // ring
  [0.36, 0.93], // pinky
]
const TIP_INDICES = [8, 12, 16, 20]

/**
 * A hand in a plain, predictable pose.
 *
 * `spread` drives how far the fingertips sit from the wrist in hand-scale units
 * (wrist-to-middle-knuckle = 1): ~1 is an open palm, ~0.3 is a fist.
 * `pinch` is the thumb-to-index-tip gap in the same units.
 */
export function makeHand(
  options: {
    spread?: number
    pinch?: number
    at?: Landmark
    handedness?: 'Left' | 'Right'
    score?: number
  } = {},
): HandFrame {
  const { spread = 1, pinch = 0.6, at = ORIGIN, handedness = 'Right', score = 0.95 } = options

  const landmarks: Landmark[] = Array.from({ length: 21 }, () => ({ ...at }))
  const put = (i: number, x: number, y: number, z = 0) => {
    landmarks[i] = { x: at.x + x, y: at.y + y, z: at.z + z }
  }

  put(0, 0, 0) // wrist
  put(5, -0.3, 1, 0) // index MCP
  put(9, 0, 1, 0) // middle MCP -- fixes hand scale at 1 unit from the wrist
  put(17, 0.3, 1, 0) // pinky MCP

  // Curled fingertips sit ~0.45 from the wrist, open ones ~1.8.
  const radius = 0.45 + 1.35 * spread
  TIP_INDICES.forEach((index, i) => {
    const [dx, dy] = TIP_DIRECTIONS[i]
    const len = Math.hypot(dx, dy)
    put(index, (dx / len) * radius, (dy / len) * radius)
  })

  // Thumb tip sits `pinch` away from the index tip.
  const indexTip = landmarks[8]
  put(4, indexTip.x - at.x - pinch, indexTip.y - at.y)

  return { landmarks, handedness, score }
}

export const openPalm = (at?: Landmark) => makeHand({ spread: 1, pinch: 0.7, at })
export const fist = (at?: Landmark) => makeHand({ spread: 0.25, pinch: 0.5, at })
export const pinching = (at?: Landmark) => makeHand({ spread: 1, pinch: 0.06, at })

export function frame(hands: HandFrame[], timestampMs: number): LandmarkFrame {
  return { hands, timestampMs }
}

/** Repeats one frame shape over a time span at a fixed rate. */
export function hold(
  build: (t: number) => HandFrame[],
  fromMs: number,
  toMs: number,
  stepMs = 33,
): LandmarkFrame[] {
  const frames: LandmarkFrame[] = []
  for (let t = fromMs; t <= toMs; t += stepMs) frames.push(frame(build(t), t))
  return frames
}
