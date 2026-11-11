import { expect, test, type Locator, type Page } from '@playwright/test'
import { captureExperience, expectActionReady, expectFocusedWindow } from './helpers/experience'

const article = (page: Page, id: string) => page.locator(`[data-window-id="${id}"]`)
const outer = (page: Page, id: string) => article(page, id).locator('..')
const task = (page: Page, title: string) => page.locator('.taskbar-windows button').filter({ hasText: title })
const dimensions = async (element: Locator) => {
  const box = (await element.boundingBox())!
  return [Math.round(box.width), Math.round(box.height)]
}

async function openGame(page: Page, title: string) {
  if (await page.locator('[data-window-id]').count()) {
    const start = page.locator('.start-button')
    await expectActionReady(start)
    await start.click()
    const entry = page.locator('.start-menu-items > button').filter({ has: page.getByText(title, { exact: true }) })
    await expectActionReady(entry)
    await entry.click()
    return
  }
  const icon = page.locator('.desktop-icon').filter({ hasText: title })
  await expectActionReady(icon)
  await icon.dblclick()
}

async function resize(page: Page, element: Locator, width: number, height: number) {
  const bounds = (await element.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width - 2, bounds.y + bounds.height - 2)
  await page.mouse.down()
  const sizes: number[] = []
  for (let step = 1; step <= 8; step++) {
    await page.mouse.move(bounds.x + bounds.width - 2 + (width - bounds.width) * step / 8, bounds.y + bounds.height - 2 + (height - bounds.height) * step / 8)
    sizes.push((await element.boundingBox())!.width)
  }
  await page.mouse.up()
  const direction = Math.sign(width - bounds.width)
  expect(sizes.every((size, index) => direction * (size - (index ? sizes[index - 1] : bounds.width)) > 1), 'Resize must follow every step across embedded app documents').toBe(true)
  await expect.poll(() => dimensions(element)).toEqual([width, height])
}

async function move(page: Page, element: Locator, x: number, y: number) {
  const bounds = (await element.boundingBox())!
  const label = element.locator('.title-bar-text')
  await expectActionReady(label)
  const title = (await label.boundingBox())!
  const pointer = { x: title.x + title.width / 2, y: title.y + title.height / 2 }
  await page.mouse.move(pointer.x, pointer.y)
  await page.mouse.down()
  await page.mouse.move(pointer.x + x - bounds.x, pointer.y + y - bounds.y, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => { const bounds = (await element.boundingBox())!; return [Math.round(bounds.x), Math.round(bounds.y)] }).toEqual([x, y])
}

async function insideWorkspace(page: Page, element: Locator) {
  await expect.poll(async () => {
    const bounds = (await element.boundingBox())!, workspace = (await page.locator('.desktop-windows').boundingBox())!
    return bounds.x >= workspace.x && bounds.y >= workspace.y && bounds.x + bounds.width <= workspace.x + workspace.width && bounds.y + bounds.height <= workspace.y + workspace.height
  }).toBe(true)
  for (const name of ['Minimize', 'Close']) await expectActionReady(element.getByRole('button', { name, exact: true }))
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
})

const requests = [
  { id: 'system:welcome', title: 'Welcome', width: 620, height: 430 },
  { id: 'system:help', title: 'Build a game', width: 720, height: 620 },
  { id: 'system:plugins', title: 'Plugins', width: 620, height: 520 },
  { id: 'game:minefield', title: 'Minefield', width: 480, height: 600 },
  { id: 'game:chess', title: 'Chess', width: 1000, height: 760 },
  { id: 'game:orbit-pinball', title: 'Space Cadet Pinball', width: 920, height: 740 },
  { id: 'game:paintbox', title: 'Paintbox', width: 1000, height: 760 },
  { id: 'game:mafia', title: 'Mafia Online', width: 780, height: 640 },
]

