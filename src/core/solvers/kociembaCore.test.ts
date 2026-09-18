import { Alg } from 'cubing/alg'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  applyMove,
  createInitialState,
  initCube3Logic,
  isSolved,
  movesFromAlg,
} from '../puzzles/cube3/logic'
import { initSolverCore, isSolverReady, solveScramble } from './kociembaCore'

// The real correctness test: apply the scramble, apply the solver's answer,
// and assert cubing/kpuzzle -- an independent implementation -- calls it solved.
async function solvesFor(scramble: string): Promise<boolean> {
  const solution = await solveScramble(scramble)
  let state = createInitialState()
  for (const m of movesFromAlg(new Alg(scramble))) state = applyMove(state, m)
  if (solution.trim()) {
    for (const m of movesFromAlg(new Alg(solution))) state = applyMove(state, m)
  }
  return isSolved(state)
}

describe('kociemba solver core', () => {
  beforeAll(async () => {
    await initCube3Logic()
    await initSolverCore()
  }, 60_000)

  it('reports ready after init', () => {
    expect(isSolverReady()).toBe(true)
  })

  it('returns an empty solution for an empty scramble rather than throwing', async () => {
    // cube-solver itself throws on empty input; the core must absorb that,
    // because "already solved" is a completely normal thing for the UI to ask.
    await expect(solveScramble('')).resolves.toBe('')
    await expect(solveScramble('   ')).resolves.toBe('')
  })

  it('rejects input that is not an algorithm', async () => {
    await expect(solveScramble('not-an-alg')).rejects.toThrow(/valid algorithm/)
  })

  it('refuses a facelet string instead of silently misbehaving', async () => {
    // 54 facelet chars are all drawn from URFDLB, so they slip past
    // cube-solver's own regex and crash deep inside it. Guard explicitly.
    const facelets = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB'
    await expect(solveScramble(facelets)).rejects.toThrow()
  })

  it('solves a single turn', async () => {
    expect(await solvesFor('R')).toBe(true)
  })

  it('solves a sexy move', async () => {
    expect(await solvesFor("R U R' U'")).toBe(true)
  })

  it('solves a full WCA-length scramble', async () => {
    expect(await solvesFor("F R U' B2 L D' R2 U F' L2 B D2 R' U2 F2 L' B' D")).toBe(true)
  })

  it('returns a solution within the plan ceiling of 30 moves', async () => {
    const solution = await solveScramble("D2 R' U2 B2 L F2 U' R B D L2 F' U2 R2 F2 D B2 D' F2")
    const length = solution.split(/\s+/).filter(Boolean).length
    expect(length).toBeGreaterThan(0)
    expect(length).toBeLessThanOrEqual(30)
  })
})
