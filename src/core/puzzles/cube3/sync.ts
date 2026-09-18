import { orbitsOf } from '../kpattern'
import type { PieceId, PuzzleState } from '../PuzzlePlugin'
import { CUBE3_COLORS, type Face, facesOfSlot, slotId } from './geometry'
import { patternOf } from './logic'

// Two distinct id spaces, deliberately:
//   * PieceMesh.pieceId  = SLOT id ("cube3-slot-1_1_1"). Stable mesh identity;
//     a cubie mesh never moves between slots, its stickers are recoloured.
//   * pieceIdForFacelet() = PHYSICAL PIECE id ("cube3-CORNERS-4"). Which actual
//     piece currently occupies that slot. Lessons ask "is the right piece here".

export interface SlotDef {
  orbit: 'CORNERS' | 'EDGES' | 'CENTERS'
  index: number
  slot: [number, number, number]
  // Slot facelets in the orbit's own winding order; index i of this array pairs
  // with sticker index i of whichever piece sits here.
  faces: Face[]
}

// Orbit orderings below were CONFIRMED empirically in the Task 1.1 spike, not
// assumed: applying R to the solved pattern changes exactly CORNERS indices
// 0,1,4,7 and EDGES indices 1,5,8,10 -- precisely the R-face slots under these
// orderings. See docs/plans/2026-09-18-handcube.md.
export const CORNER_SLOTS: SlotDef[] = [
  { orbit: 'CORNERS', index: 0, slot: [1, 1, 1], faces: ['U', 'F', 'R'] },
  { orbit: 'CORNERS', index: 1, slot: [1, 1, -1], faces: ['U', 'R', 'B'] },
  { orbit: 'CORNERS', index: 2, slot: [-1, 1, -1], faces: ['U', 'B', 'L'] },
  { orbit: 'CORNERS', index: 3, slot: [-1, 1, 1], faces: ['U', 'L', 'F'] },
  { orbit: 'CORNERS', index: 4, slot: [1, -1, 1], faces: ['D', 'R', 'F'] },
  { orbit: 'CORNERS', index: 5, slot: [-1, -1, 1], faces: ['D', 'F', 'L'] },
  { orbit: 'CORNERS', index: 6, slot: [-1, -1, -1], faces: ['D', 'L', 'B'] },
  { orbit: 'CORNERS', index: 7, slot: [1, -1, -1], faces: ['D', 'B', 'R'] },
]

export const EDGE_SLOTS: SlotDef[] = [
  { orbit: 'EDGES', index: 0, slot: [0, 1, 1], faces: ['U', 'F'] },
  { orbit: 'EDGES', index: 1, slot: [1, 1, 0], faces: ['U', 'R'] },
  { orbit: 'EDGES', index: 2, slot: [0, 1, -1], faces: ['U', 'B'] },
  { orbit: 'EDGES', index: 3, slot: [-1, 1, 0], faces: ['U', 'L'] },
  { orbit: 'EDGES', index: 4, slot: [0, -1, 1], faces: ['D', 'F'] },
  { orbit: 'EDGES', index: 5, slot: [1, -1, 0], faces: ['D', 'R'] },
  { orbit: 'EDGES', index: 6, slot: [0, -1, -1], faces: ['D', 'B'] },
  { orbit: 'EDGES', index: 7, slot: [-1, -1, 0], faces: ['D', 'L'] },
  { orbit: 'EDGES', index: 8, slot: [1, 0, 1], faces: ['F', 'R'] },
  { orbit: 'EDGES', index: 9, slot: [-1, 0, 1], faces: ['F', 'L'] },
  { orbit: 'EDGES', index: 10, slot: [1, 0, -1], faces: ['B', 'R'] },
  { orbit: 'EDGES', index: 11, slot: [-1, 0, -1], faces: ['B', 'L'] },
]

export const CENTER_SLOTS: SlotDef[] = [
  { orbit: 'CENTERS', index: 0, slot: [0, 1, 0], faces: ['U'] },
  { orbit: 'CENTERS', index: 1, slot: [-1, 0, 0], faces: ['L'] },
  { orbit: 'CENTERS', index: 2, slot: [0, 0, 1], faces: ['F'] },
  { orbit: 'CENTERS', index: 3, slot: [1, 0, 0], faces: ['R'] },
  { orbit: 'CENTERS', index: 4, slot: [0, 0, -1], faces: ['B'] },
  { orbit: 'CENTERS', index: 5, slot: [0, -1, 0], faces: ['D'] },
]

export const ALL_SLOTS: SlotDef[] = [...CORNER_SLOTS, ...EDGE_SLOTS, ...CENTER_SLOTS]

// Sticker colours of each piece in its SOLVED home slot, in that slot's face
// order. Piece n of an orbit is, by definition, the piece that belongs at slot n.
const SOLVED_STICKERS: Record<string, string[][]> = {
  CORNERS: CORNER_SLOTS.map((s) => s.faces.map((f) => CUBE3_COLORS[f])),
  EDGES: EDGE_SLOTS.map((s) => s.faces.map((f) => CUBE3_COLORS[f])),
  CENTERS: CENTER_SLOTS.map((s) => s.faces.map((f) => CUBE3_COLORS[f])),
}

// Facelet label -> slot, tolerant of ordering ("URF" and "UFR" are the same slot).
const normalise = (label: string) => label.toUpperCase().split('').sort().join('')
const SLOT_BY_LABEL = new Map<string, SlotDef>(
  ALL_SLOTS.map((s) => [normalise(s.faces.join('')), s]),
)

export function slotForFacelet(facelet: string): SlotDef {
  const slot = SLOT_BY_LABEL.get(normalise(facelet))
  if (!slot) throw new Error(`unknown cube3 facelet: ${facelet}`)
  return slot
}

// Which physical piece currently sits at the slot this facelet names.
export function pieceIdForFacelet(state: PuzzleState, facelet: string): PieceId {
  const def = slotForFacelet(facelet)
  const orbit = orbitsOf(patternOf(state))[def.orbit]
  return `cube3-${def.orbit}-${orbit.pieces[def.index]}`
}

// Sticker colours for every cubie in the current state, keyed by mesh slot id.
//
// The orientation rule -- slot facelet i shows the resident piece's sticker
// (i + orientation) mod n -- was derived from real post-R pattern data in the
// Task 1.1 spike and is re-verified by sync.test.ts, not taken on faith.
export function faceletColors(state: PuzzleState): Map<PieceId, Record<string, string>> {
  const data = orbitsOf(patternOf(state))
  const out = new Map<PieceId, Record<string, string>>()

  for (const def of ALL_SLOTS) {
    const orbit = data[def.orbit]
    const piece = orbit.pieces[def.index]
    const orientation = orbit.orientation[def.index]
    const stickers = SOLVED_STICKERS[def.orbit][piece]
    const n = def.faces.length

    const colors: Record<string, string> = {}
    def.faces.forEach((face, i) => {
      colors[face] = stickers[(i + orientation) % n]
    })
    out.set(slotId(def.slot), colors)
  }
  return out
}

// "Which mesh piece is at which logical slot right now" -- a plain lookup,
// deliberately free of Three.js scene-graph code. The r3f component applies the
// actual position/rotation.
export function syncMeshToState(
  state: PuzzleState,
  facelets: string[] = ALL_SLOTS.map((s) => s.faces.join('')),
): Map<string, PieceId> {
  const map = new Map<string, PieceId>()
  for (const facelet of facelets) {
    map.set(facelet, pieceIdForFacelet(state, facelet))
  }
  return map
}

export { facesOfSlot }
