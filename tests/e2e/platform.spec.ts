import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

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
  await expect(page.getByLabel('4 games installed')).toBeVisible()
  await page.getByRole('button', { name: 'start' }).click()
  await expect(page.getByRole('button', { name: /Open a random installed game/ })).toBeVisible()
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

  await page.locator('.desktop-icon[aria-label="Open Orbit Pinball"]').dblclick()
  const pinball = page.frameLocator('iframe[title="Orbit Pinball"]')
  await expect(pinball.getByRole('button', { name: 'Launch' })).toBeVisible()
  await pinball.getByRole('button', { name: 'Launch' }).click()
  await expect(pinball.getByText('Orbit active')).toBeVisible()
  await page.locator('.desktop-rnd-window').filter({ has: page.locator('iframe[title="Orbit Pinball"]') }).getByRole('button', { name: 'Close' }).click()

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

    await teamOneGuesser.page.getByTitle('Team 1').click()
    await teamTwoCluegiver.page.getByTitle('Team 2').click()
    await teamTwoGuesser.page.getByTitle('Team 2').click()

    await host.page.getByRole('button', { name: 'Clue-giver', exact: true }).click()
    await expect(teamTwoCluegiver.page.getByRole('button', { name: 'Clue-giver', exact: true })).toBeVisible()
    await teamTwoCluegiver.page.getByRole('button', { name: 'Clue-giver', exact: true }).click()

    const rounds = host.page.locator('.round-pick').first()
    await rounds.getByRole('button', { name: '2', exact: true }).click()
    await expect(host.page.getByText('Each team needs exactly one clue-giver')).toHaveCount(0, { timeout: 15_000 })
    await host.page.getByRole('button', { name: 'Start game' }).click()

    for (let round = 0; round < 4; round += 1) {
      const cluegiver = round % 2 === 0 ? host : teamTwoCluegiver
      const guesser = round % 2 === 0 ? teamOneGuesser : teamTwoGuesser

      await expect(cluegiver.page.getByText("You're the clue-giver this round!", { exact: true })).toBeVisible({
        timeout: 15_000,
      })
      await cluegiver.page.getByPlaceholder('one word or phrase — no numbers').fill(`signal-${round + 1}`)
      await cluegiver.page.getByRole('button', { name: 'Send clue' }).click()

      const slider = guesser.page.getByRole('slider', { name: 'Position marker' })
      await expect(slider).toBeVisible({ timeout: 15_000 })
      const box = await slider.boundingBox()
      if (!box) throw new Error('Position marker has no bounding box')
      await guesser.page.mouse.click(box.x + box.width * (0.25 + round * 0.15), box.y + box.height / 2)
      await guesser.page.getByRole('button', { name: 'Lock in' }).click()

      const reveal = host.page.getByRole('button', { name: /Show result/ })
      await expect(reveal).toBeVisible({ timeout: 15_000 })
      await reveal.click()

      const advanceName = round === 3 ? 'Game over' : 'Next turn'
      const advance = host.page.getByRole('button', { name: advanceName, exact: true })
      await expect(advance).toBeVisible({ timeout: 15_000 })
      await advance.click()
    }

    for (const player of players) {
      await expect(player.page.getByText('Game over', { exact: true })).toBeVisible({ timeout: 15_000 })
      await expect(player.page.getByRole('heading', { name: 'Final scores' })).toBeVisible()
    }
  } finally {
    await Promise.all(players.map((player) => player.context.close()))
  }
})
