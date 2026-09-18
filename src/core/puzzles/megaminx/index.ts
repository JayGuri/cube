import { megaminxBeginnerLessons } from '../../tutorial/lessons/megaminxBeginner'
import type { PuzzlePlugin } from '../PuzzlePlugin'
import { buildMegaminxGeometry, MEGAMINX_COLORS } from './geometry'
import { applyMove, createInitialState, initMegaminxLogic, isSolved, scramble } from './logic'
import { solveMegaminx } from './solve'
import { faceletColors, pieceIdForFacelet } from './sync'

export async function createMegaminxPlugin(): Promise<PuzzlePlugin> {
  await initMegaminxLogic()

  return {
    id: 'megaminx',
    displayName: 'Megaminx',
    kpuzzleDefinitionId: 'megaminx',

    createInitialState,
    applyMove,
    isSolved,
    scramble,
    solve: async (state, history) => solveMegaminx(state, history),

    buildGeometry: buildMegaminxGeometry,
    colorScheme: MEGAMINX_COLORS,
    pieceIdForFacelet,
    faceletColors,

    // spec 8.5: 12 tightly-packed pentagonal faces make direct pinch-to-grab
    // error-prone, so megaminx uses hover-then-confirm (Task 8.1, already
    // implemented in InteractionController) instead of instant grab; snap
    // angle 72 degrees (a fifth of a full turn).
    gestureProfile: {
      snapAngleDeg: 72,
      grabMode: 'hover-then-confirm',
      twistAxisMode: 'screen-relative',
    },

    tutorial: { puzzleId: 'megaminx', tracks: megaminxBeginnerLessons },
  }
}
