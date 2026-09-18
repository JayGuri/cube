import { expect, test } from '@playwright/test'

test('algorithm trainer shows a case, reveals a solution, and grading advances', async ({ page }) => {
  await page.goto('/trainer')
  await expect(page.getByTestId('algo-case-name')).toBeVisible()
  await expect(page.getByTestId('puzzle-canvas')).toHaveAttribute('data-ready', 'true')

  const before = await page.getByTestId('algo-progress').textContent()
  await page.getByTestId('reveal-solution').click()
  await expect(page.getByTestId('algo-solution')).toBeVisible()
  await page.getByRole('button', { name: /knew it cold/i }).click()

  await expect(page.getByTestId('algo-progress')).not.toHaveText(before ?? '')
})
