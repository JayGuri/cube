import { Alg } from 'cubing/alg'
import type { Move } from '../puzzles/PuzzlePlugin'
import type { Axis, DragInput } from './MouseDragAdapter'
import { moveFromDrag } from './MouseDragAdapter'
import type { GestureEvent } from './GestureRecognizer'

// One controller, several input adapters (spec 8.6). Mouse, gesture and keyboard
// all produce the SAME internal intent shape, so they cannot drift apart in
// behaviour and the cheap-to-test mouse path stands in for the gesture path in
// CI, where driving a real hand is impractical.

export type TwistAxisMode = 'screen-relative' | 'body-diagonal'
export type GrabMode = 'instant' | 'hover-then-confirm'

export interface ControllerProfile {
  snapAngleDeg: number
  twistAxisMode: TwistAxisMode
  grabMode: GrabMode
  // How long a hover stays live before a confirming pinch is too late.
  hoverConfirmWindowMs: number
}

export const DEFAULT_PROFILE: ControllerProfile = {
  snapAngleDeg: 90,
  twistAxisMode: 'screen-relative',
  grabMode: 'instant',
  hoverConfirmWindowMs: 1200,
}

// What any adapter feeds the controller.
export type InputIntent =
  | { kind: 'HOVER'; slot: [number, number, number]; hitNormal: [number, number, number]; atMs: number }
  | {
      kind: 'GRAB'
      slot: [number, number, number]
      hitNormal: [number, number, number]
      atMs: number
    }
  | { kind: 'TWIST'; totalAngle: number }
  | { kind: 'RELEASE'; atMs: number }
  | { kind: 'DRAG'; drag: DragInput }
  | { kind: 'UNDO' }
  | { kind: 'CANCEL' }

export type ControllerEvent =
  | { type: 'HIGHLIGHT'; slot: [number, number, number] }
  | { type: 'CLEAR_HIGHLIGHT' }
  | { type: 'PREVIEW'; angle: number }
  | { type: 'MOVE'; move: Move }
  | { type: 'UNDO' }

export interface ControllerState {
  grabbed: { slot: [number, number, number]; hitNormal: [number, number, number] } | null
  hovered: { slot: [number, number, number]; hitNormal: [number, number, number]; atMs: number } | null
  twistAngle: number
}

export function createControllerState(): ControllerState {
  return { grabbed: null, hovered: null, twistAngle: 0 }
}

const AXES: Axis[] = ['x', 'y', 'z']
const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 }
const FACE_FOR: Record<Axis, { positive: string; negative: string }> = {
  x: { positive: 'R', negative: 'L' },
  y: { positive: 'U', negative: 'D' },
  z: { positive: 'F', negative: 'B' },
}

/**
 * Rotation axis for a twist.
 *
 * "screen-relative" turns the layer whose axis is the grabbed face's normal,
 * which is what a 3x3 or pyraminx wants. "body-diagonal" (skewb, spec 8.5)
 * instead turns about the diagonal running through the grabbed corner, so the
 * axis comes from the piece's position rather than from the camera.
 */
export function twistAxisFor(
  mode: TwistAxisMode,
  slot: [number, number, number],
  hitNormal: [number, number, number],
): [number, number, number] {
  if (mode === 'body-diagonal') {
    const norm = Math.hypot(...slot) || 1
    return [slot[0] / norm, slot[1] / norm, slot[2] / norm]
  }
  return hitNormal
}

function moveFromTwist(
  slot: [number, number, number],
  hitNormal: [number, number, number],
  totalAngle: number,
  profile: ControllerProfile,
): Move | null {
  const steps = Math.round(totalAngle / profile.snapAngleDeg)
  if (steps === 0) return null

  const axisVector = twistAxisFor(profile.twistAxisMode, slot, hitNormal)
  const absolute = axisVector.map(Math.abs)
  const axis = AXES[absolute.indexOf(Math.max(...absolute))]
  const layer = slot[AXIS_INDEX[axis]]
  if (layer === 0) return null // slice turns are the mouse adapter's business

  const letter = FACE_FOR[axis][layer > 0 ? 'positive' : 'negative']
  const turns = ((steps % 4) + 4) % 4
  if (turns === 0) return null

  const notation = turns === 1 ? letter : turns === 2 ? `${letter}2` : `${letter}'`
  return { alg: new Alg(notation), snapAngleDeg: profile.snapAngleDeg }
}

