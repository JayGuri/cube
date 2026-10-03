import { Alg } from 'cubing/alg'
import { beforeAll, describe, expect, it } from 'vitest'
import { applyMove, createInitialState, initCube3Logic, isSolved, movesFromAlg } from '../puzzles/cube3/logic'
import { solveScramble } from './kociembaCore'
import { initProofTables, initTwoPhase, randomCubie, randomScramble, solveDetailed, solveTwoPhase } from './twoPhase'

// Deterministic pseudo-random numbers, so a failure can be reproduced.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

function randomTurns(next: () => number, tokens: string[], length: number): string {
  const out: string[] = []
  for (let i = 0; i < length; i++) out.push(tokens[Math.floor(next() * tokens.length)] + ['', "'", '2'][Math.floor(next() * 3)])
  return out.join(' ')
}

// cubing.js is an independent implementation: apply scramble then solution.
function solvedAfter(scramble: string, solution: string): boolean {
  let state = createInitialState()
  for (const m of movesFromAlg(new Alg(`${scramble} ${solution}`))) state = applyMove(state, m)
  return isSolved(state)
}

const quarterTurns = (s: string) => s.split(/\s+/).filter(Boolean).reduce((n, m) => n + (m.includes('2') ? 2 : 1), 0)

describe('two-phase solver', () => {
  beforeAll(async () => {
    await initCube3Logic()
    initTwoPhase()
  }, 60_000)

  it('returns nothing for a solved cube', () => {
    expect(solveTwoPhase('')).toBe('')
    expect(solveTwoPhase("R R'")).toBe('')
  })

  it('REGRESSION: a position one turn away is solved by that one turn undone', () => {
    expect(solveTwoPhase('R', { timeMs: 50 })).toBe("R'")
    expect(solveTwoPhase('R2', { timeMs: 50 })).toBe('R2')
    expect(solveTwoPhase('R U', { timeMs: 50 })).toBe("U' R'")
  })

  it('solves random cubes, as judged by cubing.js, in a reasonable number of turns', () => {
    const next = rng(42)
    for (let i = 0; i < 25; i++) {
      const scramble = randomTurns(next, ['U', 'R', 'F', 'D', 'L', 'B'], 25)
      const solution = solveTwoPhase(scramble, { timeMs: 100 })
      expect(solvedAfter(scramble, solution), scramble).toBe(true)
      expect(quarterTurns(solution), scramble).toBeLessThanOrEqual(40)
    }
  }, 60_000)

  it('keeps improving: more time never gives a longer answer', () => {
    const scramble = "F R U' B2 L D' R2 U F' L2 B D2 R' U2 F2 L' B' D"
    const quick = quarterTurns(solveTwoPhase(scramble, { timeMs: 0 }))
    const patient = quarterTurns(solveTwoPhase(scramble, { timeMs: 1200 }))
    expect(patient).toBeLessThanOrEqual(quick)
    expect(patient).toBeLessThanOrEqual(36)
  }, 30_000)

  it('solves the superflip, a famously hard position', () => {
    const superflip = "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2"
    const solution = solveTwoPhase(superflip, { timeMs: 1500 })
    expect(solvedAfter(superflip, solution)).toBe(true)
    // The proven best is 20 face turns (24 steps); we do not aim for optimal.
    expect(quarterTurns(solution)).toBeLessThanOrEqual(36)
  }, 30_000)
})

describe('solving histories with slice turns and rotations', () => {
  beforeAll(async () => {
    await initCube3Logic()
    initTwoPhase()
  }, 60_000)

  it('solves cubes that were made with M, E, S, x, y and z', async () => {
    const next = rng(7)
    for (let i = 0; i < 25; i++) {
      const scramble = randomTurns(next, ['U', 'R', 'F', 'D', 'L', 'B', 'M', 'E', 'S', 'x', 'y', 'z'], 14)
      const solution = await solveScramble(scramble, 60)
      expect(solvedAfter(scramble, solution), scramble).toBe(true)
    }
  }, 60_000)
})

describe('solution length', () => {
  beforeAll(() => initTwoPhase(), 60_000)

  it('REGRESSION: random scrambles average well under 30 steps after a short search', () => {
    const next = rng(2024)
    let total = 0
    const runs = 6
    for (let i = 0; i < runs; i++) {
      const scramble = randomTurns(next, ['U', 'R', 'F', 'D', 'L', 'B'], 30)
      const solution = solveTwoPhase(scramble, { timeMs: 500 })
      expect(solvedAfter(scramble, solution)).toBe(true)
      total += quarterTurns(solution)
    }
    expect(total / runs).toBeLessThan(29)
  }, 60_000)
})

describe("proving a solution is the shortest", () => {
  beforeAll(async () => {
    await initCube3Logic()
    initProofTables()
  }, 60_000)

  it("solves lightly scrambled cubes optimally and says so", () => {
    const next = rng(11)
    for (let i = 0; i < 20; i++) {
      const scramble = randomTurns(next, ["U", "R", "F", "D", "L", "B"], 6)
      const result = solveDetailed(scramble, { timeMs: 200, proveMs: 800 })
      expect(solvedAfter(scramble, result.solution), scramble).toBe(true)
      // Proven: nothing cheaper exists, and it is never worse than undoing the scramble.
      expect(result.noneBelow, scramble).toBe(result.cost)
      expect(result.cost, scramble).toBeLessThanOrEqual(quarterTurns(scramble))
    }
  }, 60_000)

  it("never claims a proof it does not have: noneBelow is at most the cost", () => {
    const next = rng(3)
    for (let i = 0; i < 5; i++) {
      const scramble = randomTurns(next, ["U", "R", "F", "D", "L", "B"], 30)
      const result = solveDetailed(scramble, { timeMs: 150, proveMs: 150 })
      expect(solvedAfter(scramble, result.solution)).toBe(true)
      expect(result.noneBelow).toBeLessThanOrEqual(result.cost)
    }
  }, 60_000)

  it("uses an outside bound: with a 3-step route already known, it proves 3 is the floor", () => {
    const result = solveDetailed("R U F", { timeMs: 100, proveMs: 500, bound: 3 })
    expect(result.cost).toBe(3)
    expect(result.noneBelow).toBe(3)
  })
})

describe("random-state scrambles", () => {
  beforeAll(async () => {
    await initCube3Logic()
    initTwoPhase()
  }, 60_000)

  it("draws only reachable cubes: parities agree, twists and flips add up", () => {
    const parity = (p: number[]) => {
      let n = 0
      for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[j] < p[i]) n++
      return n % 2
    }
    for (let i = 0; i < 200; i++) {
      const c = randomCubie()
      expect(parity(c.cp)).toBe(parity(c.ep))
      expect(c.co.reduce((a, b) => a + b, 0) % 3).toBe(0)
      expect(c.eo.reduce((a, b) => a + b, 0) % 2).toBe(0)
      expect([...c.cp].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
      expect([...c.ep].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    }
  })

  it("makes scrambles that are all different, long enough, and solvable", () => {
    const scrambles = Array.from({ length: 30 }, () => randomScramble())
    expect(new Set(scrambles).size).toBe(30)
    for (const scramble of scrambles) expect(scramble.split(" ").length).toBeGreaterThanOrEqual(16)
    for (const scramble of scrambles.slice(0, 5)) {
      expect(solvedAfter(scramble, "")).toBe(false)
      expect(solvedAfter(scramble, solveTwoPhase(scramble, { timeMs: 50 }))).toBe(true)
    }
  }, 60_000)
})
