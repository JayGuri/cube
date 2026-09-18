import { orbitsOf } from '../../puzzles/kpattern'
import { patternOf } from '../../puzzles/pyraminx/logic'
import type { LessonStep, LessonTrack, PuzzleState } from '../../puzzles/PuzzlePlugin'

// Representative slice (plan Review Note 5) for pyraminx: the tips stage --
// genuinely trivial on a real pyraminx (each tip only rotates in place, never
// permutes -- Task 6.1 spike), which is exactly why it's the natural first
// lesson. The remaining stages (axial alignment, edge placement) follow the
// same validate-by-orbit-data pattern once authored.

function tipsSolved(state: PuzzleState): boolean {
  return orbitsOf(patternOf(state)).CORNERS2.orientation.every((o) => o === 0)
}

const tipsStep: LessonStep = {
  instructionText:
    'Solve the 4 tips. Each tip only spins in place -- it never swaps places with another tip -- so just rotate each one until its colours line up with its three neighbouring faces.',
  highlightPieces: ['pyraminx-tip-0', 'pyraminx-tip-1', 'pyraminx-tip-2', 'pyraminx-tip-3'],
  validate: (state) => tipsSolved(state),
}

export const pyraminxTipsTrack: LessonTrack = {
  name: 'Tips',
  steps: [tipsStep],
}

export const pyraminxBeginnerLessons: LessonTrack[] = [pyraminxTipsTrack]
