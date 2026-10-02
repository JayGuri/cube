import { beforeAll, describe, expect, it } from 'vitest'
import { applyAlgString, createInitialState, initCube3Logic } from '../puzzles/cube3/logic'
import { LESSONS, invertMoves } from './lessons'
import { STAGE_ORDER, stageBefore, stageDone } from './stages'

const solved = () => createInitialState()
const run = (alg: string, from = solved()) => applyAlgString(from, alg)

describe('Academy stages', () => {
  beforeAll(async () => {
    await initCube3Logic()
  })

  it('a solved cube satisfies every stage', () => {
    for (const goal of STAGE_ORDER) expect(stageDone(goal, solved())).toBe(true)
  })

  it('a stage includes the stages before it', () => {
    // Breaking a first-layer corner breaks every later stage but not the cross.
    const broken = run("R U R' U'")
    expect(stageDone('cross', broken)).toBe(true)
    expect(stageDone('firstLayer', broken)).toBe(false)
    expect(stageDone('solved', broken)).toBe(false)
  })

  it('inverting an algorithm undoes it', () => {
    const alg = "R U' F2 L' D B2"
    expect(invertMoves(invertMoves(alg))).toBe(alg)
    for (const goal of STAGE_ORDER) expect(stageDone(goal, run(invertMoves(alg), run(alg)))).toBe(true)
  })
})

describe('Academy lessons', () => {
  beforeAll(async () => {
    await initCube3Logic()
  })

  const withGoal = LESSONS.filter((l) => l.goal)

  it('has a lesson for every stage, in order', () => {
    expect(withGoal.map((l) => l.goal)).toEqual(['cross', 'firstLayer', 'secondLayer', 'topCross', 'topFace', 'topCorners', 'solved'])
  })

  for (const lesson of withGoal) {
    const goal = lesson.goal!
    const before = stageBefore(goal)
    lesson.cases.forEach((c, i) => {
      it(`${lesson.id}, practice position ${i + 1}: starts unfinished, keeps earlier layers, and the solution finishes it`, () => {
        const start = run(c.setup)
        expect(stageDone(goal, start), 'starts unfinished').toBe(false)
        if (before) expect(stageDone(before, start), 'earlier layers intact').toBe(true)
        const end = run(c.solution, start)
        expect(stageDone(goal, end), 'solution reaches the goal').toBe(true)
      })
    })
  }

  it('every algorithm leaves the earlier layers alone, however many times it is repeated', () => {
    for (const lesson of withGoal) {
      const before = stageBefore(lesson.goal!)
      if (!before || !lesson.algorithm) continue
      let state = solved()
      for (let i = 0; i < 6; i++) {
        state = run(lesson.algorithm.moves, state)
        expect(stageDone(before, state), `${lesson.id} repeat ${i + 1}`).toBe(true)
      }
    }
  })
})
