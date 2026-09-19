import { AXES, FACE_FOR, SLICE_FOR, type Axis } from '../gestures/MouseDragAdapter'

// Reverses moveFromDrag's (and the gesture/keyboard adapters', and the
// solver's) notation encoding back into a rotation the renderer can animate.
// Only understands cube3-style layer notation (R/L/U/D/F/B, M/E/S, with a
// trailing "'" or "2") -- mastermorphix reuses this exact notation since it
// shares cube3's kpuzzleDefinitionId, so it gets animation for free. Any other
// letter (pyraminx, skewb, megaminx each have their own notation) returns
// null, and the caller falls back to an instant, unanimated move.

export interface ParsedLayerTurn {
  axis: Axis
  // Which slot value along `axis` this move rotates: -1, 0 (a middle slice),
  // or 1.
  layer: -1 | 0 | 1
  // Radians to rotate the affected layer about the POSITIVE axis direction
  // (three.js's standard right-handed rotation convention) to animate this
  // move from start to finish.
  angle: number
}

const LETTER_TO_FACE: Record<string, { axis: Axis; layer: 1 | -1 }> = {}
const LETTER_TO_SLICE: Record<string, { axis: Axis; followsNegative: boolean }> = {}
for (const axis of AXES) {
  LETTER_TO_FACE[FACE_FOR[axis].positive] = { axis, layer: 1 }
  LETTER_TO_FACE[FACE_FOR[axis].negative] = { axis, layer: -1 }
  LETTER_TO_SLICE[SLICE_FOR[axis].letter] = { axis, followsNegative: SLICE_FOR[axis].followsNegative }
}

export function parseCubeMove(notation: string): ParsedLayerTurn | null {
  const letter = notation[0]
  const modifier = notation.slice(1) // must be exactly '', "'", or '2'
  // megaminx's own notation reuses several of these same letters (U, D, R...)
  // but with modifiers like "++"/"--" for its extra layer depths -- accepting
  // any letter match regardless of modifier treated those as ordinary cube3
  // turns, which (a) animated around the wrong axis and (b) is what made a
  // megaminx solve take ~40s+ in the E2E suite instead of resolving each
  // move instantly like every other non-cube3 puzzle. Reject anything but
  // the three modifiers cube3/mastermorphix notation actually uses.
  if (modifier !== '' && modifier !== "'" && modifier !== '2') return null
  const notationSign = modifier === "'" ? -1 : 1
  const steps = modifier === '2' ? 2 : 1

  const face = LETTER_TO_FACE[letter]
  if (face) {
    // Inverts moveFromDrag's `notationSign = layer > 0 ? turnSign : -turnSign`
    // to recover moveFromDrag's own turnSign -- but that sign describes a
    // rotation about the POSITIVE puzzle axis via the "v = omega x r"
    // physical convention, which is the OPPOSITE sense from what the real
    // cubing.js/kpuzzle engine (the actual source of truth for the committed
    // state) performs for an unprimed face letter. Confirmed empirically:
    // applying plain "U" through the real cube3 plugin and checking which
    // face's stickers land where showed this formula, without the leading
    // minus, animates the INVERSE of the move that actually gets committed
    // -- a real user report ("the animation is right, the result is U
    // inverse"), reproduced and root-caused against the real plugin, not
    // just re-derived on paper.
    const turnSign = face.layer > 0 ? notationSign : -notationSign
    return { axis: face.axis, layer: face.layer, angle: -turnSign * (Math.PI / 2) * steps }
  }

  const slice = LETTER_TO_SLICE[letter]
  if (slice) {
    // Inverts `notationSign = slice.followsNegative ? -turnSign : turnSign`,
    // then applies the same real-kpuzzle correction as the face case above.
    const turnSign = slice.followsNegative ? -notationSign : notationSign
    return { axis: slice.axis, layer: 0, angle: -turnSign * (Math.PI / 2) * steps }
  }

  return null
}
