import { Link } from 'react-router-dom'

// The Cubit mark: a cube seen corner-on. Its two side faces wear the two hand
// colours -- yellow for the right hand, blue for the left -- the same cue the
// signs use inside the app. A "cubit" was an old measure of length, from elbow
// to fingertip: a unit taken from the hand.

const INK = '#10131A'

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <path d="M24 3 42 13.5 24 24 6 13.5Z" fill="#F2F3F7" />
      <path d="M6 13.5 24 24V45L6 34.5Z" fill="#4CC9F0" />
      <path d="M42 13.5 24 24V45L42 34.5Z" fill="#FFD500" />
      <g stroke={INK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M33 8.25 15 18.75M15 8.25 33 18.75" />
        <path d="M15 18.75v21M6 24l18 10.5" />
        <path d="M33 18.75v21M24 34.5 42 24" />
        <path d="M24 3 42 13.5v21L24 45 6 34.5v-21Z M24 24v21M6 13.5 24 24l18-10.5" />
      </g>
    </svg>
  )
}

export function Logo({ to = '/', size = 28 }: { to?: string; size?: number }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5" aria-label="Cubit, home">
      <span className="transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110">
        <LogoMark size={size} />
      </span>
      <span className="font-display text-xl font-extrabold lowercase tracking-tight">cubit</span>
    </Link>
  )
}
