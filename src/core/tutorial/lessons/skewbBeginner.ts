import { orbitsOf } from '../../puzzles/kpattern'
import { patternOf } from '../../puzzles/skewb/logic'
import type { LessonStep, LessonTrack, PuzzleState } from '../../puzzles/PuzzlePlugin'

// Representative slice (plan Review Note 5) for skewb: getting one corner and
// its 3 adjacent centres into their home orientation is the natural first,
// concrete step -- intuitive, and it proves the validate-by-orbit-data
// pattern generalises to skewb's CORNERS orbit the same way it did for
// cube3's and pyraminx's.

function cornerZeroSolved(state: PuzzleState): boolean {
  const data = orbitsOf(patternOf(state))
  return data.CORNERS.pieces[0] === 0 && data.CORNERS.orientation[0] === 0
}

const firstCornerStep: LessonStep = {
  instructionText:
    'Skewb has 8 corners and 6 centres. Start by getting any one corner back into its own home position, oriented correctly.',
  highlightPieces: ['skewb-corner-0'],
  validate: (state) => cornerZeroSolved(state),
}

export const skewbFirstCornerTrack: LessonTrack = {
  name: 'First Corner',
  steps: [firstCornerStep],
}

export const skewbBeginnerLessons: LessonTrack[] = [skewbFirstCornerTrack]
