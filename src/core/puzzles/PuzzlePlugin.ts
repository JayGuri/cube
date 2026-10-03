// ---------------------------------------------------------------------------
// cubing API confirmed by the Task 1.1 spike against cubing@0.56.0 (2026-09-18).
// The short version of what was learned about the cubing.js puzzle definitions:
//
//   - `cubing/puzzles` exports ONLY `cube3x3x3` / `cube2x2x2` as named puzzles.
//     Everything else comes from the `puzzles` dictionary: puzzles["megaminx"].
//   - await <entry>.kpuzzle()      -> KPuzzle
//   - kpuzzle.defaultPattern()     -> KPattern   (the solved state)
//   - pattern.applyAlg(alg)        -> KPattern
//   - pattern.applyMove(move)      -> KPattern
//   - pattern.isIdentical(other)   -> boolean    EXACT: a `y` rotation reads unsolved
//   - pattern.experimentalIsSolved({ ignorePuzzleOrientation: true })
//                                  -> boolean, rotation-tolerant, 3x3x3 ONLY.
//                                     Skewb throws "not supported for this puzzle".
//     => see isPatternSolved() in ./kpattern.ts, which tries one then the other.
//   - patternData shape: { ORBIT: { pieces: number[], orientation: number[] } }
//     (singular "orientation"). Solved = identity permutation, all-zero orientation.
//   - [...alg.childAlgNodes()] yields Move instances, NOT Alg. Wrap with
//     new Alg([node]) -- the plan's `node as unknown as Alg` cast was wrong.
// ---------------------------------------------------------------------------

import type { Alg } from 'cubing/alg'
import type { BufferGeometry } from 'three'

import type { Solution, SolveEffort } from '../solvers/kociemba'

export type PuzzleId = 'cube3' | 'mirror'

export interface Move {
  alg: Alg
  snapAngleDeg: number
}

export interface PuzzleState {
  // Opaque wrapper around a cubing KPattern (or, for pieces cubing cannot model,
  // a puzzle-specific state object). Plugins own the concrete shape; nothing
  // outside a plugin inspects this directly except via the plugin's own methods.
  raw: unknown
}

export type PieceId = string

export interface PieceMesh {
  pieceId: PieceId
  geometry: BufferGeometry
  // Cubie centre in puzzle space, used for raycast hit -> layer resolution.
  slot: [number, number, number]
}

export interface PuzzleMesh {
  pieces: PieceMesh[]
}

// face/colour key -> hex
export type FaceColorMap = Record<string, string>

export interface PuzzlePlugin {
  id: PuzzleId
  displayName: string

  createInitialState(): PuzzleState
  applyMove(state: PuzzleState, move: Move): PuzzleState
  isSolved(state: PuzzleState): boolean
  /** A random-state scramble, never one of the recent ones. */
  scramble(): Promise<Move[]>
  // Takes the history as well as the state: the solver works from the moves
  // that made the cube (see core/solvers/kociembaCore.ts).
  solve(state: PuzzleState, history: Move[], effort?: SolveEffort): Promise<Solution>

  buildGeometry(): PuzzleMesh
  colorScheme: FaceColorMap
  // Per-piece sticker colours for the current state, keyed by pieceId then face.
  faceletColors(state: PuzzleState): Map<PieceId, Record<string, string>>

  /** Degrees one turn snaps to. */
  snapAngleDeg: number
}
