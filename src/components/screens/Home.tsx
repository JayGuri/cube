import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

// Sticker colours of a real cube; the hero face settles from a scramble into
// solid white once, as the page opens.
const STICKERS = ['#FFFFFF', '#FFD500', '#2FB36B', '#2F6FDE', '#C41E3A', '#FF8A00']
const SCRAMBLED = [4, 1, 2, 5, 0, 3, 1, 5, 2]

function SettlingFace() {
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 450)
    return () => clearTimeout(t)
  }, [])
  return (
    <div
      aria-hidden
      className="grid aspect-square w-full max-w-76 grid-cols-3 gap-2 rounded-[1.75rem] bg-[#0C0D10] p-3 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]"
    >
      {SCRAMBLED.map((c, i) => (
        <div
          key={i}
          className="rounded-xl transition-colors duration-700 ease-out"
          style={{ background: settled ? STICKERS[0] : STICKERS[c], transitionDelay: `${i * 90}ms` }}
        />
      ))}
    </div>
  )
}

function MiniFace({ colors }: { colors: string[] }) {
  return (
    <div className="grid w-16 shrink-0 grid-cols-3 gap-1 rounded-xl bg-[#0C0D10] p-1.5" aria-hidden>
      {colors.map((c, i) => (
        <div key={i} className="aspect-square rounded-[5px]" style={{ background: c }} />
      ))}
    </div>
  )
}

// Silver blocks of uneven sizes -- the Mirror Cube's whole idea in one glance.
function MirrorThumb() {
  return (
    <div
      className="grid w-16 shrink-0 gap-1 rounded-xl bg-[#0C0D10] p-1.5"
      style={{ gridTemplateColumns: '1.4fr 1fr 0.6fr', gridTemplateRows: '1.25fr 1fr 0.75fr', aspectRatio: '1' }}
      aria-hidden
    >
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="rounded-[5px] bg-linear-to-br from-[#E8E9EC] to-[#8F939B]" />
      ))}
    </div>
  )
}

const STEPS = [
  { title: 'Show a sign', body: 'Hold up fingers on one hand. Each finger pattern picks a layer of the cube.' },
  { title: 'Pick a direction', body: 'Your right hand turns it clockwise, your left hand counter-clockwise.' },
  { title: 'Hold still', body: 'Keep the sign up until the ring fills, and the layer turns.' },
]

export function Home() {
  return (
    <main className="min-h-dvh bg-[#16171B] text-[#ECEAE4]">
      <div className="mx-auto max-w-5xl px-6 pb-20 pt-8">
        <nav className="flex items-center justify-between text-sm">
          <span className="font-display text-lg font-bold tracking-tight">HandCube</span>
          <div className="flex gap-5 text-[#9C9AA3]">
            <Link to="/trainer" className="hover:text-[#ECEAE4]">
              Algorithm trainer
            </Link>
            <Link to="/settings" className="hover:text-[#ECEAE4]">
              Settings
            </Link>
          </div>
        </nav>

        <section className="mt-14 grid items-center gap-12 md:grid-cols-[1.2fr_1fr]">
          <div>
            <h1 className="sr-only">HandCube</h1>
            <p className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
              Solve a Rubik&rsquo;s cube with your hands.
            </p>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[#9C9AA3]">
              Your webcam reads your fingers, so you can turn the cube on screen without touching anything. A mouse and
              keyboard work too.
            </p>
            <Link
              to="/play/cube3"
              className="mt-8 inline-block rounded-full bg-[#FFD500] px-7 py-3 font-semibold text-[#16171B] transition hover:bg-[#FFE04D]"
            >
              Start with the 3x3
            </Link>
          </div>
          <div className="flex justify-center md:justify-end">
            <SettlingFace />
          </div>
        </section>

        <section className="mt-20">
          <h2 className="font-display text-2xl font-bold">Pick a cube</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Link
              to="/play/cube3"
              data-testid="play-cube3"
              className="group flex items-center gap-5 rounded-2xl border border-white/[0.07] bg-[#202227] p-5 transition hover:border-[#FFD500]/60"
            >
              <MiniFace
                colors={['#C41E3A', '#FFFFFF', '#2FB36B', '#FFD500', '#2F6FDE', '#FF8A00', '#FFFFFF', '#C41E3A', '#2FB36B']}
              />
              <div>
                <h2 className="font-display text-xl font-bold group-hover:text-[#FFD500]">3x3 Cube</h2>
                <p className="mt-1 text-sm text-[#9C9AA3]">The classic. Match every face to one colour.</p>
              </div>
            </Link>
            <Link
              to="/play/mirror"
              data-testid="play-mirror"
              className="group flex items-center gap-5 rounded-2xl border border-white/[0.07] bg-[#202227] p-5 transition hover:border-[#C8CBD1]/70"
            >
              <MirrorThumb />
              <div>
                <h2 className="font-display text-xl font-bold group-hover:text-[#E8E9EC]">Mirror Cube</h2>
                <p className="mt-1 text-sm text-[#9C9AA3]">
                  All silver. Every piece is a different size, so you solve by shape.
                </p>
              </div>
            </Link>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="font-display text-2xl font-bold">How hand control works</h2>
          <ol className="mt-6 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="font-display text-4xl font-extrabold text-[#FFD500]">{i + 1}</span>
                <h3 className="mt-2 text-lg font-bold">{s.title}</h3>
                <p className="mt-1 text-[#9C9AA3]">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-2xl text-[#9C9AA3]">
            After you scramble, try it on your own. If you get stuck, press{' '}
            <b className="text-[#F5B83D]">Guide me</b> and an arrow on the cube shows the next move.
          </p>
        </section>
      </div>
    </main>
  )
}
