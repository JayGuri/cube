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
