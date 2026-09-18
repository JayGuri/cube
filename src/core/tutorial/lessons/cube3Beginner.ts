import { CUBE3_COLORS, slotId, type Face } from '../../puzzles/cube3/geometry'
import { faceletColors } from '../../puzzles/cube3/sync'
import type { LessonStep, LessonTrack, PuzzleState } from '../../puzzles/PuzzlePlugin'

// Task 5.2: the beginner layer-by-layer method's first stage, the cross --
// the "representative slice" per the plan's Review Note 5. Each step checks
// one cross edge is in place AND correctly oriented (white sticker facing up),
// using the same colour data the renderer uses, so a step can never validate
// something the user can't see is true.

function edgeIsPlaced(state: PuzzleState, slot: [number, number, number], face: Face): boolean {
  const colors = faceletColors(state)
  return colors.get(slotId(slot))?.[face] === CUBE3_COLORS[face as keyof typeof CUBE3_COLORS]
}

const CROSS_EDGES: Array<{ slot: [number, number, number]; label: string }> = [
  { slot: [0, 1, 1], label: 'front' },
  { slot: [1, 1, 0], label: 'right' },
  { slot: [0, 1, -1], label: 'back' },
  { slot: [-1, 1, 0], label: 'left' },
]

function crossStep(edge: (typeof CROSS_EDGES)[number]): LessonStep {
  return {
    instructionText: `Place the white-and-${edge.label} edge piece so its white sticker faces up, on the ${edge.label} side of the top layer.`,
    highlightPieces: [slotId(edge.slot)],
    hintArrow: { axis: 'y', direction: 1 },
    validate: (state) => edgeIsPlaced(state, edge.slot, 'U'),
  }
}

export const cube3CrossTrack: LessonTrack = {
  name: 'Cross',
  steps: CROSS_EDGES.map(crossStep),
}

// This 4-step cross track is the pattern to repeat for F2L / OLL / PLL-style
// stages: same schema, same validate-by-colour approach, more steps. Content
// authoring for the rest of the beginner method is a follow-on task against
// this proven pattern, not a design question (plan Review Note 5).
export const cube3BeginnerLessons: LessonTrack[] = [cube3CrossTrack]
