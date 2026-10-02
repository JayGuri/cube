import { Alg } from 'cubing/alg'
import { beforeAll, describe, expect, it } from 'vitest'
import { CUBE3_COLORS, slotId, type Face } from '../cube3/geometry'
import { applyMove, createInitialState, initCube3Logic } from '../cube3/logic'
import { faceletColors } from '../cube3/sync'
import { applyMoveToPieces, createPieces, currentSlot, mulVec, type Vec3 } from './pieces'

const NORMAL: Record<Face, Vec3> = {
  R: [1, 0, 0], L: [-1, 0, 0], U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1],
}
const FACE_OF = Object.fromEntries(
  (Object.keys(NORMAL) as Face[]).map((f) => [NORMAL[f].join(','), f]),
) as Record<string, Face>

const run = (moves: string[]) => moves.reduce(applyMoveToPieces, createPieces())
const isIdentity = (m: number[][]) => m.every((row, i) => row.every((v, j) => v === (i === j ? 1 : 0)))

// mulberry32 -- deterministic sequences
function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('mirror piece tracker', () => {
  beforeAll(async () => {
    await initCube3Logic()
  })

  it('returns to identity after a full cycle', () => {
    for (const [m, n] of [['R', 4], ["U'", 4], ['M', 4], ['F2', 2]] as const) {
      const pieces = run(Array(n).fill(m))
      expect(pieces.every((p) => isIdentity(p.rotation))).toBe(true)
    }
  })

  it('matches the real cube sticker colours for random sequences', () => {
    const rand = prng(42)
    const letters = 'RLUDFBMES'
    const mods = ['', "'", '2']
    for (let seq = 0; seq < 25; seq++) {
      const moves = Array.from({ length: 25 }, () =>
        letters[Math.floor(rand() * 9)] + mods[Math.floor(rand() * 3)])
      let state = createInitialState()
      for (const m of moves) state = applyMove(state, { alg: new Alg(m), snapAngleDeg: 90 })
      const colors = faceletColors(state)
      for (const piece of run(moves)) {
        for (const face of Object.keys(NORMAL) as Face[]) {
          const n = NORMAL[face]
          const axis = n.findIndex((v) => v !== 0)
          if (piece.home[axis] !== n[axis]) continue
          const currentFace = FACE_OF[mulVec(piece.rotation, n).join(',')]
          expect(colors.get(slotId(currentSlot(piece)))![currentFace], moves.join(' ')).toBe(
            CUBE3_COLORS[face],
          )
        }
      }
    }
  })
})
