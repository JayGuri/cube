import * as THREE from 'three'

// Generalizes cube3/geometry.ts's per-face material grouping (Task 1.5) to any
// solid bounded by planar outer faces -- reused by pyraminx (4 faces), skewb
// (6, same convention as cube3), and megaminx (12) rather than re-deriving the
// same triangle-classification logic per puzzle.

export interface OuterFace {
  id: string
  normal: THREE.Vector3
  offset: number
}

const PLANE_EPS = 1e-3

function faceAt(point: THREE.Vector3, faces: OuterFace[]): number | null {
  for (let i = 0; i < faces.length; i++) {
    const { normal, offset } = faces[i]
    const along = point.dot(normal)
    if (Math.abs(along - offset) < PLANE_EPS) return i
  }
  return null
}

/**
 * Sorts a geometry's triangles into one material group per outer face plus a
 * trailing "interior" group, keyed by triangle CENTROID (not vertex): a
 * corner triangle's vertices can sit on the shared edge of two faces and get
 * misclassified by a per-vertex test, but its centroid lies strictly inside
 * exactly one face (this is the same fix Task 1.5 needed for cube3's corners).
 */
export function assignFaceGroups(source: THREE.BufferGeometry, faces: OuterFace[]): THREE.BufferGeometry {
  const geo = source.index ? source.toNonIndexed() : source.clone()
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const triangleCount = pos.count / 3
  const interiorGroup = faces.length

  const buckets: number[][] = faces.map(() => [])
  buckets.push([])

  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const centroid = new THREE.Vector3()
  for (let t = 0; t < triangleCount; t++) {
    a.fromBufferAttribute(pos, t * 3)
    b.fromBufferAttribute(pos, t * 3 + 1)
    c.fromBufferAttribute(pos, t * 3 + 2)
    centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3)
    const face = faceAt(centroid, faces)
    buckets[face === null ? interiorGroup : face].push(t)
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

/** How many of a piece's material groups (excluding the trailing interior one) are non-empty. */
export function visibleFaceCount(geo: THREE.BufferGeometry, faceCount: number): number {
  return geo.groups.filter((g) => (g.materialIndex ?? faceCount) < faceCount && g.count > 0).length
}
