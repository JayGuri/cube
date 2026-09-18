import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { centroidOf, cutSolidByPlanes } from './csgBuilder'

const AXES = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, 0, 1),
]

describe('cutSolidByPlanes', () => {
  it('one axis-aligned plane splits a box into 2 pieces', () => {
    const box = new THREE.BoxGeometry(2, 2, 2)
    const pieces = cutSolidByPlanes(box, [{ normal: new THREE.Vector3(1, 0, 0), offset: 0 }])
    expect(pieces.length).toBe(2)
  })

  it('two planes on one axis produce 3 slabs, not 4', () => {
    const box = new THREE.BoxGeometry(3, 3, 3)
    const pieces = cutSolidByPlanes(box, [
      { normal: new THREE.Vector3(1, 0, 0), offset: -0.5 },
      { normal: new THREE.Vector3(1, 0, 0), offset: 0.5 },
    ])
    expect(pieces.length).toBe(3)
  })

  it('6 planes (2 per axis) cut a 3x3x3 box into exactly 27 cells', () => {
    const box = new THREE.BoxGeometry(3, 3, 3)
    const planes = AXES.flatMap((normal) => [
      { normal, offset: -0.5 },
      { normal, offset: 0.5 },
    ])
    expect(cutSolidByPlanes(box, planes).length).toBe(27)
  })

  it('reports a sensible centroid for a cut piece', () => {
    const box = new THREE.BoxGeometry(2, 2, 2)
    const halves = cutSolidByPlanes(box, [{ normal: new THREE.Vector3(1, 0, 0), offset: 0 }])
    const xs = halves.map((g) => centroidOf(g).x).sort((p, q) => p - q)
    expect(xs[0]).toBeCloseTo(-0.5, 5)
    expect(xs[1]).toBeCloseTo(0.5, 5)
  })
})
