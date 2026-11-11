import { expect, test } from '@playwright/test'
import { captureExperience, expectActionReady } from './helpers/experience'

test.beforeEach(async ({ context }, info) => {
  if (!info.title.startsWith('self-hosted analytics')) {
    await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
  }
})

test('self-hosted analytics remains silent until consent and tracks the game launch journey', async ({ page }) => {
  const trackedEvents: string[] = []
  await page.route('**/api/analytics/events', async (route) => {
    const payload = route.request().postDataJSON() as { event?: string }
    if (payload.event) trackedEvents.push(payload.event)
    expect(route.request().headers().authorization).toBeUndefined()
    await route.fulfill({ status: 202, contentType: 'application/json', body: '{"accepted":true}' })
  })

  await page.goto('/')
  await expect(page.getByRole('dialog', { name: 'Analytics privacy settings' })).toBeVisible()
  expect(trackedEvents).toEqual([])

  await page.getByRole('button', { name: 'Accept analytics' }).click()
  await expect.poll(() => trackedEvents).toContain('platform_viewed')

  await page.locator('.desktop-icon[aria-label="Open Paintbox"]').dblclick()
  const paintbox = page.frameLocator('iframe[title="Paintbox"]')
  await expect(paintbox.getByRole('button', { name: 'Save PNG' })).toBeVisible()
  await expect.poll(() => paintbox.getByLabel('Drawing canvas').evaluate((canvas) => (
    (canvas as HTMLCanvasElement).getContext('2d')?.getImageData(0, 0, 1, 1).data[3]
  ))).toBe(255)
  await expect.poll(() => trackedEvents).toContain('game_session_started')
  expect(trackedEvents).not.toContain('game_session_ended')

  await paintbox.getByRole('button', { name: 'Save PNG' }).click()
  await expect.poll(() => trackedEvents).toContain('game_session_completed')

  const gameWindow = page.locator('.desktop-rnd-window').filter({
    has: page.locator('iframe[title="Paintbox"]'),
  })
  await gameWindow.getByRole('button', { name: 'Close' }).click()
  await expect.poll(() => trackedEvents).toContain('game_session_ended')
})

