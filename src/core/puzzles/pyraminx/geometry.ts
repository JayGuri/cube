import * as THREE from 'three'
import { centroidOf, cutSolidByPlanes } from '../../geometry/csgBuilder'
import { assignFaceGroups, type OuterFace } from '../../geometry/faceGroups'
import type { PieceMesh, PuzzleMesh } from '../PuzzlePlugin'

// Tetrahedron vertex directions matching THREE.TetrahedronGeometry's internal
// vertex set: 4 alternating corners of a cube, but NORMALIZED to unit length --
// THREE.TetrahedronGeometry(radius) places its vertices at distance `radius`
// from the origin, not at the raw (1,1,1)-style coordinates. Using the raw,
// un-normalized vectors to compute cut-plane offsets (an early version of this
// file did exactly that) cuts at the wrong depth relative to the actual solid;
// the CSG output still LOOKS like 14 plausible pieces by count, but every
// piece loses its true outer-face triangles, which only showed up once sync
// tried to colour by face membership. Confirmed empirically in Task 6.1.
export const VERTICES = [
  new THREE.Vector3(1, 1, 1),
  new THREE.Vector3(-1, -1, 1),
  new THREE.Vector3(-1, 1, -1),
  new THREE.Vector3(1, -1, -1),
].map((v) => v.normalize())

const RADIUS = 1

// spec 7.3: for each vertex-axis (vertex -> opposite face centroid), one plane
// at 1/3 of the way (separates the tip) and one at 2/3 (separates edges from
// the axial centre). For a regular tetrahedron centred at the origin with unit
// circumradius, the face opposite vertex Vi sits at -Vi/3 (since the other 3
// vertices sum to -Vi), giving cut-plane offsets of 5/9 and 1/9 along Vi.
const TIP_PLANE_OFFSET = (5 / 9) * RADIUS
const AXIAL_PLANE_OFFSET = (1 / 9) * RADIUS
const FACE_OFFSET = (1 / 3) * RADIUS

export const OUTER_FACES: OuterFace[] = VERTICES.map((v, i) => ({
  id: `F${i}`,
  normal: v.clone().multiplyScalar(-1),
  offset: FACE_OFFSET,
}))
export const INTERIOR_GROUP = OUTER_FACES.length

function pyraminxPlanes() {
  return VERTICES.flatMap((v) => [
    { normal: v, offset: TIP_PLANE_OFFSET },
    { normal: v, offset: AXIAL_PLANE_OFFSET },
  ])
}

export type PyraminxKind = 'tip' | 'axial' | 'edge'
export interface PyraminxSlot {
  kind: PyraminxKind
  // vertex indices this piece is associated with: 1 for tip/axial, 2 for edge.
  vertices: number[]
}

// Classifies a piece by how many vertex-axes its centroid projects positively
// onto, then (for the one-axis case) by how large that projection is.
// Verified exactly (Task 6.1 spike, corrected vertex scale): tips project
// 2/3 along their axis, axial centres 1/3, edges 2/9 on each of their two
// axes, and the hidden core ~0.037 on two axes -- close enough to "edge"'s
// projection COUNT (two positive axes) that POSITIVE_EPS must clear it, and
// far enough below a real edge's 2/9 that the margin is comfortable.
const POSITIVE_EPS = 0.1
const TIP_VS_AXIAL_THRESHOLD = 0.5 // exactly between tips' 2/3 and axials' 1/3

export function classifyPyraminxPiece(centroid: THREE.Vector3): PyraminxSlot | null {
  const projections = VERTICES.map((v) => centroid.dot(v))
  const positive = projections.map((p, i) => ({ p, i })).filter(({ p }) => p > POSITIVE_EPS)

  if (positive.length === 0) return null // hidden core
  if (positive.length === 1) {
    const { p, i } = positive[0]
    return p > TIP_VS_AXIAL_THRESHOLD ? { kind: 'tip', vertices: [i] } : { kind: 'axial', vertices: [i] }
  }
  if (positive.length === 2) {
    return { kind: 'edge', vertices: positive.map((x) => x.i).sort() }
  }
  return null
}

export function pyraminxSlotId(slot: PyraminxSlot): string {
  return `pyraminx-${slot.kind}-${slot.vertices.join('_')}`
}

// spec 11.1: 4 solid face colours, no white.
export const PYRAMINX_COLORS: Record<string, string> = {
  F0: '#009E60', // green
  F1: '#C41E3A', // red
  F2: '#0051BA', // blue
  F3: '#FFD500', // yellow
}

let cached: PuzzleMesh | null = null

export function buildPyraminxGeometry(): PuzzleMesh {
  if (cached) return cached
  const tet = new THREE.TetrahedronGeometry(RADIUS)
  const cells = cutSolidByPlanes(tet, pyraminxPlanes())

  const pieces: PieceMesh[] = []
  for (const cell of cells) {
    const centroid = centroidOf(cell)
    const slot = classifyPyraminxPiece(centroid)
    if (!slot) continue // hidden core, invisible
    pieces.push({
      pieceId: pyraminxSlotId(slot),
      geometry: assignFaceGroups(cell, OUTER_FACES),
      slot: [centroid.x, centroid.y, centroid.z],
    })
  }

  cached = { pieces }
  return cached
}
