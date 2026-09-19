import * as THREE from 'three'
import { centroidOf, cutSolidByPlanes, type CutPlane } from '../../geometry/csgBuilder'
import type { PieceMesh, PuzzleMesh } from '../PuzzlePlugin'

export const CUBE_SIZE = 3
const HALF = CUBE_SIZE / 2
const EPS = 1e-4

// Render/material order. Index 6 is the unstickered plastic interior.
export const FACE_ORDER = ['U', 'D', 'F', 'B', 'R', 'L'] as const
export type Face = (typeof FACE_ORDER)[number]
export const INNER_GROUP = 6

// x = right (R+), y = up (U+), z = front (F+)
export const FACE_NORMALS: Record<Face, THREE.Vector3> = {
  U: new THREE.Vector3(0, 1, 0),
  D: new THREE.Vector3(0, -1, 0),
  F: new THREE.Vector3(0, 0, 1),
  B: new THREE.Vector3(0, 0, -1),
  R: new THREE.Vector3(1, 0, 0),
  L: new THREE.Vector3(-1, 0, 0),
}

// spec 11.1 -- physically accurate WCA scheme so skills transfer to a real cube.
export const CUBE3_COLORS: Record<Face, string> = {
  U: '#FFFFFF',
  D: '#FFD500',
  F: '#009E60',
  B: '#0051BA',
  R: '#C41E3A',
  // Was #FF5800 (hue ~21deg, right next to red's ~350deg) -- a real user
  // report that orange read as basically the same colour as red. Moved to a
  // hue further round the wheel (~29deg) while staying just as saturated.
  L: '#FF8A00',
}

function cube3Planes(): CutPlane[] {
  const axes = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
  ]
  // 2 planes per axis -> 3 slabs per axis -> 27 cells (spec 7.3).
  return axes.flatMap((normal) => [
    { normal, offset: -0.5 },
    { normal, offset: 0.5 },
  ])
}

// Which outer face a point lies on, or null for an interior point.
function faceAt(p: THREE.Vector3): Face | null {
  for (const face of FACE_ORDER) {
    const n = FACE_NORMALS[face]
    const along = p.x * n.x + p.y * n.y + p.z * n.z
    if (Math.abs(along - HALF) < EPS) return face
  }
  return null
}

export function slotOf(geo: THREE.BufferGeometry): [number, number, number] {
  const c = centroidOf(geo)
  const q = (v: number) => (Math.abs(v) < 0.25 ? 0 : v > 0 ? 1 : -1)
  return [q(c.x), q(c.y), q(c.z)]
}

export function slotId(slot: [number, number, number]): string {
  return `cube3-slot-${slot[0]}_${slot[1]}_${slot[2]}`
}

// Which outer faces this cubie shows stickers on, derived from its slot.
export function facesOfSlot(slot: [number, number, number]): Face[] {
  const faces: Face[] = []
  if (slot[1] === 1) faces.push('U')
  if (slot[1] === -1) faces.push('D')
  if (slot[2] === 1) faces.push('F')
  if (slot[2] === -1) faces.push('B')
  if (slot[0] === 1) faces.push('R')
  if (slot[0] === -1) faces.push('L')
  return faces
}

// Sorts triangles into one material group per outer face plus an interior group,
// so a piece can be drawn with an array of 7 materials and coloured per face.
export function assignFaceGroups(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geo = source.index ? source.toNonIndexed() : source.clone()
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const triangleCount = pos.count / 3

  const buckets: number[][] = FACE_ORDER.map(() => [])
  buckets.push([]) // interior

  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const centroid = new THREE.Vector3()
  for (let t = 0; t < triangleCount; t++) {
    a.fromBufferAttribute(pos, t * 3)
    b.fromBufferAttribute(pos, t * 3 + 1)
    c.fromBufferAttribute(pos, t * 3 + 2)
    // Classify by the triangle's centroid, not its vertices: a sticker triangle
    // on a corner cubie has vertices sitting on the shared edge of two faces, so
    // a per-vertex test matches whichever face is checked first and mislabels it.
    // The centroid of a face triangle lies strictly inside exactly one face.
    centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3)
    const face = faceAt(centroid)
    const group = face === null ? INNER_GROUP : FACE_ORDER.indexOf(face)
    buckets[group].push(t)
  }

  const attrs = Object.keys(geo.attributes)
  const reordered = new THREE.BufferGeometry()
  const order = buckets.flat()
  for (const name of attrs) {
    const src = geo.getAttribute(name) as THREE.BufferAttribute
    const itemSize = src.itemSize
    const out = new Float32Array(order.length * 3 * itemSize)
    order.forEach((t, i) => {
      for (let v = 0; v < 3; v++) {
        for (let k = 0; k < itemSize; k++) {
          out[(i * 3 + v) * itemSize + k] = src.array[(t * 3 + v) * itemSize + k] as number
        }
      }
    })
    reordered.setAttribute(name, new THREE.BufferAttribute(out, itemSize))
  }

  let start = 0
  buckets.forEach((bucket, groupIndex) => {
    reordered.addGroup(start, bucket.length * 3, groupIndex)
    start += bucket.length * 3
  })
  reordered.computeVertexNormals()
  return reordered
}

let cached: PuzzleMesh | null = null

// CSG runs once per puzzle type and is cached for the session (spec 12.1) --
// moves only rotate existing pieces, they never re-cut geometry.
export function buildCube3Geometry(): PuzzleMesh {
  if (cached) return cached

  const box = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE)
  const cells = cutSolidByPlanes(box, cube3Planes())

  const pieces: PieceMesh[] = []
  for (const cell of cells) {
    const slot = slotOf(cell)
    // Drop the fully interior core: the one cell with no outer face (spec 7.3).
    if (slot[0] === 0 && slot[1] === 0 && slot[2] === 0) continue
    pieces.push({ pieceId: slotId(slot), geometry: assignFaceGroups(cell), slot })
  }

  cached = { pieces }
  return cached
}
