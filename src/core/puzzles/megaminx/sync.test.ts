import { Alg } from 'cubing/alg'
import { beforeAll, describe, expect, it } from 'vitest'
import { applyMove, createInitialState, initMegaminxLogic, movesFromAlg } from './logic'
import { MEGAMINX_COLORS } from './geometry'
import { buildMegaminxGeometry } from './geometry'
import { faceletColors, pieceIdForFacelet } from './sync'

const run = (alg: string) => {
  let state = createInitialState()
  for (const m of movesFromAlg(new Alg(alg), 72)) state = applyMove(state, m)
  return state
}

describe('megaminx sync', () => {
  beforeAll(async () => {
    await initMegaminxLogic()
  }, 20_000)

  it('covers all 62 pieces', () => {
    expect(faceletColors(createInitialState()).size).toBe(62)
    expect(buildMegaminxGeometry().pieces.length).toBe(62)
  })

  it('a solved megaminx shows each face as one uniform colour', () => {
    const colors = faceletColors(createInitialState())
    for (const piece of buildMegaminxGeometry().pieces) {
      const faceColors = colors.get(piece.pieceId)!
      const [, , faceStr] = piece.pieceId.split('-')
      for (const face of faceStr.split('_')) {
        expect(faceColors[`F${face}`]).toBe(MEGAMINX_COLORS[`F${face}`])
      }
    }
  })

  it('a whole-face turn unsolves some pieces and its inverse restores them', () => {
    const before = faceletColors(createInitialState())
    const after = faceletColors(run('R++'))
    let anyDiff = false
    for (const [id, colors] of before) {
      if (JSON.stringify(after.get(id)) !== JSON.stringify(colors)) anyDiff = true
    }
    expect(anyDiff).toBe(true)

    const restored = faceletColors(run("R++ R--"))
    for (const [id, colors] of before) {
      expect(restored.get(id)).toEqual(colors)
    }
  })

  it('rejects an unknown facelet id', () => {
    expect(() => pieceIdForFacelet(createInitialState(), 'not-a-real-slot')).toThrow(/unknown/)
  })
})
