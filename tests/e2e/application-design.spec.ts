import { expect, test } from '@playwright/test'

const canvas = 'rgb(246, 244, 248)'
const surface = 'rgb(255, 255, 255)'
const accent = 'rgb(177, 45, 117)'

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
  ['Prism reference', '/design-system', '.prism-reference'],
]) {
  test(`${name} uses the shared application language at desktop and phone sizes`, async ({ page }) => {
    await page.goto(path)
    const app = page.locator(root)
    await expect(page.locator('body')).toHaveCSS('background-color', canvas)
    await expect(page.locator('body')).toHaveCSS('background-image', /gradient/)
    await expect(app).toHaveCSS('font-family', /Segoe UI/)
    await expect(app).toHaveCSS('color', 'rgb(41, 36, 54)')
    for (const width of [1280, 390, 320]) {
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
  await expect(chat.locator('.pip-chat-messages')).toHaveCSS('background-image', /gradient/)
  await expect(chat.locator('.pip-chat-message p').first()).toHaveCSS('background-color', surface)
  await chat.getByRole('button', { name: 'Close Pip chat' }).click()
  await page.locator('.desktop-icon').filter({ hasText: 'Plugins' }).dblclick()
  await expect(page.locator('.plugin-manager')).toHaveCSS('background-color', canvas)
  const row = page.locator('.plugin-row').first()
  expect(await row.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(surface)
  expect(await row.locator('strong').evaluate(element => getComputedStyle(element).color)).not.toBe('rgb(41, 36, 54)')
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

test('Radar keeps its identity and translated controls readable on narrow phones', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/games/consensus-radar')
  for (const language of ['EN', 'УКР']) {
    await page.getByRole('button', { name: language, exact: true }).click()
    const brand = await page.locator('.brand').boundingBox()
    const actions = await page.locator('.topbar-actions').boundingBox()
    expect(actions!.y).toBeGreaterThanOrEqual(brand!.y + brand!.height)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await page.getByPlaceholder('Your name…').fill('A player with a long name')
  await page.getByRole('button', { name: /Continue/ }).click()
  await expect(page.locator('.player-pill')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

function rgba(value: string) {
  const values = value.match(/[\d.]+/g)!.map(Number)
  return [values[0], values[1], values[2], values[3] ?? 1]
}
function luminance(rgb: number[]) {
  return rgb.slice(0, 3).map(channel => {
    const value = channel / 255
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
  }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
}
function contrast(first: number[], second: number[]) {
  const [dark, light] = [luminance(first), luminance(second)].sort((a, b) => a - b)
  return (light + .05) / (dark + .05)
}

test('Prism gives meaningful content distinct colors, readable contrast, and working states', async ({ page }) => {
  await page.goto('/design-system')
  const cards = await page.locator('.prism-tone-card').evaluateAll(elements => elements.map(element => ({ ink: getComputedStyle(element).color, fill: getComputedStyle(element).backgroundColor })))
  expect(new Set(cards.map(card => card.ink)).size).toBe(4)
  for (const card of cards) expect(contrast(rgba(card.ink), rgba(card.fill))).toBeGreaterThanOrEqual(4.5)
  const material = await page.locator('.prism-material-sample').evaluate(element => ({
    fill: getComputedStyle(element).backgroundColor,
    text: [...element.querySelectorAll('h3, p')].map(child => getComputedStyle(child).color),
    opacity: getComputedStyle(element).opacity,
  }))
  const fill = rgba(material.fill)
  expect(fill[3]).toBeLessThan(1)
  expect(material.opacity).toBe('1')
  for (const background of [0, 255]) {
    const composited = fill.slice(0, 3).map(channel => channel * fill[3] + background * (1 - fill[3]))
    for (const text of material.text) expect(contrast(rgba(text), composited), 'text must remain readable on composited glass').toBeGreaterThanOrEqual(4.5)
  }
  await page.getByRole('button', { name: 'Analysis', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Analysis', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Preview feedback' }).click()
  await expect(page.getByRole('status')).toContainText('Sample action completed')
})

test('saved material preference reaches another app and the static cabinet and survives reload', async ({ page, context }) => {
  await page.goto('/design-system')
  const chess = await context.newPage()
  await chess.goto('/games/chess')
  const cabinet = await context.newPage()
  await cabinet.goto('/vendor/pinball/cabinet.html')
  await expect(chess.locator('.chess-toolbar')).toHaveCSS('backdrop-filter', /blur/)
  await page.getByLabel('Reduce transparency').check()
  for (const app of [page, chess, cabinet]) await expect(app.locator('html')).toHaveAttribute('data-ui-material', 'solid')
  await expect(chess.locator('.chess-toolbar')).toHaveCSS('backdrop-filter', 'none')
  await expect(cabinet.locator('.pinball-bar')).toHaveCSS('background-color', surface)
  await page.reload()
  await expect(page.getByLabel('Reduce transparency')).toBeChecked()
  await page.getByLabel('Reduce transparency').uncheck()
  await expect(chess.locator('.chess-toolbar')).toHaveCSS('backdrop-filter', /blur/)
  await expect(cabinet.locator('.pinball-bar')).toHaveCSS('backdrop-filter', /blur/)
})

test('system transparency, forced colors, and reduced motion preferences preserve usable controls', async ({ page }) => {
  await page.goto('/design-system')
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] })
  await expect(page.locator('.prism-material-sample')).toHaveCSS('background-color', surface)
  await expect(page.locator('.prism-material-sample')).toHaveCSS('backdrop-filter', 'none')
  await session.send('Emulation.setEmulatedMedia', { features: [] })
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' })
  await expect(page.locator('.prism-material-sample')).toHaveCSS('backdrop-filter', 'none')
  await page.getByRole('button', { name: 'Preview feedback' }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Reset', exact: true })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Reset', exact: true })).toHaveCSS('outline-style', 'solid')
  expect(await page.getByRole('button', { name: 'Reset', exact: true }).evaluate(element => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThan(.001)
})
