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
