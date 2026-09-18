/// <reference lib="webworker" />
import { initSolverCore, solveScramble } from './kociembaCore'

// Thin shim over the pure core: all real logic (and all the tests) live there.
export interface SolverRequest {
  id: number
  type: 'init' | 'solve'
  scramble?: string
}

export interface SolverResponse {
  id: number
  ok: boolean
  solution?: string
  error?: string
}

self.onmessage = async (e: MessageEvent<SolverRequest>) => {
  const { id, type, scramble } = e.data
  try {
    if (type === 'init') {
      await initSolverCore()
      self.postMessage({ id, ok: true } satisfies SolverResponse)
      return
    }
    const solution = await solveScramble(scramble ?? '')
    self.postMessage({ id, ok: true, solution } satisfies SolverResponse)
  } catch (err) {
    self.postMessage({ id, ok: false, error: (err as Error).message } satisfies SolverResponse)
  }
}
