import { Link } from 'react-router-dom'
import { LESSONS } from '../../core/academy/lessons'
import { useAcademyStore } from '../../state/academyStore'
import { Logo } from '../Logo'

// The lesson list. One path from "meet the cube" to a solved cube.

export function Academy() {
  const completed = useAcademyStore((s) => s.completed)
  const reset = useAcademyStore((s) => s.reset)
  const next = LESSONS.find((l) => !completed.includes(l.id)) ?? LESSONS[LESSONS.length - 1]
  const finished = LESSONS.every((l) => completed.includes(l.id))
  const started = completed.length > 0

  return (
    <main className="min-h-dvh bg-[#16171B] text-[#ECEAE4]">
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <nav className="flex items-center justify-between text-sm">
          <Logo />
          <Link to="/play/cube3" className="text-[#9C9AA3] hover:text-[#ECEAE4]">
            Free play
          </Link>
        </nav>

        <header className="mt-14">
          <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
            Learn to solve it.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-[#9C9AA3]">
            Eight short lessons, one layer at a time. Each one has practice positions, and a button that shows you the
            moves on the cube.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to={`/learn/${next.id}`}
              data-testid="academy-continue"
              className="rounded-full bg-[#FF8A00] px-7 py-3 font-semibold text-[#16171B] transition hover:-translate-y-0.5 hover:bg-[#FFA033]"
            >
              {finished ? 'Review a lesson' : started ? 'Continue' : 'Start lesson 1'}
            </Link>
            <span className="flex items-center gap-3 text-sm text-[#9C9AA3]" data-testid="academy-progress">
              <span className="h-2 w-28 overflow-hidden rounded-full bg-white/10" aria-hidden>
                <span className="block h-full rounded-full bg-[#2FB36B] transition-[width]" style={{ width: `${(completed.length / LESSONS.length) * 100}%` }} />
              </span>
              <span>{completed.length} of {LESSONS.length} done</span>
            </span>
          </div>
        </header>

        <ol className="relative mt-14 space-y-3">
          <span className="absolute bottom-6 left-[1.35rem] top-6 w-px bg-white/10" aria-hidden />
          {LESSONS.map((lesson, i) => {
            const done = completed.includes(lesson.id)
            const current = lesson.id === next.id && !finished
            return (
              <li key={lesson.id}>
                <Link
                  to={`/learn/${lesson.id}`}
                  data-testid={`lesson-${lesson.id}`}
                  className={`group relative flex items-center gap-5 rounded-2xl border p-4 transition hover:-translate-y-0.5 ${
                    current ? 'border-[#FF8A00]/60 bg-[#FF8A00]/[0.07]' : 'border-white/[0.07] bg-[#1B1D22] hover:border-white/20'
                  }`}
                >
                  <span
                    className={`font-display relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-extrabold ${
                      done ? 'bg-[#2FB36B] text-[#16171B]' : current ? 'bg-[#FF8A00] text-[#16171B]' : 'bg-[#2A2D34] text-[#9C9AA3]'
                    }`}
                  >
                    {done ? (
                      <svg width="18" height="18" viewBox="0 0 18 18" aria-label="Done">
                        <path d="m3 9.5 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span>
                    <span className="font-display block text-lg font-bold leading-tight">{lesson.title}</span>
                    <span className="block text-[#9C9AA3]">{lesson.blurb}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>

        {started && (
          <button type="button" onClick={reset} className="mt-8 text-sm text-[#9C9AA3] underline-offset-4 hover:text-[#ECEAE4] hover:underline">
            Clear my progress
          </button>
        )}
      </div>
    </main>
  )
}
