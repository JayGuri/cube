import * as THREE from 'three'

// Task 7.1/7.4: cube-to-tetrahedron shape-mod for Mastermorphix.
//
// An early version of this file used a single affine (barycentric) map from
// the cube's 4 alternating corners to the tetrahedron's 4 vertices. That maps
// the FIRST 4 corners correctly, but a cube's symmetry group (48 elements) is
// strictly larger than a regular tetrahedron's (24), so no single affine map
// can ALSO send the cube's other 4 corners onto the tetrahedron's 4 face
// centroids -- verified by direct computation, not just an implementation
// bug (see the test file's history).
//
// This uses a fraction-preserving RADIAL remap instead: for a point p, find
// how far along its own direction from the origin it sits relative to the
// CUBE's boundary in that direction (fraction f, with f=1 exactly on the
// cube's surface), then place it at that same fraction f along the
// TETRAHEDRON's boundary in that direction. This is verified (below and in
// the test) to send the cube's 4 "even" corners exactly onto the
// tetrahedron's 4 vertices AND its 4 "odd" corners exactly onto the
// tetrahedron's 4 face centroids, while leaving every other point (cut-plane
// vertices, edge midpoints) mapped smoothly and continuously -- no point off
// the cube's own outer surface collapses onto another, since depth along the
// ray is preserved as a fraction, not discarded.

export interface RadialFace {
  normal: THREE.Vector3
  offset: number
}

function cubeSurfaceDistance(dir: THREE.Vector3, half: number): number {
  const maxComp = Math.max(Math.abs(dir.x), Math.abs(dir.y), Math.abs(dir.z))
  return half / maxComp
}

function tetSurfaceDistance(dir: THREE.Vector3, faces: RadialFace[]): number {
  let best = Infinity
  for (const f of faces) {
    const d = dir.dot(f.normal)
    if (d > 1e-9) best = Math.min(best, f.offset / d)
  }
  return best
}

export function makeCubeToTetRemapper(
  cubeHalfExtent: number,
  tetFaces: RadialFace[],
): (p: THREE.Vector3) => THREE.Vector3 {
  return (p: THREE.Vector3) => {
    const r = p.length()
    if (r < 1e-9) return new THREE.Vector3(0, 0, 0)
    const dir = p.clone().divideScalar(r)
    const cubeR = cubeSurfaceDistance(dir, cubeHalfExtent)
    const tetR = tetSurfaceDistance(dir, tetFaces)
    return dir.multiplyScalar((r / cubeR) * tetR)
  }
}

/**
 * Splits every triangle into 4 by midpoint subdivision, `iterations` times,
 * preserving each triangle's material group.
 *
 * This exists because remapGeometry only moves EXISTING vertices: a large
 * flat triangle (a cube3 centre piece's face, say) has a genuinely CURVED
 * image under the radial remap below, but linearly connecting its 3 already-
 * remapped corners approximates that curve so poorly for a coarse mesh that
 * adjacent pieces visibly overlap and self-intersect -- confirmed by
 * screenshot inspection, not a theoretical concern (the piece-count and
 * bounding-box tests in geometry.test.ts don't catch it, since they never
 * check watertightness). Subdividing first, then remapping each of the many
 * small resulting triangles, keeps every triangle's linear-interpolation
 * error small enough that the curve reads as smooth.
 */
export function subdivideTriangles(geometry: THREE.BufferGeometry, iterations: number): THREE.BufferGeometry {
  let geo = geometry.index ? geometry.toNonIndexed() : geometry.clone()

  for (let iter = 0; iter < iterations; iter++) {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const triCount = pos.count / 3
    const nextPositions = new Float32Array(triCount * 4 * 3 * 3)
    const groups = geo.groups.length > 0 ? geo.groups : [{ start: 0, count: pos.count, materialIndex: 0 }]
    const nextGroups: { start: number; count: number; materialIndex: number }[] = []

    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const c = new THREE.Vector3()
    let writeVert = 0

    for (const group of groups) {
      const groupStart = writeVert
      const startTri = group.start / 3
      const triInGroup = group.count / 3
      for (let t = 0; t < triInGroup; t++) {
        const base = (startTri + t) * 3
        a.fromBufferAttribute(pos, base)
        b.fromBufferAttribute(pos, base + 1)
        c.fromBufferAttribute(pos, base + 2)
        const ab = a.clone().add(b).multiplyScalar(0.5)
        const bc = b.clone().add(c).multiplyScalar(0.5)
        const ca = c.clone().add(a).multiplyScalar(0.5)
        // 4 sub-triangles: 3 corners + 1 centre, standard midpoint split.
        const subTris = [
          [a, ab, ca],
          [ab, b, bc],
          [ca, bc, c],
          [ab, bc, ca],
        ]
        for (const tri of subTris) {
          for (const v of tri) {
            nextPositions[writeVert * 3] = v.x
            nextPositions[writeVert * 3 + 1] = v.y
            nextPositions[writeVert * 3 + 2] = v.z
            writeVert++
          }
        }
      }
      nextGroups.push({ start: groupStart, count: writeVert - groupStart, materialIndex: group.materialIndex ?? 0 })
    }

    const next = new THREE.BufferGeometry()
    next.setAttribute('position', new THREE.BufferAttribute(nextPositions.subarray(0, writeVert * 3), 3))
    for (const g of nextGroups) next.addGroup(g.start, g.count, g.materialIndex)
    geo = next
  }

  return geo
}

/** Applies `remap` to every vertex of `geometry`, returning a new geometry (positions only; normals recomputed). */
export function remapGeometry(
  geometry: THREE.BufferGeometry,
  remap: (p: THREE.Vector3) => THREE.Vector3,
): THREE.BufferGeometry {
  const out = geometry.clone()
  const pos = out.getAttribute('position') as THREE.BufferAttribute
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    const mapped = remap(p)
    pos.setXYZ(i, mapped.x, mapped.y, mapped.z)
  }
  pos.needsUpdate = true
  out.computeVertexNormals()
  return out
}
