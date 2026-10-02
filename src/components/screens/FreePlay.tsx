import { Alg } from 'cubing/alg'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CameraDebugOverlay } from '../CameraDebugOverlay'
import { GestureConfidenceIndicator } from '../GestureConfidenceIndicator'
import { GuidePanel, HandsKey, SignsHud } from '../HandsGuide'
import { LessonPanel } from '../LessonPanel'
import { Logo } from '../Logo'
import { PuzzleCanvas } from '../PuzzleCanvas'
import { SolutionPlayer, type PlaybackSpeed } from '../SolutionPlayer'
import { lessonById, lessonIndex } from '../../core/academy/lessons'
import { stageDone, stageProgress } from '../../core/academy/stages'
import { movesFromAlg } from '../../core/puzzles/cube3/logic'
import { createFistLockState, fistLockProgress, stepFistLock } from '../../core/gestures/fistLock'
import { DEFAULT_THRESHOLDS } from '../../core/gestures/GestureRecognizer'
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
import { usePuzzleStore } from '../../state/puzzleStore'
import { useAcademyStore } from '../../state/academyStore'
import { useSettingsStore } from '../../state/settingsStore'

const BUTTON =
  'rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-[#ECEAE4] transition hover:border-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFD500] disabled:cursor-not-allowed disabled:opacity-40'
const PRIMARY =
  'rounded-full bg-[#FFD500] px-5 py-2 text-sm font-semibold text-[#16171B] transition hover:bg-[#FFE04D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFD500] disabled:cursor-not-allowed disabled:opacity-40'

type InputMode = 'mouse' | 'hands'

// The Academy holds the cube with white at the bottom. That is the same cube
// turned over, so only the colours shown change: white and yellow trade
// places, and so do green and blue.
const FLIP_COLORS: Record<string, string> = {
  '#FFFFFF': '#FFD500',
  '#FFD500': '#FFFFFF',
  '#009E60': '#0051BA',
  '#0051BA': '#009E60',
}

