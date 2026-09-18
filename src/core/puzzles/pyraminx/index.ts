import { pyraminxBeginnerLessons } from '../../tutorial/lessons/pyraminxBeginner'
import type { PuzzlePlugin } from '../PuzzlePlugin'
import { buildPyraminxGeometry, PYRAMINX_COLORS } from './geometry'
import { applyMove, createInitialState, initPyraminxLogic, isSolved, scramble } from './logic'
import { solvePyraminx } from './solve'
import { faceletColors, pieceIdForFacelet } from './sync'

export async function createPyraminxPlugin(): Promise<PuzzlePlugin> {
  await initPyraminxLogic()

  return {
    id: 'pyraminx',
    displayName: 'Pyraminx',
    kpuzzleDefinitionId: 'pyraminx',

    createInitialState,
    applyMove,
    isSolved,
    scramble,
    solve: async (state, history) => solvePyraminx(state, history),

    buildGeometry: buildPyraminxGeometry,
    colorScheme: PYRAMINX_COLORS,
    pieceIdForFacelet,
    faceletColors,

    // spec 8.5: snap angle 120 for pyraminx; larger tip hit-boxes are a
    // PuzzleCanvas-level concern (Task 8.1's hover-confirm style branch),
    // not part of this profile shape.
    gestureProfile: {
      snapAngleDeg: 120,
      grabMode: 'instant',
      twistAxisMode: 'screen-relative',
    },

    tutorial: { puzzleId: 'pyraminx', tracks: pyraminxBeginnerLessons },
  }
}
