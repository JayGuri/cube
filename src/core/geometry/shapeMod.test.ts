import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { makeCubeToTetRemapper, type RadialFace } from './shapeMod'

const HALF = 1.5
const R = 2.6

const tetVertexDirs = [
  new THREE.Vector3(1, 1, 1),
  new THREE.Vector3(-1, -1, 1),
  new THREE.Vector3(-1, 1, -1),
  new THREE.Vector3(1, -1, -1),
].map((v) => v.normalize())

const tetFaces: RadialFace[] = tetVertexDirs.map((v) => ({
  normal: v.clone().multiplyScalar(-1),
  offset: R / 3,
}))

const evenCorners = tetVertexDirs.map((v) => v.clone().multiplyScalar(HALF * Math.sqrt(3)))
const oddCorners = [
  new THREE.Vector3(-1, 1, 1),
  new THREE.Vector3(1, -1, 1),
  new THREE.Vector3(1, 1, -1),
  new THREE.Vector3(-1, -1, -1),
].map((v) => v.normalize().multiplyScalar(HALF * Math.sqrt(3)))

const tetVertices = tetVertexDirs.map((v) => v.clone().multiplyScalar(R))
const tetFaceCentroids = tetVertices.map((v) => v.clone().multiplyScalar(-1 / 3))

describe('cube-to-tetrahedron radial remap', () => {
  const remap = makeCubeToTetRemapper(HALF, tetFaces)

  it('maps each of the 4 alternating cube corners exactly onto a tetrahedron vertex', () => {
    for (const corner of evenCorners) {
      const mapped = remap(corner)
      const distances = tetVertices.map((v) => mapped.distanceTo(v))
      expect(Math.min(...distances)).toBeLessThan(1e-6)
    }
  })

  it('maps each of the OTHER 4 cube corners exactly onto a tetrahedron face centroid', () => {
    for (const corner of oddCorners) {
      const mapped = remap(corner)
      const distances = tetFaceCentroids.map((c) => mapped.distanceTo(c))
      expect(Math.min(...distances)).toBeLessThan(1e-6)
    }
  })

  it('maps the cube centre to the tetrahedron centre (both at the origin)', () => {
    expect(remap(new THREE.Vector3(0, 0, 0)).length()).toBe(0)
  })

  it('preserves relative depth: a point halfway to the cube surface lands halfway to the tet surface', () => {
    const halfway = evenCorners[0].clone().multiplyScalar(0.5)
    const mapped = remap(halfway)
    expect(mapped.length()).toBeCloseTo(tetVertices[0].length() * 0.5, 5)
  })

  it('does not collapse two distinct points on the same ray onto each other', () => {
    const near = evenCorners[0].clone().multiplyScalar(0.3)
    const far = evenCorners[0].clone().multiplyScalar(0.9)
    expect(remap(near).distanceTo(remap(far))).toBeGreaterThan(0.1)
  })
})
