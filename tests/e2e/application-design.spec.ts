import { expect, test } from '@playwright/test'

const canvas = 'rgb(233, 232, 226)'
const surface = 'rgb(245, 244, 239)'
const accent = 'rgb(53, 78, 97)'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
})

for (const [name, path, root] of [
  ['Chess', '/games/chess', '.chess-app'],
  ['Consensus Radar', '/games/consensus-radar', '.radar-app'],
  ['Minefield', '/games/minefield', '.minefield-app'],
  ['Paintbox', '/games/paintbox', '.paintbox-app'],
  ['Pinball', '/vendor/pinball/cabinet.html', 'body.app-surface'],
  ['Developer guide', '/develop', '.developer-shell'],
]) {
  test(`${name} uses the shared application language at desktop and phone sizes`, async ({ page }) => {
    await page.goto(path)
    const app = page.locator(root)
    await expect(app).toHaveCSS('background-color', canvas)
    await expect(app).toHaveCSS('background-image', 'none')
    await expect(app).toHaveCSS('font-family', /Segoe UI/)
    await expect(app).toHaveCSS('color', 'rgb(37, 49, 57)')
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} must fit ${width}px`).toBe(true)
      await page.screenshot({ path: `test-results/design-${name.replaceAll(' ', '-')}-${width}.png`, fullPage: true })
    }
  })
}

test('XP desktop chrome stays distinct from the application controls inside its windows', async ({ page }) => {
  await page.goto('/')
  const title = page.locator('.desktop-window .title-bar').first()
  await expect(title).toHaveCSS('background-image', /gradient/)
  await expect(page.locator('.desktop-taskbar')).toHaveCSS('background-image', /gradient/)
  await expect(page.locator('.start-button')).toHaveCSS('background-image', /gradient/)
  await expect(page.locator('.welcome-panel')).toHaveCSS('background-color', canvas)
  await expect(page.locator('.welcome-actions button').first()).toHaveCSS('background-image', 'none')
  await expect(page.locator('.welcome-actions button').first()).toHaveCSS('border-top-style', 'solid')
  const close = page.locator('.desktop-window').first().getByRole('button', { name: 'Close', exact: true })
  await expect(close).toHaveCSS('background-image', /url|gradient/)
  await page.locator('.desktop-icon[aria-label="Open Minefield"]').dblclick()
  const frame = page.frameLocator('iframe[title="Minefield"]')
  await expect(frame.locator('.minefield-app')).toHaveCSS('background-color', canvas)
  await expect(frame.getByRole('button', { name: 'New game' })).toHaveCSS('background-image', 'none')
  await page.screenshot({ path: 'test-results/design-xp-boundary.png', fullPage: true })
})

test('notes, assistant content, and system panels use the same surfaces while the chat header remains XP', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.sticky-note-plugin textarea')).toHaveCSS('font-family', /Segoe UI/)
  await expect(page.locator('.sticky-note-plugin')).toHaveCSS('transform', 'none')
  await page.getByRole('button', { name: 'Talk to me' }).click()
  const chat = page.getByRole('dialog', { name: 'Talk to Pip' })
  await expect(chat.locator('header')).toHaveCSS('background-image', /gradient/)
  await expect(chat.locator('.pip-chat-messages')).toHaveCSS('background-image', 'none')
  await expect(chat.locator('.pip-chat-message p').first()).toHaveCSS('background-color', surface)
  await chat.getByRole('button', { name: 'Close Pip chat' }).click()
  await page.locator('.desktop-icon').filter({ hasText: 'Plugins' }).dblclick()
  await expect(page.locator('.plugin-manager')).toHaveCSS('background-color', canvas)
  await expect(page.locator('.plugin-row').first()).toHaveCSS('background-color', surface)
})

test('a primary action and keyboard focus carry the same meaning in the redesigned room UI', async ({ page }) => {
  await page.goto('/games/consensus-radar')
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  const input = page.getByPlaceholder('Your name…')
  await input.focus()
  await expect(input).toHaveCSS('outline-style', 'solid')
  await expect(input).toHaveCSS('outline-width', '3px')
  await expect(page.getByRole('button', { name: /Continue/ })).toHaveCSS('background-color', accent)
  await expect(page.locator('.logo-big')).toHaveCSS('animation-name', 'none')
})
