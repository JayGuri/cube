import { Link } from 'react-router-dom'
import { isPuzzleAvailable } from '../../core/puzzles/registry'

interface PuzzleCard {
  id: string
  name: string
  blurb: string
}

const PUZZLES: PuzzleCard[] = [
  { id: 'cube3', name: '3x3 Cube', blurb: 'The classic. 26 pieces, 43 quintillion states.' },
  { id: 'pyraminx', name: 'Pyraminx', blurb: 'Tetrahedral, four trivial tips.' },
  { id: 'skewb', name: 'Skewb', blurb: 'Corner-turning, body-diagonal axes.' },
  { id: 'mastermorphix', name: 'Mastermorphix', blurb: 'A 3x3 wrapped in tetrahedral plastic.' },
  { id: 'megaminx', name: 'Megaminx', blurb: 'Twelve pentagonal faces, 62 pieces.' },
]

export function Home() {
  return (
    <main className="min-h-dvh bg-[#0F1117] px-6 py-12 text-[#F5F5F7]">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">HandCube</h1>
            <p className="mt-2 max-w-2xl text-[#9A9DB0]">
              Solve twisty puzzles with your hands. Pick a puzzle to start.
            </p>
          </div>
          <Link to="/settings" className="text-sm text-[#9A9DB0] hover:text-[#F5F5F7]">
            Settings
          </Link>
        </div>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PUZZLES.map((p) => {
            const available = isPuzzleAvailable(p.id)
            return (
              <li key={p.id}>
                {available ? (
                  <div className="rounded-xl border border-white/10 bg-[#1A1D27] p-5 transition hover:border-[#00D4FF]/60 hover:bg-[#242837]">
                    <h2 className="text-lg font-medium">{p.name}</h2>
                    <p className="mt-1 text-sm text-[#9A9DB0]">{p.blurb}</p>
                    <div className="mt-4 flex gap-4">
                      <Link to={`/play/${p.id}`} className="text-sm text-[#00D4FF]">
                        Free play →
                      </Link>
                      <Link to={`/academy/${p.id}`} className="text-sm text-[#6C63FF]">
                        Academy →
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/5 bg-[#1A1D27]/50 p-5 opacity-60">
                    <h2 className="text-lg font-medium">{p.name}</h2>
                    <p className="mt-1 text-sm text-[#9A9DB0]">{p.blurb}</p>
                    <span className="mt-4 inline-block text-sm text-[#9A9DB0]">Coming soon</span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </main>
  )
}
