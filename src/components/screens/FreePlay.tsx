import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CameraDebugOverlay } from '../CameraDebugOverlay'
import { GestureConfidenceIndicator } from '../GestureConfidenceIndicator'
import { PuzzleCanvas } from '../PuzzleCanvas'
import { applySensitivity } from '../../core/gestures/GestureRecognizer'
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
  const { plugin, state, moveHistory, status, error } = usePuzzleStore()
  const { load, applyMove, reset, undo, isSolved } = usePuzzleStore()
  const calibratedThresholds = useCalibrationStore((s) => s.thresholds)
  const defaultInputMode = useSettingsStore((s) => s.defaultInputMode)
  const colorblindPalette = useSettingsStore((s) => s.colorblindPalette)
  const gestureSensitivity = useSettingsStore((s) => s.gestureSensitivity)
  // The Settings sensitivity slider was previously stored but never applied
  // anywhere -- moving it did nothing. Layered on top of calibration here.
  const thresholds = applySensitivity(calibratedThresholds, gestureSensitivity)

  const [inputMode, setInputMode] = useState<InputMode>(defaultInputMode)
  // "Show me the move or controls" -- a real user request. Hands mode had no
  // in-app explanation of the gesture vocabulary anywhere, which is exactly
  // why the two-handed "anchor" requirement (removed elsewhere this session)
  // went unnoticed: a first-time user has no way to discover it themselves.
  const [showHandsHelp, setShowHandsHelp] = useState(true)

  useEffect(() => {
    void load(puzzleId as PuzzleId)
  }, [load, puzzleId])

  // Mouse and keyboard must keep working while the camera is active (spec 8.6),
  // so the hook only runs at all when the user has switched to hand control.
  const gestures = useHandGestures({ enabled: inputMode === 'hands', thresholds })

  const solved = status === 'ready' && isSolved()

  // Moves used to apply (and jump to their final colours) the instant they
  // arrived, which read as jerky teleporting rather than a cube turning --
  // confirmed by a user report, and by there being no animation code at all.
  // Every move (drag, gesture, keyboard, scramble, solve) now goes through
  // this one queue: applied to the store immediately (so game logic/solvers
  // keep seeing up-to-date state), but PuzzleCanvas is told which move is
  // "in flight" and keeps rendering its pre-move colours, rotating the
  // affected layer into place, until it reports the animation done -- only
  // then does the next queued move start. Solve and Scramble push their
  // whole move list through the same queue instead of applying it in one
  // batch, which is what makes Solve visibly solve move by move.
  const [animatingMove, setAnimatingMove] = useState<Move | null>(null)
  const [busy, setBusy] = useState(false)
  const [queueError, setQueueError] = useState<string | null>(null)
  const animResolveRef = useRef<(() => void) | null>(null)
  const moveQueueRef = useRef<Move[]>([])
  const processingRef = useRef(false)

  const handleAnimationComplete = () => {
    setAnimatingMove(null)
    const resolve = animResolveRef.current
    animResolveRef.current = null
    resolve?.()
  }

  const applyAnimated = (move: Move) =>
    new Promise<void>((resolve) => {
      animResolveRef.current = resolve
      applyMove(move)
      setAnimatingMove(move)
    })

  const drainQueue = async () => {
    if (processingRef.current) return
    processingRef.current = true
    while (moveQueueRef.current.length > 0) {
      const move = moveQueueRef.current.shift()!
      await applyAnimated(move)
    }
    processingRef.current = false
  }

  const enqueueMoves = (moves: Move[]) => {
    moveQueueRef.current.push(...moves)
    return drainQueue()
  }

  const handleMove = (move: Move | null) => {
    if (move) void enqueueMoves([move])
  }

  const handleScramble = async () => {
    if (!plugin) return
    setBusy(true)
    setQueueError(null)
    try {
      reset()
      const moves = await plugin.scramble()
      await enqueueMoves(moves)
    } catch (e) {
      setQueueError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleSolve = async () => {
    if (!plugin || !state) return
    setBusy(true)
    setQueueError(null)
    try {
      const moves = await plugin.solve(state, moveHistory)
      await enqueueMoves(moves)
    } catch (e) {
      setQueueError((e as Error).message)
    } finally {
      setBusy(false)
    }
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
      void enqueueMoves([move])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, plugin])

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
              animatingMove={animatingMove}
              onAnimationComplete={handleAnimationComplete}
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

            {inputMode === 'hands' && showHandsHelp && (
              <div
                className="absolute left-4 top-4 w-64 rounded-lg border border-white/10 bg-[#0F1117]/90 p-3 text-xs text-[#9A9DB0] shadow-lg backdrop-blur"
                data-testid="hands-help"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#F5F5F7]">
                    Solving with your hands
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowHandsHelp(false)}
                    aria-label="Hide hand-control instructions"
                    className="text-[#9A9DB0] hover:text-[#F5F5F7]"
                  >
                    ×
                  </button>
                </div>
                <ol className="list-decimal space-y-1 pl-4">
                  <li>Show one hand to the camera, over the face you want to turn.</li>
                  <li>Pinch thumb and index finger together and hold briefly to grab it.</li>
                  <li>Keep pinching and twist your wrist the way you'd turn the layer for real -- the cube follows your actual motion, not a mirrored one.</li>
                  <li>Release near a quarter or half turn to commit it; release early and it springs back.</li>
                </ol>
                <p className="mt-2 border-t border-white/10 pt-2 font-semibold text-[#F5F5F7]">
                  Middle slices (M / E / S)
                </p>
                <p className="mt-1">
                  Grab an edge square -- not a corner, not the small centre square -- and twist the same way.
                  That piece has no outer layer of its own, so it turns the middle slice between the two
                  outer layers instead.
                </p>
                <p className="mt-2 border-t border-white/10 pt-2">
                  Open hand, no pinch: move it to orbit the camera. Two open hands: spread apart or together to
                  zoom. Two quick pinches in a row: undo the last move.
                </p>
              </div>
            )}
          </div>

          <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-white/10 px-6 py-4">
            <button type="button" className={BUTTON} onClick={() => void handleScramble()} disabled={busy}>
              Scramble
            </button>
            <button type="button" className={BUTTON} onClick={reset} disabled={busy}>
              Reset
            </button>
            <button type="button" className={BUTTON} onClick={undo} disabled={busy || moveHistory.length === 0}>
              Undo
            </button>
            <button type="button" className={BUTTON} onClick={() => void handleSolve()} disabled={busy}>
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

          {(error || queueError) && <p className="px-6 pb-4 text-sm text-[#EF4444]">{error || queueError}</p>}
        </>
      )}
    </main>
  )
}
