import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CameraDebugOverlay } from '../CameraDebugOverlay'
import { GestureConfidenceIndicator } from '../GestureConfidenceIndicator'
import { PuzzleCanvas } from '../PuzzleCanvas'
import { moveFromKey } from '../../core/gestures/KeyboardAdapter'
import { useHandGestures } from '../../core/gestures/useHandGestures'
import type { Move, PuzzleId } from '../../core/puzzles/PuzzlePlugin'
import { useCalibrationStore } from '../../state/calibrationStore'
import { usePuzzleStore } from '../../state/puzzleStore'
import { useSettingsStore } from '../../state/settingsStore'

const BUTTON =
  'rounded-lg border border-white/10 bg-[#1A1D27] px-4 py-2 text-sm font-medium transition hover:border-[#00D4FF]/60 hover:bg-[#242837] disabled:cursor-not-allowed disabled:opacity-40'

type InputMode = 'mouse' | 'hands'

export function FreePlay() {
  const { puzzleId = 'cube3' } = useParams<{ puzzleId: string }>()
  const { plugin, state, moveHistory, status, error, busy } = usePuzzleStore()
  const { load, applyMove, reset, scramble, solve, undo, isSolved } = usePuzzleStore()
  const thresholds = useCalibrationStore((s) => s.thresholds)
  const defaultInputMode = useSettingsStore((s) => s.defaultInputMode)
  const colorblindPalette = useSettingsStore((s) => s.colorblindPalette)

  const [inputMode, setInputMode] = useState<InputMode>(defaultInputMode)

  useEffect(() => {
    void load(puzzleId as PuzzleId)
  }, [load, puzzleId])

  // Mouse and keyboard must keep working while the camera is active (spec 8.6),
  // so the hook only runs at all when the user has switched to hand control.
  const gestures = useHandGestures({ enabled: inputMode === 'hands', thresholds })

  const solved = status === 'ready' && isSolved()

  const handleMove = (move: Move | null) => {
    if (move) applyMove(move)
  }

  // Task 10.2: keyboard stays live regardless of inputMode (spec 8.6) --
  // never the ONLY path, but never disabled either.
  useEffect(() => {
    if (status !== 'ready' || !plugin) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return
      const move = moveFromKey({ key: e.key, shiftKey: e.shiftKey, altKey: e.altKey }, plugin.gestureProfile.snapAngleDeg)
      if (!move) return
      e.preventDefault()
      applyMove(move)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [status, plugin, applyMove])

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#0F1117] text-[#F5F5F7]">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
        <Link to="/" className="text-sm text-[#9A9DB0] hover:text-[#F5F5F7]">
          ← All puzzles
        </Link>
        <h1 className="text-lg font-medium">{plugin?.displayName ?? puzzleId}</h1>
        <div className="flex items-center gap-4">
          <div className="flex overflow-hidden rounded-lg border border-white/10 text-xs">
            <button
              type="button"
              data-testid="input-mode-mouse"
              onClick={() => setInputMode('mouse')}
              className={`px-3 py-1.5 ${inputMode === 'mouse' ? 'bg-[#00D4FF] text-[#0F1117]' : 'text-[#9A9DB0]'}`}
            >
              Mouse
            </button>
            <button
              type="button"
              data-testid="input-mode-hands"
              onClick={() => setInputMode('hands')}
              className={`px-3 py-1.5 ${inputMode === 'hands' ? 'bg-[#00D4FF] text-[#0F1117]' : 'text-[#9A9DB0]'}`}
            >
              Hands
            </button>
          </div>
          <p className="text-sm text-[#9A9DB0]" data-testid="move-count">
            {moveHistory.length} moves
          </p>
        </div>
      </header>

      {status === 'loading' && <p className="p-6 text-[#9A9DB0]">Loading puzzle…</p>}
      {status === 'error' && <p className="p-6 text-[#EF4444]">{error}</p>}

      {status === 'ready' && plugin && state && (
        <>
          <div className="relative min-h-0 w-full flex-1">
            <PuzzleCanvas
              plugin={plugin}
              state={state}
              onMove={handleMove}
              className="h-full w-full"
              gestureTick={inputMode === 'hands' ? gestures.tick : null}
              gestureProfile={plugin.gestureProfile}
              colorblindPalette={colorblindPalette}
            />

            {inputMode === 'hands' && (
              <div className="absolute right-4 top-4 w-48 overflow-hidden rounded-lg border border-white/10 shadow-lg">
                <div className="relative aspect-video bg-black">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    ref={gestures.videoRef}
                    className="h-full w-full -scale-x-100 object-cover"
                    playsInline
                    muted
                    data-testid="gesture-video"
                  />
                  <CameraDebugOverlay frame={gestures.frame} width={192} height={108} />
                </div>
                <div className="flex items-center justify-between bg-black/60 px-2 py-1">
                  <GestureConfidenceIndicator frame={gestures.frame} />
                  <span className="text-[10px] uppercase tracking-wide text-[#9A9DB0]" data-testid="gesture-state">
                    {gestures.gestureState.name}
                  </span>
                </div>
                {gestures.error && (
                  <p className="bg-[#EF4444]/20 px-2 py-1 text-[10px] text-[#EF4444]" data-testid="gesture-error">
                    {gestures.error}
                  </p>
                )}
              </div>
            )}
          </div>

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
