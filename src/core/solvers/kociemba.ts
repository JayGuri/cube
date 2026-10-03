import { Alg } from 'cubing/alg'
import type { Move } from '../puzzles/PuzzlePlugin'
import { initSolverCore, newScrambleAlg, solveScrambleDetailed, type SolveOptions } from './kociembaCore'
import type { SolverRequest, SolverResponse } from './kociemba.worker'

// Main-thread wrapper. The table build happens off the main thread and is
// warmed at app start, never on the first Solve press.

let worker: Worker | null = null
// Set when the worker never came up; everything then runs on the main thread.
let workerDisabled = false
let nextId = 1
const pending = new Map<number, { resolve: (r: SolverResponse) => void; reject: (e: Error) => void }>()

function supportsWorker(): boolean {
  return typeof Worker !== 'undefined' && typeof import.meta.url === 'string'
}

function getWorker(): Worker | null {
  if (workerDisabled || !supportsWorker()) return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('./kociemba.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<SolverResponse>) => {
      const entry = pending.get(e.data.id)
      if (!entry) return
      pending.delete(e.data.id)
      if (e.data.ok) entry.resolve(e.data)
      else entry.reject(new Error(e.data.error ?? 'solver failed'))
    }
    worker.onerror = () => {
      // Fall back to the main thread rather than leaving Solve permanently dead.
      for (const [, entry] of pending) entry.reject(new Error('solver worker crashed'))
      pending.clear()
      worker = null
    }
  } catch {
    worker = null
  }
  return worker
}

type Request = SolverRequest extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never

function ask(request: Request): Promise<SolverResponse> {
  const w = getWorker()
  if (!w) {
    // No worker (test runner, or an environment that blocks module workers):
    // run the same pure core inline. Slower, but correct.
    if (request.type === 'init') return initSolverCore().then(() => ({ id: 0, ok: true }))
    if (request.type === 'scramble') return Promise.resolve({ id: 0, ok: true, scramble: newScrambleAlg() })
    return solveScrambleDetailed(request.scramble, request.options).then((result) => ({ id: 0, ok: true, result }))
  }
  const id = nextId++
  return new Promise<SolverResponse>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({ ...request, id } as SolverRequest)
  })
}

const WORKER_START_MS = 15_000

/**
 * Builds the solver's tables. Normally a worker does it; if the worker has not
 * answered within 15 seconds (its script failed to load, or the browser blocks
 * workers) it is abandoned and the solver runs on the main thread instead, so
 * solving and scrambling can never hang waiting for it.
 */
export async function initSolver(): Promise<void> {
  if (!getWorker()) {
    await initSolverCore()
    return
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const gaveUp = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(true), WORKER_START_MS)
  })
  const timedOut = await Promise.race([ask({ type: 'init' }).then(() => false), gaveUp])
  clearTimeout(timer)
  if (!timedOut) return
  workerDisabled = true
  worker?.terminate()
  worker = null
  for (const [, entry] of pending) entry.reject(new Error('solver worker did not start'))
  pending.clear()
  await initSolverCore()
}

/** A solution, and whether it is provably the shortest one there is. */
export interface Solution {
  moves: Move[]
  optimal: boolean
}

/**
 * How hard to look.
 *   quick     -- a good answer at once (the guide's first route).
 *   normal    -- Solve for me.
 *   thorough  -- background refinement while you follow the guide.
 */
export type SolveEffort = 'quick' | 'normal' | 'thorough'

const EFFORT: Record<SolveEffort, SolveOptions> = {
  quick: { timeMs: 250, proveMs: 300 },
  normal: { timeMs: 1200, proveMs: 700 },
  thorough: { timeMs: 3500, proveMs: 2500 },
}

const toMoves = (alg: Alg, snapAngleDeg: number): Move[] =>
  [...alg.childAlgNodes()].map((node) => ({ alg: new Alg([node]), snapAngleDeg }))

// The solver needs the sequence that produced the current state, not the state
// itself -- see the notes at the top of kociembaCore.ts.
export async function solveFromHistory(
  history: Move[],
  snapAngleDeg = 90,
  {
    // The Mirror Cube is only solved when it is also held the way it started
    // (its blocks differ in size), so a slice turn or rotation in the history
    // can't be absorbed by turning the whole cube.
    keepOrientation = false,
    effort = 'normal',
  }: { keepOrientation?: boolean; effort?: SolveEffort } = {},
): Promise<Solution> {
  const scramble = history.map((m) => m.alg.toString()).join(' ').trim()
  if (scramble.length === 0) return { moves: [], optimal: true }

  // Two valid ways back to solved; use whichever takes fewer turns.
  //  1. The solver's answer: two-phase search from six points of view, plus an
  //     optimal search that proves (or beats) it when the cube is close enough.
  //  2. Undoing the history in reverse, with cancelling moves merged
  //     (R R' vanishes, R R becomes R2). Always correct.
  const undo = toMoves(new Alg(scramble).invert().experimentalSimplify({ cancel: true }), snapAngleDeg)
  if (keepOrientation && /[MESxyz]/.test(scramble)) return { moves: undo, optimal: false }

  // The undo route's cost tells the optimal search where it can stop looking.
  const { result } = await ask({ type: 'solve', scramble, options: { ...EFFORT[effort], bound: quarterTurns(undo) } })
  const solver = result!.solution.trim() ? toMoves(new Alg(result!.solution), snapAngleDeg) : []
  const moves = quarterTurns(undo) <= quarterTurns(solver) ? undo : solver
  return { moves, optimal: quarterTurns(moves) <= result!.noneBelow }
}

/** Turns as a person makes them: a half turn (R2, R2') counts as two. */
export function quarterTurns(moves: Move[]): number {
  return moves.reduce((n, m) => n + (/2/.test(m.alg.toString()) ? 2 : 1), 0)
}

// ---- Scrambles -------------------------------------------------------------
const RECENT_KEY = 'palmtwist.recentScrambles.v1'
const RECENT_LIMIT = 200

function recentScrambles(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

function remember(scramble: string, recent: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([scramble, ...recent].slice(0, RECENT_LIMIT)))
  } catch {
    // Storage blocked: the scramble is still random, just not checked against old ones.
  }
}

/**
 * A fresh random-state scramble: a uniformly random cube (one of 43
 * quintillion), drawn with the browser's cryptographic random generator.
 * It is also checked against the last 200 scrambles on this device, so a
 * repeat cannot slip through even by chance.
 */
export async function newScramble(snapAngleDeg = 90): Promise<Move[]> {
  const recent = recentScrambles()
  for (let attempt = 0; ; attempt++) {
    const { scramble } = await ask({ type: 'scramble' })
    if (!recent.includes(scramble!) || attempt >= 5) {
      remember(scramble!, recent)
      return toMoves(new Alg(scramble!), snapAngleDeg)
    }
  }
}
