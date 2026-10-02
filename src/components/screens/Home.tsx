import { useEffect, useRef, useState } from 'react'
import { parseCubeMove } from '../../core/animation/parseCubeMove'
import {
  applyMoveToPieces,
  createPieces,
  currentSlot,
  type Mat3,
  type TrackedPiece,
  type Vec3,
} from '../../core/puzzles/mirror/pieces'
import { Link } from 'react-router-dom'

// Each cubie's six faces, in CSS space (y points down): transform, and the
// outward math-space direction that face shows when the cubie is home.
const SIDES: { t: string; n: Vec3; color: string }[] = [
  { t: 'translateZ(var(--hs))', n: [0, 0, 1], color: '#2FB36B' },
  { t: 'rotateY(180deg) translateZ(var(--hs))', n: [0, 0, -1], color: '#2F6FDE' },
  { t: 'rotateY(90deg) translateZ(var(--hs))', n: [1, 0, 0], color: '#C41E3A' },
  { t: 'rotateY(-90deg) translateZ(var(--hs))', n: [-1, 0, 0], color: '#FF8A00' },
  { t: 'rotateX(90deg) translateZ(var(--hs))', n: [0, 1, 0], color: '#FFFFFF' },
  { t: 'rotateX(-90deg) translateZ(var(--hs))', n: [0, -1, 0], color: '#FFD500' },
]
const FACES = ['R', 'L', 'U', 'D', 'F', 'B']
const TURN_MS = 280
const CUBIE = 66
// Same order as createPieces(), so index i always names the same cubie.
const HOMES = createPieces()

// Rotation about a math axis by any angle, as rows.
function axisRot(axis: number, a: number): Mat3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  if (axis === 0) return [[1, 0, 0], [0, c, -s], [0, s, c]]
  if (axis === 1) return [[c, 0, s], [0, 1, 0], [-s, 0, c]]
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]]
}
const mul = (a: Mat3, b: Mat3) =>
  a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j])) as Mat3

// Math space is y-up, CSS is y-down: flip y on both sides, then write the
// matrix column-major for matrix3d, and move the cubie out to its home.
function cubieTransform(m: Mat3, home: Vec3): string {
  const f = [1, -1, 1]
  const c = (i: number, j: number) => f[i] * f[j] * m[i][j]
  return (
    `matrix3d(${c(0, 0)},${c(1, 0)},${c(2, 0)},0,${c(0, 1)},${c(1, 1)},${c(2, 1)},0,${c(0, 2)},${c(1, 2)},${c(2, 2)},0,0,0,0,1) ` +
    `translate3d(${home[0] * CUBIE}px,${-home[1] * CUBIE}px,${home[2] * CUBIE}px)`
  )
}

const invert = (m: string) => (m.endsWith("'") ? m[0] : m + "'")
const randomScramble = () => {
  const out: string[] = []
  while (out.length < 14) {
    const f = FACES[Math.floor(Math.random() * 6)]
    if (out.length && out[out.length - 1][0] === f) continue
    out.push(Math.random() < 0.5 ? f : f + "'")
  }
  return out
}

// The hero: a real 3x3 that turns its layers -- it scrambles itself, then
// solves back move by move -- while tumbling and leaning toward the pointer.
function HeroCube() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const els = useRef<(HTMLDivElement | null)[]>([])
  const pieces = useRef<TrackedPiece[]>(createPieces())

  useEffect(() => {
    const draw = (turn?: { axis: number; layer: number; angle: number }) => {
      pieces.current.forEach((p, i) => {
        const el = els.current[i]
        if (!el) return
        let m = p.rotation
        if (turn && currentSlot(p)[turn.axis] === turn.layer) m = mul(axisRot(turn.axis, turn.angle), m)
        el.style.transform = cubieTransform(m, p.home)
      })
    }
    draw()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    let timer = 0
    let cancelled = false
    const wait = (ms: number) => new Promise<void>((r) => (timer = window.setTimeout(r, ms)))
    const animate = (move: string) =>
      new Promise<void>((resolve) => {
        const t = parseCubeMove(move)!
        const axis = { x: 0, y: 1, z: 2 }[t.axis]
        const start = performance.now()
        const step = (now: number) => {
          if (cancelled) return
          const k = Math.min(1, (now - start) / TURN_MS)
          const ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
          if (k < 1) {
            draw({ axis, layer: t.layer, angle: t.angle * ease })
            raf = requestAnimationFrame(step)
          } else {
            pieces.current = applyMoveToPieces(pieces.current, move)
            draw()
            resolve()
          }
        }
        raf = requestAnimationFrame(step)
      })

    ;(async () => {
      await wait(700)
      while (!cancelled) {
        const scramble = randomScramble()
        for (const m of scramble) if (!cancelled) await animate(m)
        await wait(900)
        for (const m of [...scramble].reverse()) if (!cancelled) await animate(invert(m))
        await wait(1800)
      }
    })()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
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
        <div className="hero-cube" style={{ ['--hs' as string]: `${CUBIE / 2}px`, ['--c' as string]: `${CUBIE}px` }}>
          {HOMES.map((p, i) => (
            <div key={i} className="hero-cubie" ref={(el) => void (els.current[i] = el)}>
              {SIDES.map((s, j) => {
                const outward = s.n.every((v, k) => v === 0 || v === p.home[k])
                return (
                  <div key={j} className="hero-sticker" style={{ transform: s.t }}>
                    {outward && <span style={{ background: s.color }} />}
                  </div>
                )
              })}
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
