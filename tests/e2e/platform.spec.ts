import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

test('Mixpanel remains silent until consent and tracks the game launch journey', async ({ page }) => {
  const mixpanelEvents: string[] = []
  await page.route('https://api-eu.mixpanel.com/**', async (route) => {
    const encoded = new URLSearchParams(route.request().postData() ?? '').get('data')
    if (encoded) {
      const payload = JSON.parse(encoded) as { event?: string }
      if (payload.event) mixpanelEvents.push(payload.event)
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '1' })
  })

  await page.goto('/')
  await expect(page.getByRole('dialog', { name: 'Analytics privacy settings' })).toBeVisible()
  expect(mixpanelEvents).toEqual([])

  await page.getByRole('button', { name: 'Accept analytics' }).click()
  await expect.poll(() => mixpanelEvents).toContain('platform_viewed')

  await page.locator('.desktop-icon[aria-label="Open Paintbox"]').dblclick()
  const paintbox = page.frameLocator('iframe[title="Paintbox"]')
  await expect(paintbox.getByRole('button', { name: 'Save PNG' })).toBeVisible()
  await expect.poll(() => paintbox.getByLabel('Drawing canvas').evaluate((canvas) => (
    (canvas as HTMLCanvasElement).getContext('2d')?.getImageData(0, 0, 1, 1).data[3]
  ))).toBe(255)
  await expect.poll(() => mixpanelEvents).toContain('game_session_started')
  expect(mixpanelEvents).not.toContain('game_session_ended')

  await paintbox.getByRole('button', { name: 'Save PNG' }).click()
  await expect.poll(() => mixpanelEvents).toContain('game_session_completed')
  expect(mixpanelEvents.filter((event) => event === '$opt_in')).toHaveLength(1)

  const gameWindow = page.locator('.desktop-rnd-window').filter({
    has: page.locator('iframe[title="Paintbox"]'),
  })
  await gameWindow.getByRole('button', { name: 'Close' }).click()
  await expect.poll(() => mixpanelEvents).toContain('game_session_ended')
})

test('desktop opens and closes a readable game while Pip responds', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Team games live here.' })).toBeVisible()

  const pip = page.getByLabel('Pip desktop guide')
  await expect(pip).toBeVisible()
  const firstPhrase = await pip.locator('p').textContent()
  await pip.getByRole('button', { name: 'Surprise me' }).click()
  await expect(pip.locator('p')).not.toHaveText(firstPhrase ?? '')

  await page.locator('.desktop-icon[aria-label="Open Consensus Radar"]').dblclick()
  const gameFrame = page.frameLocator('iframe[title="Consensus Radar"]')
  const nameHeading = gameFrame.getByRole('heading', { name: 'Як тебе звати?' })
  await expect(nameHeading).toBeVisible()
  await expect(nameHeading).toHaveCSS('color', 'rgb(232, 243, 255)')

  const gameWindow = page.locator('.desktop-rnd-window').filter({
    has: page.locator('iframe[title="Consensus Radar"]'),
  })
  await gameWindow.getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('iframe[title="Consensus Radar"]')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Team games live here.' })).toBeVisible()
  expect(errors).toEqual([])
})

test('desktop plugins and three isolated classic games work', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('/')
  await expect(page.locator('.desktop-sky')).toHaveCSS('background-image', /millennium-horizon\.svg/)
  await expect(page.getByLabel('Desktop sticky note')).toBeVisible()
  await expect(page.getByLabel('5 games installed')).toBeVisible()
  await page.getByRole('button', { name: 'start' }).click()
  await expect(page.getByRole('button', { name: /Open a random installed game/ })).toBeVisible()
  await page.getByRole('button', { name: 'start' }).click()

  await page.locator('.desktop-icon').filter({ hasText: 'Plugins' }).dblclick()
  const pluginWindow = page.locator('.desktop-rnd-window').filter({ hasText: 'Installed desktop plugins' })
  await expect(pluginWindow.locator('.plugin-row')).toHaveCount(4)
  const counterToggle = pluginWindow.locator('.plugin-row').filter({ hasText: 'Game Counter' }).getByRole('checkbox')
  await counterToggle.uncheck()
  await expect(page.getByLabel('5 games installed')).toHaveCount(0)
  await counterToggle.check()
  await expect(page.getByLabel('5 games installed')).toBeVisible()
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

  await page.locator('.desktop-icon[aria-label="Open Neon Forge Pinball"]').dblclick()
  const pinball = page.frameLocator('iframe[title="Neon Forge Pinball"]')
  const pinballCanvas = pinball.locator('canvas')
  await expect(pinballCanvas).toBeVisible()
  await expect(pinballCanvas).toHaveJSProperty('width', 420)
  await expect(pinballCanvas).toHaveJSProperty('height', 720)
  await pinball.getByRole('button', { name: 'START GAME' }).click()
  await expect(pinball.getByRole('button', { name: 'HOLD LAUNCH' })).toBeEnabled()
  await page.locator('.desktop-rnd-window').filter({ has: page.locator('iframe[title="Neon Forge Pinball"]') }).getByRole('button', { name: 'Close' }).click()

  await expect(page.getByRole('heading', { name: 'Team games live here.' })).toBeVisible()
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
    const body = route.request().postDataJSON() as { messages: Array<{ role: string; content: string }> }
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'How do I play Minefield?' })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Right-click to flag mines, and clear every safe square!', model: 'xiaomi/mimo-v2.5' }),
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
  await expect(minefield.getByRole('link', { name: 'Back to desktop' })).toHaveCount(0)

  await page.locator('.desktop-icon[aria-label="Open Paintbox"]').dblclick()
  const paintbox = page.frameLocator('iframe[title="Paintbox"]')
  await expect(paintbox.getByRole('link', { name: 'Back to desktop' })).toHaveCount(0)
})

