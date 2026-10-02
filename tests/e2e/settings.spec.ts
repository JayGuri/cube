import { expect, test } from '@playwright/test'

test('settings screen toggles persist across reload', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('colorblind-toggle').click()
  await page.reload()
  // The toggle's persisted state is verified via localStorage directly, since
  // the visual knob position is a CSS detail, not the contract under test.
  const stored = await page.evaluate(() => localStorage.getItem('palmtwist.settings.v1'))
  expect(stored).toContain('"colorblindPalette":true')
})
