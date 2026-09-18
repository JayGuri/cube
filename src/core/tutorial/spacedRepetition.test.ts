import { describe, expect, it } from 'vitest'
import { createNewCard, nextInterval } from './spacedRepetition'

const NOW = 1_700_000_000_000

describe('SM-2 spaced repetition', () => {
  it('a new card starts due immediately with the default ease factor', () => {
    const card = createNewCard(NOW)
    expect(card.easeFactor).toBe(2.5)
    expect(card.dueDate).toBe(NOW)
  })

  it('a perfect recall (quality 5) increases both interval and ease factor', () => {
    const card = createNewCard(NOW)
    const first = nextInterval(card, 5, NOW)
    expect(first.interval).toBeGreaterThan(0)
    expect(first.easeFactor).toBeGreaterThanOrEqual(card.easeFactor)
    expect(first.correctStreak).toBe(1)

    const second = nextInterval(first, 5, NOW)
    expect(second.interval).toBeGreaterThan(first.interval)
  })

  it('a fail (quality 0-2) resets the interval to 1 day and drops the streak', () => {
    let card = createNewCard(NOW)
    card = nextInterval(card, 5, NOW)
    card = nextInterval(card, 5, NOW)
    const easeBefore = card.easeFactor

    const failed = nextInterval(card, 1, NOW)
    expect(failed.interval).toBe(1)
    expect(failed.correctStreak).toBe(0)
    expect(failed.easeFactor).toBeLessThan(easeBefore)
  })

  it('ease factor never drops below the SM-2 floor of 1.3', () => {
    let card = createNewCard(NOW)
    for (let i = 0; i < 20; i++) card = nextInterval(card, 0, NOW)
    expect(card.easeFactor).toBeGreaterThanOrEqual(1.3)
  })

  it('dueDate advances by exactly `interval` days from `now`', () => {
    const card = createNewCard(NOW)
    const next = nextInterval(card, 4, NOW)
    expect(next.dueDate).toBe(NOW + next.interval * 24 * 60 * 60 * 1000)
  })

  it('clamps an out-of-range quality rather than producing nonsense', () => {
    const card = createNewCard(NOW)
    const clampedHigh = nextInterval(card, 99, NOW)
    const exact5 = nextInterval(card, 5, NOW)
    expect(clampedHigh).toEqual(exact5)
  })
})
