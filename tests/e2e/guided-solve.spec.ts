import { expect, test, type Page } from '@playwright/test'

async function open(page: Page) {
  await page.goto('/play/cube3')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('app')).toHaveAttribute('data-solver-ready', 'true', { timeout: 15_000 })
}

const stepKey = (step: string) => (step.endsWith("'") ? `Shift+${step[0]}` : step[0].toLowerCase())
const oppositeKey = (step: string) => (step.endsWith("'") ? step[0].toLowerCase() : `Shift+${step[0]}`)

// The guide's position, so a test can wait for it to move on.
async function where(page: Page) {
  if (await page.getByTestId('guide-done').isVisible()) return 'done'
  const step = await page.getByTestId('guide-step').textContent()
  const progress = await page.getByText(/^Step \d+ of \d+/).textContent()
  return `${step}|${progress}`
}

async function followToTheEnd(page: Page) {
  for (let i = 0; i < 60; i++) {
    if (await page.getByTestId('guide-done').isVisible()) return
    const before = await where(page)
    const step = (await page.getByTestId('guide-step').textContent())!.trim()
    await page.keyboard.press(stepKey(step))
    await expect.poll(() => where(page), { timeout: 15_000 }).not.toBe(before)
  }
}

test('Scramble starts a guided solve; following every shown step solves the cube', async ({ page }) => {
  test.setTimeout(150_000)
  await open(page)
  await page.getByRole('button', { name: /scramble/i }).click()
  await expect(page.getByTestId('guide-step')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')
  // The arrow on the cube points at the shown step.
  const step = (await page.getByTestId('guide-step').textContent())!.trim()
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-guide-move', step)

  await followToTheEnd(page)
  await expect(page.getByTestId('guide-done')).toBeVisible()
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
})

test('a wrong move re-solves from where the cube really is, and the guide still finishes', async ({ page }) => {
  test.setTimeout(150_000)
  await open(page)
  await page.getByRole('button', { name: /scramble/i }).click()
  await expect(page.getByTestId('guide-step')).toBeVisible({ timeout: 30_000 })

  const step = (await page.getByTestId('guide-step').textContent())!.trim()
  await page.keyboard.press(oppositeKey(step))
  await expect(page.getByTestId('guide-step')).toBeVisible({ timeout: 30_000 })

  await followToTheEnd(page)
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
})

test('Stop, Guide me, and Reset', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: /scramble/i }).click()
  await expect(page.getByTestId('guide-step')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId('guide-stop').click()
  await expect(page.getByTestId('guide-panel')).toHaveCount(0)
  await page.getByTestId('guide-me').click()
  await expect(page.getByTestId('guide-step')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: /reset/i }).click()
  await expect(page.getByTestId('guide-panel')).toHaveCount(0)
})
