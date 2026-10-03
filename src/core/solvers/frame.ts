// The solver understands face turns only (U R F D L B). Hand signs and the
// keyboard can also make slice turns (M E S), and tests use whole-cube
// rotations (x y z). All of these can be rewritten as face turns plus a
// whole-cube rotation:
//
//   M = R L' x'      E = U D' y'      S = F' B z
//
// A whole-cube rotation changes nothing about how scrambled the cube is, only
// which face we call "Up". So instead of rotating, we keep a `frame`: for each
// face label as the player sees it NOW, which face of the original cube it is.
// Moves after a rotation are then relabelled through the frame, and the
// solution is relabelled back the other way. The app judges "solved" without
// caring how the cube is held, so this is exact.

type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'
export type Frame = Record<Face, Face>

const IDENTITY_FRAME: Frame = { U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B' }

// For each rotation: after it, the face now labelled K is the one that was
// labelled SOURCE[K] just before. (x turns like R: the front goes up; y turns
// like U: the front goes left; z turns like F: the top goes right.)
const SOURCE: Record<'x' | 'y' | 'z', Frame> = {
  x: { U: 'F', F: 'D', D: 'B', B: 'U', R: 'R', L: 'L' },
  y: { L: 'F', F: 'R', R: 'B', B: 'L', U: 'U', D: 'D' },
  z: { R: 'U', D: 'R', L: 'D', U: 'L', F: 'F', B: 'B' },
}

function rotate(frame: Frame, axis: 'x' | 'y' | 'z', quarterTurns: number): Frame {
  let f = frame
  for (let i = 0; i < quarterTurns; i++) {
    const next = { ...f }
    for (const face of Object.keys(f) as Face[]) next[face] = f[SOURCE[axis][face]]
    f = next
  }
  return f
}

/**
 * Rewrites any algorithm (face turns, slices, rotations) as face turns on the
 * original cube, and returns the frame the cube ends up held in.
 */
export function toFaceTurns(alg: string): { turns: string; frame: Frame } {
  let frame = IDENTITY_FRAME
  const out: string[] = []

  for (const [, letter, suffix] of alg.matchAll(/([URFDLBMESxyz])(2'?|')?/g)) {
    const steps = suffix?.startsWith('2') ? 2 : 1
    const prime = suffix === "'"
    for (let s = 0; s < steps; s++) {
      const face = (f: Face, p: boolean) => out.push(frame[f] + (p ? "'" : ''))
      switch (letter) {
        case 'U':
        case 'R':
        case 'F':
        case 'D':
        case 'L':
        case 'B':
          face(letter, prime)
          break
        case 'M': // R L' x'
          face('R', prime)
          face('L', !prime)
          frame = rotate(frame, 'x', prime ? 1 : 3)
          break
        case 'E': // U D' y'
          face('U', prime)
          face('D', !prime)
          frame = rotate(frame, 'y', prime ? 1 : 3)
          break
        case 'S': // F' B z
          face('F', !prime)
          face('B', prime)
          frame = rotate(frame, 'z', prime ? 3 : 1)
          break
        default: // x y z
          frame = rotate(frame, letter as 'x' | 'y' | 'z', prime ? 3 : 1)
      }
    }
  }
  return { turns: out.join(' '), frame }
}

/** Relabels a face-turn solution (in original-cube terms) for a cube held in `frame`. */
export function fromOriginalFrame(solution: string, frame: Frame): string {
  const labelFor = Object.fromEntries((Object.keys(frame) as Face[]).map((k) => [frame[k], k])) as Frame
  return solution.replace(/[URFDLB]/g, (face) => labelFor[face as Face])
}
