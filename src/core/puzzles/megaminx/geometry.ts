import * as THREE from 'three'
import { centroidOf, cutSolidByPlanes } from '../../geometry/csgBuilder'
import { assignFaceGroups, type OuterFace } from '../../geometry/faceGroups'
import type { PieceMesh, PuzzleMesh } from '../PuzzlePlugin'

// The 12 face normals of THREE.DodecahedronGeometry(1), extracted directly
// from its own triangles (Task 8.2 spike) rather than hand-derived from
// golden-ratio vertex formulas -- avoids re-deriving irrational dodecahedron
// coordinates by hand and the transcription-error risk that carries.
export const FACE_NORMALS: THREE.Vector3[] = [
  [0, 0.8506508230317321, 0.525731088366892],
  [0.8506508148812837, 0.5257311015545952, 0],
  [0.5257310990359683, 0, -0.8506508164378807],
  [-0.5257310990359683, 0, -0.8506508164378807],
  [-0.8506508230317321, -0.525731088366892, 0],
  [0, 0.8506508230317321, -0.525731088366892],
  [-0.8506508148812837, 0.5257311015545952, 0],
  [-0.5257310990359683, 0, 0.8506508164378807],
  [0, -0.8506508148812837, -0.5257311015545952],
  [0.5257311015545952, 0, 0.8506508148812837],
  [0.8506508164378807, -0.5257310990359683, 0],
  [0, -0.8506508148812837, 0.5257311015545952],
].map(([x, y, z]) => new THREE.Vector3(x, y, z))

const RADIUS = 1
// Regular dodecahedron radius-1 face-plane distance from centre, confirmed
// via the same spike: 0.7947.
const FACE_OFFSET = 0.7946544722917661
// Depth of the single cut plane per face (spec 7.3). Chosen empirically
// (Task 8.2) and verified via the piece-count test below -- see that test
// for what changes if this constant is ever retuned.
const CUT_OFFSET = FACE_OFFSET * 0.62

function megaminxPlanes() {
  return FACE_NORMALS.map((n) => ({ normal: n, offset: CUT_OFFSET }))
}

export const OUTER_FACES: OuterFace[] = FACE_NORMALS.map((n, i) => ({
  id: `F${i}`,
  normal: n,
  offset: FACE_OFFSET,
}))
export const INTERIOR_GROUP = OUTER_FACES.length

// spec 11.1: the 12-colour standard set.
export const MEGAMINX_COLORS: Record<string, string> = {
  F0: '#FFFFFF',
  F1: '#A0A0A0',
  F2: '#C41E3A',
  F3: '#FFD500',
  F4: '#6F2DA8',
  F5: '#FF8A00', // was #FF5800 -- too close to red, see cube3/geometry.ts
  F6: '#0051BA',
  F7: '#4AA8D8',
  F8: '#009E60',
  F9: '#EC008C',
  F10: '#145A32',
  F11: '#F5DEB3',
}

export type MegaminxKind = 'corner' | 'edge' | 'center'
export interface MegaminxSlot {
  kind: MegaminxKind
  faces: number[]
}

// A piece is classified by WHICH of the 12 "beyond this face's cut plane"
// half-spaces its centroid sits in. Beyond exactly 1 face -> a centre piece;
// beyond exactly 2 (necessarily adjacent, since only adjacent face-pairs'
// half-spaces overlap this close to the centre) -> an edge; beyond exactly 3
// (necessarily the 3 faces meeting at one vertex) -> a corner; beyond 0 ->
// the hidden core (dropped, same treatment as cube3's).
export function classifyMegaminxPiece(centroid: THREE.Vector3): MegaminxSlot | null {
  const beyond: number[] = []
  FACE_NORMALS.forEach((n, i) => {
    if (centroid.dot(n) > CUT_OFFSET - 0.02) beyond.push(i)
  })
  if (beyond.length === 0) return null
  if (beyond.length === 1) return { kind: 'center', faces: beyond }
  if (beyond.length === 2) return { kind: 'edge', faces: beyond.sort((a, b) => a - b) }
  if (beyond.length === 3) return { kind: 'corner', faces: beyond.sort((a, b) => a - b) }
  return null
}

export function megaminxSlotId(slot: MegaminxSlot): string {
  return `megaminx-${slot.kind}-${slot.faces.join('_')}`
}

let cached: PuzzleMesh | null = null

export function buildMegaminxGeometry(): PuzzleMesh {
  if (cached) return cached
  const dod = new THREE.DodecahedronGeometry(RADIUS)
  const cells = cutSolidByPlanes(dod, megaminxPlanes())

  const pieces: PieceMesh[] = []
  for (const cell of cells) {
    const centroid = centroidOf(cell)
    const slot = classifyMegaminxPiece(centroid)
    if (!slot) continue
    pieces.push({
      pieceId: megaminxSlotId(slot),
      geometry: assignFaceGroups(cell, OUTER_FACES),
      slot: [centroid.x, centroid.y, centroid.z],
    })
  }

  cached = { pieces }
  return cached
}