export function FreePlay({ lessonId }: { lessonId?: string } = {}) {
  const { puzzleId: routePuzzleId = 'cube3' } = useParams<{ puzzleId: string }>()
  const lesson = lessonId ? lessonById(lessonId) : undefined
  const puzzleId = lesson ? 'cube3' : routePuzzleId
  const { plugin, state, moveHistory, status, error } = usePuzzleStore()
  const { load, applyMove, reset, undo, isSolved } = usePuzzleStore()
  const defaultInputMode = useSettingsStore((s) => s.defaultInputMode)
  const colorblindPalette = useSettingsStore((s) => s.colorblindPalette)
  const swapHands = useSettingsStore((s) => s.swapHands)
  const thresholds = DEFAULT_THRESHOLDS

  const [inputMode, setInputMode] = useState<InputMode>(defaultInputMode)
  // Hands mode always shows its gesture key until dismissed: there is no
  // other way for a first-time user to discover the vocabulary.
  const [showHandsHelp, setShowHandsHelp] = useState(!lessonId)
  // First-visit mouse tips; dismissal is remembered on this device.
  const [tipsOpen, setTipsOpen] = useState(() => {
    try {
      return localStorage.getItem(TIPS_KEY) !== 'dismissed'
    } catch {
      return true
    }
  })
  const dismissTips = () => {
    setTipsOpen(false)
    try {
      localStorage.setItem(TIPS_KEY, 'dismissed')
    } catch {
      // Storage blocked: the tips simply come back next visit.
    }
  }
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

  // --- Solution playback ----------------------------------------------------
  // "Solve for me" finds a solution, then plays it back where it can be paused,
  // stepped through either way and sped up.
  const [solution, setSolution] = useState<{ moves: Move[]; index: number } | null>(null)
  const solutionRef = useRef<{ moves: Move[]; index: number } | null>(null)
  const [solveStatus, setSolveStatus] = useState<'off' | 'solving' | 'ready'>('off')
  const solveTokenRef = useRef(0)
  const solveActiveRef = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const setSolutionBoth = (next: { moves: Move[]; index: number } | null) => {
    solutionRef.current = next
    setSolution(next)
  }

  const closeSolution = () => {
    solveTokenRef.current++
    solveActiveRef.current = false
    setPlaying(false)
    setSolutionBoth(null)
    setSolveStatus('off')
  }

  useEffect(() => {
    if (!playing) return
    let alive = true
    void (async () => {
      await drainQueue()
      if (!alive) return
      const s = solutionRef.current
      if (!s || s.index >= s.moves.length) {
        setPlaying(false)
        return
      }
      // Count the move first, then play it: pausing at any instant leaves the
      // index and the cube in agreement.
      setSolutionBoth({ ...s, index: s.index + 1 })
      void enqueueMoves([s.moves[s.index]])
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, solution?.index])

  const stepSolution = (direction: 1 | -1) => {
    const s = solutionRef.current
    if (!s || playing) return
    if (direction === 1 && s.index < s.moves.length) {
      setSolutionBoth({ ...s, index: s.index + 1 })
      void enqueueMoves([s.moves[s.index]])
    } else if (direction === -1 && s.index > 0) {
      const m = s.moves[s.index - 1]
      setSolutionBoth({ ...s, index: s.index - 1 })
      void enqueueMoves([{ alg: m.alg.invert(), snapAngleDeg: m.snapAngleDeg }])
    }
  }

  // --- Academy lessons ---------------------------------------------------------
  const completeLesson = useAcademyStore((s) => s.complete)
  const [caseIndex, setCaseIndex] = useState(0)
  const [lessonNote, setLessonNote] = useState<string | null>(null)
  const [lessonDone, setLessonDone] = useState(false)

  // Put the cube in a lesson's practice position (not animated).
  const setupCase = (i: number) => {
    if (!lesson) return
    stopGuide()
    setLessonNote(null)
    setLessonDone(false)
    moveQueueRef.current = []
    reset()
    const c = lesson.cases[i]
    if (c) for (const m of movesFromAlg(new Alg(c.setup))) applyMove(m)
    setCaseIndex(i)
  }

  const checkLesson = () => {
    if (!lesson) return
    const { state: now, moveHistory: history } = usePuzzleStore.getState()
    if (!now) return
    const met = lesson.goal ? stageDone(lesson.goal, now) : history.length >= 4
    if (met) {
      setLessonDone(true)
      completeLesson(lesson.id)
    }
  }

  useEffect(() => {
    if (lesson && status === 'ready') setupCase(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id, plugin, status])

  // The numbers behind the lesson's progress bar: how many pieces are right.
  const lessonProgress =
    lesson && state
      ? lesson.goal
        ? stageProgress(lesson.goal, state)
        : { done: Math.min(moveHistory.length, 4), total: 4, unit: 'turns made' }
      : { done: 0, total: 1, unit: '' }

  // Play the whole practice solution as a demo, with the usual player controls.
  const watchIt = () => {
    const c = lesson?.cases[caseIndex]
    if (!lesson || !c) return
    closeSolution()
    setupCase(caseIndex)
    solveActiveRef.current = true
    setSolutionBoth({ moves: movesFromAlg(new Alg(c.solution)), index: 0 })
    setSolveStatus('ready')
    setPlaying(true)
  }

  const showMe = () => {
    const c = lesson?.cases[caseIndex]
    if (!lesson || !c) return
    setupCase(caseIndex)
    setGuideBoth(createGuide(movesFromAlg(new Alg(c.solution))))
    setGuideStatus('following')
  }

  // --- Guided solve ------------------------------------------------------
  // Opt-in via "Guide me"; it shows one quarter turn at a time. Moves the user
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
    if (solveActiveRef.current) closeSolution()
    void enqueueMoves([move]).then(checkLesson)
    let g = guideRef.current
    if (!g) return
    for (const step of expandSteps([move])) {
      const r = followMove(g, step)
      if (r.outcome === 'off-track') {
        if (lesson) {
          // A lesson's moves are fixed; there is nothing to re-solve.
          stopGuide()
          setLessonNote('That was not the move shown. Press Undo to take it back, then Show me again.')
          return
        }
        void startGuide()
        return
      }
      g = r.guide
      if (r.outcome === 'finished') {
        if (lesson) {
          stopGuide()
          return
        }
        // Don't announce "Solved!" while queued turns are still animating --
        // wait for the cube to actually land, and only celebrate if it really
        // is solved; otherwise keep guiding from wherever it ended up.
        const token = ++guideTokenRef.current
        setGuideBoth(null)
        setGuideStatus('solving')
        void drainQueue().then(() => {
          if (token !== guideTokenRef.current) return
          if (usePuzzleStore.getState().isSolved()) setGuideStatus('done')
          else void startGuide()
        })
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
    closeSolution()
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
    // No guide here on purpose: after a scramble the user solves it
    // themselves by default, and opts in with "Guide me" if they want help.
  }

  const handleReset = () => {
    stopGuide()
    closeSolution()
    reset()
  }

  const handleUndo = () => {
    closeSolution()
    setLessonNote(null)
    undo()
    if (guideRef.current && !lesson) void startGuide()
  }

  const handleSolve = async () => {
    if (!plugin || !state) return
    stopGuide()
    closeSolution()
    const token = solveTokenRef.current
    solveActiveRef.current = true
    setSolveStatus('solving')
    setQueueError(null)
    try {
      await drainQueue()
      const { state: now, moveHistory: history } = usePuzzleStore.getState()
      const moves = await plugin.solve(now!, history)
      if (token !== solveTokenRef.current) return // stopped or superseded while thinking
      if (moves.length === 0) {
        closeSolution()
        return
      }
      setSolutionBoth({ moves, index: 0 })
      setSolveStatus('ready')
      setPlaying(true)
    } catch (e) {
      if (token === solveTokenRef.current) {
        setQueueError((e as Error).message)
        closeSolution()
      }
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

  const showMouseTips = !lesson && inputMode === 'mouse' && tipsOpen && guideStatus === 'off' && solveStatus === 'off'

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#16171B] text-[#ECEAE4]">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-6">
        <Logo size={24} />
        <div className="flex min-w-0 items-center gap-3 max-sm:sr-only">
        <span className="text-white/20" aria-hidden>
          /
        </span>
        {lesson ? (
          <>
            <Link to="/learn" className="text-sm text-[#9C9AA3] hover:text-[#ECEAE4]">
              Learn
            </Link>
            <span className="text-white/20" aria-hidden>
              /
            </span>
            <span className="text-sm text-[#9C9AA3]">{lesson.title}</span>
          </>
        ) : (
          <h1 className="text-sm text-[#9C9AA3]">{plugin?.displayName ?? puzzleId}</h1>
        )}
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div role="group" aria-label="Control with" className="flex rounded-full bg-[#202227] p-1 text-sm">
            <button
              type="button"
              data-testid="input-mode-mouse"
              aria-pressed={inputMode === 'mouse'}
              onClick={() => setInputMode('mouse')}
              className={`rounded-full px-3.5 py-1 transition ${inputMode === 'mouse' ? 'bg-[#FFD500] font-semibold text-[#16171B]' : 'text-[#9C9AA3] hover:text-[#ECEAE4]'}`}
            >
              Mouse
            </button>
            <button
              type="button"
              data-testid="input-mode-hands"
              aria-pressed={inputMode === 'hands'}
              onClick={() => setInputMode('hands')}
              className={`rounded-full px-3.5 py-1 transition ${inputMode === 'hands' ? 'bg-[#FFD500] font-semibold text-[#16171B]' : 'text-[#9C9AA3] hover:text-[#ECEAE4]'}`}
            >
              Hands
            </button>
          </div>
          <button
            type="button"
            data-testid="camera-lock"
            aria-pressed={cameraLocked}
            onClick={toggleCameraLock}
            title="Freeze the view so the cube stays put (Space, or hold a fist)"
            className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition ${
              cameraLocked
                ? 'border-[#F5B83D] bg-[#F5B83D]/15 text-[#F5B83D]'
                : 'border-white/10 text-[#9C9AA3] hover:border-white/25 hover:text-[#ECEAE4]'
            }`}
          >
            {cameraLocked ? 'View locked' : 'Lock view'}
          </button>
        </div>
      </header>

      {status === 'loading' && <p className="p-6 text-[#9C9AA3]">Loading the cube…</p>}
      {status === 'error' && <p className="p-6 text-[#EF4444]">{error}</p>}

      {status === 'ready' && plugin && state && (
        <>
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {lesson && (
            <LessonPanel
              lesson={lesson}
              index={lessonIndex(lesson.id)}
              caseNumber={caseIndex + 1}
              done={lessonDone}
              note={lessonNote}
              guiding={guideStatus !== 'off'}
              watching={solveStatus !== 'off'}
              progress={lessonProgress}
              signMoves={lesson.algorithm?.moves ?? lesson.cases[caseIndex]?.solution ?? ''}
              onWatch={watchIt}
              onGuide={showMe}
              onSelectCase={setupCase}
            />
          )}
          <div className="relative min-h-0 w-full flex-1">
            <PuzzleCanvas
              plugin={plugin}
              state={state}
              onMove={handleMove}
              className="h-full w-full"
              gestureTick={canvasTick}
              colorblindPalette={colorblindPalette}
              colorRemap={lesson ? FLIP_COLORS : undefined}
              turnMs={solveStatus === 'ready' ? Math.round(220 / speed) : undefined}
              animatingMove={animatingMove}
              onAnimationComplete={handleAnimationComplete}
              cameraLocked={cameraLocked}
              previewLayer={signsActive && heldSigns[0] ? LAYER_SLICE[heldSigns[0].layer] : null}
              guideMove={guide ? guide.steps[guide.index] : null}
            />

            {(cameraLocked || lockHoldProgress > 0) && (
              <div
                data-testid="lock-badge"
                className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-[#F5B83D]/40 bg-[#16171B]/90 px-3 py-1 text-sm text-[#F5B83D]"
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

            {showMouseTips && <MouseTips onClose={dismissTips} mirror={plugin.id === 'mirror'} />}

            {inputMode === 'hands' && (
              <div className="absolute right-4 top-4 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#202227] shadow-lg">
                <div className="relative aspect-video bg-black">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    ref={gestures.videoRef}
                    className="h-full w-full -scale-x-100 object-cover"
                    playsInline
                    muted
                    data-testid="gesture-video"
                  />
                  <CameraDebugOverlay frame={gestures.frame} width={256} height={144} />
                </div>
                <div className="flex items-center justify-between px-2.5 py-1.5">
                  <GestureConfidenceIndicator frame={gestures.frame} />
                  <span className="shrink-0 text-xs text-[#9C9AA3]" data-testid="gesture-state">
                    {heldSigns.length ? heldSigns.map((h) => h.notation).join(' + ') : 'Show a sign'}
                  </span>
                </div>
                {gestures.error && (
                  <p className="bg-[#EF4444]/15 px-2.5 py-1.5 text-xs text-[#EF4444]" data-testid="gesture-error">
                    {gestures.error}
                  </p>
                )}
              </div>
            )}

            {inputMode === 'hands' && showHandsHelp && <HandsKey onClose={() => setShowHandsHelp(false)} />}
            {inputMode === 'hands' && !showHandsHelp && (
              <button
                type="button"
                onClick={() => setShowHandsHelp(true)}
                className="absolute left-4 top-4 rounded-full border border-white/10 bg-[#202227] px-3.5 py-1.5 text-sm text-[#9C9AA3] hover:text-[#ECEAE4]"
              >
                Show hand signs
              </button>
            )}

            {signsActive && heldSigns.length > 0 && <SignsHud signs={heldSigns} />}

            {guideStatus !== 'off' && (
              <GuidePanel guide={guide} status={guideStatus} onStop={stopGuide} showHands={inputMode === 'hands' || Boolean(lesson)} />
            )}

            {solveStatus !== 'off' && (
              <SolutionPlayer
                status={solveStatus}
                moves={solution?.moves.map((m) => m.alg.toString()) ?? []}
                index={solution?.index ?? 0}
                playing={playing}
                speed={speed}
                steps={solution ? expandSteps(solution.moves).length : 0}
                onPlayPause={() => setPlaying((v) => !v)}
                onStep={stepSolution}
                onSpeed={setSpeed}
                onClose={closeSolution}
              />
            )}
          </div>
          </div>

          {lesson ? (
            <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/[0.07] px-4 py-3 sm:gap-3 sm:px-6">
              <button type="button" className={BUTTON} onClick={handleUndo} disabled={busy || moveHistory.length === 0}>
                Undo
              </button>
              <button type="button" className={BUTTON} onClick={() => setupCase(caseIndex)} disabled={busy}>
                Restart position
              </button>
              <div className="mx-auto flex items-center gap-3 text-sm">
                <span
                  data-testid="lesson-status"
                  className={`rounded-full px-3 py-1 font-semibold ${lessonDone ? 'bg-[#2FB36B]/15 text-[#4ED48A]' : 'bg-white/5 text-[#9C9AA3]'}`}
                >
                  {lessonDone ? 'Complete' : 'In progress'}
                </span>
                <span className="tabular-nums text-[#9C9AA3]" data-testid="move-count">
                  {moveHistory.length} moves
                </span>
              </div>
              <Link to="/learn" className={BUTTON}>
                All lessons
              </Link>
            </footer>
          ) : (
          <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-white/[0.07] px-4 py-3 sm:gap-3 sm:px-6">
            <button type="button" className={PRIMARY} onClick={() => void handleScramble()} disabled={busy}>
              Scramble
            </button>
            <button type="button" className={BUTTON} onClick={handleUndo} disabled={busy || moveHistory.length === 0}>
              Undo
            </button>
            <button type="button" className={BUTTON} onClick={handleReset} disabled={busy}>
              Reset
            </button>

            <div className="mx-auto flex items-center gap-3 text-sm">
              <span
                data-testid="solved-status"
                className={`rounded-full px-3 py-1 font-semibold ${
                  solved ? 'bg-[#2FB36B]/15 text-[#4ED48A]' : 'bg-white/5 text-[#9C9AA3]'
                }`}
              >
                {solved ? 'Solved' : 'Scrambled'}
              </span>
              <span className="tabular-nums text-[#9C9AA3]" data-testid="move-count">
                {moveHistory.length} moves
              </span>
            </div>

            {!solved && guideStatus === 'off' && (
              <button
                type="button"
                data-testid="guide-me"
                title="Shows the next move to make, one step at a time"
                className={`${BUTTON} border-[#F5B83D]/60 text-[#F5B83D] hover:border-[#F5B83D]`}
                onClick={() => void startGuide()}
                disabled={busy}
              >
                Guide me
              </button>
            )}
            <button
              type="button"
              className={BUTTON}
              title="Plays the whole solution for you"
              onClick={() => void handleSolve()}
              disabled={busy || solved || solveStatus !== 'off'}
            >
              Solve for me
            </button>
          </footer>
          )}

          {(error || queueError) && <p className="px-6 pb-3 text-sm text-[#EF4444]">{error || queueError}</p>}
        </>
      )}
    </main>
  )
}

