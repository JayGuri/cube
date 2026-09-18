import { describe, expect, it } from 'vitest'
import { CUBE3_COLORS } from './cube3/geometry'
import { applyColorblindPalette } from './colorblindPalette'

describe('applyColorblindPalette', () => {
  it('remaps every WCA cube colour to a distinct value', () => {
    const remapped = applyColorblindPalette(CUBE3_COLORS)
    const values = Object.values(remapped)
    expect(new Set(values).size).toBe(values.length)
  })

  it('leaves white unchanged (it is not part of the red/green confusion)', () => {
    expect(applyColorblindPalette(CUBE3_COLORS).U).toBe('#FFFFFF')
  })

  it('moves red and green far enough apart to differ from the original pair', () => {
    const remapped = applyColorblindPalette(CUBE3_COLORS)
    expect(remapped.F).not.toBe(CUBE3_COLORS.F) // green
    expect(remapped.R).not.toBe(CUBE3_COLORS.R) // red
    expect(remapped.F).not.toBe(remapped.R)
  })

  it('passes through an unknown hex unchanged rather than dropping it', () => {
    expect(applyColorblindPalette({ X: '#123456' }).X).toBe('#123456')
  })
})
