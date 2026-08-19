import { expect, test } from '@playwright/test'

test('Neon Forge launches, scores, flips, saves, and tilts without runtime errors', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/games/orbit-pinball')
  const canvas = page.getByLabel('Neon Forge pinball playfield')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveJSProperty('width', 420)
  await expect(canvas).toHaveJSProperty('height', 720)
  await expect(page.getByRole('button', { name: 'Enable pinball sounds' })).toHaveText('SOUND OFF')

  await page.getByRole('button', { name: 'START GAME' }).click()
  await expect(page.getByRole('button', { name: 'HOLD LAUNCH' })).toBeEnabled()

  await page.keyboard.down('Space')
  await page.waitForTimeout(700)
  await page.keyboard.up('Space')
  await expect(page.getByText('BALL SAVE LIT')).toBeVisible()

  await page.keyboard.down('ArrowLeft')
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(150)
  await page.keyboard.up('ArrowLeft')
  await page.keyboard.up('ArrowRight')

  await expect.poll(async () => {
    const score = await page.locator('.forge-dmd > div').first().locator('strong').textContent()
    return Number(score?.replaceAll(',', ''))
  }, { timeout: 8_000 }).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'NUDGE' }).click()
  await page.getByRole('button', { name: 'NUDGE' }).click()
  await page.getByRole('button', { name: 'NUDGE' }).click()
  await expect(page.getByText('TILT · FLIPPERS DISABLED')).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('Neon Forge remains playable when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('blocked', 'SecurityError') }
    Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError') }
  })
  await page.goto('/games/orbit-pinball')
  await expect(page.getByLabel('Neon Forge pinball playfield')).toBeVisible()
  await page.getByRole('button', { name: 'START GAME' }).click()
  await expect(page.getByRole('button', { name: 'HOLD LAUNCH' })).toBeEnabled()
})

test('focused controls retain native Space-key activation', async ({ page }) => {
  await page.goto('/games/orbit-pinball')

  const start = page.getByRole('button', { name: 'START GAME' })
  await start.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'HOLD LAUNCH' })).toBeEnabled()

  const sound = page.getByRole('button', { name: 'Enable pinball sounds' })
  await sound.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Mute pinball sounds' })).toBeVisible()

  const launch = page.getByRole('button', { name: 'HOLD LAUNCH' })
  await launch.focus()
  await page.keyboard.down('Space')
  await page.waitForTimeout(200)
  await page.keyboard.up('Space')
  await expect(launch).toBeDisabled()
})
