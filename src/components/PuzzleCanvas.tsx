import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { FACE_ORDER, INNER_GROUP } from '../core/puzzles/cube3/geometry'
import { moveFromDrag, type Axis, type DragInput } from '../core/gestures/MouseDragAdapter'
import type { Move, PuzzleMesh, PuzzlePlugin, PuzzleState } from '../core/puzzles/PuzzlePlugin'

const PLASTIC = '#14161F'

interface DragStart {
  normal: [number, number, number]
  slot: [number, number, number]
  x: number
  y: number
}

// Screen-space direction of each puzzle axis under the live camera, which is
// what turns a 2D drag into a 3D rotation axis.
function axisScreenDirs(camera: THREE.Camera): Record<Axis, [number, number]> {
  const origin = new THREE.Vector3(0, 0, 0).project(camera)
  const dirFor = (v: THREE.Vector3): [number, number] => {
    const p = v.clone().project(camera)
    // Screen y grows downward; NDC y grows upward.
    return [p.x - origin.x, -(p.y - origin.y)]
  }
  return {
    x: dirFor(new THREE.Vector3(1, 0, 0)),
    y: dirFor(new THREE.Vector3(0, 1, 0)),
    z: dirFor(new THREE.Vector3(0, 0, 1)),
  }
}

interface PiecesProps {
  plugin: PuzzlePlugin
  mesh: PuzzleMesh
  state: PuzzleState
  onMove: (move: Move | null) => void
  interactive: boolean
  setOrbitEnabled: (enabled: boolean) => void
}

function Pieces({ plugin, mesh, state, onMove, interactive, setOrbitEnabled }: PiecesProps) {
  const { camera } = useThree()
  const colors = useMemo(() => plugin.faceletColors(state), [plugin, state])
  const drag = useRef<DragStart | null>(null)

  // pointerup is bound to the window, not to the meshes: a turn drag routinely
  // ends off the piece it started on (or off the canvas entirely), and an r3f
  // pointerup only fires while the pointer is still over an object.
  useEffect(() => {
    const finish = (e: PointerEvent) => {
      const start = drag.current
      drag.current = null
      setOrbitEnabled(true)
      if (!start) return
      const input: DragInput = {
        hitNormal: start.normal,
        slot: start.slot,
        dragScreen: [e.clientX - start.x, e.clientY - start.y],
        axisScreenDirs: axisScreenDirs(camera),
      }
      onMove(moveFromDrag(input))
    }
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
  }, [camera, onMove, setOrbitEnabled])

  const handleDown = (e: ThreeEvent<PointerEvent>, slot: [number, number, number]) => {
    if (!interactive) return
    const n = e.face?.normal
    if (!n) return
    // Only the nearest piece under the cursor should start a drag, and the
    // camera must not orbit while a layer is being turned.
    e.stopPropagation()
    setOrbitEnabled(false)
    drag.current = {
      normal: [Math.round(n.x), Math.round(n.y), Math.round(n.z)],
      slot,
      x: e.nativeEvent.clientX,
      y: e.nativeEvent.clientY,
    }
  }

  return (
    <group>
      {mesh.pieces.map((piece) => {
        const faceColors = colors.get(piece.pieceId) ?? {}
        return (
          <mesh
            key={piece.pieceId}
            geometry={piece.geometry}
            onPointerDown={(e) => handleDown(e, piece.slot)}
          >
            {FACE_ORDER.map((face, i) => (
              <meshStandardMaterial
                key={face}
                attach={`material-${i}`}
                color={faceColors[face] ?? PLASTIC}
                roughness={0.35}
                metalness={0.05}
              />
            ))}
            <meshStandardMaterial
              attach={`material-${INNER_GROUP}`}
              color={PLASTIC}
              roughness={0.9}
            />
          </mesh>
        )
      })}
    </group>
  )
}

export interface PuzzleCanvasProps {
  plugin: PuzzlePlugin
  state: PuzzleState
  onMove: (move: Move | null) => void
  // Preview mode renders a still, non-interactive thumbnail.
  interactive?: boolean
  className?: string
}

export function PuzzleCanvas({
  plugin,
  state,
  onMove,
  interactive = true,
  className,
}: PuzzleCanvasProps) {
  const mesh = useMemo(() => plugin.buildGeometry(), [plugin])
  // Raycasting only works once the renderer exists; tests and any future
  // loading state need a real signal for that rather than a guessed delay.
  const [ready, setReady] = useState(false)
  const controls = useRef<{ enabled: boolean } | null>(null)
  const setOrbitEnabled = (enabled: boolean) => {
    if (controls.current) controls.current.enabled = enabled
  }

  return (
    <div className={className} data-testid="puzzle-canvas" data-ready={ready ? "true" : "false"}>
      <Canvas
        camera={{ position: [5.5, 5, 6.5], fov: 40 }}
        dpr={[1, 2]}
        onCreated={() => setReady(true)}
      >
        <color attach="background" args={['#0F1117']} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[6, 8, 5]} intensity={1.1} />
        <directionalLight position={[-6, -4, -5]} intensity={0.35} />
        <Pieces
          plugin={plugin}
          mesh={mesh}
          state={state}
          onMove={onMove}
          interactive={interactive}
          setOrbitEnabled={setOrbitEnabled}
        />
        <OrbitControls
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={controls as any}
          enablePan={false}
          minDistance={6}
          maxDistance={16}
        />
      </Canvas>
    </div>
  )
}
