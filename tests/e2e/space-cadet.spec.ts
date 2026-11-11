import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
})

test('faithful Space Cadet engine starts, plays, pauses, supports touch controls and persists sound', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/games/orbit-pinball')
  const game = page.frameLocator('iframe[title="Space Cadet Pinball"]:visible').frameLocator('iframe[title="Space Cadet runtime"]')
  await expect(game.getByRole('button', { name: 'New game', exact: true })).toBeEnabled({ timeout: 30_000 })
  await expect(game.locator('#art-label')).toHaveText('Open Cadet art · CC0')
  const canvas = game.getByLabel('Space Cadet pinball table')
  expect(await canvas.evaluate(node => (node as HTMLCanvasElement).width)).toBeGreaterThan(300)
  const before = await canvas.evaluate(node => (node as HTMLCanvasElement).toDataURL())
  await game.getByRole('button', { name: 'New game', exact: true }).click()
  const launch = game.getByRole('button', { name: 'Hold to launch', exact: true })
  const bounds = (await launch.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(600)
  await page.mouse.up()
  await expect.poll(() => canvas.evaluate(node => (node as HTMLCanvasElement).toDataURL())).not.toBe(before)
  await game.getByRole('button', { name: 'Left flipper', exact: true }).click()
  await game.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(game.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
  await game.getByRole('button', { name: 'Resume', exact: true }).click()
  await game.getByRole('button', { name: 'Sound off', exact: true }).click()
  await expect(game.getByRole('button', { name: 'Sound on', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(game.getByRole('button', { name: 'Sound on', exact: true })).toBeEnabled({ timeout: 30_000 })
  await game.getByRole('button', { name: 'Sound on', exact: true }).click()
  await expect.poll(() => canvas.evaluate(() => (window as unknown as { Module: { SDL2: { audioContext: AudioContext } } }).Module.SDL2.audioContext.state)).toBe('suspended')
  await page.screenshot({ path: 'test-results/space-cadet-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/space-cadet-phone.png', fullPage: true })
  expect(errors).toEqual([])
  await game.getByRole('button', { name: 'Exit', exact: true }).click()
  await expect(page).toHaveURL('/')
})

test('local XP data import stays in the browser and the free-play table can be restored', async ({ page }) => {
  const uploads: string[] = []
  page.on('request', request => { if (['POST','PUT'].includes(request.method())) uploads.push(request.url()) })
  await page.goto('/vendor/pinball/cabinet.html')
  const game = page.frameLocator('iframe[title="Space Cadet runtime"]')
  await expect(game.getByRole('button', { name: 'New game', exact: true })).toBeEnabled({ timeout: 30_000 })
  await game.locator('#original-files').setInputFiles({ name: 'bad.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('not executable') })
  await expect(game.locator('#notice')).toContainText('Choose PINBALL.DAT')
  // The legal CC0 DAT exercises the same local-file path; no Microsoft fixture is distributed.
  const data = await readFile('public/vendor/space-cadet/SpaceCadetPinball.data')
  await game.locator('#original-files').setInputFiles({ name: 'PINBALL.DAT', mimeType: 'application/octet-stream', buffer: data.subarray(0, 911260) })
  await expect(game.locator('#art-label')).toHaveText('Your original XP files · local')
  await expect(game.getByRole('button', { name: 'New game', exact: true })).toBeEnabled({ timeout: 30_000 })
  await game.getByRole('button', { name: 'Return to free-play art' }).click()
  await expect(game.locator('#art-label')).toHaveText('Open Cadet art · CC0')
  await expect(game.getByRole('button', { name: 'New game', exact: true })).toBeEnabled({ timeout: 30_000 })
  expect(uploads).toEqual([])
})

test('slow native runtime loading is visible and the app can exit while downloading', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/SpaceCadetPinball.wasm', async route => { await gate; await route.continue().catch(() => undefined) })
  await page.goto('/games/orbit-pinball', { waitUntil: 'domcontentloaded' })
  const game = page.frameLocator('iframe[title="Space Cadet Pinball"]:visible').frameLocator('iframe[title="Space Cadet runtime"]')
  await expect(game.getByRole('progressbar', { name: 'Loading Space Cadet' })).toBeVisible()
  await expect(game.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
  await game.getByRole('button', { name: 'Exit', exact: true }).click()
  await expect(page).toHaveURL('/')
  release()
})

test('engine download failure replaces progress with retry and can recover', async ({ page }) => {
  await page.route('**/SpaceCadetPinball.wasm', route => route.abort())
  await page.goto('/vendor/pinball/cabinet.html')
  const game = page.frameLocator('iframe[title="Space Cadet runtime"]')
  await expect(game.getByRole('button', { name: 'Retry Pinball' })).toBeVisible({ timeout: 15_000 })
  await expect(game.getByRole('progressbar')).toHaveCount(0)
  await expect(game.getByRole('button', { name: 'New game', exact: true })).toBeDisabled()
  await page.unroute('**/SpaceCadetPinball.wasm')
  await game.getByRole('button', { name: 'Retry Pinball' }).click()
  await expect(game.getByRole('button', { name: 'New game', exact: true })).toBeEnabled({ timeout: 30_000 })
})

test('a delayed cabinet controller starts its child only after its message handler is ready', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/vendor/pinball/controller.js', async route => { await gate; await route.continue() })
  await page.goto('/vendor/pinball/cabinet.html', { waitUntil: 'commit' })
  await expect(page.locator('iframe[title="Space Cadet runtime"]')).toHaveAttribute('src', 'about:blank')
  await expect(page.getByRole('progressbar', { name: 'Opening Pinball controls' })).toBeVisible()
  release()
  const game = page.frameLocator('iframe[title="Space Cadet runtime"]')
  await expect(game.getByRole('button', { name: 'New game', exact: true })).toBeEnabled({ timeout: 30_000 })
  await expect(page.locator('#cabinet-boot')).toHaveCount(0)
})
