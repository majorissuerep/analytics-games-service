import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
})

test('Paintbox restores actual pixels with undo, redo and keyboard history', async ({ page }) => {
  await page.goto('/games/paintbox')
  const canvas = page.getByLabel('Drawing canvas')
  const pixel = () => canvas.evaluate(node => Array.from((node as HTMLCanvasElement).getContext('2d')!.getImageData(100, 100, 1, 1).data))
  await expect.poll(pixel).toEqual([255, 255, 255, 255])
  const box = (await canvas.boundingBox())!
  await page.mouse.click(box.x + 100 / 960 * box.width, box.y + 100 / 560 * box.height)
  await expect.poll(pixel).toEqual([17, 17, 17, 255])
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect.poll(pixel).toEqual([255, 255, 255, 255])
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect.poll(pixel).toEqual([17, 17, 17, 255])
  await canvas.focus()
  await page.keyboard.press('Control+z')
  await expect.poll(pixel).toEqual([255, 255, 255, 255])
  await page.keyboard.press('Control+Shift+z')
  await expect.poll(pixel).toEqual([17, 17, 17, 255])
})

test('Sticky Note retains an unsaved draft and recovers browser storage without data loss', async ({ page }) => {
  await page.goto('/')
  const note = page.getByRole('textbox', { name: 'Sticky note text' })
  await note.fill('Keep this idea\nAnd this second line')
  await page.reload()
  await expect(note).toHaveValue('Keep this idea\nAnd this second line')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Object.assign(window, { restoreNoteStorage: () => { Storage.prototype.setItem = original } })
    Storage.prototype.setItem = function (key, value) {
      if (key === 'analytics-games.desktop.sticky-note.v1') throw new DOMException('Storage full', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await note.fill('Still here after a failed save')
  await expect(page.getByRole('button', { name: 'Retry save' })).toBeVisible()
  await expect(note).toHaveValue('Still here after a failed save')
  await page.evaluate(() => (window as unknown as { restoreNoteStorage(): void }).restoreNoteStorage())
  await page.getByRole('button', { name: 'Retry save' }).click()
  await page.reload()
  await expect(note).toHaveValue('Still here after a failed save')
})

test('desktop Chess keeps its sound and new-game controls reachable inside XP chrome', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open Chess', exact: true }).first().dblclick()
  const game = page.frameLocator('iframe[title="Chess"]')
  await expect(game.getByRole('button', { name: /Mute sounds|Unmute sounds/ })).toBeVisible()
  await game.getByRole('button', { name: /Local/ }).click()
  await game.getByRole('button', { name: 'Start pass-and-play' }).click()
  await game.getByRole('button', { name: 'New game', exact: true }).click()
  await expect(game.getByRole('button', { name: 'Start pass-and-play' })).toBeVisible()
})

test('a focused Pinball control releases its native key after pointer and keyboard holds', async ({ page }) => {
  await page.goto('/vendor/pinball/cabinet.html')
  const game = page.frameLocator('iframe[title="Space Cadet runtime"]')
  const control = game.getByRole('button', { name: 'Left flipper', exact: true })
  await expect(game.getByRole('button', { name: 'New game', exact: true })).toBeEnabled({ timeout: 30_000 })
  const canvas = game.getByLabel('Space Cadet pinball table')
  await canvas.evaluate(node => {
    const events: string[] = []
    Object.assign(window, { cabinetKeys: events })
    for (const type of ['keydown', 'keyup']) node.addEventListener(type, event => {
      if ((event as KeyboardEvent).code === 'KeyZ') events.push(type)
    })
  })
  await control.focus()
  const bounds = (await control.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  await control.focus()
  await page.keyboard.down('Enter')
  await page.keyboard.up('Enter')
  expect(await canvas.evaluate(() => (window as unknown as { cabinetKeys: string[] }).cabinetKeys)).toEqual(['keydown', 'keyup', 'keydown', 'keyup'])
})

test('game navigation waits for host hydration so cached readiness cannot be lost', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/_next/static/**/*.js*', async route => { await gate; await route.continue().catch(() => undefined) })
  await page.goto('/games/orbit-pinball', { waitUntil: 'commit' })
  const frame = page.locator('iframe[title="Space Cadet Pinball"]:visible')
  await expect(frame).toHaveAttribute('src', 'about:blank')
  await expect(page.getByRole('progressbar', { name: 'Opening Space Cadet Pinball' })).toBeVisible()
  release()
  await expect(frame).toHaveAttribute('src', '/vendor/pinball/cabinet.html')
  await expect(page.locator('.desktop-game-loader')).toHaveCount(0)
  await expect(frame.contentFrame().frameLocator('iframe[title="Space Cadet runtime"]').getByRole('button', { name: 'New game', exact: true })).toBeEnabled({ timeout: 30_000 })
})

test('XP Start menu keeps long game descriptions inside a narrow desktop', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/')
  await page.getByRole('button', { name: 'start', exact: true }).click()
  const menu = page.getByRole('navigation', { name: 'Start menu' })
  const bounds = (await menu.boundingBox())!
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320)
  for (const row of await menu.locator('button').all()) {
    const box = (await row.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width)
  }
  await expect(menu.getByRole('button', { name: /Surprise me/ })).toBeVisible()
})
