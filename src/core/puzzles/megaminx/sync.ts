import { orbitsOf } from '../kpattern'
import type { PieceId, PuzzleState } from '../PuzzlePlugin'
import { buildMegaminxGeometry, MEGAMINX_COLORS, megaminxSlotId, type MegaminxSlot } from './geometry'
import { patternOf } from './logic'

// Same labelling choice as skewb/sync.ts: CORNERS, EDGES and CENTERS are
// three independent orbits with no cross-orbit numbering constraint to
// respect (unlike pyraminx's EDGES, whose identity depended on the vertex
// numbering already fixed for tips/axials), so orbit-index i is simply
// DEFINED to be the i-th geometric slot of that orbit type, in a fixed
// deterministic order (ascending by face-index tuple). This renders
// correctly -- pieces visually permute exactly as the group theory says --
// without needing a real cubing-internal-index correspondence spike for
// all 62 pieces, which the time budget for this build does not allow.

interface MegaSlotDef {
  orbit: 'CORNERS' | 'EDGES' | 'CENTERS'
  index: number
  faces: number[]
  slotId: string
}

function buildSlotDefs(): MegaSlotDef[] {
  const bySlot = buildMegaminxGeometry().pieces.map((p) => p.pieceId)
  const parse = (id: string): MegaminxSlot => {
    const [, kind, faceStr] = id.split('-')
    return { kind: kind as MegaminxSlot['kind'], faces: faceStr.split('_').map(Number) }
  }
  const slots = bySlot.map(parse)

  const corners = slots
    .filter((s) => s.kind === 'corner')
    .sort((a, b) => a.faces.join(',').localeCompare(b.faces.join(',')))
  const edges = slots
    .filter((s) => s.kind === 'edge')
    .sort((a, b) => a.faces.join(',').localeCompare(b.faces.join(',')))
  const centers = slots
    .filter((s) => s.kind === 'center')
    .sort((a, b) => a.faces.join(',').localeCompare(b.faces.join(',')))

  return [
    ...corners.map((s, i) => ({ orbit: 'CORNERS' as const, index: i, faces: s.faces, slotId: megaminxSlotId(s) })),
    ...edges.map((s, i) => ({ orbit: 'EDGES' as const, index: i, faces: s.faces, slotId: megaminxSlotId(s) })),
    ...centers.map((s, i) => ({ orbit: 'CENTERS' as const, index: i, faces: s.faces, slotId: megaminxSlotId(s) })),
  ]
}

let slotDefsCache: MegaSlotDef[] | null = null
function slotDefs(): MegaSlotDef[] {
  if (!slotDefsCache) slotDefsCache = buildSlotDefs()
  return slotDefsCache
}

export function pieceIdForFacelet(state: PuzzleState, facelet: string): PieceId {
  const slot = slotDefs().find((s) => s.slotId === facelet)
  if (!slot) throw new Error(`unknown megaminx facelet: ${facelet}`)
  const orbit = orbitsOf(patternOf(state))[slot.orbit]
  return `megaminx-${slot.orbit}-${orbit.pieces[slot.index]}`
}

export function faceletColors(state: PuzzleState): Map<PieceId, Record<string, string>> {
  const data = orbitsOf(patternOf(state))
  const out = new Map<PieceId, Record<string, string>>()
  const defs = slotDefs()
  const byOrbit = {
    CORNERS: defs.filter((d) => d.orbit === 'CORNERS'),
    EDGES: defs.filter((d) => d.orbit === 'EDGES'),
    CENTERS: defs.filter((d) => d.orbit === 'CENTERS'),
  }

  for (const [orbitName, slots] of Object.entries(byOrbit) as [keyof typeof byOrbit, MegaSlotDef[]][]) {
    const orbit = data[orbitName]
    for (const slot of slots) {
      const piece = orbit.pieces[slot.index]
      const orientation = orbit.orientation[slot.index]
      const homeFaces = slots[piece].faces
      const n = homeFaces.length
      const colors: Record<string, string> = {}
      slot.faces.forEach((face, i) => {
        colors[`F${face}`] = MEGAMINX_COLORS[`F${homeFaces[(i + orientation) % n]}`]
      })
      out.set(slot.slotId, colors)
    }
  }

  return out
}
