import { skewbBeginnerLessons } from '../../tutorial/lessons/skewbBeginner'
import type { PuzzlePlugin } from '../PuzzlePlugin'
import { buildSkewbGeometry, SKEWB_COLORS } from './geometry'
import { applyMove, createInitialState, initSkewbLogic, isSolved, scramble } from './logic'
import { solveSkewb } from './solve'
import { faceletColors, pieceIdForFacelet } from './sync'

export async function createSkewbPlugin(): Promise<PuzzlePlugin> {
  await initSkewbLogic()

  return {
    id: 'skewb',
    displayName: 'Skewb',
    kpuzzleDefinitionId: 'skewb',

    createInitialState,
    applyMove,
    isSolved,
    scramble,
    solve: async (state, history) => solveSkewb(state, history),

    buildGeometry: buildSkewbGeometry,
    colorScheme: SKEWB_COLORS,
    pieceIdForFacelet,
    faceletColors,

    // spec 8.5: grab targets a corner; twist axis is the body-diagonal
    // through that corner, not screen-relative; snap angle 120.
    gestureProfile: {
      snapAngleDeg: 120,
      grabMode: 'instant',
      twistAxisMode: 'body-diagonal',
    },

    tutorial: { puzzleId: 'skewb', tracks: skewbBeginnerLessons },
  }
}
