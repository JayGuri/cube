import { expect, test } from '@playwright/test'

for (const puzzleId of ['pyraminx', 'skewb']) {
  test(`${puzzleId} loads, scrambles, and solve returns it to solved`, async ({ page }) => {
    await page.goto(`/play/${puzzleId}`)
    await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
    await expect(page.getByTestId('solved-status')).toHaveText('Solved')

    await page.getByRole('button', { name: /scramble/i }).click()
    await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')

    await page.getByRole('button', { name: /solve/i }).click()
    await expect(page.getByTestId('solved-status')).toHaveText('Solved', { timeout: 10_000 })
  })
}

test('home links into pyraminx and skewb academy', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Pyraminx' })).toBeVisible()
  await page.getByRole('link', { name: 'Academy →' }).first().click()
  await expect(page.getByRole('heading', { name: /Academy/i })).toBeVisible()
})

test('mastermorphix loads, scrambles, and solve returns it to solved', async ({ page }) => {
  await page.goto('/play/mastermorphix')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
  await page.getByRole('button', { name: /scramble/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')
  await page.getByRole('button', { name: /solve/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Solved', { timeout: 10_000 })
})

test('megaminx loads, scrambles, and solve returns it to solved', async ({ page }) => {
  await page.goto('/play/megaminx')
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByTestId('solved-status')).toHaveText('Solved')
  await page.getByRole('button', { name: /scramble/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Scrambled')
  await page.getByRole('button', { name: /solve/i }).click()
  await expect(page.getByTestId('solved-status')).toHaveText('Solved', { timeout: 10_000 })
})
