import { Link } from 'react-router-dom'

export function Home() {
  return (
    <main className="min-h-dvh bg-[#0F1117] px-6 py-12 text-[#F5F5F7]">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">HandCube</h1>
            <p className="mt-2 max-w-xl text-[#9A9DB0]">
              A 3x3 you solve with your hands -- show a sign to pick a layer, swipe to turn it.
            </p>
          </div>
          <nav className="flex shrink-0 gap-4">
            <Link to="/trainer" className="text-sm text-[#9A9DB0] hover:text-[#F5F5F7]">
              Algorithm Trainer
            </Link>
            <Link to="/settings" className="text-sm text-[#9A9DB0] hover:text-[#F5F5F7]">
              Settings
            </Link>
          </nav>
        </div>

        <Link
          to="/play/cube3"
          data-testid="play-cube3"
          className="mt-10 block rounded-xl border border-white/10 bg-[#1A1D27] p-6 transition hover:border-[#00D4FF]/60 hover:bg-[#242837]"
        >
          <h2 className="text-xl font-medium">3x3 Cube</h2>
          <p className="mt-1 text-sm text-[#9A9DB0]">The classic. 26 pieces, 43 quintillion states.</p>
          <span className="mt-4 inline-block text-sm text-[#00D4FF]">Start solving →</span>
        </Link>
      </div>
    </main>
  )
}
