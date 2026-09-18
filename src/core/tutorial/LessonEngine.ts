import type { LessonTrack, Move, PuzzleState } from '../puzzles/PuzzlePlugin'

// Drives a LessonTrack (spec 9.2): advances currentStepIndex only when the
// current step's validate() passes, tracks progress, and calls onIncorrect
// when a move is applied that doesn't (yet) satisfy the step.

export interface LessonEngineState {
  currentStepIndex: number
  moveHistory: Move[]
  completed: boolean
}

export function createLessonEngineState(): LessonEngineState {
  return { currentStepIndex: 0, moveHistory: [], completed: false }
}

export interface LessonEngine {
  track: LessonTrack
  state: LessonEngineState
  currentStep: LessonTrack['steps'][number] | null
  progressFraction: number
  // Feeds a move + the resulting state; returns whether the current step just
  // completed. Advancing is idempotent: calling this again after completion
  // with the same trailing state does not re-fire completion.
  recordMove: (move: Move, resultingState: PuzzleState) => { advanced: boolean }
  reset: () => void
}

export function createLessonEngine(
  track: LessonTrack,
  onIncorrect?: (state: PuzzleState, moveHistory: Move[]) => void,
): LessonEngine {
  let state = createLessonEngineState()

  const currentStep = () =>
    state.completed ? null : track.steps[state.currentStepIndex] ?? null

  return {
    track,
    get state() {
      return state
    },
    get currentStep() {
      return currentStep()
    },
    get progressFraction() {
      if (track.steps.length === 0) return 1
      return state.currentStepIndex / track.steps.length
    },
    recordMove(move, resultingState) {
      state = { ...state, moveHistory: [...state.moveHistory, move] }
      const step = currentStep()
      if (!step) return { advanced: false }

      if (step.validate(resultingState, state.moveHistory)) {
        const nextIndex = state.currentStepIndex + 1
        state = {
          ...state,
          currentStepIndex: nextIndex,
          completed: nextIndex >= track.steps.length,
        }
        return { advanced: true }
      }

      onIncorrect?.(resultingState, state.moveHistory)
      return { advanced: false }
    },
    reset() {
      state = createLessonEngineState()
    },
  }
}
