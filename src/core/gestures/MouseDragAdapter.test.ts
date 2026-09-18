import { beforeAll, describe, expect, it } from 'vitest'
import {
  applyMove,
  createInitialState,
  initCube3Logic,
  isSolved,
} from '../puzzles/cube3/logic'
import { faceletColors } from '../puzzles/cube3/sync'
import { CUBE3_COLORS, slotId, type Face } from '../puzzles/cube3/geometry'
import { moveFromDrag, type DragInput } from './MouseDragAdapter'

// A camera looking at the front-top-right, giving each puzzle axis a distinct
// screen direction. y is negated because screen y grows downward.
const axisScreenDirs: DragInput['axisScreenDirs'] = {
  x: [1, 0],
  y: [0, -1],
  z: [0.5, 0.5],
}

const drag = (over: Partial<DragInput>): DragInput => ({
  hitNormal: [0, 1, 0],
  slot: [1, 1, 1],
  dragScreen: [40, 0],
  axisScreenDirs,
  ...over,
})

describe('moveFromDrag', () => {
  beforeAll(async () => {
    await initCube3Logic()
  })

  it('ignores a drag shorter than the click threshold', () => {
    expect(moveFromDrag(drag({ dragScreen: [2, 1] }))).toBeNull()
  })

  it('produces a move for a real drag', () => {
    expect(moveFromDrag(drag({}))).not.toBeNull()
  })

  it('dragging the opposite way gives the inverse move', () => {
    const a = moveFromDrag(drag({ dragScreen: [40, 0] }))!
    const b = moveFromDrag(drag({ dragScreen: [-40, 0] }))!
    expect(a.alg.toString()).toBe(b.alg.invert().toString())
  })

  it('always emits a legal single turn of the layer that was grabbed', () => {
    const cases: DragInput[] = [
      drag({ hitNormal: [0, 1, 0], slot: [1, 1, 1], dragScreen: [40, 0] }),
      drag({ hitNormal: [1, 0, 0], slot: [1, 1, 1], dragScreen: [0, -40] }),
      drag({ hitNormal: [0, 0, 1], slot: [1, -1, 1], dragScreen: [40, 0] }),
      drag({ hitNormal: [0, -1, 0], slot: [-1, -1, -1], dragScreen: [-40, 0] }),
      drag({ hitNormal: [-1, 0, 0], slot: [-1, 0, 1], dragScreen: [0, 40] }),
    ]
    for (const input of cases) {
      const move = moveFromDrag(input)
      expect(move, JSON.stringify(input)).not.toBeNull()
      expect(move!.alg.toString()).toMatch(/^[UDFBRLMES]'?$/)
      expect(move!.snapAngleDeg).toBe(90)
      // The turn must actually change the cube.
      const after = applyMove(createInitialState(), move!)
      expect(isSolved(after)).toBe(false)
    }
  })

  it('grabbing a middle layer yields a slice move, not an outer face turn', () => {
    // hit the U face and drag along +x: the rotation axis is z, so the grabbed
    // layer is the slot's z component -- 0 here, i.e. the S slice.
    const move = moveFromDrag(drag({ hitNormal: [0, 1, 0], slot: [1, 1, 0] }))!
    expect(move.alg.toString()).toMatch(/^[MES]'?$/)
  })

  it('dragging right across the U face turns the layer the cube actually shows', () => {
    // Drag along +x over the top face: the grabbed layer is z = +1 (the front
    // slice through the hit cubie), so the F face must move. Assert via colours,
    // which is what the user sees -- not via the notation string.
    const move = moveFromDrag(
      drag({ hitNormal: [0, 1, 0], slot: [1, 1, 1], dragScreen: [40, 0] }),
    )!
    const state = applyMove(createInitialState(), move)
    const colors = faceletColors(state)
    const topFront = colors.get(slotId([0, 1, 1]))!['U' as Face]
    expect(topFront).not.toBe(CUBE3_COLORS.U)
  })
})
