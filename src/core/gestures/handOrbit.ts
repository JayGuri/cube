import * as THREE from 'three'

// Turning the camera around the cube from an open-hand gesture.
//
// `dx`/`dy` are the hand's per-frame movement in raw camera-frame units:
// raw x DEcreases when the user moves their hand to THEIR right (the camera
// faces them), raw y increases downward. The rule, from the user's own
// perspective: the cube turns the way the hand moves -- hand right, the cube
// turns right. (An earlier sign here turned it the opposite way, confirmed by
// the user live.)

// How far the camera swings per unit of hand travel. Higher = faster orbit.
const ORBIT_SENSITIVITY = 6
// Keeps the camera from flipping over the top or bottom of the cube.
const MIN_POLAR = 0.15
const MAX_POLAR = Math.PI - 0.15

export function orbitFromHand(camera: THREE.Vector3, target: THREE.Vector3, dx: number, dy: number): THREE.Vector3 {
  const offset = camera.clone().sub(target)
  const spherical = new THREE.Spherical().setFromVector3(offset)
  spherical.theta += dx * ORBIT_SENSITIVITY
  spherical.phi = Math.max(MIN_POLAR, Math.min(MAX_POLAR, spherical.phi - dy * ORBIT_SENSITIVITY))
  offset.setFromSpherical(spherical)
  return target.clone().add(offset)
}
