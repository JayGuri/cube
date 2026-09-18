import { create } from 'zustand'
import { PUZZLE_REGISTRY } from '../core/puzzles/registry'
import type { Move, PuzzleId, PuzzlePlugin, PuzzleState } from '../core/puzzles/PuzzlePlugin'

export interface PuzzleStore {
  plugin: PuzzlePlugin | null
  state: PuzzleState | null
  moveHistory: Move[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  busy: boolean

  load: (id: PuzzleId) => Promise<void>
  applyMove: (move: Move) => void
  undo: () => void
  reset: () => void
  scramble: () => Promise<void>
  solve: () => Promise<void>
  isSolved: () => boolean
}

export const usePuzzleStore = create<PuzzleStore>((set, get) => ({
  plugin: null,
  state: null,
  moveHistory: [],
  status: 'idle',
  error: null,
  busy: false,

  load: async (id) => {
    const loader = PUZZLE_REGISTRY[id]
    if (!loader) {
      set({ status: 'error', error: `unknown puzzle: ${id}` })
      return
    }
    set({ status: 'loading', error: null })
    try {
      const plugin = await loader()
      set({
        plugin,
        state: plugin.createInitialState(),
        moveHistory: [],
        status: 'ready',
      })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  applyMove: (move) => {
    const { plugin, state, moveHistory } = get()
    if (!plugin || !state) return
    set({
      state: plugin.applyMove(state, move),
      moveHistory: [...moveHistory, move],
    })
  },

  undo: () => {
    const { plugin, state, moveHistory } = get()
    if (!plugin || !state || moveHistory.length === 0) return
    const last = moveHistory[moveHistory.length - 1]
    set({
      state: plugin.applyMove(state, { alg: last.alg.invert(), snapAngleDeg: last.snapAngleDeg }),
      moveHistory: moveHistory.slice(0, -1),
    })
  },

  reset: () => {
    const { plugin } = get()
    if (!plugin) return
    set({ state: plugin.createInitialState(), moveHistory: [] })
  },

  scramble: async () => {
    const { plugin } = get()
    if (!plugin) return
    set({ busy: true })
    try {
      const moves = await plugin.scramble()
      let next = plugin.createInitialState()
      for (const m of moves) next = plugin.applyMove(next, m)
      set({ state: next, moveHistory: moves })
    } catch (e) {
      set({ error: (e as Error).message })
    } finally {
      set({ busy: false })
    }
  },

  solve: async () => {
    const { plugin, state } = get()
    if (!plugin || !state) return
    set({ busy: true, error: null })
    try {
      const moves = await plugin.solve(state, get().moveHistory)
      let next = state
      for (const m of moves) next = plugin.applyMove(next, m)
      set({ state: next, moveHistory: [...get().moveHistory, ...moves] })
    } catch (e) {
      set({ error: (e as Error).message })
    } finally {
      set({ busy: false })
    }
  },

  isSolved: () => {
    const { plugin, state } = get()
    return Boolean(plugin && state && plugin.isSolved(state))
  },
}))