test('desktop opens and closes a readable game while Pip responds', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Games', exact: true })).toBeVisible()

  const pip = page.getByLabel('Pip desktop guide')
  await expect(pip).toBeVisible()
  const firstPhrase = await pip.locator('p').textContent()
  await pip.getByRole('button', { name: 'Surprise me' }).click()
  await expect(pip.locator('p')).not.toHaveText(firstPhrase ?? '')

  await page.locator('.desktop-icon[aria-label="Open Minefield"]').dblclick()
  const gameFrame = page.frameLocator('iframe[title="Minefield"]')
  const nameHeading = gameFrame.getByRole('button', { name: 'New game' })
  await expect(nameHeading).toBeVisible()
  await expect(nameHeading).toBeEnabled()

  const gameWindow = page.locator('.desktop-rnd-window').filter({
    has: page.locator('iframe[title="Minefield"]'),
  })
  await gameWindow.getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('iframe[title="Minefield"]')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Games', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('desktop plugins and three isolated classic games work', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('/')
  await expect(page.locator('.desktop-sky')).toHaveCSS('background-image', /millennium-meadow\.webp/)
  await expect(page.getByLabel('Desktop sticky note')).toBeVisible()
  await expect(page.getByLabel('4 games installed')).toBeVisible()
  await page.getByRole('button', { name: 'start' }).click()
  await expect(page.getByRole('button', { name: /Play a random available game/ })).toBeVisible()
  await page.getByRole('button', { name: 'start' }).click()

  await page.locator('.desktop-icon').filter({ hasText: 'Plugins' }).dblclick()
  const pluginWindow = page.locator('.desktop-rnd-window').filter({ hasText: 'Installed desktop plugins' })
  await expect(pluginWindow.locator('.plugin-row')).toHaveCount(4)
  const counterToggle = pluginWindow.locator('.plugin-row').filter({ hasText: 'Game Counter' }).getByRole('checkbox')
  await counterToggle.uncheck()
  await expect(page.getByLabel('4 games installed')).toHaveCount(0)
  await counterToggle.check()
  await expect(page.getByLabel('4 games installed')).toBeVisible()
  await pluginWindow.getByRole('button', { name: 'Close' }).click()

  await page.locator('.desktop-icon[aria-label="Open Minefield"]').dblclick()
  const minefield = page.frameLocator('iframe[title="Minefield"]')
  await expect(minefield.getByRole('button', { name: 'New game' })).toBeVisible()
  await expect(minefield.getByLabel(/Covered cell/)).toHaveCount(81)
  await minefield.getByLabel('Covered cell, row 1, column 1').click({ button: 'right' })
  await expect(minefield.getByLabel('Flagged cell, row 1, column 1')).toBeVisible()
  await minefield.getByLabel('Flagged cell, row 1, column 1').click({ button: 'right' })
  await minefield.getByLabel('Covered cell, row 1, column 1').click()
  await expect(minefield.locator('.minefield-cell.revealed').first()).toBeVisible()
  await page.locator('.desktop-rnd-window').filter({ has: page.locator('iframe[title="Minefield"]') }).getByRole('button', { name: 'Close' }).click()

  await page.locator('.desktop-icon[aria-label="Open Paintbox"]').dblclick()
  const paintbox = page.frameLocator('iframe[title="Paintbox"]')
  await expect(paintbox.getByLabel('Drawing canvas')).toBeVisible()
  await expect(paintbox.getByRole('button', { name: 'Save PNG' })).toBeVisible()
  await paintbox.getByRole('button', { name: 'Use color #d72b2b' }).click()
  const canvas = paintbox.getByLabel('Drawing canvas')
  const canvasBox = await canvas.boundingBox()
  if (!canvasBox) throw new Error('Paintbox canvas has no bounding box')
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.45, canvasBox.y + canvasBox.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.55, canvasBox.y + canvasBox.height * 0.5, { steps: 8 })
  await page.mouse.up()
  const centerPixel = await canvas.evaluate((element: HTMLCanvasElement) => (
    Array.from(element.getContext('2d')?.getImageData(element.width / 2, element.height / 2, 1, 1).data ?? [])
  ))
  expect(centerPixel.slice(0, 3)).not.toEqual([255, 255, 255])
  await paintbox.getByRole('button', { name: 'Undo' }).click()
  await paintbox.getByRole('button', { name: 'Eraser' }).click()
  await expect(paintbox.getByRole('button', { name: 'Eraser' })).toHaveAttribute('aria-pressed', 'true')
  await page.locator('.desktop-rnd-window').filter({ has: page.locator('iframe[title="Paintbox"]') }).getByRole('button', { name: 'Close' }).click()

  expect(errors).toEqual([])
})

test('desktop icons launch games and tools from the keyboard', async ({ page }) => {
  await page.goto('/')

  const minefieldIcon = page.locator('.desktop-icon[aria-label="Open Minefield"]')
  await minefieldIcon.focus()
  await minefieldIcon.press('Enter')
  await expect(page.locator('iframe[title="Minefield"]')).toBeVisible()

  const pluginIcon = page.locator('.desktop-icon').filter({ hasText: 'Plugins' })
  await pluginIcon.focus()
  await pluginIcon.press('Space')
  await expect(page.getByRole('heading', { name: 'Installed desktop plugins' })).toBeVisible()
})

