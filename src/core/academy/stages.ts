import { facesOfSlot, slotId, type Face } from '../puzzles/cube3/geometry'
import { faceletColors } from '../puzzles/cube3/sync'
import type { PuzzleState } from '../puzzles/PuzzlePlugin'

// How far through the layer-by-layer method a cube is, read straight off its
// sticker colours. A piece is "in place" when each of its stickers matches the
// centre of the face it sits on -- centres never move on face turns, so they
// are the reference.
//
// The Academy holds the cube with the FIRST layer on the bottom (D) and the
// LAST layer on top (U), like most written tutorials.

type Slot = [number, number, number]

export type StageGoal = 'cross' | 'firstLayer' | 'secondLayer' | 'topCross' | 'topFace' | 'topCorners' | 'solved'

const NORMAL: Record<Face, Slot> = { U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0] }

const BOTTOM_EDGES: Slot[] = [[0, -1, 1], [1, -1, 0], [0, -1, -1], [-1, -1, 0]]
const BOTTOM_CORNERS: Slot[] = [[1, -1, 1], [-1, -1, 1], [1, -1, -1], [-1, -1, -1]]
const MIDDLE_EDGES: Slot[] = [[1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1]]
const TOP_EDGES: Slot[] = [[0, 1, 1], [1, 1, 0], [0, 1, -1], [-1, 1, 0]]
const TOP_CORNERS: Slot[] = [[1, 1, 1], [-1, 1, 1], [1, 1, -1], [-1, 1, -1]]

/** Stages in order; each one includes everything before it. */
export const STAGE_ORDER: StageGoal[] = ['cross', 'firstLayer', 'secondLayer', 'topCross', 'topFace', 'topCorners', 'solved']

export function stageDone(goal: StageGoal, state: PuzzleState): boolean {
  const colors = faceletColors(state)
  const sticker = (slot: Slot, face: Face) => colors.get(slotId(slot))?.[face]
  const centre = (face: Face) => sticker(NORMAL[face], face)

  // Every sticker of this piece matches the centre of the face it is on.
  const inPlace = (slot: Slot) => facesOfSlot(slot).every((f) => sticker(slot, f) === centre(f))
  // Only the sticker on the top face matches the top centre (the piece may be in the wrong place).
  const topUp = (slot: Slot) => sticker(slot, 'U') === centre('U')
  const all = (slots: Slot[], test: (s: Slot) => boolean) => slots.every(test)

  const upTo = STAGE_ORDER.indexOf(goal)
  const checks: Array<() => boolean> = [
    () => all(BOTTOM_EDGES, inPlace),
    () => all(BOTTOM_CORNERS, inPlace),
    () => all(MIDDLE_EDGES, inPlace),
    () => all(TOP_EDGES, topUp),
    () => all([...TOP_EDGES, ...TOP_CORNERS], topUp),
    () => all(TOP_CORNERS, inPlace),
    () => all(TOP_EDGES, inPlace),
  ]
  return checks.slice(0, upTo + 1).every((check) => check())
}

/** The stage before this one, or null for the first. */
export function stageBefore(goal: StageGoal): StageGoal | null {
  const i = STAGE_ORDER.indexOf(goal)
  return i > 0 ? STAGE_ORDER[i - 1] : null
}
