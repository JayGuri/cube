import type { PuzzleId, PuzzlePlugin } from './PuzzlePlugin'

// The app is focused on the 3x3 alone for now; the other puzzles and the
// Academy were removed rather than hidden, so nothing dead ships. The
// registry shape is kept so a puzzle can be re-added without touching callers.
export const PUZZLE_REGISTRY: Record<PuzzleId, () => Promise<PuzzlePlugin>> = {
  cube3: async () => (await import('./cube3')).createCube3Plugin(),
}

export function isPuzzleAvailable(id: string): id is PuzzleId {
  return id in PUZZLE_REGISTRY
}

export const AVAILABLE_PUZZLE_IDS: PuzzleId[] = Object.keys(PUZZLE_REGISTRY) as PuzzleId[]