test('Pip opens a repo-aware chat and renders an answer', async ({ page }) => {
  await page.route('**/api/pip/chat', async (route) => {
    const body = route.request().postDataJSON() as { userKey: string; message: string }
    expect(body.message).toBe('How do I play Minefield?')
    expect(body.userKey).toMatch(/^[A-Za-z0-9-]{8,100}$/)
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'event: meta\ndata: {"model":"qa-model"}\n\nevent: delta\ndata: {"text":"Right-click to flag mines, and clear every safe square!"}\n\nevent: done\ndata: {"text":"Right-click to flag mines, and clear every safe square!"}\n\n',
    })
  })
  await page.goto('/')

  await page.getByRole('button', { name: 'Talk to me' }).click()
  const chat = page.getByRole('dialog', { name: 'Talk to Pip' })
  await expect(chat).toBeVisible()
  await chat.getByRole('button', { name: 'How do I play Minefield?' }).click()
  await chat.getByRole('button', { name: 'Send message' }).click()
  await expect(chat.getByText('Right-click to flag mines, and clear every safe square!')).toBeVisible()
  await chat.getByRole('button', { name: 'Close Pip chat' }).click()
  await expect(chat).toHaveCount(0)
})

test('game window follows every drag step across iframe content', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.goto('/')
  await page.locator('.desktop-icon[aria-label="Open Minefield"]').dblclick()
  const gameWindow = page.locator('.desktop-rnd-window').filter({ has: page.locator('iframe[title="Minefield"]') })
  const titleBar = gameWindow.locator('.title-bar')
  const box = await titleBar.boundingBox()
  if (!box) throw new Error('Minefield title bar has no bounding box')

  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  const positions: number[] = []
  for (let step = 1; step <= 8; step += 1) {
    await page.mouse.move(startX + step * 30, startY + step * 20)
    positions.push((await gameWindow.boundingBox())?.x ?? Number.NaN)
  }
  await page.mouse.up()

  expect(
    positions.every((position, index) => index === 0 || position > positions[index - 1] + 15),
    `Window x positions should advance continuously: ${positions.join(', ')}`,
  ).toBe(true)
})

test('new windows fit inside a short desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 576 })
  await page.goto('/')
  await page.locator('.desktop-icon[aria-label="Open Minefield"]').dblclick()
  const gameWindow = page.locator('.desktop-rnd-window').filter({ has: page.locator('iframe[title="Minefield"]') })
  const box = await gameWindow.boundingBox()
  if (!box) throw new Error('Minefield window has no bounding box')
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(1280)
  expect(box.y + box.height).toBeLessThanOrEqual(576 - 42)
})

test('embedded games use only the desktop window chrome', async ({ page }) => {
  await page.goto('/')
  await page.locator('.desktop-icon[aria-label="Open Minefield"]').dblclick()
  const minefield = page.frameLocator('iframe[title="Minefield"]')
  await expect(minefield.locator('.minefield-app')).toBeVisible()
  await expect(minefield.getByRole('link', { name: 'Back to desktop' })).toHaveCount(0)

  await page.locator('.desktop-icon[aria-label="Open Paintbox"]').dblclick()
  const paintbox = page.frameLocator('iframe[title="Paintbox"]')
  await expect(paintbox.locator('.paintbox-app')).toBeVisible()
  await expect(paintbox.getByRole('link', { name: 'Back to desktop' })).toHaveCount(0)
})

test('Chess supports bot color selection and pass-and-play moves', async ({ page }) => {
  await page.goto('/games/chess')
  await expect(page.getByRole('navigation', { name: 'Game mode', exact: true })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: /Black/ }).click()
  await page.getByLabel('Stockfish difficulty').selectOption('beginner')
  await page.getByRole('button', { name: 'Play Stockfish 18', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Black to move/ })).toBeVisible({ timeout: 15_000 })
  await page.locator('#analytics-chess-board-square-e7').click()
  await page.locator('#analytics-chess-board-square-e5').click()
  await page.getByRole('button', { name: 'Moves', exact: true }).click()
  await expect(page.locator('.chess-moves')).not.toContainText('Moves will appear here.')

  await page.getByRole('button', { name: 'New game' }).click()
  await page.getByRole('navigation', { name: 'Game mode', exact: true }).getByRole('button', { name: /Local/ }).click()
  await page.getByRole('button', { name: 'Start pass-and-play' }).click()
  await page.locator('#analytics-chess-board-square-e2').click()
  await page.locator('#analytics-chess-board-square-e4').click()
  await expect(page.getByRole('heading', { name: 'Black to move' })).toBeVisible()
})

