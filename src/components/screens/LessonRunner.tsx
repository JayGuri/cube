import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PuzzleCanvas } from '../PuzzleCanvas'
import { createLessonEngine, type LessonEngine } from '../../core/tutorial/LessonEngine'
import { setLessonProgress } from '../../core/tutorial/progressStore'
import type { Move, PuzzleId } from '../../core/puzzles/PuzzlePlugin'
import { usePuzzleStore } from '../../state/puzzleStore'

type Pulse = 'none' | 'success' | 'error'

export function LessonRunner() {
  const { puzzleId = 'cube3', trackName = '' } = useParams<{ puzzleId: string; trackName: string }>()
  const { plugin, state, status, load, applyMove, reset } = usePuzzleStore()

  const engineRef = useRef<LessonEngine | null>(null)
  const [, forceRender] = useState(0)
  const [pulse, setPulse] = useState<Pulse>('none')
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    void load(puzzleId as PuzzleId)
  }, [load, puzzleId])

  const track = useMemo(
    () => plugin?.tutorial.tracks.find((t) => t.name === decodeURIComponent(trackName)) ?? null,
    [plugin, trackName],
  )

  useEffect(() => {
    if (!track) return
    engineRef.current = createLessonEngine(track, () => {
      setPulse('error')
      setTimeout(() => setPulse('none'), 500)
    })
    forceRender((n) => n + 1)
  }, [track])

  const handleMove = (move: Move | null) => {
    if (!move || !plugin || !state) return
    applyMove(move)
    const nextState = plugin.applyMove(state, move)
    const result = engineRef.current?.recordMove(move, nextState)
    if (result?.advanced) {
      setPulse('success')
      setTimeout(() => setPulse('none'), 500)
      if (engineRef.current) {
        void setLessonProgress({
          puzzleId: plugin.id,
          trackName: track?.name ?? '',
          completedSteps: engineRef.current.state.currentStepIndex,
          lastPracticed: Date.now(),
          bestMoveCount: engineRef.current.state.moveHistory.length,
        }).catch(() => undefined)
      }
    }
    forceRender((n) => n + 1)
  }

  const engine = engineRef.current
  const currentStep = engine?.currentStep ?? null

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#0F1117] text-[#F5F5F7]">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
        <Link to={`/academy/${puzzleId}`} className="text-sm text-[#9A9DB0] hover:text-[#F5F5F7]">
          ← {plugin?.displayName ?? puzzleId} Academy
        </Link>
        <h1 className="text-lg font-medium">{track?.name ?? decodeURIComponent(trackName)}</h1>
        <button
          type="button"
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-[#9A9DB0] hover:text-[#F5F5F7]"
          onClick={() => setShowHint((v) => !v)}
        >
          {showHint ? 'Hide hint' : 'Hint'}
        </button>
      </header>

      {status === 'ready' && plugin && state && track && (
        <>
          <div
            className={`relative min-h-0 w-full flex-1 transition-colors ${
              pulse === 'success' ? 'bg-[#22C55E]/10' : pulse === 'error' ? 'bg-[#EF4444]/10' : ''
            }`}
          >
            <PuzzleCanvas
              plugin={plugin}
              state={state}
              onMove={handleMove}
              className="h-full w-full"
              hintArrow={showHint ? currentStep?.hintArrow : null}
            />
          </div>

          <footer className="shrink-0 border-t border-white/10 px-6 py-4">
            {engine?.state.completed ? (
              <div className="flex items-center justify-between">
                <p className="text-[#22C55E]" data-testid="lesson-complete">
                  Track complete! Nice work.
                </p>
                <button type="button" className="rounded-lg bg-[#00D4FF] px-4 py-2 text-sm font-medium text-[#0F1117]" onClick={reset}>
                  Practice again
                </button>
              </div>
            ) : (
              <p className="text-[#F5F5F7]" data-testid="lesson-instruction">
                {currentStep?.instructionText ?? 'Loading step…'}
              </p>
            )}
            <p className="mt-1 text-xs text-[#9A9DB0]">
              Step {(engine?.state.currentStepIndex ?? 0) + 1} of {track.steps.length}
            </p>
          </footer>
        </>
      )}
    </main>
  )
}
