import { expect, test } from '@playwright/test'

test('home lists the 3x3 and links into free play', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'HandCube' })).toBeVisible()
  await page.getByRole('link', { name: /3x3 Cube/i }).click()
  await expect(page).toHaveURL(/\/play\/cube3/)
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
})

test('dragging a cube face turns it, and Reset restores the solved state', async ({ page }) => {
  await page.goto('/play/cube3')
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')

  const box = (await canvas.boundingBox())!
  // Drag across the upper-right of the cube. This is a smoke test for "a drag
  // produced a real move" -- geometric correctness is covered by the unit tests
  // on moveFromDrag and faceletColors, which do not need a browser.
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.35)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.35, { steps: 12 })
  await page.mouse.up()

  await expect(page.getByTestId('move-count')).not.toHaveText('0 moves')
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')

  await page.getByRole('button', { name: /^reset$/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
  await expect(page.getByTestId('move-count')).toHaveText('0 moves')
})

test('scramble unsolves and undo walks back one move', async ({ page }) => {
  await page.goto('/play/cube3')
  await page.getByRole('button', { name: /scramble/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')

  const before = await page.getByTestId('move-count').textContent()
  await page.getByRole('button', { name: /undo/i }).click()
  await expect(page.getByTestId('move-count')).not.toHaveText(before!)
})

test('Scramble then Solve returns the cube to solved', async ({ page }) => {
  await page.goto('/play/cube3')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')

  await page.getByRole('button', { name: /scramble/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')

  await page.getByRole('button', { name: /solve/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Solved', { timeout: 30_000 })
})

test('the solver is warmed at startup, not on first Solve press', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('app')).toHaveAttribute('data-solver-ready', 'true', {
    timeout: 30_000,
  })
})
