import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetDbConnectionForTests,
  getAllLessonProgress,
  getAlgoStats,
  getDueAlgoStats,
  getLessonProgress,
  getSolveTimes,
  recordSolveTime,
  setAlgoStats,
  setLessonProgress,
} from './progressStore'

beforeEach(() => {
  // Fresh in-memory IndexedDB per test via fake-indexeddb/auto's own reset,
  // plus a fresh connection since the module caches its DB promise.
  indexedDB = new IDBFactory()
  __resetDbConnectionForTests()
})

describe('progressStore', () => {
  it('returns undefined for lesson progress that has never been set', async () => {
    expect(await getLessonProgress('cube3', 'Cross')).toBeUndefined()
  })

  it('round-trips lesson progress', async () => {
    await setLessonProgress({
      puzzleId: 'cube3',
      trackName: 'Cross',
      completedSteps: 2,
      lastPracticed: 1700000000000,
      bestMoveCount: 8,
    })
    const record = await getLessonProgress('cube3', 'Cross')
    expect(record).toEqual({
      puzzleId: 'cube3',
      trackName: 'Cross',
      completedSteps: 2,
      lastPracticed: 1700000000000,
      bestMoveCount: 8,
    })
  })

  it('overwrites on a second set to the same key', async () => {
    await setLessonProgress({ puzzleId: 'cube3', trackName: 'Cross', completedSteps: 1, lastPracticed: 1, bestMoveCount: null })
    await setLessonProgress({ puzzleId: 'cube3', trackName: 'Cross', completedSteps: 4, lastPracticed: 2, bestMoveCount: 6 })
    const all = await getAllLessonProgress()
    expect(all).toHaveLength(1)
    expect(all[0].completedSteps).toBe(4)
  })

  it('filters due algo stats by dueDate and puzzleId', async () => {
    const now = 1_000_000
    await setAlgoStats({ puzzleId: 'cube3', algoCaseId: 'PLL-Ua', easeFactor: 2.5, interval: 1, dueDate: now - 10, correctStreak: 1 })
    await setAlgoStats({ puzzleId: 'cube3', algoCaseId: 'PLL-Ub', easeFactor: 2.5, interval: 1, dueDate: now + 10_000, correctStreak: 0 })
    await setAlgoStats({ puzzleId: 'pyraminx', algoCaseId: 'X', easeFactor: 2.5, interval: 1, dueDate: now - 10, correctStreak: 0 })

    const due = await getDueAlgoStats('cube3', now)
    expect(due.map((r) => r.algoCaseId)).toEqual(['PLL-Ua'])
    expect(await getAlgoStats('cube3', 'PLL-Ub')).toBeDefined()
  })

  it('auto-increments solve time ids and filters by puzzle', async () => {
    await recordSolveTime({ puzzleId: 'cube3', moves: 20, timeMs: 15000, date: 1, wasGestureControlled: true })
    await recordSolveTime({ puzzleId: 'skewb', moves: 8, timeMs: 4000, date: 2, wasGestureControlled: false })
    const cube3Times = await getSolveTimes('cube3')
    expect(cube3Times).toHaveLength(1)
    expect(cube3Times[0].moves).toBe(20)
    expect(await getSolveTimes()).toHaveLength(2)
  })
})
