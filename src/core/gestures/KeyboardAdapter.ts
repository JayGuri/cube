import { Alg } from 'cubing/alg'
import type { Move } from '../puzzles/PuzzlePlugin'

// Task 10.2: full keyboard-only control path, feeding the same Move shape
// mouse and gesture input produce (spec 8.6) -- letter keys matching WCA
// face notation directly (more discoverable than an arrow-key scheme), Shift
// for the prime (counter-clockwise) direction, Alt for a double turn.
//
// Pure function, no DOM: testable the same way MouseDragAdapter is.

const KEY_TO_LETTER: Record<string, string> = {
  u: 'U',
  d: 'D',
  l: 'L',
  r: 'R',
  f: 'F',
  b: 'B',
}

export interface KeyboardChord {
  key: string
  shiftKey: boolean
  altKey: boolean
}

export function moveFromKey(chord: KeyboardChord, snapAngleDeg: number): Move | null {
  const letter = KEY_TO_LETTER[chord.key.toLowerCase()]
  if (!letter) return null
  const suffix = chord.altKey ? '2' : chord.shiftKey ? "'" : ''
  return { alg: new Alg(`${letter}${suffix}`), snapAngleDeg }
}
