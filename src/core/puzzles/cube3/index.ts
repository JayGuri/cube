import type { PuzzlePlugin, PuzzleState } from '../PuzzlePlugin'
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
    solve: async (_state: PuzzleState) => {
      // Replaced in Phase 2 by the Kociemba worker.
      throw new Error('cube3 solve() not implemented until Phase 2')
    },

    buildGeometry: buildCube3Geometry,
    colorScheme: CUBE3_COLORS,
    pieceIdForFacelet,
    faceletColors,

    gestureProfile: {
      snapAngleDeg: 90,
      grabMode: 'instant',
      twistAxisMode: 'screen-relative',
    },

    // Filled in Phase 5.
    tutorial: { puzzleId: 'cube3', tracks: [] },
  }
}
