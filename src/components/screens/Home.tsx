import { Link } from 'react-router-dom'

interface PuzzleCard {
  id: string
  name: string
  blurb: string
  available: boolean
}

// Phase 6-8 flip these to available as each plugin lands.
const PUZZLES: PuzzleCard[] = [
  { id: 'cube3', name: '3x3 Cube', blurb: 'The classic. 26 pieces, 43 quintillion states.', available: true },
  { id: 'pyraminx', name: 'Pyraminx', blurb: 'Tetrahedral, four trivial tips.', available: false },
  { id: 'skewb', name: 'Skewb', blurb: 'Corner-turning, body-diagonal axes.', available: false },
  { id: 'mastermorphix', name: 'Mastermorphix', blurb: 'A 3x3 wrapped in tetrahedral plastic.', available: false },
  { id: 'megaminx', name: 'Megaminx', blurb: 'Twelve pentagonal faces, 62 pieces.', available: false },
]

export function Home() {
  return (
    <main className="min-h-dvh bg-[#0F1117] px-6 py-12 text-[#F5F5F7]">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-semibold tracking-tight">HandCube</h1>
        <p className="mt-2 max-w-2xl text-[#9A9DB0]">
          Solve twisty puzzles with your hands. Pick a puzzle to start.
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PUZZLES.map((p) => (
            <li key={p.id}>
              {p.available ? (
                <Link
                  to={`/play/${p.id}`}
                  className="block rounded-xl border border-white/10 bg-[#1A1D27] p-5 transition hover:border-[#00D4FF]/60 hover:bg-[#242837]"
                >
                  <h2 className="text-lg font-medium">{p.name}</h2>
                  <p className="mt-1 text-sm text-[#9A9DB0]">{p.blurb}</p>
                  <span className="mt-4 inline-block text-sm text-[#00D4FF]">Free play →</span>
                </Link>
              ) : (
                <div className="rounded-xl border border-white/5 bg-[#1A1D27]/50 p-5 opacity-60">
                  <h2 className="text-lg font-medium">{p.name}</h2>
                  <p className="mt-1 text-sm text-[#9A9DB0]">{p.blurb}</p>
                  <span className="mt-4 inline-block text-sm text-[#9A9DB0]">Coming soon</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
