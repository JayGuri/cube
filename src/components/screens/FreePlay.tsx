import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PuzzleCanvas } from '../PuzzleCanvas'
import type { Move, PuzzleId } from '../../core/puzzles/PuzzlePlugin'
import { usePuzzleStore } from '../../state/puzzleStore'

const BUTTON =
  'rounded-lg border border-white/10 bg-[#1A1D27] px-4 py-2 text-sm font-medium transition hover:border-[#00D4FF]/60 hover:bg-[#242837] disabled:cursor-not-allowed disabled:opacity-40'

export function FreePlay() {
  const { puzzleId = 'cube3' } = useParams<{ puzzleId: string }>()
  const { plugin, state, moveHistory, status, error, busy } = usePuzzleStore()
  const { load, applyMove, reset, scramble, solve, undo, isSolved } = usePuzzleStore()

  useEffect(() => {
    void load(puzzleId as PuzzleId)
  }, [load, puzzleId])

  const solved = status === 'ready' && isSolved()

  const handleMove = (move: Move | null) => {
    if (move) applyMove(move)
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#0F1117] text-[#F5F5F7]">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
        <Link to="/" className="text-sm text-[#9A9DB0] hover:text-[#F5F5F7]">
          ← All puzzles
        </Link>
        <h1 className="text-lg font-medium">{plugin?.displayName ?? puzzleId}</h1>
        <p className="text-sm text-[#9A9DB0]" data-testid="move-count">
          {moveHistory.length} moves
        </p>
      </header>

      {status === 'loading' && <p className="p-6 text-[#9A9DB0]">Loading puzzle…</p>}
      {status === 'error' && <p className="p-6 text-[#EF4444]">{error}</p>}

      {status === 'ready' && plugin && state && (
        <>
          <PuzzleCanvas
            plugin={plugin}
            state={state}
            onMove={handleMove}
            className="min-h-0 w-full flex-1"
          />

          <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-white/10 px-6 py-4">
            <button type="button" className={BUTTON} onClick={() => void scramble()} disabled={busy}>
              Scramble
            </button>
            <button type="button" className={BUTTON} onClick={reset} disabled={busy}>
              Reset
            </button>
            <button type="button" className={BUTTON} onClick={undo} disabled={busy || moveHistory.length === 0}>
              Undo
            </button>
            <button type="button" className={BUTTON} onClick={() => void solve()} disabled={busy}>
              Solve
            </button>

            <span
              data-testid="solved-status"
              className={`ml-auto rounded-full px-3 py-1 text-sm font-medium ${
                solved ? 'bg-[#22C55E]/15 text-[#22C55E]' : 'bg-white/5 text-[#9A9DB0]'
              }`}
            >
              {solved ? 'Solved' : 'Scrambled'}
            </span>
          </footer>

          {error && <p className="px-6 pb-4 text-sm text-[#EF4444]">{error}</p>}
        </>
      )}
    </main>
  )
}