const TIPS_KEY = 'cubit.tips.v1'

function MouseTips({ onClose, mirror }: { onClose: () => void; mirror: boolean }) {
  return (
    <div
      data-testid="mouse-tips"
      className="absolute left-4 top-4 w-[calc(100%-2rem)] rounded-xl border border-white/10 bg-[#202227]/95 p-4 text-sm text-[#9C9AA3] shadow-lg sm:w-72"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h2 className="font-display text-base font-bold text-[#ECEAE4]">How to turn the cube</h2>
        <button type="button" onClick={onClose} aria-label="Hide tips" className="text-lg leading-none hover:text-[#ECEAE4]">
          ×
        </button>
      </div>
      <ul className="space-y-1.5">
        {mirror && (
          <li>
            <b className="text-[#ECEAE4]">Solved</b> when the blocks form a perfect cube again. The thick blocks belong on
            the Right, Top and Front.
          </li>
        )}
        <li>
          <b className="text-[#ECEAE4]">Drag a {mirror ? 'block' : 'piece'}</b> to turn its layer.
        </li>
        <li>
          <b className="text-[#ECEAE4]">Drag empty space</b> or right-drag to look around; scroll to zoom.
        </li>
        <li className="max-sm:hidden">
          Or press <Kbd>R</Kbd> <Kbd>U</Kbd> <Kbd>F</Kbd> <Kbd>L</Kbd> <Kbd>D</Kbd> <Kbd>B</Kbd>, with <Kbd>Shift</Kbd> to
          turn the other way.
        </li>
        <li className="max-sm:hidden">
          <Kbd>Space</Kbd> locks the view.
        </li>
      </ul>
      <p className="mt-3 border-t border-white/10 pt-3 max-sm:hidden">
        Press <b className="text-[#ECEAE4]">Scramble</b> and solve it yourself. Stuck?{' '}
        <b className="text-[#F5B83D]">Guide me</b> shows the next move.
      </p>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 font-sans text-xs text-[#ECEAE4]">{children}</kbd>
}
