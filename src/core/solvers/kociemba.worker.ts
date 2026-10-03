/// <reference lib="webworker" />
import { initSolverCore, newScrambleAlg, solveScrambleDetailed, warmProofTables, type SolveOptions, type SolveResult } from './kociembaCore'

// Thin shim over the pure core: all real logic (and all the tests) live there.
export type SolverRequest =
  | { id: number; type: 'init' }
  | { id: number; type: 'solve'; scramble: string; options?: SolveOptions }
  | { id: number; type: 'scramble' }

export interface SolverResponse {
  id: number
  ok: boolean
  result?: SolveResult
  scramble?: string
  error?: string
}

self.onmessage = async (e: MessageEvent<SolverRequest>) => {
  const request = e.data
  const { id } = request
  try {
    if (request.type === 'init') {
      await initSolverCore()
      self.postMessage({ id, ok: true } satisfies SolverResponse)
      // The optimal-search tables are only needed later; build them now, while
      // nobody is waiting on the worker.
      setTimeout(warmProofTables, 0)
      return
    }
    if (request.type === 'scramble') {
      self.postMessage({ id, ok: true, scramble: newScrambleAlg() } satisfies SolverResponse)
      return
    }
    const result = await solveScrambleDetailed(request.scramble, request.options)
    self.postMessage({ id, ok: true, result } satisfies SolverResponse)
  } catch (err) {
    self.postMessage({ id, ok: false, error: (err as Error).message } satisfies SolverResponse)
  }
}
