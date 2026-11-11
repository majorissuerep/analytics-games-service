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
  const canvas = game.getByLabel('Space Cadet pinball table')
  await expect(game.getByLabel('Score', { exact: true })).toHaveText('0')
  await expect(game.getByLabel('Ball', { exact: true })).toHaveText('1 / 3')
  await canvas.focus()
  await page.keyboard.down('Space')
  await page.waitForTimeout(1200)
  await page.keyboard.up('Space')
  await expect.poll(async () => Number((await game.locator('#score').innerText()).replaceAll(',', '')), { timeout: 20_000 }).toBeGreaterThan(0)
  await page.keyboard.down('ArrowLeft')
  await page.waitForTimeout(200)
  await page.keyboard.up('ArrowLeft')
  await page.keyboard.press('ArrowRight')
  await game.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(game.locator('#pause')).toHaveAttribute('aria-label', 'Resume')
  await game.locator('#resume-table').click()
  await expect(game.locator('#pause')).toHaveAttribute('aria-label', 'Pause')
  await game.getByRole('button', { name: 'Sound off', exact: true }).click()
  await expect(game.getByRole('button', { name: 'Sound on', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(game.getByRole('button', { name: 'Sound on', exact: true })).toBeEnabled({ timeout: 30_000 })
  await game.getByRole('button', { name: 'Sound on', exact: true }).click()
  await expect.poll(() => canvas.evaluate(() => (window as unknown as { Module: { SDL2: { audioContext: AudioContext } } }).Module.SDL2.audioContext.state)).toBe('suspended')
  await page.screenshot({ path: 'test-results/space-cadet-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  const privacy = page.getByRole('button', { name: 'Privacy', exact: true })
  if (await privacy.isVisible()) {
    const launcher = (await privacy.boundingBox())!
    const flipper = (await game.getByRole('button', { name: 'Right flipper', exact: true }).boundingBox())!
    expect(launcher.y).toBeGreaterThanOrEqual(flipper.y + flipper.height)
  }
  await page.screenshot({ path: 'test-results/space-cadet-phone.png', fullPage: true })
  expect(errors).toEqual([])
})

test('ready-to-play cabinet has no file setup or scrolling and uses Space plus horizontal arrows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/vendor/pinball/cabinet.html')
  const game = page.frameLocator('iframe[title="Space Cadet runtime"]')
  await expect(game.getByRole('button', { name: 'New game', exact: true })).toBeEnabled({ timeout: 30_000 })
  await expect(game.locator('input, select, details, nav')).toHaveCount(0)
  await expect(game.getByLabel('Score', { exact: true })).toHaveText('0')
  const launch = game.getByRole('button', { name: 'Hold to launch' })
  const box = (await launch.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(1200)
  await page.mouse.up()
  await expect.poll(async () => Number((await game.locator('#score').innerText()).replaceAll(',', '')), { timeout: 20_000 }).toBeGreaterThan(0)
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowDown')
  expect(await game.locator('html').evaluate(node => ({ top: node.scrollTop, height: node.scrollHeight, viewport: innerHeight }))).toMatchObject({ top: 0, height: 844, viewport: 844 })
  await game.getByRole('button', { name: 'New game', exact: true }).click()
  await expect(game.getByLabel('Score', { exact: true })).toHaveText('0')
  await expect(game.getByLabel('Ball', { exact: true })).toHaveText('1 / 3')
})

test('slow native runtime loading remains visible with disabled play controls', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/SpaceCadetPinball.wasm', async route => { await gate; await route.continue().catch(() => undefined) })
  await page.goto('/games/orbit-pinball', { waitUntil: 'domcontentloaded' })
  const game = page.frameLocator('iframe[title="Space Cadet Pinball"]:visible').frameLocator('iframe[title="Space Cadet runtime"]')
  await expect(game.getByRole('progressbar', { name: 'Loading Space Cadet' })).toBeVisible()
  await expect(game.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
  await expect(game.getByRole('button', { name: 'New game', exact: true })).toBeDisabled()
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
