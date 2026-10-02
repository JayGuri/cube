import { Link } from 'react-router-dom'
import { LESSONS, type Lesson } from '../core/academy/lessons'
import { HAND_COLOR } from '../core/gestures/signGestures'
import type { StageProgress } from '../core/academy/stages'
import { useAcademyStore } from '../state/academyStore'
import { SignSequence } from './HandsGuide'

// The teaching column beside the cube in an Academy lesson: what to do, the
// live goal, the finger signs, and ways to practise.

interface Props {
  lesson: Lesson
  index: number
  caseNumber: number
  done: boolean
  note: string | null
  /** Step-by-step guide is showing. */
  guiding: boolean
  /** A demo is playing. */
  watching: boolean
  progress: StageProgress
  /** The moves to show as hand signs: the lesson's algorithm, or this position's solution. */
  signMoves: string
  onWatch: () => void
  onGuide: () => void
  onSelectCase: (index: number) => void
}

const ACTION =
  'rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-[#ECEAE4] transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-40'

export function LessonPanel({ lesson, index, caseNumber, done, note, guiding, watching, progress, signMoves, onWatch, onGuide, onSelectCase }: Props) {
  const completed = useAcademyStore((s) => s.completed)
  const hasPractice = lesson.cases.length > 0
  const prev = LESSONS[index - 1]
  const next = LESSONS[index + 1]
  const fraction = progress.total ? progress.done / progress.total : 0

  return (
    <aside
      data-testid="lesson-panel"
      className="flex max-h-[46%] shrink-0 flex-col overflow-y-auto border-b border-white/[0.07] bg-[#1B1D22] p-5 md:max-h-none md:w-92 md:border-b-0 md:border-r"
    >
      <nav aria-label="Lessons" className="flex items-center gap-1.5">
        {LESSONS.map((l, i) => (
          <Link
            key={l.id}
            to={`/learn/${l.id}`}
            title={l.title}
            aria-label={`Lesson ${i + 1}: ${l.title}`}
            aria-current={i === index ? 'step' : undefined}
            className={`h-2 flex-1 rounded-full transition ${
              i === index ? 'bg-[#FF8A00]' : completed.includes(l.id) ? 'bg-[#2FB36B]' : 'bg-white/15 hover:bg-white/30'
            }`}
          />
        ))}
      </nav>
      <p className="mt-3 text-sm text-[#FF8A00]">
        Lesson {index + 1} of {LESSONS.length}
      </p>
      <h1 className="font-display mt-1 text-2xl font-bold leading-tight">{lesson.title}</h1>

      <section className="mt-4 rounded-xl border border-white/10 bg-[#16171B] p-4" aria-label="Goal">
        <p className="text-sm text-[#9C9AA3]">Your goal</p>
        <p className="mt-1 text-[15px] leading-snug text-[#ECEAE4]">{lesson.goalText}</p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          aria-label={progress.unit}
          className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${done ? 'bg-[#2FB36B]' : 'bg-[#FF8A00]'}`}
            style={{ width: `${(done ? 1 : fraction) * 100}%` }}
          />
        </div>
        <p data-testid="lesson-progress" className="mt-1.5 text-sm text-[#9C9AA3]">
          {progress.done} of {progress.total} {progress.unit}
        </p>
      </section>

      {index > 0 && <p className="mt-3 text-sm text-[#9C9AA3]">The cube is shown with white on the bottom.</p>}

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
        <section className="mt-5" aria-label="Practice">
          <p className="text-sm text-[#9C9AA3]">Practice position</p>
          <div className="mt-2 flex items-center gap-2">
            {lesson.cases.map((_, i) => (
              <button
                key={i}
                type="button"
                data-testid={`case-${i + 1}`}
                aria-pressed={caseNumber === i + 1}
                aria-label={`Practice position ${i + 1}`}
                onClick={() => onSelectCase(i)}
                className={`h-9 w-9 rounded-lg font-display font-bold transition ${
                  caseNumber === i + 1 ? 'bg-[#FF8A00] text-[#16171B]' : 'bg-white/10 text-[#ECEAE4] hover:bg-white/20'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" data-testid="watch-it" className={ACTION} onClick={onWatch} disabled={guiding || done}>
              Watch it
            </button>
            <button type="button" data-testid="show-me" className={ACTION} onClick={onGuide} disabled={guiding || watching || done}>
              Step by step
            </button>
          </div>
          <p className="mt-2 text-sm text-[#9C9AA3]">Watch plays the whole thing. Step by step draws each move on the cube for you to copy.</p>
        </section>
      )}

      {note && (
        <p data-testid="lesson-note" className="mt-4 rounded-lg bg-[#F5B83D]/10 px-3 py-2 text-sm text-[#F5B83D]">
          {note}
        </p>
      )}

      {done && (
        <div data-testid="lesson-done" className="mt-5 rounded-xl border border-[#2FB36B]/40 bg-[#2FB36B]/10 p-4">
          <p className="font-display text-lg font-bold text-[#4ED48A]">Lesson complete</p>
          {next ? (
            <Link
              to={`/learn/${next.id}`}
              data-testid="next-lesson"
              className="mt-3 inline-block rounded-full bg-[#FFD500] px-5 py-2 text-sm font-semibold text-[#16171B] hover:bg-[#FFE04D]"
            >
              Next: {next.title}
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

      <div className="mt-auto flex items-center justify-between gap-3 pt-6 text-sm">
        {prev ? (
          <Link to={`/learn/${prev.id}`} className="text-[#9C9AA3] hover:text-[#ECEAE4]">
            Back: {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next && !done && (
          <Link to={`/learn/${next.id}`} className="text-[#9C9AA3] hover:text-[#ECEAE4]">
            Skip ahead
          </Link>
        )}
      </div>
    </aside>
  )
}
