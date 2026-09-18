import { Alg } from 'cubing/alg'
import type { Move } from '../puzzles/PuzzlePlugin'
import { initSolverCore, solveScramble } from './kociembaCore'
import type { SolverRequest, SolverResponse } from './kociemba.worker'

// Main-thread wrapper. The ~0.9s pruning-table build happens off the main thread
// and is warmed at app start, never on the first Solve press (spec 12.4).

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (s: string) => void; reject: (e: Error) => void }>()

function supportsWorker(): boolean {
  return typeof Worker !== 'undefined' && typeof import.meta.url === 'string'
}

function getWorker(): Worker | null {
  if (!supportsWorker()) return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('./kociemba.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<SolverResponse>) => {
      const entry = pending.get(e.data.id)
      if (!entry) return
      pending.delete(e.data.id)
      if (e.data.ok) entry.resolve(e.data.solution ?? '')
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

function ask(type: SolverRequest['type'], scramble?: string): Promise<string> {
  const w = getWorker()
  if (!w) {
    // No worker (test runner, or an environment that blocks module workers):
    // run the same pure core inline. Slower, but correct.
    return type === 'init' ? initSolverCore().then(() => '') : solveScramble(scramble ?? '')
  }
  const id = nextId++
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({ id, type, scramble } satisfies SolverRequest)
  })
}

export async function initSolver(): Promise<void> {
  await ask('init')
}

// The solver needs the sequence that produced the current state, not the state
// itself -- see the spike notes at the top of kociembaCore.ts.
export async function solveFromHistory(history: Move[], snapAngleDeg = 90): Promise<Move[]> {
  const scramble = history.map((m) => m.alg.toString()).join(' ').trim()
  if (scramble.length === 0) return []
  const solution = await ask('solve', scramble)
  if (!solution.trim()) return []
  return [...new Alg(solution).childAlgNodes()].map((node) => ({
    alg: new Alg([node]),
    snapAngleDeg,
  }))
}
