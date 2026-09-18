import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { moveFromDrag, type Axis, type DragInput } from '../core/gestures/MouseDragAdapter'
import {
  createControllerState,
  DEFAULT_PROFILE,
  handleIntent,
  intentFromGestureEvent,
  type ControllerState,
} from '../core/gestures/InteractionController'
import type { GestureTick } from '../core/gestures/useHandGestures'
import { applyColorblindPaletteToColors } from '../core/puzzles/colorblindPalette'
import type { GestureProfile, Move, PuzzleMesh, PuzzlePlugin, PuzzleState } from '../core/puzzles/PuzzlePlugin'
import { HintOverlay, type HintArrowProps } from './HintOverlay'

const PLASTIC = '#14161F'
const HIGHLIGHT = '#00D4FF'

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
  gestureTick?: GestureTick | null
  gestureProfile?: GestureProfile
  highlightedSlot?: [number, number, number] | null
  setHighlightedSlot?: (slot: [number, number, number] | null) => void
  colorblindPalette?: boolean
}

function Pieces({
  plugin,
  mesh,
  state,
  onMove,
  interactive,
  setOrbitEnabled,
  gestureTick,
  gestureProfile,
  highlightedSlot,
  setHighlightedSlot,
  colorblindPalette,
}: PiecesProps) {
  const { camera, scene } = useThree()
  // Material group order is derived from the plugin's own colorScheme keys,
  // not a hardcoded cube3 face list -- assignFaceGroups() (per-puzzle
  // geometry.ts) always numbers groups 0..N-1 in this same key order, with N
  // the trailing interior/plastic group, so this works unchanged for any
  // puzzle's face count.
  const faceKeys = useMemo(() => Object.keys(plugin.colorScheme), [plugin])
  const innerGroup = faceKeys.length
  const colors = useMemo(() => {
    const raw = plugin.faceletColors(state)
    if (!colorblindPalette) return raw
    const out = new Map<string, Record<string, string>>()
    for (const [id, faceColors] of raw) out.set(id, applyColorblindPaletteToColors(faceColors))
    return out
  }, [plugin, state, colorblindPalette])
  const drag = useRef<DragStart | null>(null)
  const controllerState = useRef<ControllerState>(createControllerState())
  const lastSeq = useRef(-1)
  const raycaster = useRef(new THREE.Raycaster())

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

  // Task 4.5: raycast from the gesture cursor and route FSM events through the
  // same InteractionController the mouse path informally mirrors, so both
  // input paths commit through the same move semantics.
  useEffect(() => {
    if (!gestureTick || !interactive || gestureTick.seq === lastSeq.current) return
    lastSeq.current = gestureTick.seq
    const profile = { ...DEFAULT_PROFILE, ...gestureProfile }

    for (const event of gestureTick.events) {
      let hit: { slot: [number, number, number]; hitNormal: [number, number, number] } | null = null
      if (gestureTick.cursor && (event.type === 'GRAB' || event.type === 'ANCHOR_HOLD')) {
        const ndc = new THREE.Vector2(gestureTick.cursor.x * 2 - 1, -(gestureTick.cursor.y * 2 - 1))
        raycaster.current.setFromCamera(ndc, camera)
        const intersections = raycaster.current.intersectObjects(scene.children, true)
        const first = intersections.find((i) => i.object.userData?.slot)
        if (first) {
          const n = first.face?.normal
          hit = {
            slot: first.object.userData.slot,
            hitNormal: n ? [Math.round(n.x), Math.round(n.y), Math.round(n.z)] : [0, 1, 0],
          }
        }
      }

      const intent = intentFromGestureEvent(event, {
        slot: hit?.slot ?? [0, 0, 0],
        hitNormal: hit?.hitNormal ?? [0, 1, 0],
        atMs: gestureTick.seq,
      })
      if (!intent) continue
      // A GRAB with no raycast hit under the fingertip must not silently grab
      // whatever the controller was last pointed at.
      if (intent.kind === 'GRAB' && !hit) continue

      const result = handleIntent(controllerState.current, intent, profile)
      controllerState.current = result.nextState
      for (const ev of result.events) {
        if (ev.type === 'MOVE') onMove(ev.move)
        if (ev.type === 'HIGHLIGHT') setHighlightedSlot?.(ev.slot)
        if (ev.type === 'CLEAR_HIGHLIGHT') setHighlightedSlot?.(null)
      }
    }
  }, [gestureTick, interactive, camera, scene, onMove, gestureProfile, setHighlightedSlot])

  return (
    <group>
      {mesh.pieces.map((piece) => {
        const faceColors = colors.get(piece.pieceId) ?? {}
        const isHighlighted =
          highlightedSlot &&
          highlightedSlot[0] === piece.slot[0] &&
          highlightedSlot[1] === piece.slot[1] &&
          highlightedSlot[2] === piece.slot[2]
        return (
          <mesh
            key={piece.pieceId}
            geometry={piece.geometry}
            userData={{ slot: piece.slot }}
            onPointerDown={(e) => handleDown(e, piece.slot)}
          >
            {faceKeys.map((face, i) => (
              <meshStandardMaterial
                key={face}
                attach={`material-${i}`}
                color={faceColors[face] ?? PLASTIC}
                emissive={isHighlighted ? HIGHLIGHT : '#000000'}
                emissiveIntensity={isHighlighted ? 0.4 : 0}
                roughness={0.35}
                metalness={0.05}
              />
            ))}
            <meshStandardMaterial
              attach={`material-${innerGroup}`}
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
  // Task 4.5: live gesture events + cursor, from useHandGestures.
  gestureTick?: GestureTick | null
  gestureProfile?: GestureProfile
  hintArrow?: HintArrowProps | null
  colorblindPalette?: boolean
}

export function PuzzleCanvas({
  plugin,
  state,
  onMove,
  interactive = true,
  className,
  gestureTick,
  gestureProfile,
  hintArrow,
  colorblindPalette,
}: PuzzleCanvasProps) {
  const mesh = useMemo(() => plugin.buildGeometry(), [plugin])
  // Raycasting only works once the renderer exists; tests and any future
  // loading state need a real signal for that rather than a guessed delay.
  const [ready, setReady] = useState(false)
  const [highlightedSlot, setHighlightedSlot] = useState<[number, number, number] | null>(null)
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
          gestureTick={gestureTick}
          gestureProfile={gestureProfile}
          highlightedSlot={highlightedSlot}
          setHighlightedSlot={setHighlightedSlot}
          colorblindPalette={colorblindPalette}
        />
        {hintArrow && <HintOverlay axis={hintArrow.axis} direction={hintArrow.direction} />}
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
