import type { KPattern } from 'cubing/kpuzzle'

// `isIdentical` is exact: a whole-puzzle rotation (e.g. `y` on a 3x3) makes a
// visually-solved puzzle compare unequal, so using it alone tells a user who
// solved the cube while holding it turned that they failed.
//
// `experimentalIsSolved({ ignorePuzzleOrientation: true })` gets this right but
// is only implemented for some puzzles -- skewb throws outright (confirmed in
// the Task 1.1 spike). So: try the good one, fall back to the exact one.
export function isPatternSolved(pattern: KPattern, solved: KPattern): boolean {
  try {
    return pattern.experimentalIsSolved({
      ignorePuzzleOrientation: true,
      // Centres render as one solid colour, so a rotated centre is invisible to
      // the user; reporting it unsolved would be wrong.
      ignoreCenterOrientation: true,
    })
  } catch {
    return pattern.isIdentical(solved)
  }
}

export interface OrbitData {
  pieces: number[]
  orientation: number[]
}

// The { ORBIT: { pieces, orientation } } map behind a KPattern.
export function orbitsOf(pattern: KPattern): Record<string, OrbitData> {
  return (pattern as unknown as { patternData: Record<string, OrbitData> }).patternData
}
