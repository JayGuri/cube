import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { parseCubeMove } from '../core/animation/parseCubeMove'
import { moveFromDrag, AXIS_INDEX, type Axis, type DragInput } from '../core/gestures/MouseDragAdapter'
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
// Fraction of each piece's own slot distance from centre used as its visual
// gap offset (see the render loop below) -- proportional, not a fixed unit
// count, so it looks right across cube3's ~1.5-unit half-extent and
// megaminx's ~1-unit dodecahedron alike. Widened from 0.045 on user feedback
// that the seams read as too thin to feel like a real cube's black plastic.
const GAP_FRACTION = 0.075
// How long a single quarter/half turn takes to visually rotate into place.
const MOVE_DURATION_MS = 220

const AXIS_VECTOR: Record<Axis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
}
const IDENTITY_QUATERNION = new THREE.Quaternion()

// Standard ease-in-out: starts and ends the turn gently instead of snapping
// to/from a constant speed, which read as mechanical/jerky.
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

interface DragStart {
  normal: [number, number, number]
  slot: [number, number, number]
  x: number
  y: number
}

// The subset of drei's OrbitControls ref (a three-stdlib OrbitControls
// instance under the hood) that the gesture-driven camera nudge needs.
interface OrbitControlsHandle {
  enabled: boolean
  object: THREE.Camera
  target: THREE.Vector3
  update: () => void
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
  // The move currently being visually turned, or null when nothing is
  // animating. Colours stay on the PRE-move state until the rotation
  // finishes, then snap to `state` and onAnimationComplete fires -- see the
  // useFrame loop below for how the two stay in lockstep.
  animatingMove?: Move | null
  onAnimationComplete?: () => void
  // The gesture FSM's ORBIT/ZOOM events are camera-only concerns (an open
  // hand moving, or two open hands moving apart/together) -- there is no
  // puzzle Move to produce, so they bypass intentFromGestureEvent entirely
  // and nudge the camera directly, the same way OrbitControls does for mouse
  // drag/wheel.
  onGestureOrbit?: (dx: number, dy: number) => void
  onGestureZoom?: (delta: number) => void
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
  animatingMove,
  onAnimationComplete,
  onGestureOrbit,
  onGestureZoom,
}: PiecesProps) {
  const { camera, scene } = useThree()
  // Material group order is derived from the plugin's own colorScheme keys,
  // not a hardcoded cube3 face list -- assignFaceGroups() (per-puzzle
  // geometry.ts) always numbers groups 0..N-1 in this same key order, with N
  // the trailing interior/plastic group, so this works unchanged for any
  // puzzle's face count.
  const faceKeys = useMemo(() => Object.keys(plugin.colorScheme), [plugin])
  const innerGroup = faceKeys.length

  // Colours are computed from `colorState`, not the live `state` prop
  // directly: while a move animates, `state` has already flipped (the store
  // updates synchronously) but the pieces must keep showing the PRE-move
  // colours until the rotation finishes, or the sticker pattern would jump to
  // its final arrangement before the pieces visually got there.
  const [colorState, setColorState] = useState(state)
  const stateRef = useRef(state)
  stateRef.current = state
  const onAnimationCompleteRef = useRef(onAnimationComplete)
  onAnimationCompleteRef.current = onAnimationComplete

  // Any state change NOT accompanied by an animatingMove (Reset, Undo, a
  // scramble jump, switching puzzles) has nothing to animate toward, so it
  // must be reflected immediately rather than waiting for a rotation that
  // will never start.
  useEffect(() => {
    if (!animatingMove) setColorState(state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mesh])

  const colors = useMemo(() => {
    const raw = plugin.faceletColors(colorState)
    if (!colorblindPalette) return raw
    const out = new Map<string, Record<string, string>>()
    for (const [id, faceColors] of raw) out.set(id, applyColorblindPaletteToColors(faceColors))
    return out
  }, [plugin, colorState, colorblindPalette])

  const pieceGroupRefs = useRef(new Map<string, THREE.Group>())
  const activeAnim = useRef<{ axis: Axis; layer: -1 | 0 | 1; angle: number; startedAt: number } | null>(null)
  const piecesById = useMemo(() => new Map(mesh.pieces.map((p) => [p.pieceId, p])), [mesh])

  // A NEW animatingMove means a move just landed in the store. Figure out
  // whether it is one this renderer knows how to visually turn (cube3 and
  // mastermorphix's shared R/L/U/D/F/B/M/E/S notation); anything else (the
  // other four puzzles have their own notations) snaps instantly, same as
  // before animation existed at all.
  //
  // handledMoveRef guards against React StrictMode's dev-only double-invoke
  // of effects: without it, the same `animatingMove` object started this
  // effect twice, and for puzzles with no animation (parsed === null) that
  // fired onAnimationComplete twice for one move -- the second, spurious
  // call resolved the QUEUE's promise for whichever move had since become
  // current, letting the solve loop race ahead and re-run stale moves.
  // Confirmed by megaminx's solve applying 117 moves instead of the expected
  // 26 in an E2E run, only under the dev server (StrictMode is dev-only).
  const handledMoveRef = useRef<Move | null>(null)
  useEffect(() => {
    if (!animatingMove || handledMoveRef.current === animatingMove) return
    handledMoveRef.current = animatingMove
    const parsed = parseCubeMove(animatingMove.alg.toString())
    if (!parsed) {
      setColorState(stateRef.current)
      onAnimationCompleteRef.current?.()
      return
    }
    activeAnim.current = { ...parsed, startedAt: performance.now() }
  }, [animatingMove])

  useFrame(() => {
    const anim = activeAnim.current
    if (!anim) return
    const t = Math.min(1, (performance.now() - anim.startedAt) / MOVE_DURATION_MS)
    const angle = anim.angle * easeInOutQuad(t)
    const axisVector = AXIS_VECTOR[anim.axis]
    const axisIdx = AXIS_INDEX[anim.axis]
    for (const [pieceId, group] of pieceGroupRefs.current) {
      const piece = piecesById.get(pieceId)
      const inLayer = piece && piece.slot[axisIdx] === anim.layer
      if (inLayer) group.quaternion.setFromAxisAngle(axisVector, angle)
      else if (!group.quaternion.equals(IDENTITY_QUATERNION)) group.quaternion.identity()
    }
    if (t >= 1) {
      activeAnim.current = null
      for (const group of pieceGroupRefs.current.values()) group.quaternion.identity()
      setColorState(stateRef.current)
      onAnimationCompleteRef.current?.()
    }
  })

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
    // Only the left/primary button turns a layer; right-button drags are left
    // alone so OrbitControls (mouseButtons.RIGHT = ROTATE below) can always
    // orbit the camera no matter where the cursor lands on the puzzle.
    if (e.nativeEvent.button !== 0) return
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
      // Camera-only events never reach intentFromGestureEvent -- there is no
      // puzzle Move for "an open hand moved" or "two hands spread apart".
      if (event.type === 'ORBIT') {
        onGestureOrbit?.(event.dx, event.dy)
        continue
      }
      if (event.type === 'ZOOM') {
        onGestureZoom?.(event.delta)
        continue
      }

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
  }, [
    gestureTick,
    interactive,
    camera,
    scene,
    onMove,
    gestureProfile,
    setHighlightedSlot,
    onGestureOrbit,
    onGestureZoom,
  ])

  return (
    <group>
      {mesh.pieces.map((piece) => {
        const faceColors = colors.get(piece.pieceId) ?? {}
        const isHighlighted =
          highlightedSlot &&
          highlightedSlot[0] === piece.slot[0] &&
          highlightedSlot[1] === piece.slot[1] &&
          highlightedSlot[2] === piece.slot[2]
        // A solved face is one uniform colour with no gap between cubies, so
        // it renders as a single solid block and the puzzle reads as static
        // plastic rather than a twisty puzzle. Nudging each piece slightly
        // outward along its own slot direction (proportional to the puzzle's
        // own scale, not a fixed constant) reveals real seams between pieces
        // without needing any puzzle-specific axis knowledge.
        const gapOffset = piece.slot.map((v) => v * GAP_FRACTION) as [number, number, number]
        return (
          <group
            key={piece.pieceId}
            position={gapOffset}
            ref={(el) => {
              if (el) pieceGroupRefs.current.set(piece.pieceId, el)
              else pieceGroupRefs.current.delete(piece.pieceId)
            }}
          >
            <mesh
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
          </group>
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
  // The move currently animating and a callback for when it finishes turning
  // (see Pieces above). Callers that don't pass these (Academy, the
  // AlgorithmTrainer preview) just keep today's instant-snap behaviour.
  animatingMove?: Move | null
  onAnimationComplete?: () => void
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
  animatingMove,
  onAnimationComplete,
}: PuzzleCanvasProps) {
  const mesh = useMemo(() => plugin.buildGeometry(), [plugin])
  // The camera is framed for cube3's ~2.6-unit half-diagonal. Pyraminx and
  // Megaminx use a unit-radius base solid, so without this they rendered at
  // barely a third of cube3's on-screen size -- confirmed by screenshot, not
  // a theoretical concern. Normalising every puzzle's overall extent to the
  // same target radius keeps one fixed camera framing working for all five.
  const scale = useMemo(() => {
    const box = new THREE.Box3()
    for (const piece of mesh.pieces) {
      piece.geometry.computeBoundingBox()
      if (piece.geometry.boundingBox) box.union(piece.geometry.boundingBox)
    }
    const size = box.getSize(new THREE.Vector3())
    const radius = size.length() / 2
    const TARGET_RADIUS = 2.6 // cube3's own natural half-diagonal
    return radius > 1e-6 ? TARGET_RADIUS / radius : 1
  }, [mesh])
  // Raycasting only works once the renderer exists; tests and any future
  // loading state need a real signal for that rather than a guessed delay.
  const [ready, setReady] = useState(false)
  const [highlightedSlot, setHighlightedSlot] = useState<[number, number, number] | null>(null)
  const controls = useRef<OrbitControlsHandle | null>(null)
  const setOrbitEnabled = (enabled: boolean) => {
    if (controls.current) controls.current.enabled = enabled
  }

  // Mouse orbit/zoom are handled by OrbitControls itself (pointer/wheel
  // events on the canvas). The gesture FSM's ORBIT/ZOOM events have no DOM
  // pointer to synthesize, so they nudge the same camera directly -- same
  // spherical-coordinate approach OrbitControls uses internally, clamped to
  // the same polar/distance limits so a hand can never flip the camera
  // upside down or fly through the puzzle. `dx`/`dy`/`delta` are per-frame
  // deltas in the gesture's normalised [0,1] hand-tracking space, not
  // screen pixels, so the sensitivity constants below are a reasonable
  // starting point tuned by feel rather than measured against a real
  // camera -- if hand-orbit feels too twitchy or too sluggish once someone
  // can actually test it live, these are the two numbers to adjust.
  const nudgeOrbit = (dx: number, dy: number) => {
    const ctrl = controls.current
    if (!ctrl) return
    const ORBIT_SENSITIVITY = 6
    const MIN_POLAR = 0.15
    const MAX_POLAR = Math.PI - 0.15
    const offset = ctrl.object.position.clone().sub(ctrl.target)
    const spherical = new THREE.Spherical().setFromVector3(offset)
    spherical.theta -= dx * ORBIT_SENSITIVITY
    spherical.phi = Math.max(MIN_POLAR, Math.min(MAX_POLAR, spherical.phi - dy * ORBIT_SENSITIVITY))
    offset.setFromSpherical(spherical)
    ctrl.object.position.copy(ctrl.target).add(offset)
    ctrl.object.lookAt(ctrl.target)
    ctrl.update()
  }

  const nudgeZoom = (delta: number) => {
    const ctrl = controls.current
    if (!ctrl) return
    const ZOOM_SENSITIVITY = 40
    const offset = ctrl.object.position.clone().sub(ctrl.target)
    const spherical = new THREE.Spherical().setFromVector3(offset)
    spherical.radius = Math.max(6, Math.min(16, spherical.radius - delta * ZOOM_SENSITIVITY))
    offset.setFromSpherical(spherical)
    ctrl.object.position.copy(ctrl.target).add(offset)
    ctrl.update()
  }

  return (
    <div
      className={className}
      data-testid="puzzle-canvas"
      data-ready={ready ? "true" : "false"}
      // Right-drag orbits the camera (OrbitControls mouseButtons.RIGHT below)
      // no matter where it starts, but the browser's native context menu
      // popping up mid-drag interrupted that -- confirmed by a user report of
      // camera rotation getting "stuck" partway through. Suppressing it here
      // is what actually makes right-drag orbit reliable.
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        camera={{ position: [5.5, 5, 6.5], fov: 40 }}
        dpr={[1, 2]}
        onCreated={() => setReady(true)}
      >
        <color attach="background" args={['#0F1117']} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[6, 8, 5]} intensity={1.1} />
        <directionalLight position={[-6, -4, -5]} intensity={0.35} />
        <group scale={scale}>
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
            animatingMove={animatingMove}
            onAnimationComplete={onAnimationComplete}
            onGestureOrbit={nudgeOrbit}
            onGestureZoom={nudgeZoom}
          />
          {hintArrow && <HintOverlay axis={hintArrow.axis} direction={hintArrow.direction} />}
        </group>
        <OrbitControls
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={controls as any}
          enablePan={false}
          minDistance={6}
          maxDistance={16}
          // Left orbits from empty space (pieces intercept left-drags to turn
          // a layer instead); right always orbits regardless of what's under
          // the cursor, so the camera is never stuck because a piece is there.
          mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        />
      </Canvas>
    </div>
  )
}
