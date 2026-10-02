import { Link } from 'react-router-dom'
import type { Lesson } from '../core/academy/lessons'
import { HAND_COLOR } from '../core/gestures/signGestures'
import { SignSequence } from './HandsGuide'

// The teaching column beside the cube in an Academy lesson.

interface Props {
  lesson: Lesson
  index: number
  total: number
  caseNumber: number
  caseCount: number
  done: boolean
  note: string | null
  guiding: boolean
  busy: boolean
  nextLessonId: string | null
  /** The moves to show as hand signs: the lesson's algorithm, or this position's solution. */
  signMoves: string
  onShowMe: () => void
  onNewPosition: () => void
}

const ACTION =
  'rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-[#ECEAE4] transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-40'

export function LessonPanel({
  lesson,
  index,
  total,
  caseNumber,
  caseCount,
  done,
  note,
  guiding,
  busy,
  nextLessonId,
  signMoves,
  onShowMe,
  onNewPosition,
}: Props) {
  const hasPractice = lesson.cases.length > 0
  return (
    <aside
      data-testid="lesson-panel"
      className="max-h-[42%] shrink-0 overflow-y-auto border-b border-white/[0.07] bg-[#1B1D22] p-5 md:max-h-none md:w-[22rem] md:border-b-0 md:border-r"
    >
      <p className="text-sm text-[#FF8A00]">
        Lesson {index + 1} of {total}
      </p>
      <h1 className="font-display mt-1 text-2xl font-bold leading-tight">{lesson.title}</h1>

      <ol className="mt-4 space-y-3 text-[15px] leading-relaxed text-[#C9C7CF]">
        {lesson.steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="font-display mt-0.5 w-5 shrink-0 text-lg font-bold text-[#FF8A00]">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {lesson.algorithm && (
        <div className="mt-5 rounded-xl border border-white/10 bg-[#16171B] p-4">
          <p className="text-sm text-[#9C9AA3]">{lesson.algorithm.name}</p>
          <p data-testid="lesson-algorithm" className="mt-1 break-words font-mono text-lg leading-snug text-[#ECEAE4]">
            {lesson.algorithm.moves}
          </p>
          <p className="mt-1 text-sm text-[#9C9AA3]">{lesson.algorithm.hint}</p>
        </div>
      )}

      {signMoves && (
        <div className="mt-5" data-testid="lesson-signs">
          <p className="text-sm text-[#9C9AA3]">
            With your hands: <b style={{ color: HAND_COLOR.Right }}>right hand</b> turns clockwise,{' '}
            <b style={{ color: HAND_COLOR.Left }}>left hand</b> counter-clockwise. Raise the lit fingers and hold.
          </p>
          <div className="mt-2">
            <SignSequence moves={signMoves} />
          </div>
        </div>
      )}

      {hasPractice && (
        <div className="mt-5">
          <p className="text-sm text-[#9C9AA3]">
            Practice position {caseNumber} of {caseCount}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" data-testid="show-me" className={ACTION} onClick={onShowMe} disabled={busy || guiding || done}>
              Show me
            </button>
            <button type="button" data-testid="new-position" className={ACTION} onClick={onNewPosition} disabled={busy}>
              New position
            </button>
          </div>
        </div>
      )}

      {note && (
        <p data-testid="lesson-note" className="mt-4 rounded-lg bg-[#F5B83D]/10 px-3 py-2 text-sm text-[#F5B83D]">
          {note}
        </p>
      )}

      {done && (
        <div data-testid="lesson-done" className="mt-5 rounded-xl border border-[#2FB36B]/40 bg-[#2FB36B]/10 p-4">
          <p className="font-display text-lg font-bold text-[#4ED48A]">Lesson complete</p>
          {nextLessonId ? (
            <Link
              to={`/learn/${nextLessonId}`}
              data-testid="next-lesson"
              className="mt-3 inline-block rounded-full bg-[#FFD500] px-5 py-2 text-sm font-semibold text-[#16171B] hover:bg-[#FFE04D]"
            >
              Next lesson
            </Link>
          ) : (
            <Link
              to="/play/cube3"
              className="mt-3 inline-block rounded-full bg-[#FFD500] px-5 py-2 text-sm font-semibold text-[#16171B] hover:bg-[#FFE04D]"
            >
              Play freely
            </Link>
          )}
        </div>
      )}
    </aside>
  )
}