test('Chess supports bot color selection and pass-and-play moves', async ({ page }) => {
  await page.goto('/games/chess')
  await page.getByRole('button', { name: /Black/ }).click()
  await page.getByLabel('Stockfish difficulty').selectOption('beginner')
  await page.getByRole('button', { name: 'Play Stockfish' }).click()
  await expect(page.getByRole('heading', { name: /Black to move/ })).toBeVisible({ timeout: 15_000 })
  await page.locator('#analytics-chess-board-square-e7').click()
  await page.locator('#analytics-chess-board-square-e5').click()
  await expect(page.locator('.chess-moves')).not.toContainText('Moves will appear here.')

  await page.getByRole('button', { name: 'New game' }).click()
  await page.locator('.chess-mode-tabs').getByRole('button', { name: /Local/ }).click()
  await page.getByRole('button', { name: 'Start pass-and-play' }).click()
  await page.locator('#analytics-chess-board-square-e2').click()
  await page.locator('#analytics-chess-board-square-e4').click()
  await expect(page.getByRole('heading', { name: 'Black to move' })).toBeVisible()
})

test('Chess remains usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/games/chess')
  await expect(page.getByRole('button', { name: 'Play Stockfish' })).toBeVisible()
  await page.locator('.chess-mode-tabs').getByRole('button', { name: /Local/ }).click()
  await page.getByRole('button', { name: 'Start pass-and-play' }).click()
  const board = page.getByLabel('Chess board')
  const box = await board.boundingBox()
  if (!box) throw new Error('Chess board has no bounding box')
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  await page.locator('#analytics-chess-board-square-e2').click()
  await page.locator('#analytics-chess-board-square-e4').click()
  await expect(page.getByRole('heading', { name: 'Black to move' })).toBeVisible()
})