export interface ControllerResult {
  nextState: ControllerState
  events: ControllerEvent[]
}

export function handleIntent(
  state: ControllerState,
  intent: InputIntent,
  profile: ControllerProfile = DEFAULT_PROFILE,
): ControllerResult {
  const next: ControllerState = { ...state }
  const events: ControllerEvent[] = []

  switch (intent.kind) {
    case 'HOVER':
      // Only meaningful in hover-then-confirm mode (megaminx, spec 8.5), where
      // 12 tightly packed faces make an instant pinch-to-grab error-prone.
      if (profile.grabMode === 'hover-then-confirm') {
        next.hovered = { slot: intent.slot, hitNormal: intent.hitNormal, atMs: intent.atMs }
        events.push({ type: 'HIGHLIGHT', slot: intent.slot })
      }
      break

    case 'GRAB':
      if (profile.grabMode === 'hover-then-confirm') {
        const hover = state.hovered
        const inWindow = hover !== null && intent.atMs - hover.atMs <= profile.hoverConfirmWindowMs
        if (!inWindow) {
          // No live hover to confirm: ignore rather than grabbing blind.
          next.hovered = null
          if (hover) events.push({ type: 'CLEAR_HIGHLIGHT' })
          break
        }
        next.grabbed = { slot: hover.slot, hitNormal: hover.hitNormal }
      } else {
        next.grabbed = { slot: intent.slot, hitNormal: intent.hitNormal }
      }
      next.hovered = null
      next.twistAngle = 0
      break

    case 'TWIST':
      if (!state.grabbed) break
      next.twistAngle = intent.totalAngle
      events.push({ type: 'PREVIEW', angle: intent.totalAngle })
      break

    case 'RELEASE': {
      const grabbed = state.grabbed
      next.grabbed = null
      next.twistAngle = 0
      if (!grabbed) break
      const move = moveFromTwist(grabbed.slot, grabbed.hitNormal, state.twistAngle, profile)
      if (move) events.push({ type: 'MOVE', move })
      break
    }

    case 'DRAG': {
      const move = moveFromDrag(intent.drag)
      if (move) events.push({ type: 'MOVE', move })
      break
    }

    case 'UNDO':
      events.push({ type: 'UNDO' })
      break

    case 'CANCEL':
      next.grabbed = null
      next.hovered = null
      next.twistAngle = 0
      if (state.hovered) events.push({ type: 'CLEAR_HIGHLIGHT' })
      break
  }

  return { nextState: next, events }
}

/**
 * Translates the gesture FSM's vocabulary into controller intents.
 *
 * Bug fixed here: the FSM's own `RELEASE` event fires on EVERY pinch release
 * (spring-back or not), and a `COMMIT` event -- when the twist angle actually
 * qualified -- is pushed into the SAME tick's event array immediately after
 * it. Mapping FSM `RELEASE` to controller `CANCEL` wiped the grabbed state
 * before the following `COMMIT` was ever processed, so `moveFromTwist` never
 * ran and no gesture-driven move ever reached the puzzle: confirmed by a
 * real user reporting hand tracking worked but the cube never turned. Both
 * FSM events now map to the controller's OWN `RELEASE` intent, which already
 * safely no-ops on a second call (moveFromTwist returns null once
 * state.grabbed is already cleared).
 */
export function intentFromGestureEvent(
  event: GestureEvent,
  context: { slot: [number, number, number]; hitNormal: [number, number, number]; atMs: number },
): InputIntent | null {
  switch (event.type) {
    case 'GRAB':
      return { kind: 'GRAB', slot: context.slot, hitNormal: context.hitNormal, atMs: context.atMs }
    case 'TWIST':
      return { kind: 'TWIST', totalAngle: event.totalAngle }
    case 'COMMIT':
    case 'RELEASE':
      return { kind: 'RELEASE', atMs: context.atMs }
    case 'UNDO':
      return { kind: 'UNDO' }
    default:
      return null
  }
}
