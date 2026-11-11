import { expect, test } from '@playwright/test'

const surface = 'rgb(255, 255, 255)'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
})

for (const [name, path, root] of [
  ['Chess', '/games/chess', '.chess-app'],
  ['Minefield', '/games/minefield', '.minefield-app'],
  ['Paintbox', '/games/paintbox', '.paintbox-app'],
  ['Pinball', '/vendor/pinball/cabinet.html', 'body.app-surface'],
  ['Developer guide', '/develop', '.developer-shell'],
  ['Prism reference', '/design-system', '.prism-reference'],
]) {
  test(`${name} keeps its own surfaces readable and contained at desktop and phone sizes`, async ({ page }) => {
    await page.goto(path)
    const app = page.locator(root).filter({ visible: true })
    await expect(app).toHaveCSS('font-family', /Segoe UI/)
    const palette = await app.evaluate(element => {
      const style = getComputedStyle(element)
      const sample = document.createElement('span')
      sample.style.color = 'var(--ui-canvas)'
      element.append(sample)
      const canvas = getComputedStyle(sample).color
      sample.remove()
      return { ink: style.color, canvas }
    })
    expect(contrast(rgba(palette.ink), rgba(palette.canvas)), `${name} text on its app canvas`).toBeGreaterThanOrEqual(4.5)
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
  await expect(page.locator('.welcome-panel')).toHaveCSS('font-family', /Segoe UI/)
  await expect(page.locator('.welcome-actions button').first()).toHaveCSS('border-top-style', 'solid')
  const close = page.locator('.desktop-window').first().getByRole('button', { name: 'Close', exact: true })
  await expect(close).toHaveCSS('background-image', /url|gradient/)
  await page.locator('.desktop-icon[aria-label="Open Minefield"]').dblclick()
  const frame = page.frameLocator('iframe[title="Minefield"]')
  await expect(frame.locator('.minefield-app')).toHaveCSS('font-family', /Segoe UI/)
  await expect(frame.getByRole('button', { name: 'New game' })).toHaveCSS('border-top-style', 'solid')
  await page.screenshot({ path: 'test-results/design-xp-boundary.png', fullPage: true })
})

test('Chess setup fits its window, limits decorative color, and scrolls only at the document edge', async ({ page }) => {
  for (const size of [{ width: 920, height: 680 }, { width: 1100, height: 800 }]) {
    await page.setViewportSize(size)
    await page.goto('/games/chess?embedded=1')
    await expect(page.getByRole('button', { name: 'Play Stockfish 18', exact: true })).toBeInViewport()
    await expect(page.getByText('Loading available chess models', { exact: true })).toHaveCount(0)
    const layout = await page.locator('.chess-setup').evaluate(element => ({
      overflow: getComputedStyle(element).overflowY,
      appFits: element.closest('.chess-app')!.getBoundingClientRect().bottom <= innerHeight,
      inactiveFills: [...element.querySelectorAll('.chess-mode-tabs button:not(.active)')].map(button => getComputedStyle(button).backgroundColor),
    }))
    expect(layout.overflow).toBe('visible')
    expect(layout.appFits).toBe(true)
    expect(new Set(layout.inactiveFills)).toEqual(new Set(['rgba(0, 0, 0, 0)']))
    await expect(page.locator('.chess-setup-panel')).toHaveCSS('background-image', /linear-gradient/)
    await page.screenshot({ path: `test-results/chess-compact-${size.width}.png` })
  }
  await page.setViewportSize({ width: 320, height: 640 })
  await page.getByRole('button', { name: 'Bring your own Chess model' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.locator('.chess-setup')).toHaveCSS('overflow-y', 'visible')
  const action = page.getByRole('button', { name: 'Play Stockfish 18', exact: true })
  await action.scrollIntoViewIfNeeded()
  await expect(action).toBeInViewport()
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0)
})

test('standalone privacy stays outside useful app content on a narrow page', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/games/chess')
  const privacy = page.getByRole('button', { name: 'Privacy', exact: true })
  await expect(privacy).toBeVisible()
  const app = (await page.locator('.chess-app').boundingBox())!
  const control = (await privacy.boundingBox())!
  expect(control.y, 'privacy belongs after the app, not over the Play button').toBeGreaterThanOrEqual(app.y + app.height)
  await privacy.scrollIntoViewIfNeeded()
  await privacy.click()
  await expect(page.getByRole('dialog', { name: 'Analytics privacy settings' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(privacy).toBeFocused()
})

test('desktop glass renders the backdrop through Chess and solid preference removes it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.locator('.desktop-icon[aria-label="Open Chess"]').dblclick()
  const iframe = page.locator('iframe[title="Chess"]')
  const frame = page.frameLocator('iframe[title="Chess"]')
  await expect(iframe).toHaveAttribute('aria-busy', 'false')
  await expect(frame.getByRole('button', { name: 'Play Stockfish 18', exact: true })).toBeInViewport()
  await expect(frame.locator('html')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(frame.locator('body')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  const windowBody = iframe.locator('xpath=ancestor::*[contains(@class,"desktop-window-body")]')
  await expect(windowBody).toHaveCSS('backdrop-filter', /blur/)
  // Sample empty canvas at the left edge, away from controls, text and shadows.
  // Pixel changes prove the iframe really composites the host backdrop, rather
  // than merely declaring an alpha color over an opaque document.
  const bounds = (await iframe.boundingBox())!
  const clip = { x: bounds.x + 5, y: bounds.y + 140, width: 3, height: 3 }
  async function sample(backdrop: string) {
    await page.locator('.desktop-sky').evaluate((element, color) => {
      Object.assign((element as HTMLElement).style, { backgroundImage: 'none', backgroundColor: color })
    }, backdrop)
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    return page.screenshot({ clip, animations: 'disabled' })
  }
  const darkGlass = await sample('black')
  const lightGlass = await sample('white')
  expect(darkGlass.equals(lightGlass), 'the desktop must show through the app canvas').toBe(false)
  const material = await frame.locator('.chess-app').evaluate(element => ({
    fill: getComputedStyle(element).backgroundColor,
    copy: [...element.querySelectorAll('.chess-intro p, .chess-attribution')].map(child => getComputedStyle(child).color),
  }))
  const windowFill = rgba(await windowBody.evaluate(element => getComputedStyle(element).backgroundColor))
  const appFill = rgba(material.fill)
  const darkestCanvas = appFill.slice(0, 3).map((channel, i) => channel * appFill[3] + windowFill[i] * windowFill[3] * (1 - appFill[3]))
  for (const color of material.copy) expect(contrast(rgba(color), darkestCanvas), 'unbacked copy over dark wallpaper').toBeGreaterThanOrEqual(4.5)
  await page.screenshot({ path: 'test-results/chess-glass-dark-backdrop.png' })
  // Use the real persisted preference script in both documents.
  await page.evaluate(() => localStorage.setItem('analytics-games.material.v1', 'solid'))
  await page.reload()
  await page.locator('.desktop-icon[aria-label="Open Chess"]').dblclick()
  await expect(iframe).toHaveAttribute('aria-busy', 'false')
  await expect(frame.locator('html')).toHaveAttribute('data-ui-material', 'solid')
  await expect(windowBody).toHaveCSS('backdrop-filter', 'none')
  await expect(frame.locator('.chess-setup-panel')).toHaveCSS('background-image', /^none(?:, none)*$/)
  const darkSolid = await sample('black')
  const lightSolid = await sample('white')
  expect(darkSolid.equals(lightSolid), 'solid mode must stop the backdrop showing through').toBe(true)
})

test('notes, assistant and system panels have individual content while the chat header stays XP', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.sticky-note-plugin textarea')).toHaveCSS('font-family', /Segoe UI/)
  await expect(page.locator('.sticky-note-plugin')).toHaveCSS('transform', 'none')
  await page.getByRole('button', { name: 'Talk to me' }).click()
  const chat = page.getByRole('dialog', { name: 'Talk to Pip' })
  await expect(chat.locator('header')).toHaveCSS('background-image', /gradient/)
  await expect(chat.locator('.pip-chat-message p').first()).toBeVisible()
  await expect(chat.locator('.pip-chat-messages')).toHaveCSS('font-family', /Segoe UI/)
  await chat.getByRole('button', { name: 'Close Pip chat' }).click()
  await page.locator('.desktop-icon').filter({ hasText: 'Plugins' }).dblclick()
  await expect(page.locator('.plugin-manager')).toHaveCSS('font-family', /Segoe UI/)
  const row = page.locator('.plugin-row').first()
  await expect(row).toBeVisible()
  await expect(row.getByRole('checkbox')).toBeVisible()
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
  expect(new Set(cards.map(card => card.ink)).size).toBe(2)
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
  await expect(cabinet.frameLocator('iframe[title="Space Cadet runtime"]').locator('.pinball-bar')).toHaveCSS('backdrop-filter', 'none')
  await page.reload()
  await expect(page.getByLabel('Reduce transparency')).toBeChecked()
  await page.getByLabel('Reduce transparency').uncheck()
  await expect(chess.locator('.chess-toolbar')).toHaveCSS('backdrop-filter', /blur/)
  await expect(cabinet.frameLocator('iframe[title="Space Cadet runtime"]').locator('.pinball-bar')).toHaveCSS('backdrop-filter', /blur/)
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
