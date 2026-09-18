// Task 9.1: standard SM-2 spaced-repetition scheduler (the same algorithm
// family Anki uses), implemented directly from the public formula rather
// than inventing a variant.

export interface CardState {
  easeFactor: number
  interval: number // days
  dueDate: number // epoch ms
  correctStreak: number
}

export function createNewCard(now = Date.now()): CardState {
  return { easeFactor: 2.5, interval: 0, dueDate: now, correctStreak: 0 }
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * SM-2 update. `quality` is 0-5 (0-2 = fail/hard, resets the interval and
 * drops ease; 3-5 = pass, grows the interval and ease).
 */
export function nextInterval(card: CardState, quality: number, now = Date.now()): CardState {
  const q = Math.max(0, Math.min(5, quality))

  const nextEase = Math.max(
    1.3,
    card.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  )

  if (q < 3) {
    return {
      easeFactor: nextEase,
      interval: 1,
      dueDate: now + DAY_MS,
      correctStreak: 0,
    }
  }

  const streak = card.correctStreak + 1
  let interval: number
  if (streak === 1) interval = 1
  else if (streak === 2) interval = 6
  else interval = Math.round(card.interval * nextEase)

  return {
    easeFactor: nextEase,
    interval,
    dueDate: now + interval * DAY_MS,
    correctStreak: streak,
  }
}
