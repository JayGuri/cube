import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

// Face colours in CSS-cube order: front, back, right, left, top, bottom.
const FACE = ['#2FB36B', '#2F6FDE', '#C41E3A', '#FF8A00', '#FFFFFF', '#FFD500']
const FACE_TRANSFORM = [
  'translateZ(var(--h))',
  'rotateY(180deg) translateZ(var(--h))',
  'rotateY(90deg) translateZ(var(--h))',
  'rotateY(-90deg) translateZ(var(--h))',
  'rotateX(90deg) translateZ(var(--h))',
  'rotateX(-90deg) translateZ(var(--h))',
]

const randomFaces = () => FACE.map(() => Array.from({ length: 9 }, () => Math.floor(Math.random() * 6)))
const solvedFaces = () => FACE.map((_, f) => Array<number>(9).fill(f))

// The hero: a cube that tumbles on its own, leans toward the pointer, and
// keeps scrambling itself and settling back to solved.
function HeroCube() {
  const [faces, setFaces] = useState(solvedFaces)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let solved = true
    const id = setInterval(() => {
      solved = !solved
      setFaces(solved ? solvedFaces() : randomFaces())
    }, 2600)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const move = (e: PointerEvent) =>
      setTilt({ x: (e.clientY / window.innerHeight - 0.5) * -24, y: (e.clientX / window.innerWidth - 0.5) * 30 })
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])

  return (
    <div aria-hidden className="hero-stage relative grid h-80 w-full place-items-center sm:h-96">
      <div className="absolute bottom-4 h-8 w-56 rounded-[50%] bg-black/60 blur-xl" />
      <div
        className="transition-transform duration-500 ease-out"
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transformStyle: 'preserve-3d' }}
      >
        <div className="hero-cube">
          {faces.map((face, f) => (
            <div key={f} className="hero-face" style={{ transform: FACE_TRANSFORM[f] }}>
              {face.map((c, i) => (
                <span
                  key={i}
                  className="rounded-[10px] transition-colors duration-500"
                  style={{ background: FACE[c], transitionDelay: `${(i * 37 + f * 53) % 400}ms` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MiniFace({ colors }: { colors: string[] }) {
  return (
    <div
      className="grid w-16 shrink-0 grid-cols-3 gap-1 rounded-xl bg-[#0C0D10] p-1.5 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
      aria-hidden
    >
      {colors.map((c, i) => (
        <div key={i} className="aspect-square rounded-[5px]" style={{ background: c }} />
      ))}
    </div>
  )
}

// Brushed-blue blocks of uneven sizes -- the Mirror Cube in one glance.
function MirrorThumb() {
  return (
    <div
      className="grid w-16 shrink-0 gap-1 rounded-xl bg-[#0C0D10] p-1.5 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110"
      style={{ gridTemplateColumns: '1.4fr 1fr 0.6fr', gridTemplateRows: '1.25fr 1fr 0.75fr', aspectRatio: '1' }}
      aria-hidden
    >
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="rounded-[5px] bg-linear-to-br from-[#8FB0F2] via-[#4F7FE0] to-[#24418A]" />
      ))}
    </div>
  )
}

const STEPS = [
  { title: 'Show a sign', body: 'Each finger pattern picks a layer.' },
  { title: 'Pick a hand', body: 'Right turns it clockwise, left turns it back.' },
  { title: 'Hold still', body: 'The ring fills and the layer turns.' },
]

export function Home() {
  return (
    <main className="min-h-dvh overflow-hidden bg-[#16171B] text-[#ECEAE4]">
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

        <section className="mt-10 grid items-center gap-6 md:grid-cols-[1.1fr_1fr]">
          <div>
            <h1 className="sr-only">HandCube</h1>
            <p className="font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-7xl">
              Solve a cube with your hands.
            </p>
            <p className="mt-5 max-w-sm text-lg text-[#9C9AA3]">Your webcam reads your fingers. No touching needed.</p>
            <Link
              to="/play/cube3"
              className="mt-8 inline-block rounded-full bg-[#FFD500] px-7 py-3 font-semibold text-[#16171B] transition hover:-translate-y-0.5 hover:bg-[#FFE04D] hover:shadow-[0_10px_30px_-10px_#FFD500]"
            >
              Start playing
            </Link>
          </div>
          <HeroCube />
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-bold">Pick a cube</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Link
              to="/play/cube3"
              data-testid="play-cube3"
              className="group flex items-center gap-5 rounded-2xl border border-white/[0.07] bg-[#202227] p-5 transition hover:-translate-y-1 hover:border-[#FFD500]/60"
            >
              <MiniFace
                colors={['#C41E3A', '#FFFFFF', '#2FB36B', '#FFD500', '#2F6FDE', '#FF8A00', '#FFFFFF', '#C41E3A', '#2FB36B']}
              />
              <div>
                <h2 className="font-display text-xl font-bold group-hover:text-[#FFD500]">3x3 Cube</h2>
                <p className="mt-1 text-sm text-[#9C9AA3]">Match every face to one colour.</p>
              </div>
            </Link>
            <Link
              to="/play/mirror"
              data-testid="play-mirror"
              className="group flex items-center gap-5 rounded-2xl border border-white/[0.07] bg-[#202227] p-5 transition hover:-translate-y-1 hover:border-[#4F7FE0]/70"
            >
              <MirrorThumb />
              <div>
                <h2 className="font-display text-xl font-bold group-hover:text-[#8FB0F2]">Mirror Cube</h2>
                <p className="mt-1 text-sm text-[#9C9AA3]">One colour. Solve it by shape.</p>
              </div>
            </Link>
          </div>
        </section>

        <section className="mt-16">
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
        </section>
      </div>
    </main>
  )
}
