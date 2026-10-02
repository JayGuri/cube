import * as THREE from 'three'
import type { PieceMesh, PuzzleMesh } from '../PuzzlePlugin'

// Render/material order. Index 6 is the unstickered plastic interior.
export const FACE_ORDER = ['U', 'D', 'F', 'B', 'R', 'L'] as const
export type Face = (typeof FACE_ORDER)[number]
export const INNER_GROUP = 6

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

// three.js builds a box face by face in this order, six vertices per face once
// it is made non-indexed.
const BOX_FACE_ORDER: Face[] = ['R', 'L', 'U', 'D', 'F', 'B']

/**
 * One cubie: a unit box at its slot, with its triangles sorted into one
 * material group per outer face plus an interior group, so a piece is drawn
 * with an array of 7 materials and coloured per face. Faces that point into
 * the cube go to the interior group.
 */
function cubieGeometry(slot: [number, number, number]): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed()
  const outward = new Set(facesOfSlot(slot))

  const buckets: number[][] = FACE_ORDER.map(() => [])
  buckets.push([]) // interior
  BOX_FACE_ORDER.forEach((face, i) => {
    buckets[outward.has(face) ? FACE_ORDER.indexOf(face) : INNER_GROUP].push(i)
  })

  const geo = new THREE.BufferGeometry()
  const order = buckets.flat()
  for (const name of Object.keys(box.attributes)) {
    const src = box.getAttribute(name) as THREE.BufferAttribute
    const out = new Float32Array(order.length * 6 * src.itemSize)
    order.forEach((faceIndex, i) => {
      const from = faceIndex * 6 * src.itemSize
      out.set((src.array as Float32Array).subarray(from, from + 6 * src.itemSize), i * 6 * src.itemSize)
    })
    geo.setAttribute(name, new THREE.BufferAttribute(out, src.itemSize))
  }

  let start = 0
  buckets.forEach((bucket, groupIndex) => {
    geo.addGroup(start, bucket.length * 6, groupIndex)
    start += bucket.length * 6
  })
  geo.translate(slot[0], slot[1], slot[2])
  return geo
}

let cached: PuzzleMesh | null = null

// Built once and cached for the session: moves only rotate existing pieces,
// they never rebuild geometry.
export function buildCube3Geometry(): PuzzleMesh {
  if (cached) return cached

  const pieces: PieceMesh[] = []
  for (const x of [-1, 0, 1]) {
    for (const y of [-1, 0, 1]) {
      for (const z of [-1, 0, 1]) {
        // Skip the fully interior core: the one cell with no outer face.
        if (x === 0 && y === 0 && z === 0) continue
        const slot: [number, number, number] = [x, y, z]
        pieces.push({ pieceId: slotId(slot), geometry: cubieGeometry(slot), slot })
      }
    }
  }

  cached = { pieces }
  return cached
}