test('Chess remains usable on a narrow viewport', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/games/chess')
  await expect(page.getByRole('navigation', { name: 'Game mode', exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: 'Play Stockfish 18', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Game mode', exact: true }).getByRole('button', { name: /Local/ }).click()
  await page.getByRole('button', { name: 'Start pass-and-play' }).click()
  const board = page.getByLabel('Chess board')
  const box = await board.boundingBox()
  if (!box) throw new Error('Chess board has no bounding box')
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  await page.locator('#analytics-chess-board-square-e2').click()
  await page.locator('#analytics-chess-board-square-e4').click()
  await expect(page.getByRole('heading', { name: 'Black to move' })).toBeVisible()
  await expectActionReady(page.getByRole('button', { name: /Undo/ }))
  await expectActionReady(page.getByRole('button', { name: 'Leave game', exact: true }))
  await captureExperience(page, info, 'chess-resize', 'narrow-local-move', 'clamped')
})

test('Chess exposes safe custom model submission without changing built-in play', async ({ page }, info) => {
  await page.goto('/games/chess')
  await expect(page.getByRole('navigation', { name: 'Game mode', exact: true })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('navigation', { name: 'Game mode', exact: true }).getByRole('button', { name: /Models/ }).click()
  await expect(page.getByText(/quarantined, scanned, and require administrator approval/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Upload package (unavailable)' })).toBeDisabled()
  await expect(page.getByLabel('Repository')).toBeVisible()
  await expect(page.getByLabel('Immutable commit SHA')).toBeVisible()
  await expectActionReady(page.getByRole('button', { name: 'Submit for review', exact: true }))
  await captureExperience(page, info, 'chess-sections', 'model-submission')
  await page.getByRole('navigation', { name: 'Game mode', exact: true }).getByRole('button', { name: /Computer/ }).click()
  await page.getByRole('button', { name: 'Play Stockfish 18', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'White to move' })).toBeVisible()
})

test('Chess section navigation stays anchored through long details and constrained windows', async ({ page }, info) => {
  await page.setViewportSize({ width: 1180, height: 796 })
  await page.goto('/games/chess')
  await expect(page.getByRole('navigation', { name: 'Game mode', exact: true })).toBeVisible({ timeout: 20_000 })
  for (const section of ['Computer', 'Online', 'Local', 'Model arena', 'Models']) {
    const nav = page.getByRole('navigation', { name: 'Game mode' })
    const tab = nav.getByRole('button').filter({ has: page.locator('span', { hasText: section }) })
    await expectActionReady(tab)
    await tab.click()
    if (section === 'Model arena') await page.getByRole('button', { name: 'Saved matches', exact: true }).click()
    const details = page.locator(section === 'Model arena' ? '.chess-match-archive' : '.chess-setup-details')
    await details.evaluate(element => { element.scrollTop = element.scrollHeight })
    for (const button of await nav.getByRole('button').all()) await expectActionReady(button)
    await captureExperience(page, info, 'chess-sections', `${section}-selected-details-scrolled`)
  }
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 576 }]) {
    await page.setViewportSize(viewport)
    for (const button of await page.getByRole('navigation', { name: 'Game mode' }).getByRole('button').all()) await expectActionReady(button)
    await expectActionReady(page.getByRole('button', { name: 'Submit for review', exact: true }))
    expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([viewport.width, viewport.height])
    await captureExperience(page, info, 'chess-sections', `model-details-${viewport.width}`, 'clamped')
  }
})

test('Chess model arena pauses and replays durable matches', async ({ page }) => {
  await page.goto('/games/chess')
  await expect(page.getByRole('navigation', { name: 'Game mode', exact: true })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: /Model arena/ }).click()
  await expect(page.getByRole('heading', { name: 'New model match' })).toBeVisible()
  await expect(page.getByLabel('White model')).toHaveValue('builtin-stockfish-18')
  await expect(page.getByLabel('Black model')).toHaveValue('builtin-stockfish-18')
  const created = page.waitForResponse(response => response.url().endsWith('/api/chess-model-matches') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Start model match' }).click()
  const creationResponse = await created
  expect(creationResponse.status(), await creationResponse.text()).toBe(201)
  await expect(page.getByRole('button', { name: 'Pause match' })).toBeVisible()
  await expect(page.getByText(/active.*1 plies · 3s\/turn/)).toBeVisible({ timeout: 8000 })
  await page.getByRole('button', { name: 'Pause match' }).click()
  await expect(page.getByText(/paused.*\d+ plies · 3s\/turn/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play replay' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('navigation', { name: 'Game mode', exact: true })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: /Model arena/ }).click()
  await page.getByRole('button', { name: 'Saved matches', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Saved matches' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Stockfish 18 vs Stockfish 18/ }).first()).toBeVisible()
})

test('Chess password room synchronizes legal moves', async ({ browser }) => {
  const hostContext = await browser.newContext()
  const guestContext = await browser.newContext()
  await Promise.all([hostContext, guestContext].map(context => context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))))
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()
  try {
    await host.goto('/games/chess')
    await expect(host.getByRole('navigation', { name: 'Game mode', exact: true })).toBeVisible({ timeout: 20_000 })
    await host.getByRole('button', { name: /Online/ }).click()
    await host.getByLabel('Display name').fill('White Host')
    await host.getByLabel(/Room password/).fill('knights')
    await host.getByRole('button', { name: 'Create private room' }).click()
    const code = (await host.locator('.chess-room-panel strong').textContent())?.trim() ?? ''
    expect(code).toMatch(/^[A-Z2-9]{6}$/)

    await guest.goto('/games/chess')
    await expect(guest.getByRole('navigation', { name: 'Game mode', exact: true })).toBeVisible({ timeout: 20_000 })
    await guest.getByRole('button', { name: /Online/ }).click()
    await guest.locator('.chess-online-tabs').getByRole('button', { name: 'Join room' }).click()
    await guest.getByLabel('Display name').fill('Black Guest')
    await guest.getByLabel('Room code').fill(code)
    await guest.getByLabel(/Room password/).fill('wrong')
    await guest.getByRole('button', { name: 'Join room', exact: true }).last().click()
    await expect(guest.locator('.chess-notice')).toContainText('Incorrect room password')
    await guest.getByLabel(/Room password/).fill('knights')
    await guest.getByRole('button', { name: 'Join room', exact: true }).last().click()

    await expect(host.getByRole('heading', { name: /Waiting for opponent · 2\/2/ })).toBeVisible({ timeout: 5000 })
    await host.getByRole('button', { name: 'Start match' }).click()
    await expect(host.getByRole('heading', { name: /White to move/ })).toBeVisible({ timeout: 15_000 })
    await host.locator('#analytics-chess-board-square-e2').click()
    await host.locator('#analytics-chess-board-square-e4').click()
    await expect(guest.getByRole('heading', { name: /Black to move/ })).toBeVisible({ timeout: 15_000 })
    await guest.locator('#analytics-chess-board-square-e7').click()
    await guest.locator('#analytics-chess-board-square-e5').click()
    await expect(host.getByRole('heading', { name: /White to move/ })).toBeVisible({ timeout: 15_000 })
  } finally {
    await hostContext.close()
    await guestContext.close()
  }
})
