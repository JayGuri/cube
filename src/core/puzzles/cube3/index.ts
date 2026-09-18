import { solveFromHistory } from '../../solvers/kociemba'
import { cube3BeginnerLessons } from '../../tutorial/lessons/cube3Beginner'
import type { Move, PuzzlePlugin } from '../PuzzlePlugin'
import { buildCube3Geometry, CUBE3_COLORS } from './geometry'
import {
  applyMove,
  createInitialState,
  initCube3Logic,
  isSolved,
  scramble,
} from './logic'
import { faceletColors, pieceIdForFacelet } from './sync'

// async because the cubing KPuzzle load is async -- callers never see an
// uninitialised plugin.
export async function createCube3Plugin(): Promise<PuzzlePlugin> {
  await initCube3Logic()

  return {
    id: 'cube3',
    displayName: '3x3 Cube',
    kpuzzleDefinitionId: '3x3x3',

    createInitialState,
    applyMove,
    isSolved,
    scramble,
    solve: async (_state, history: Move[]) => solveFromHistory(history, 90),

    buildGeometry: buildCube3Geometry,
    colorScheme: CUBE3_COLORS,
    pieceIdForFacelet,
    faceletColors,

    gestureProfile: {
      snapAngleDeg: 90,
      grabMode: 'instant',
      twistAxisMode: 'screen-relative',
    },

    tutorial: { puzzleId: 'cube3', tracks: cube3BeginnerLessons },
  }
}
