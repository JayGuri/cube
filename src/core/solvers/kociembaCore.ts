// Task 2.1 spike findings (cube-solver@2.4.1), which OVERTURN the plan and spec:
//
//   * `solve()` takes a SCRAMBLE ALGORITHM STRING, not a facelet string.
//     Internally: solve(alg) -> kociemba(alg) -> Solver.solve({ scramble: alg }).
//     The plan's `solveFacelets(faceletString)` API does not exist.
//   * This is a trap, not just a mismatch: a 54-char facelet string is made of
//     the letters U R F D L B, so it PASSES cube-solver's algorithm regex and
//     then dies deep inside with an unrelated TypeError. Never pass facelets.
//   * initialize('kociemba') -- not initialize('3x3x3'), which throws
//     "Specified solver does not exist". Takes ~885ms, hence the worker.
//   * Empty or whitespace-only input throws. Guarded below.
//   * M / S / E slice moves and x / y / z rotations are all accepted.
//   * Solutions were verified against cubing/kpuzzle as an independent oracle:
//     6 of 6 scrambles reached an exactly-solved pattern. Solutions are valid
//     but not always optimal (solve("R") returns 8 moves, not "R'") -- two-phase
//     is tuned for random-state solves, which is why the plan allows up to 30.
//
// This module is pure and worker-agnostic so it can be unit tested directly;
// kociemba.worker.ts is a thin shim over it.

type SolveFn = (scramble: string, type?: string) => string
type InitFn = (type: string) => void

interface CubeSolverModule {
  solve: SolveFn
  initialize: InitFn
}

let mod: CubeSolverModule | null = null

async function loadModule(): Promise<CubeSolverModule> {
  if (mod) return mod
  // cube-solver ships a UMD bundle. Vite pre-bundles it for the browser; under
  // Node (vitest) the default import lands on the CJS namespace object.
  const imported = (await import('cube-solver')) as unknown as
    | CubeSolverModule
    | { default: CubeSolverModule }
  mod = 'solve' in imported ? imported : imported.default
  return mod
}

let initialised = false

// Building the pruning tables costs ~0.9s, so warm this up at app start rather
// than on the first Solve press (spec 12.4).
export async function initSolverCore(): Promise<void> {
  if (initialised) return
  const m = await loadModule()
  m.initialize('kociemba')
  initialised = true
}

export function isSolverReady(): boolean {
  return initialised
}

const ALG_PATTERN = /^([FRUBLDfrubldxyzMSE][2']?\s*)+$/
// Exactly 54 face letters with no separators, primes or doubles: a facelet
// string, never an algorithm.
const FACELET_PATTERN = /^[URFDLB]{54}$/

/**
 * Returns a solution for the cube reached by applying `scrambleAlg` to a solved
 * cube, as a space-separated algorithm string. An empty scramble means the cube
 * is already solved, so the solution is empty too.
 */
export async function solveScramble(scrambleAlg: string): Promise<string> {
  const alg = scrambleAlg.trim()
  if (alg.length === 0) return ''
  if (!ALG_PATTERN.test(alg)) {
    throw new Error(`not a valid algorithm for the solver: ${alg.slice(0, 60)}`)
  }
  if (FACELET_PATTERN.test(alg)) {
    // A 54-char facelet string is built from the letters U R F D L B, so it
    // sails through ALG_PATTERN and cube-solver happily returns a meaningless
    // "solution" for it. Silently wrong is worse than loud, so reject it here.
    throw new Error(
      'received a 54-character facelet string; this solver takes a scramble ' +
        'algorithm, not facelets (see the spike notes above)',
    )
  }
  const m = await loadModule()
  await initSolverCore()
  return m.solve(alg)
}

