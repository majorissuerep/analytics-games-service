import { expect, test } from '@playwright/test'

test.skip(!process.env.STYLED_CHESS_E2E, 'requires the local tuned-chess sidecar and PostgreSQL')

test('Chess can play against the tuned opening model with a selected repertoire', async ({ page }) => {
  await page.goto('/games/chess')

  await page.getByLabel('Opponent model').selectOption('builtin-styled-opening')
  await expect(page.getByLabel('Opening repertoire')).toHaveValue('black_caro_kann')
  await page.getByRole('button', { name: 'Play Tuned Opening Style' }).click()

  await page.locator('#analytics-chess-board-square-e2').click()
  await page.locator('#analytics-chess-board-square-e4').click()

  await expect(page.locator('.chess-moves')).toContainText('e4 c6', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'White to move' })).toBeVisible()
})
