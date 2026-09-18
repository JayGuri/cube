import { orbitsOf } from '../kpattern'
import type { PieceId, PuzzleState } from '../PuzzlePlugin'
import { classifySkewbPiece, SKEWB_COLORS, skewbSlotId, type Face } from './geometry'
import { patternOf } from './logic'

// CORNERS and CENTERS are independent orbits with no shared numbering
// constraint (unlike pyraminx, where EDGES' identity depended on the vertex
// numbering already fixed for tips/axials) -- so orbit-index i is simply
// DEFINED to be geometric slot i for each orbit. Both orbits genuinely permute
// (unlike pyraminx's tips/axials), so a real home-slot lookup is still needed,
// but no cross-orbit spike is required to get the labelling self-consistent.

const ALL_OCTANTS = Array.from({ length: 8 }, (_, i) => i)
const ALL_CENTER_INDICES = Array.from({ length: 6 }, (_, i) => i)

function octantFaces(octant: number): Face[] {
  // Reverse of classifySkewbPiece's bit encoding: bit2=x, bit1=y, bit0=z.
  const xPos = (octant >> 2) & 1
  const yPos = (octant >> 1) & 1
  const zPos = octant & 1
  const faces: Face[] = []
  faces.push(xPos ? 'R' : 'L')
  faces.push(yPos ? 'U' : 'D')
  faces.push(zPos ? 'F' : 'B')
  return faces
}

const CENTER_FACE: Face[] = ['U', 'D', 'F', 'B', 'R', 'L']

export interface SkewbSlotDef {
  orbit: 'CORNERS' | 'CENTERS'
  index: number
  faces: Face[]
  slotId: string
}

export const CORNER_SLOTS: SkewbSlotDef[] = ALL_OCTANTS.map((i) => ({
  orbit: 'CORNERS',
  index: i,
  faces: octantFaces(i),
  slotId: skewbSlotId({ kind: 'corner', index: i }),
}))

export const CENTER_SLOTS: SkewbSlotDef[] = ALL_CENTER_INDICES.map((i) => ({
  orbit: 'CENTERS',
  index: i,
  faces: [CENTER_FACE[i]],
  slotId: skewbSlotId({ kind: 'center', index: i }),
}))

export const ALL_SLOTS: SkewbSlotDef[] = [...CORNER_SLOTS, ...CENTER_SLOTS]

export function pieceIdForFacelet(state: PuzzleState, facelet: string): PieceId {
  const slot = ALL_SLOTS.find((s) => s.slotId === facelet)
  if (!slot) throw new Error(`unknown skewb facelet: ${facelet}`)
  const orbit = orbitsOf(patternOf(state))[slot.orbit]
  return `skewb-${slot.orbit}-${orbit.pieces[slot.index]}`
}

export function faceletColors(state: PuzzleState): Map<PieceId, Record<string, string>> {
  const data = orbitsOf(patternOf(state))
  const out = new Map<PieceId, Record<string, string>>()

  for (const slot of CORNER_SLOTS) {
    const orbit = data.CORNERS
    const piece = orbit.pieces[slot.index]
    const orientation = orbit.orientation[slot.index]
    const homeFaces = octantFaces(piece)
    const n = homeFaces.length
    const colors: Record<string, string> = {}
    slot.faces.forEach((face, i) => {
      colors[face] = SKEWB_COLORS[homeFaces[(i + orientation) % n]]
    })
    out.set(slot.slotId, colors)
  }

  for (const slot of CENTER_SLOTS) {
    const orbit = data.CENTERS
    const piece = orbit.pieces[slot.index]
    // A single square sticker looks the same under any rotation -- orientation
    // has no visual effect for a 1-face piece (matches CENTERS' numOrientations
    // of 4, one per quarter-turn symmetry of a plain square).
    out.set(slot.slotId, { [slot.faces[0]]: SKEWB_COLORS[CENTER_FACE[piece]] })
  }

  return out
}

export { classifySkewbPiece }
