import { expect, test, type Page } from '@playwright/test'

// Drives the REAL app with synthetic hand-landmark frames through the
// dev-only injection seam in useHandGestures (there is no camera in CI).
// Everything after MediaPipe's detection -- the sign recognizer, the fist
// lock, the animated move queue, the renderer -- runs exactly as it does live.

type Real = 'Right' | 'Left'

async function openHands(page: Page) {
  await page.goto('/play/cube3')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  await page.getByTestId('input-mode-hands').click()
  await page.waitForFunction(() => typeof (globalThis as never as { __handcubeInjectFrame?: unknown }).__handcubeInjectFrame === 'function')
  await expect(page.getByTestId('gesture-style-signs')).toBeVisible()
}

// Feeds frames one by one with a real gap, so React renders (and the
// recognizer sees) every frame instead of batching them into one.
async function feed(page: Page, frames: Array<{ mask: string; real: Real; cx: number; cy: number } | null>) {
  await page.evaluate(async (frames) => {
    const inject = (globalThis as never as { __handcubeInjectFrame: (f: unknown) => void }).__handcubeInjectFrame
    const t0 = performance.now()
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i]
      let hands: unknown[] = []
      if (f) {
        const s = 0.06
        const at = (x: number, y: number) => ({ x: f.cx + x * s, y: f.cy + y * s, z: 0 })
        const lm = Array.from({ length: 21 }, () => at(0, 0))
        lm[0] = at(0, 1)
        const xs = [-0.3, -0.1, 0.1, 0.3]
        ;[5, 9, 13, 17].forEach((idx, k) => (lm[idx] = at(xs[k], 0)))
        ;[8, 12, 16, 20].forEach((idx, k) => (lm[idx] = f.mask[k] === '1' ? at(xs[k] * 1.2, -1) : at(xs[k], 0.4)))
        lm[4] = at(-0.6, 0.5)
        // MediaPipe labels unmirrored frames with the opposite hand.
        hands = [{ landmarks: lm, handedness: f.real === 'Right' ? 'Left' : 'Right', score: 0.95 }]
      }
      inject({ hands, timestampMs: t0 + i * 40 })
      await new Promise((r) => setTimeout(r, 40))
    }
  }, frames)
}

const hold = (mask: string, real: Real, n = 8, cx = 0.5, cy = 0.5) =>
  Array.from({ length: n }, () => ({ mask, real, cx, cy }))

// dx/dy in the user's own terms: + is their right / up (raw camera -x / -y).
const swipe = (mask: string, real: Real, dx: number, dy: number) =>
  Array.from({ length: 6 }, (_, i) => ({ mask, real, cx: 0.5 - (dx * (i + 1)) / 6, cy: 0.5 - (dy * (i + 1)) / 6 }))

test('index finger (right hand) pushed up turns exactly R', async ({ page }) => {
  await openHands(page)
  await feed(page, hold('1000', 'Right'))
  await expect(page.getByTestId('sign-hud')).toContainText('R')
  await feed(page, swipe('1000', 'Right', 0, 0.2))
  await expect(page.getByTestId('move-count')).toHaveText('1 moves')
  await page.keyboard.press('Shift+R')
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
})

test('two fingers (right hand) pushed right turns exactly U-prime', async ({ page }) => {
  await openHands(page)
  await feed(page, [...hold('1100', 'Right'), ...swipe('1100', 'Right', 0.2, 0)])
  await expect(page.getByTestId('move-count')).toHaveText('1 moves')
  await page.keyboard.press('u')
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
})

test('index finger on the LEFT hand is L, not R', async ({ page }) => {
  await openHands(page)
  await feed(page, [...hold('1000', 'Left'), ...swipe('1000', 'Left', 0, -0.2)])
  await expect(page.getByTestId('move-count')).toHaveText('1 moves')
  await page.keyboard.press('Shift+L')
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
})

test('a middle slice (pinky, right hand) turns, and two swipes make a double turn', async ({ page }) => {
  await openHands(page)
  await feed(page, [...hold('0001', 'Right'), ...swipe('0001', 'Right', 0, 0.2)])
  await expect(page.getByTestId('move-count')).toHaveText('1 moves')
  // Rest in the new spot past the cooldown, then push again from there.
  await feed(page, [
    ...hold('0001', 'Right', 14, 0.5, 0.3),
    ...Array.from({ length: 6 }, (_, i) => ({ mask: '0001', real: 'Right' as Real, cx: 0.5, cy: 0.3 - (0.2 * (i + 1)) / 6 })),
  ])
  await expect(page.getByTestId('move-count')).toHaveText('2 moves')
})

test('holding a sign without moving turns nothing', async ({ page }) => {
  await openHands(page)
  await feed(page, hold('1110', 'Right', 20))
  await expect(page.getByTestId('sign-hud')).toBeVisible()
  await expect(page.getByTestId('move-count')).toHaveText('0 moves')
})

test('holding a closed fist still toggles the view lock', async ({ page }) => {
  await openHands(page)
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-camera-locked', 'false')
  await feed(page, hold('0000', 'Right', 28))
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-camera-locked', 'true')
  await expect(page.getByTestId('move-count')).toHaveText('0 moves')
})
