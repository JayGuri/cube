import { Alg } from 'cubing/alg'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePuzzleStore } from './puzzleStore'

const move = (s: string) => ({ alg: new Alg(s), snapAngleDeg: 90 })
const store = () => usePuzzleStore.getState()

describe('puzzleStore', () => {
  beforeEach(async () => {
    await store().load('cube3')
  })

  it('loads cube3 into a ready, solved state', () => {
    expect(store().status).toBe('ready')
    expect(store().plugin?.id).toBe('cube3')
    expect(store().isSolved()).toBe(true)
    expect(store().moveHistory).toHaveLength(0)
  })

  it('reports an unknown puzzle as an error instead of hanging', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await store().load('nope' as any)
    expect(store().status).toBe('error')
    expect(store().error).toMatch(/unknown puzzle/)
  })

  it('applies a move, recording history and unsolving', () => {
    store().applyMove(move('R'))
    expect(store().moveHistory).toHaveLength(1)
    expect(store().isSolved()).toBe(false)
  })

  it('undo reverses the last move', () => {
    store().applyMove(move('R'))
    store().applyMove(move('U'))
    store().undo()
    expect(store().moveHistory).toHaveLength(1)
    store().undo()
    expect(store().moveHistory).toHaveLength(0)
    expect(store().isSolved()).toBe(true)
  })

  it('undo on an empty history is a no-op, not a crash', () => {
    store().undo()
    expect(store().moveHistory).toHaveLength(0)
    expect(store().isSolved()).toBe(true)
  })

  it('reset returns to solved and clears history', () => {
    store().applyMove(move('R'))
    store().reset()
    expect(store().isSolved()).toBe(true)
    expect(store().moveHistory).toHaveLength(0)
  })

  it('scramble unsolves the puzzle and records the moves', async () => {
    await store().scramble()
    expect(store().isSolved()).toBe(false)
    expect(store().moveHistory.length).toBeGreaterThan(0)
    expect(store().busy).toBe(false)
  })

  it('solve() drives the puzzle back to solved and clears busy', async () => {
    await store().scramble()
    expect(store().isSolved()).toBe(false)
    await store().solve()
    expect(store().busy).toBe(false)
    expect(store().error).toBeNull()
    expect(store().isSolved()).toBe(true)
  }, 60_000)

  it('solve() on an untouched cube is a no-op, not an error', async () => {
    await store().solve()
    expect(store().error).toBeNull()
    expect(store().isSolved()).toBe(true)
  })
})
