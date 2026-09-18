import { solveFromHistory } from '../../solvers/kociemba'
import { cube3BeginnerLessons } from '../../tutorial/lessons/cube3Beginner'
import type { Move, PuzzlePlugin } from '../PuzzlePlugin'
import { CUBE3_COLORS } from '../cube3/geometry'
import { applyMove, createInitialState, initCube3Logic, isSolved, scramble } from '../cube3/logic'
import { faceletColors, pieceIdForFacelet } from '../cube3/sync'
import { buildMastermorphixGeometry } from './geometry'

// Task 7.2/7.3: Mastermorphix reuses cube3's logic and sync WHOLESALE (spec
// 6.3) -- moves, scrambling, solving and the state/colour bridge all "just
// work" unmodified, since the mechanism is identical to a 3x3. Only
// buildGeometry (Task 7.1's radial remap) differs.
export async function createMastermorphixPlugin(): Promise<PuzzlePlugin> {
  await initCube3Logic()

  return {
    id: 'mastermorphix',
    displayName: 'Mastermorphix',
    kpuzzleDefinitionId: '3x3x3',

    createInitialState,
    applyMove,
    isSolved,
    scramble,
    solve: async (_state, history: Move[]) => solveFromHistory(history, 90),

    buildGeometry: buildMastermorphixGeometry,
    colorScheme: CUBE3_COLORS,
    pieceIdForFacelet,
    faceletColors,

    gestureProfile: {
      snapAngleDeg: 90,
      grabMode: 'instant',
      twistAxisMode: 'screen-relative',
    },

    // Reuses the exact same cross-track validate logic as cube3 (Task 5.2) --
    // proof by construction that the lesson content, not just the plugin
    // code, transfers (spec 6.3's pedagogical point).
    tutorial: { puzzleId: 'mastermorphix', tracks: cube3BeginnerLessons },
  }
}
