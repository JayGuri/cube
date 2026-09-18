import { orbitsOf } from '../../puzzles/kpattern'
import { patternOf } from '../../puzzles/megaminx/logic'
import type { LessonStep, LessonTrack, PuzzleState } from '../../puzzles/PuzzlePlugin'

// Representative slice (plan Review Note 5) for megaminx: getting one centre
// piece's neighbourhood right. The full beginner method (star -> first-layer
// corners -> F2L-equivalent -> last-layer edges -> last-layer permutation)
// follows the exact same validate-by-orbit-data pattern once authored, with
// 12 face's worth of content rather than one -- an authoring task against a
// proven schema, not a design question.

function centerZeroSolved(state: PuzzleState): boolean {
  const data = orbitsOf(patternOf(state))
  return data.CENTERS.pieces[0] === 0
}

const firstCenterStep: LessonStep = {
  instructionText:
    'Megaminx has 12 centre pieces, one per face. Start by learning to identify which centre belongs on which face -- they never need solving themselves, but recognising them anchors the rest of the method.',
  highlightPieces: [],
  validate: (state) => centerZeroSolved(state),
}

export const megaminxStarTrack: LessonTrack = {
  name: 'Centres',
  steps: [firstCenterStep],
}

export const megaminxBeginnerLessons: LessonTrack[] = [megaminxStarTrack]
