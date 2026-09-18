import { orbitsOf } from '../kpattern'
import type { PieceId, PuzzleState } from '../PuzzlePlugin'
import { OUTER_FACES, PYRAMINX_COLORS, pyraminxSlotId } from './geometry'
import { patternOf } from './logic'

// Task 6.1 spike (docs/plans note) confirmed: WCA letter <-> cubing internal
// orbit index correspondence is U=0, B=1, R=2, L=3 for BOTH the CORNERS
// (axial) and CORNERS2 (tip) orbits, and this same numbering gives the EDGES
// orbit's vertex-pair identity (edge orbit index -> {vertex pair}):
//   0={U,L} 1={U,B} 2={L,R} 3={R,B} 4={L,B} 5={U,R}
// i.e. in plain vertex-index pairs: 0={0,3} 1={0,1} 2={3,2} 3={2,1} 4={3,1} 5={0,2}
// My geometry.ts's arbitrary VERTICES array is deliberately labelled to match
// this numbering 1:1 (vertex i IS cubing's internal orbit index i), so no
// separate remapping table is needed beyond the EDGES pair table below.

const EDGE_PAIR_BY_ORBIT_INDEX: [number, number][] = [
  [0, 3],
  [0, 1],
  [3, 2],
  [2, 1],
  [3, 1],
  [0, 2],
]

const ALL_FACES = [0, 1, 2, 3]

function tipOrAxialFaces(vertexIndex: number): number[] {
  return ALL_FACES.filter((f) => f !== vertexIndex)
}

function edgeFaces(pair: [number, number]): [number, number] {
  const [a, b] = ALL_FACES.filter((f) => f !== pair[0] && f !== pair[1])
  return [a, b]
}

export interface PyraSlotDef {
  orbit: 'CORNERS' | 'CORNERS2' | 'EDGES'
  index: number
  faces: number[]
  slotId: string
}

export const TIP_SLOTS: PyraSlotDef[] = ALL_FACES.map((i) => ({
  orbit: 'CORNERS2',
  index: i,
  faces: tipOrAxialFaces(i),
  slotId: pyraminxSlotId({ kind: 'tip', vertices: [i] }),
}))

export const AXIAL_SLOTS: PyraSlotDef[] = ALL_FACES.map((i) => ({
  orbit: 'CORNERS',
  index: i,
  faces: tipOrAxialFaces(i),
  slotId: pyraminxSlotId({ kind: 'axial', vertices: [i] }),
}))

export const EDGE_SLOTS: PyraSlotDef[] = EDGE_PAIR_BY_ORBIT_INDEX.map((pair, i) => ({
  orbit: 'EDGES',
  index: i,
  faces: [...edgeFaces(pair)],
  slotId: pyraminxSlotId({ kind: 'edge', vertices: [...pair].sort((a, b) => a - b) }),
}))

export const ALL_SLOTS: PyraSlotDef[] = [...TIP_SLOTS, ...AXIAL_SLOTS, ...EDGE_SLOTS]

const faceColor = (f: number) => PYRAMINX_COLORS[OUTER_FACES[f].id]

// Since tips/axials never permute (Task 6.1 spike), "home" sticker colours for
// slot index i are simply that slot's own faces' colours -- there is no
// separate SOLVED_STICKERS lookup-by-piece-identity needed the way cube3
// needed one, because the piece IS always the slot for these two orbits.
export function pieceIdForFacelet(state: PuzzleState, facelet: string): PieceId {
  const slot = ALL_SLOTS.find((s) => s.slotId === facelet)
  if (!slot) throw new Error(`unknown pyraminx facelet: ${facelet}`)
  if (slot.orbit === 'EDGES') {
    const orbit = orbitsOf(patternOf(state)).EDGES
    return `pyraminx-EDGES-${orbit.pieces[slot.index]}`
  }
  // Tips/axials: piece identity is the slot itself (never permutes).
  return `pyraminx-${slot.orbit}-${slot.index}`
}

export function faceletColors(state: PuzzleState): Map<PieceId, Record<string, string>> {
  const data = orbitsOf(patternOf(state))
  const out = new Map<PieceId, Record<string, string>>()

  for (const slot of [...TIP_SLOTS, ...AXIAL_SLOTS]) {
    const orbit = data[slot.orbit]
    const orientation = orbit.orientation[slot.index]
    const n = slot.faces.length
    const colors: Record<string, string> = {}
    slot.faces.forEach((face, i) => {
      colors[`F${face}`] = faceColor(slot.faces[(i + orientation) % n])
    })
    out.set(slot.slotId, colors)
  }

  for (const slot of EDGE_SLOTS) {
    const orbit = data.EDGES
    const piece = orbit.pieces[slot.index]
    const orientation = orbit.orientation[slot.index]
    // The piece at this slot came from home slot `piece`; its home faces are
    // EDGE_SLOTS[piece].faces, coloured by those faces' colours.
    const homeFaces = EDGE_SLOTS[piece].faces
    const n = 2
    const colors: Record<string, string> = {}
    slot.faces.forEach((face, i) => {
      colors[`F${face}`] = faceColor(homeFaces[(i + orientation) % n])
    })
    out.set(slot.slotId, colors)
  }

  return out
}
