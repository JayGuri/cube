import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CameraDebugOverlay } from '../CameraDebugOverlay'
import { GestureConfidenceIndicator } from '../GestureConfidenceIndicator'
import { GuidePanel, HandsKey, SignsHud } from '../HandsGuide'
import { PuzzleCanvas } from '../PuzzleCanvas'
import { createFistLockState, fistLockProgress, stepFistLock } from '../../core/gestures/fistLock'
import { applySensitivity } from '../../core/gestures/GestureRecognizer'
import { moveFromKey } from '../../core/gestures/KeyboardAdapter'
import {
  activeSigns,
  createSignState,
  DEFAULT_SIGN_OPTIONS,
  LAYER_SLICE,
  stepSigns,
  type ActiveSign,
} from '../../core/gestures/signGestures'
import { createGuide, expandSteps, followMove, type GuideState } from '../../core/solvers/solveGuide'
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
  const swapHands = useSettingsStore((s) => s.swapHands)
  // The Settings sensitivity slider was previously stored but never applied
  // anywhere -- moving it did nothing. Layered on top of calibration here.
  const thresholds = applySensitivity(calibratedThresholds, gestureSensitivity)

  const [inputMode, setInputMode] = useState<InputMode>(defaultInputMode)
  // Hands mode always shows its gesture key until dismissed: there is no
  // other way for a first-time user to discover the vocabulary.
  const [showHandsHelp, setShowHandsHelp] = useState(true)
  // One lock for every input: the header button, Space, or a held fist.
  const [cameraLocked, setCameraLocked] = useState(false)
  const toggleCameraLock = () => setCameraLocked((v) => !v)

  useEffect(() => {
    void load(puzzleId as PuzzleId)
  }, [load, puzzleId])

  // Mouse and keyboard must keep working while the camera is active (spec 8.6),
  // so the hook only runs at all when the user has switched to hand control.
  const gestures = useHandGestures({ enabled: inputMode === 'hands', thresholds })

  const solved = status === 'ready' && isSolved()

  const fistLockRef = useRef(createFistLockState())
  const [lockHoldProgress, setLockHoldProgress] = useState(0)
  const signsRef = useRef(createSignState())
  const [heldSigns, setHeldSigns] = useState<ActiveSign[]>([])
  const signsActive = inputMode === 'hands'

  // Per camera frame: the fist lock (every gesture style) and, in Signs
  // mode, the sign recognizer, whose turns go through the same animated
  // move queue as every other input.
  useEffect(() => {
    const f = gestures.frame
    if (inputMode !== 'hands' || !f) return
    const lock = stepFistLock(fistLockRef.current, f, thresholds.fist)
    fistLockRef.current = lock.next
    if (lock.toggled) setCameraLocked((v) => !v)
    setLockHoldProgress(fistLockProgress(lock.next, f.timestampMs))

    if (!signsActive) return
    const opts = { ...DEFAULT_SIGN_OPTIONS, swapHands }
    const r = stepSigns(signsRef.current, f, opts)
    signsRef.current = r.next
    for (const e of r.events) userMove(e.move)
    setHeldSigns(activeSigns(r.next, f.timestampMs, opts))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gestures.frame, inputMode, signsActive, swapHands])

  useEffect(() => {
    signsRef.current = createSignState()
    setHeldSigns([])
  }, [signsActive])

  // Only camera orbit/zoom pass through to the canvas, and orbit is held while a sign is up -- a three-finger
  // sign can read as an "open" hand, and holding it must not drift the
  // camera.
  const canvasTick = useMemo(() => {
    const tick = gestures.tick
    if (inputMode !== 'hands' || !tick) return null
    const events = tick.events.filter(
      (e) =>
        e.type === 'ZOOM' ||
        (e.type === 'ORBIT' && !signsRef.current.hands.Left.current && !signsRef.current.hands.Right.current),
    )
    return { ...tick, events }
  }, [gestures.tick, inputMode])

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

  // Every caller gets the SAME promise for the drain in progress, so awaiting
  // it really means "until the queue is empty" -- a second caller used to get
  // an instantly-resolved promise while the first drain was still running.
  const drainPromiseRef = useRef<Promise<void>>(Promise.resolve())
  const drainQueue = (): Promise<void> => {
    if (processingRef.current) return drainPromiseRef.current
    processingRef.current = true
    drainPromiseRef.current = (async () => {
      try {
        while (moveQueueRef.current.length > 0) {
          const move = moveQueueRef.current.shift()!
          await applyAnimated(move)
        }
      } finally {
        processingRef.current = false
      }
    })()
    return drainPromiseRef.current
  }

  const enqueueMoves = (moves: Move[]) => {
    moveQueueRef.current.push(...moves)
    return drainQueue()
  }

  // --- Guided solve ------------------------------------------------------
  // Scramble starts it; it shows one quarter turn at a time. Moves the user
  // makes are checked against it: the expected move advances, anything else
  // (or an Undo) re-solves from where the cube actually is, so the remaining
  // steps are always the shortest Kociemba finds from the real position.
  const [guide, setGuide] = useState<GuideState | null>(null)
  const [guideStatus, setGuideStatus] = useState<'off' | 'solving' | 'following' | 'done'>('off')
  const guideRef = useRef<GuideState | null>(null)
  const guideTokenRef = useRef(0)
  const setGuideBoth = (g: GuideState | null) => {
    guideRef.current = g
    setGuide(g)
  }

  const stopGuide = () => {
    guideTokenRef.current++
    setGuideBoth(null)
    setGuideStatus('off')
  }

  const startGuide = async () => {
    const p = usePuzzleStore.getState().plugin
    if (!p) return
    const token = ++guideTokenRef.current
    setGuideStatus('solving')
    // Wait for any queued turns to land so the solver sees the real position.
    await drainQueue()
    const { state: now, moveHistory: history } = usePuzzleStore.getState()
    if (!now) return
    try {
      const moves = await p.solve(now, history)
      if (token !== guideTokenRef.current) return // superseded by a newer move or stop
      const g = createGuide(moves)
      setGuideBoth(g.steps.length ? g : null)
      setGuideStatus(g.steps.length ? 'following' : 'done')
    } catch (e) {
      if (token === guideTokenRef.current) {
        setQueueError((e as Error).message)
        stopGuide()
      }
    }
  }

  // Every move the USER makes -- sign, key, drag -- comes through here.
  // (Scramble and Solve feed the queue directly: they aren't the user's.)
  const userMove = (move: Move) => {
    void enqueueMoves([move])
    let g = guideRef.current
    if (!g) return
    for (const step of expandSteps([move])) {
      const r = followMove(g, step)
      if (r.outcome === 'off-track') {
        void startGuide()
        return
      }
      g = r.guide
      if (r.outcome === 'finished') {
        guideTokenRef.current++
        setGuideBoth(null)
        setGuideStatus('done')
        return
      }
    }
    setGuideBoth(g)
  }

  const handleMove = (move: Move | null) => {
    if (move) userMove(move)
  }

  const handleScramble = async () => {
    if (!plugin) return
    stopGuide()
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
    void startGuide()
  }

  const handleReset = () => {
    stopGuide()
    reset()
  }

  const handleUndo = () => {
    undo()
    if (guideRef.current) void startGuide()
  }

  const handleSolve = async () => {
    if (!plugin || !state) return
    stopGuide()
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
      if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        setCameraLocked((v) => !v)
        return
      }
      const move = moveFromKey({ key: e.key, shiftKey: e.shiftKey, altKey: e.altKey }, plugin.gestureProfile.snapAngleDeg)
      if (!move) return
      e.preventDefault()
      userMove(move)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, plugin])

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#0F1117] text-[#F5F5F7]">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
        <Link to="/" className="text-sm text-[#9A9DB0] hover:text-[#F5F5F7]">
          ← Home
        </Link>
        <h1 className="text-lg font-medium">{plugin?.displayName ?? puzzleId}</h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            data-testid="camera-lock"
            aria-pressed={cameraLocked}
            onClick={toggleCameraLock}
            title="Lock the view (Space, or hold a fist)"
            className={`rounded-lg border px-3 py-1.5 text-xs transition ${
              cameraLocked
                ? 'border-[#F5B83D]/70 bg-[#F5B83D]/15 text-[#F5B83D]'
                : 'border-white/10 text-[#9A9DB0] hover:text-[#F5F5F7]'
            }`}
          >
            {cameraLocked ? 'View locked' : 'Lock view'}
          </button>
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
              gestureTick={canvasTick}
              colorblindPalette={colorblindPalette}
              animatingMove={animatingMove}
              onAnimationComplete={handleAnimationComplete}
              cameraLocked={cameraLocked}
              previewLayer={signsActive && heldSigns[0] ? LAYER_SLICE[heldSigns[0].layer] : null}
              guideMove={guide ? guide.steps[guide.index] : null}
            />

            {(cameraLocked || lockHoldProgress > 0) && (
              <div
                data-testid="lock-badge"
                className="pointer-events-none absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#F5B83D]/40 bg-[#0F1117]/85 px-3 py-1 text-xs text-[#F5B83D]"
              >
                {lockHoldProgress > 0 && (
                  <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden>
                    <circle cx="10" cy="10" r="8" fill="none" stroke="#F5B83D33" strokeWidth="3" />
                    <circle
                      cx="10"
                      cy="10"
                      r="8"
                      fill="none"
                      stroke="#F5B83D"
                      strokeWidth="3"
                      strokeDasharray={`${lockHoldProgress * 50.3} 50.3`}
                      transform="rotate(-90 10 10)"
                    />
                  </svg>
                )}
                {lockHoldProgress > 0 ? (cameraLocked ? 'Keep holding to unlock…' : 'Keep holding to lock…') : 'View locked'}
              </div>
            )}

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
                    {signsActive ? (heldSigns.length ? heldSigns.map((h) => h.notation).join(' + ') : 'Show a sign') : gestures.gestureState.name}
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
              <HandsKey onClose={() => setShowHandsHelp(false)} />
            )}

            {signsActive && heldSigns.length > 0 && <SignsHud signs={heldSigns} />}

            {guideStatus !== 'off' && (
              <GuidePanel
                guide={guide}
                status={guideStatus}
                onStop={stopGuide}
                showHands={inputMode === 'hands'}
              />
            )}
          </div>

          <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t border-white/10 px-6 py-4">
            <button type="button" className={BUTTON} onClick={() => void handleScramble()} disabled={busy}>
              Scramble
            </button>
            <button type="button" className={BUTTON} onClick={handleReset} disabled={busy}>
              Reset
            </button>
            <button type="button" className={BUTTON} onClick={handleUndo} disabled={busy || moveHistory.length === 0}>
              Undo
            </button>
            {!solved && guideStatus === 'off' && (
              <button
                type="button"
                data-testid="guide-me"
                className={`${BUTTON} border-[#F5B83D]/50 text-[#F5B83D]`}
                onClick={() => void startGuide()}
                disabled={busy}
              >
                Guide me
              </button>
            )}
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
