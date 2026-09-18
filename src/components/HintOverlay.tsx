import { useMemo } from 'react'
import * as THREE from 'three'

// A ghost arrow indicating the next move's axis/direction (spec 7.1/9.1),
// rendered as a Three.js primitive inside the puzzle's own <Canvas>.

export interface HintArrowProps {
  axis: string
  direction: 1 | -1
}

const AXIS_VECTORS: Record<string, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
}

export function HintOverlay({ axis, direction }: HintArrowProps) {
  const dir = useMemo(() => {
    const base = AXIS_VECTORS[axis] ?? AXIS_VECTORS.y
    return base.clone().multiplyScalar(direction)
  }, [axis, direction])

  const origin = useMemo(() => dir.clone().multiplyScalar(2.4), [dir])
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
    [dir],
  )

  return (
    <group position={origin} quaternion={quaternion} data-testid="hint-overlay">
      <mesh position={[0, 0.3, 0]}>
        <coneGeometry args={[0.25, 0.5, 12]} />
        <meshStandardMaterial color="#00D4FF" emissive="#00D4FF" emissiveIntensity={0.6} transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.6, 8]} />
        <meshStandardMaterial color="#00D4FF" emissive="#00D4FF" emissiveIntensity={0.6} transparent opacity={0.85} />
      </mesh>
    </group>
  )
}
