import type { PuzzleId, PuzzlePlugin } from './PuzzlePlugin'

// Task 6.3: the real puzzle registry, replacing Phase 1's single-entry stub
// in puzzleStore.ts. Each loader is dynamically imported so a puzzle's whole
// module graph (geometry, logic, lessons) only loads when the user actually
// opens it.
export const PUZZLE_REGISTRY: Partial<Record<PuzzleId, () => Promise<PuzzlePlugin>>> = {
  cube3: async () => (await import('./cube3')).createCube3Plugin(),
  pyraminx: async () => (await import('./pyraminx')).createPyraminxPlugin(),
  skewb: async () => (await import('./skewb')).createSkewbPlugin(),
}

export function isPuzzleAvailable(id: string): id is PuzzleId {
  return id in PUZZLE_REGISTRY
}

export const AVAILABLE_PUZZLE_IDS: PuzzleId[] = Object.keys(PUZZLE_REGISTRY) as PuzzleId[]