test('Chess exposes safe custom model submission without changing built-in play', async ({ page }) => {
  await page.goto('/games/chess')
  await page.getByRole('button', { name: /Bring your own Chess model/ }).click()
  await expect(page.getByText(/quarantined, scanned, and require administrator approval/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Upload package (unavailable)' })).toBeDisabled()
  await expect(page.getByLabel('Repository')).toBeVisible()
  await expect(page.getByLabel('Immutable commit SHA')).toBeVisible()
  await page.getByRole('button', { name: 'Play Stockfish' }).click()
  await expect(page.getByRole('heading', { name: 'White to move' })).toBeVisible()
})

test('Chess model arena pauses and replays durable matches', async ({ page }) => {
  await page.goto('/games/chess')
  await page.getByRole('button', { name: /Model arena/ }).click()
  await expect(page.getByRole('heading', { name: 'Model arena' })).toBeVisible()
  await expect(page.getByLabel('White model')).toHaveValue('builtin-stockfish-18')
  await expect(page.getByLabel('Black model')).toHaveValue('builtin-stockfish-18')
  await page.getByRole('button', { name: 'Start model match' }).click()
  await expect(page.getByRole('button', { name: 'Pause match' })).toBeVisible()
  await expect(page.getByText(/active.*1 plies · 3s\/turn/)).toBeVisible({ timeout: 8000 })
  await page.getByRole('button', { name: 'Pause match' }).click()
  await expect(page.getByText(/paused.*\d+ plies · 3s\/turn/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play replay' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /Model arena/ }).click()
  await expect(page.getByRole('heading', { name: 'Saved matches' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Stockfish 18 vs Stockfish 18/ }).first()).toBeVisible()
})

test('Chess password room synchronizes legal moves', async ({ browser }) => {
  const hostContext = await browser.newContext()
  const guestContext = await browser.newContext()
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()
  try {
    await host.goto('/games/chess')
    await host.getByRole('button', { name: /Online/ }).click()
    await host.getByLabel('Display name').fill('White Host')
    await host.getByLabel(/Room password/).fill('knights')
    await host.getByRole('button', { name: 'Create private room' }).click()
    const code = (await host.locator('.chess-room-panel strong').textContent())?.trim() ?? ''
    expect(code).toMatch(/^[A-Z2-9]{6}$/)

    await guest.goto('/games/chess')
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

interface EmulatedPlayer {
  context: BrowserContext
  page: Page
  name: string
}

async function enterPlayer(browser: Browser, name: string): Promise<EmulatedPlayer> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/games/consensus-radar')
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await page.getByPlaceholder('Your name…').fill(name)
  await page.getByRole('button', { name: /Continue/ }).click()
  await expect(page.getByRole('heading', { name: `Hi, ${name}` })).toBeVisible()
  return { context, page, name }
}

test('four isolated players complete a full Consensus Radar game', async ({ browser }) => {
  test.setTimeout(120_000)
  const players = await Promise.all(
    ['Ada', 'Ben', 'Cy', 'Dee'].map((name) => enterPlayer(browser, name)),
  )
  const [host, teamOneGuesser, teamTwoCluegiver, teamTwoGuesser] = players

  try {
    await host.page.getByRole('button', { name: 'Create room' }).click()
    const roomCode = (await host.page.locator('.room-code-val').textContent())?.trim()
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/)

    for (const player of players.slice(1)) {
      await player.page.getByPlaceholder('Room code (6 chars)').fill(roomCode ?? '')
      await player.page.getByRole('button', { name: 'Join', exact: true }).click()
      await expect(player.page.getByText('Room code', { exact: true })).toBeVisible()
    }
    await expect(host.page.getByText('Players in room (4)', { exact: true })).toBeVisible({ timeout: 15_000 })

    // Host starts on Team 1 automatically; Ben joins them, Cy and Dee form Team 2.
    await teamOneGuesser.page.getByTitle('Team 1').click()
    await teamTwoCluegiver.page.getByTitle('Team 2').click()
    await teamTwoGuesser.page.getByTitle('Team 2').click()

    // The host learns about assignments via polling — wait until every roster
    // pill is visible before starting, otherwise the lobby validation races.
    for (const [name, team] of [['Ben', 'Team 1'], ['Cy', 'Team 2'], ['Dee', 'Team 2']] as const) {
      await expect(
        host.page.locator('.player-row').filter({ hasText: name }).getByText(team, { exact: true }),
      ).toBeVisible({ timeout: 15_000 })
    }

    await host.page.getByRole('button', { name: 'Start game' }).click()

    // ── Round 1: Team 1 plays, host is the clue-giver (join-order rotation) ──
    await expect(host.page.getByText("You're the clue-giver this round!", { exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await host.page.getByPlaceholder('one word or phrase — no numbers').fill('signal one')
    await host.page.getByRole('button', { name: 'Send clue' }).click()

    const slider = teamOneGuesser.page.getByRole('slider', { name: 'Position marker' })
    await expect(slider).toBeVisible({ timeout: 15_000 })
    const box = await slider.boundingBox()
    if (!box) throw new Error('Position marker has no bounding box')
    await teamOneGuesser.page.mouse.click(box.x + box.width * 0.3, box.y + box.height / 2)
    await teamOneGuesser.page.getByRole('button', { name: 'Lock in' }).click()

    // Rival team places side bets; the last bet auto-reveals the round.
    await teamTwoCluegiver.page.getByRole('button', { name: /To the right/ }).click()
    await expect(teamTwoCluegiver.page.getByText(/Bet placed/)).toBeVisible({ timeout: 15_000 })
    await teamTwoGuesser.page.getByRole('button', { name: /To the right/ }).click()

    for (const player of players) {
      await expect(player.page.getByText('The reveal', { exact: true })).toBeVisible({ timeout: 15_000 })
    }
    await expect(host.page.getByText('Who placed what', { exact: true })).toBeVisible()
    await expect(host.page.getByText('Side bets', { exact: true })).toBeVisible()

    // ── Round 2: turn rotates to Team 2, its clue-giver is Cy ────────────────
    await host.page.getByRole('button', { name: 'Next round', exact: true }).click()
    await expect(teamTwoCluegiver.page.getByText("You're the clue-giver this round!", { exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await teamTwoCluegiver.page.getByPlaceholder('one word or phrase — no numbers').fill('signal two')
    await teamTwoCluegiver.page.getByRole('button', { name: 'Send clue' }).click()

    const sliderTwo = teamTwoGuesser.page.getByRole('slider', { name: 'Position marker' })
    await expect(sliderTwo).toBeVisible({ timeout: 15_000 })
    const boxTwo = await sliderTwo.boundingBox()
    if (!boxTwo) throw new Error('Position marker has no bounding box')
    await teamTwoGuesser.page.mouse.click(boxTwo.x + boxTwo.width * 0.7, boxTwo.y + boxTwo.height / 2)
    await teamTwoGuesser.page.getByRole('button', { name: 'Lock in' }).click()

    await host.page.getByRole('button', { name: /To the left/ }).click()
    await teamOneGuesser.page.getByRole('button', { name: /To the left/ }).click()

    for (const player of players) {
      await expect(player.page.getByText('The reveal', { exact: true })).toBeVisible({ timeout: 15_000 })
    }

    // ── Host ends the game; everyone lands on the final scoreboard ───────────
    await host.page.getByRole('button', { name: 'End the game', exact: true }).click()
    for (const player of players) {
      await expect(player.page.getByText('Game over', { exact: true })).toBeVisible({ timeout: 15_000 })
      await expect(player.page.getByRole('heading', { name: 'Final scores' })).toBeVisible()
    }
  } finally {
    await Promise.all(players.map((player) => player.context.close()))
  }
})