for (const request of requests) test(`shell-sizing: ${request.id} request resize maximize restore and constrained workspace`, async ({ page }, info) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  if (request.id !== 'system:welcome') {
    await article(page, 'system:welcome').getByRole('button', { name: 'Close', exact: true }).click()
    await openGame(page, request.title)
  }
  const window = outer(page, request.id)
  const workspace = (await page.locator('.desktop-windows').boundingBox())!
  expect(workspace.height).toBe(758)
  await expect.poll(() => dimensions(window)).toEqual([Math.min(request.width, workspace.width), Math.min(request.height, workspace.height)])
  await insideWorkspace(page, window)
  await captureExperience(page, info, 'shell-sizing', `${request.id}-requested`)
  const original = await window.boundingBox()
  await expectActionReady(window.getByRole('button', { name: 'Maximize', exact: true }))
  await window.getByRole('button', { name: 'Maximize', exact: true }).click()
  await expect.poll(() => dimensions(window)).toEqual([1280, 758])
  await captureExperience(page, info, 'shell-sizing', `${request.id}-maximized`, 'maximized')
  await window.getByRole('button', { name: 'Restore', exact: true }).click()
  await expect.poll(() => window.boundingBox()).toEqual(original)
  const resized = [Math.min(request.width - 60, 800), Math.min(request.height - 60, 620)]
  await resize(page, window, resized[0], resized[1])
  const userRect = await window.boundingBox()
  await window.getByRole('button', { name: 'Maximize', exact: true }).click()
  await window.getByRole('button', { name: 'Restore', exact: true }).click()
  await expect.poll(() => window.boundingBox()).toEqual(userRect)
  await captureExperience(page, info, 'shell-sizing', `${request.id}-user-size-restored`, 'restored')
  for (const viewport of [{ width: 1280, height: 576 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await insideWorkspace(page, window)
    await expect.poll(() => dimensions(window)).toEqual([Math.min(resized[0], viewport.width), Math.min(resized[1], viewport.height - 42)])
    await captureExperience(page, info, 'shell-sizing', `${request.id}-constrained-${viewport.width}`, 'clamped')
  }
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect.poll(() => window.boundingBox()).toEqual(userRect)
})

test('shell-focus: ten real first-action switches keyboard nested canvas drag and bounded active stack', async ({ page }, info) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1280, height: 844 })
  await page.goto('/')
  await article(page, 'system:welcome').getByRole('button', { name: 'Close', exact: true }).click()
  await openGame(page, 'Minefield')
  const mine = page.frameLocator('iframe[title="Minefield"]')
  await expect(page.locator('iframe[title="Minefield"]')).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 })
  await openGame(page, 'Paintbox')
  await expect(page.locator('iframe[title="Paintbox"]')).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 })
  const paint = outer(page, 'game:paintbox')
  await resize(page, paint, 500, 600)
  await move(page, paint, 740, 78)
  const cell = mine.locator('.minefield-cell').first()
  for (let index = 0; index < 10; index++) {
    await expectActionReady(paint.locator('.title-bar-text'))
    await paint.locator('.title-bar-text').click()
    await expectFocusedWindow(page, 'game:paintbox')
    await expectActionReady(cell)
    await cell.click({ button: 'right' })
    await expectFocusedWindow(page, 'game:minefield')
    await expect(cell).toHaveClass(index % 2 === 0 ? /flagged/ : /^(?!.*flagged)/)
    if ([0, 4, 9].includes(index)) await captureExperience(page, info, 'shell-focus', `first-action-switch-${index + 1}`)
  }
  await paint.locator('.title-bar-text').click()
  await mine.getByLabel('Level', { exact: true }).focus()
  await expectFocusedWindow(page, 'game:minefield')
  await page.keyboard.press('Tab')
  await expect(mine.getByRole('button', { name: 'New game', exact: true })).toBeFocused()
  await captureExperience(page, info, 'shell-focus', 'keyboard-activation')

  // Real drag traverses iframe bodies; capture intermediate positions rather than
  // only checking the final coordinate, which would miss a stalled drag shield.
  const window = outer(page, 'game:minefield'), start = (await window.boundingBox())!
  const label = window.locator('.title-bar-text')
  await expectActionReady(label)
  const title = (await label.boundingBox())!
  const pointer = { x: title.x + title.width / 2, y: title.y + title.height / 2 }
  await page.mouse.move(pointer.x, pointer.y)
  await page.mouse.down()
  const positions: number[] = []
  for (let step = 1; step <= 6; step++) {
    await page.mouse.move(pointer.x + step * 30, pointer.y + step * 20)
    positions.push((await window.boundingBox())!.x)
  }
  await page.mouse.up()
  expect(positions.every((position, index) => position >= (index ? positions[index - 1] : start.x) + 25)).toBe(true)
  await captureExperience(page, info, 'shell-focus', 'continuous-iframe-drag')

  await openGame(page, 'Space Cadet Pinball')
  const pinball = outer(page, 'game:orbit-pinball')
  const native = page.frameLocator('iframe[title="Space Cadet Pinball"]').frameLocator('iframe[title="Space Cadet runtime"]')
  const canvas = native.locator('#canvas')
  await expect(native.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled({ timeout: 30_000 })
  await resize(page, pinball, 640, 600)
  for (let index = 0; index < 10; index++) {
    await expectActionReady(task(page, 'Paintbox'))
    await task(page, 'Paintbox').click()
    await expectFocusedWindow(page, 'game:paintbox')
    await expectActionReady(canvas)
    await canvas.click()
    await expectFocusedWindow(page, 'game:orbit-pinball')
    await expect(canvas).toBeFocused() // The original pointer action reaches the nested canvas.
  }
  await page.keyboard.down('Space')
  await page.waitForTimeout(1200) // Hold duration charges the native plunger.
  await page.keyboard.up('Space')
  await expect.poll(async () => Number((await native.locator('#score').innerText()).replaceAll(',', '')), { timeout: 20_000 }).toBeGreaterThan(0)
  await captureExperience(page, info, 'shell-focus', 'nested-canvas-first-action-played')
  await expectActionReady(native.getByRole('button', { name: 'Pause', exact: true }))
  await native.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(native.locator('body')).toHaveAttribute('data-paused', 'true')
  await expectActionReady(task(page, 'Paintbox'))
  await task(page, 'Paintbox').click()
  await native.getByRole('button', { name: 'Resume', exact: true }).first().focus()
  await expectFocusedWindow(page, 'game:orbit-pinball')
  await page.keyboard.press('Enter')
  await expect(native.locator('body')).toHaveAttribute('data-paused', 'false')

  const stack = () => page.locator('.desktop-rnd-window').evaluateAll(elements => elements.map(element => element.getAttribute('style')))
  const before = await stack()
  await page.evaluate(() => {
    const workspace = document.querySelector('.desktop-windows')!
    const records: MutationRecord[] = []
    const observer = new MutationObserver(batch => records.push(...batch))
    observer.observe(workspace, { attributes: true, subtree: true, attributeFilter: ['style', 'data-focused'] })
    Object.assign(window, { desktopActivationProbe: { records, observer } })
  })
  for (let index = 0; index < 100; index++) await canvas.click()
  expect(await stack()).toEqual(before)
  const changes = await page.evaluate(() => {
    const probe = (window as unknown as { desktopActivationProbe: { records: MutationRecord[]; observer: MutationObserver } }).desktopActivationProbe
    probe.observer.disconnect()
    return probe.records.filter(record => (record.target as Element).matches('.desktop-rnd-window,[data-window-id]')).length
  })
  expect(changes).toBe(0)
  const ranks = await page.locator('.desktop-rnd-window').evaluateAll(elements => elements.map(element => Number((element as HTMLElement).style.zIndex)))
  expect([...ranks].sort()).toEqual(ranks.map((_, index) => index + 1))
  await captureExperience(page, info, 'shell-focus', '100-active-clicks-stable-stack')
})
