import { Alg } from 'cubing/alg'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PuzzleCanvas } from '../PuzzleCanvas'
import { CUBE3_ALGO_DECK, type AlgoCard } from '../../core/tutorial/algorithms/cube3Deck'
import { createNewCard, nextInterval, type CardState } from '../../core/tutorial/spacedRepetition'
import { getAlgoStats, setAlgoStats } from '../../core/tutorial/progressStore'
import { usePuzzleStore } from '../../state/puzzleStore'

const PUZZLE_ID = 'cube3'

export function AlgorithmTrainer() {
  const { plugin, state, status, load, applyMove, reset } = usePuzzleStore()
  const [queue, setQueue] = useState<AlgoCard[] | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [setupApplied, setSetupApplied] = useState(false)

  useEffect(() => {
    void load(PUZZLE_ID)
  }, [load])

  // Load due cards (or the whole deck, first run) once the puzzle is ready.
  useEffect(() => {
    if (status !== 'ready') return
    let cancelled = false
    async function buildQueue() {
      const now = Date.now()
      const due: AlgoCard[] = []
      for (const card of CUBE3_ALGO_DECK) {
        const stats = await getAlgoStats(PUZZLE_ID, card.id).catch(() => undefined)
        if (!stats || stats.dueDate <= now) due.push(card)
      }
      if (!cancelled) setQueue(due.length > 0 ? due : CUBE3_ALGO_DECK)
    }
    void buildQueue()
    return () => {
      cancelled = true
    }
  }, [status])

  const currentCard = queue?.[index] ?? null

  const applySetup = useCallback(() => {
    if (!plugin || !state || !currentCard) return
    reset()
    if (currentCard.setupAlg) {
      for (const node of new Alg(currentCard.setupAlg).childAlgNodes()) {
        applyMove({ alg: new Alg([node]), snapAngleDeg: 90 })
      }
    }
    setSetupApplied(true)
    setRevealed(false)
  }, [plugin, state, currentCard, reset, applyMove])

  useEffect(() => {
    if (status === 'ready' && currentCard && !setupApplied) applySetup()
  }, [status, currentCard, setupApplied, applySetup])

  const grade = async (quality: number) => {
    if (!currentCard) return
    const existing = await getAlgoStats(PUZZLE_ID, currentCard.id).catch(() => undefined)
    const prior: CardState = existing ?? createNewCard()
    const updated = nextInterval(prior, quality)
    await setAlgoStats({ puzzleId: PUZZLE_ID, algoCaseId: currentCard.id, ...updated }).catch(() => undefined)

    if (queue && index + 1 < queue.length) {
      setIndex(index + 1)
    } else {
      setIndex(0)
      setQueue(null) // triggers a fresh due-card rebuild via status effect below
    }
    setSetupApplied(false)
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#0F1117] text-[#F5F5F7]">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
        <Link to="/" className="text-sm text-[#9A9DB0] hover:text-[#F5F5F7]">
          ← All puzzles
        </Link>
        <h1 className="text-lg font-medium">Algorithm Trainer</h1>
        <span className="text-sm text-[#9A9DB0]" data-testid="algo-progress">
          {queue ? `${index + 1} / ${queue.length}` : '...'}
        </span>
      </header>

      {status === 'ready' && plugin && state && currentCard && (
        <>
          <div className="min-h-0 w-full flex-1">
            <PuzzleCanvas plugin={plugin} state={state} onMove={() => undefined} interactive={false} className="h-full w-full" />
          </div>

          <footer className="shrink-0 space-y-3 border-t border-white/10 px-6 py-4">
            <p className="text-lg font-medium" data-testid="algo-case-name">
              {currentCard.caseName}
              <span className="ml-2 text-sm text-[#9A9DB0]">({currentCard.category})</span>
            </p>

            {!revealed ? (
              <button
                type="button"
                className="rounded-lg bg-[#00D4FF] px-4 py-2 text-sm font-medium text-[#0F1117]"
                onClick={() => setRevealed(true)}
                data-testid="reveal-solution"
              >
                Show solution
              </button>
            ) : (
              <>
                <p className="text-sm text-[#9A9DB0]" data-testid="algo-solution">
                  {currentCard.solutionAlg || '(already solved)'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-[#EF4444] px-3 py-1.5 text-sm text-[#EF4444]"
                    onClick={() => void grade(1)}
                  >
                    Didn't know it
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-[#F5A524] px-3 py-1.5 text-sm text-[#F5A524]"
                    onClick={() => void grade(3)}
                  >
                    Hesitated
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-[#22C55E] px-3 py-1.5 text-sm text-[#22C55E]"
                    onClick={() => void grade(5)}
                  >
                    Knew it cold
                  </button>
                </div>
              </>
            )}
          </footer>
        </>
      )}
    </main>
  )
}
