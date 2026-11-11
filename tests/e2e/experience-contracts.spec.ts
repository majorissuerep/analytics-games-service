import { expect, test } from '@playwright/test'
import { actionIssues, captureExperience, expectActionReady, expectFocusedWindow, overflowIssues } from './helpers/experience'

test.setTimeout(60000)

const desktopWindow = (id: string) => `[data-window-id="${id}"]`
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
})

test('acceptance guards reject the known2px overflow, clipped action and body-focus defects', async ({ page }, info) => {
  await page.goto('/')
  await page.setContent(`<main id="fixture"><div id="board" style="width:272px;overflow:auto"><div style="width:274px;height:30px">Field</div></div><div style="height:40px;overflow:hidden"><button id="clipped" style="margin-top:60px">Play</button></div><article data-window-id="back" data-focused="false"><button id="body">Body action</button></article><article data-window-id="front" data-focused="true">Front window</article></main>`)
  expect(await page.locator('#board').evaluate(element => element.scrollWidth - element.clientWidth)).toBe(2)
  expect(await overflowIssues(page.locator('#fixture'), { document: false })).toContain('DIV has undeclared horizontal overflow')
  expect(await actionIssues(page.locator('#clipped'))).toContain('clipped or outside the viewport')
  await page.locator('#body').click()
  await expect(page.locator(desktopWindow('back'))).toHaveAttribute('data-focused', 'false')
  await expect(expectFocusedWindow(page, 'back')).rejects.toThrow()
  await info.attach('negative-proof', { body: JSON.stringify({ microOverflowRejected: true, clippedActionRejected: true, brokenFocusRejected: true }), contentType: 'application/json' })
})

test('Minefield launches at its requested size with no hidden overflow and grows for Expert', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.locator('.desktop-icon').filter({ has: page.getByText('Minefield', {exact: true}) }).dblclick()
  const window = page.locator(desktopWindow('game:minefield')), game = page.frameLocator('iframe[title="Minefield"]')
  await expect(page.locator('iframe[title="Minefield"]')).toHaveAttribute('aria-busy', 'false', { timeout: 20000 })
  const bounds = (await window.locator('..').boundingBox())!
  expect(bounds.width).toBe(480); expect(bounds.height).toBe(600)
  await expect.poll(() => overflowIssues(game.locator('.minefield-app'))).toEqual([])
  await expect(game.getByLabel('Cell size')).toHaveCount(0)
  await expect(game.getByRole('button', { name: /Flag mode/ })).toHaveCount(0)
  await expectActionReady(game.getByRole('button', { name: 'New game', exact: true }))
  await expectActionReady(game.getByLabel('Level', { exact: true }))
  await captureExperience(page, info, 'mine-start', 'beginner-ready')
  await game.getByLabel('Level', { exact: true }).selectOption('expert')
  await expect.poll(async () => Math.round((await window.locator('..').boundingBox())!.width)).toBe(1120)
  await expect.poll(() => overflowIssues(game.locator('.minefield-app'))).toEqual([])
  await captureExperience(page, info, 'mine-expert', 'expert-ready')
  await page.setViewportSize({ width: 320, height: 640 })
  await expect.poll(() => overflowIssues(game.locator('.minefield-app'), { allow: ['minefield-board'] })).toEqual([])
  await expect(game.locator('.minefield-board-scroll')).toHaveAttribute('data-panning', 'true')
  expect(await game.locator('.minefield-cell').first().evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(24)
  await game.locator('.minefield-cell').first().focus()
  for (let i = 0; i < 29; i++) await page.keyboard.press('ArrowRight')
  await expectActionReady(game.getByLabel('Covered cell, row 1, column 30', { exact: true }))
  await captureExperience(page, info, 'mine-narrow', 'expert-panned-to-edge', 'clamped')
})

test('requested windows maximize restore and clamp to actual taskbar workspace', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.locator('.desktop-icon').filter({ has: page.getByText('Minefield', {exact: true}) }).dblclick()
  const window = page.locator(desktopWindow('game:minefield')), rnd = window.locator('..')
  await expect(page.locator('iframe[title="Minefield"]')).toHaveAttribute('aria-busy', 'false', { timeout: 20000 })
  const requested = (await rnd.boundingBox())!
  await window.getByRole('button', { name: 'Maximize', exact: true }).click()
  const workspace = (await page.locator('.desktop-windows').boundingBox())!
  await expect.poll(async () => { const b = (await rnd.boundingBox())!; return [Math.round(b.width), Math.round(b.height)] }).toEqual([Math.round(workspace.width), Math.round(workspace.height)])
  await captureExperience(page, info, 'shell-sizing', 'maximized', 'maximized')
  await window.getByRole('button', { name: /Restore/ }).click()
  await expect.poll(async () => { const b = (await rnd.boundingBox())!; return [b.width, b.height] }).toEqual([requested.width, requested.height])
  for (const viewport of [{ width: 1280, height: 576 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(async () => { const b = (await rnd.boundingBox())!, area = (await page.locator('.desktop-windows').boundingBox())!; return b.x >= area.x && b.y >= area.y && b.x + b.width <= area.x + area.width + .5 && b.y + b.height <= area.y + area.height + .5 }).toBe(true)
    await captureExperience(page, info, 'shell-sizing', `clamped-${viewport.width}`, 'clamped')
  }
})

test('background iframe controls raise their window and act on the first repeated click', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 844 })
  await page.goto('/')
  await page.locator('.desktop-icon').filter({ has: page.getByText('Minefield', {exact: true}) }).dblclick()
  const mine = page.frameLocator('iframe[title="Minefield"]')
  await expect(mine.locator('.minefield-app')).toBeVisible()
  await page.getByRole('button', { name: 'Open Paintbox', exact: true }).dblclick()
  await expect(page.locator('iframe[title="Paintbox"]')).toHaveAttribute('aria-busy', 'false', { timeout: 20000 })
  // Move Paintbox right by its title, leaving real Minefield cells exposed.
  const paint = page.locator(desktopWindow('game:paintbox')), title = paint.locator('.title-bar')
  const b = (await title.boundingBox())!
  await page.mouse.move(b.x + 100, b.y + 10); await page.mouse.down(); await page.mouse.move(b.x + 540, b.y + 10, { steps: 8 }); await page.mouse.up()
  const cell = mine.locator('.minefield-cell').first()
  for (let i = 0; i < 10; i++) {
    await paint.locator('.title-bar').click({ position: { x: (await paint.boundingBox())!.width - 150, y: 10 } })
    await expectFocusedWindow(page, 'game:paintbox')
    await cell.click({ button: 'right' })
    await expectFocusedWindow(page, 'game:minefield')
    await expect(cell).toHaveClass(i % 2 === 0 ? /flagged/ : /^(?!.*flagged)/)
  }
  await captureExperience(page, info, 'shell-focus', 'body-click-acted-and-raised')
  await paint.locator('.title-bar').click({ position: { x: (await paint.boundingBox())!.width - 150, y: 10 } })
  await mine.getByLabel('Level', { exact: true }).focus()
  await expectFocusedWindow(page, 'game:minefield')
  await captureExperience(page, info, 'shell-focus', 'keyboard-focus-raised')
})

test('Chess anchors navigation and actions while its selected pane scrolls', async ({ page }, info) => {
  await page.setViewportSize({ width: 1180, height: 796 })
  await page.goto('/')
  await page.locator('.desktop-icon').filter({ has: page.getByText('Chess', {exact: true}) }).dblclick()
  const game = page.frameLocator('iframe[title="Chess"]')
  await expect(page.locator('iframe[title="Chess"]')).toHaveAttribute('aria-busy', 'false', { timeout: 20000 })
  await expect(game.locator('.chess-intro')).toHaveCount(0)
  await expectActionReady(game.getByRole('button', { name: 'Play Stockfish 18', exact: true }))
  await expect.poll(() => overflowIssues(game.locator('.chess-app'), { allow: ['chess-setup-details'] })).toEqual([])
  await captureExperience(page, info, 'chess-sections', 'setup')
  await game.getByRole('button', { name: /^Models/ }).click()
  await game.locator('.chess-setup-details').evaluate(element => { element.scrollTop = element.scrollHeight })
  await expectActionReady(game.getByRole('button', { name: /^Computer/ }))
  await captureExperience(page, info, 'chess-sections', 'models-details-scrolled')
  await game.getByRole('button', { name: /^Local/ }).click()
  await game.getByRole('button', { name: 'Start pass-and-play' }).click()
  await game.locator('#analytics-chess-board-square-e2').click(); await game.locator('#analytics-chess-board-square-e4').click()
  await expectActionReady(game.getByRole('button', { name: 'Undo' }))
  await expectActionReady(game.getByRole('button', { name: 'Leave game' }))
  await expectActionReady(game.getByRole('button', { name: 'New game', exact: true }))
  await expect.poll(() => overflowIssues(game.locator('.chess-app'), { allow: ['chess-utility-details'] })).toEqual([])
  await captureExperience(page, info, 'chess-play', 'played-local-move')
  await game.getByRole('button', { name: 'Undo' }).click()
  await expect(game.getByRole('heading', { name: 'White to move' })).toBeVisible()
  await captureExperience(page, info, 'chess-play', 'undo')
})

test('Chess board grows with both available axes and keeps all actions on constrained screens', async ({ page }, info) => {
  await page.setViewportSize({ width: 1920, height: 1400 })
  await page.goto('/')
  await page.locator('.desktop-icon').filter({ has: page.getByText('Chess', {exact: true}) }).dblclick()
  const window = page.locator(desktopWindow('game:chess')), game = page.frameLocator('iframe[title="Chess"]')
  await expect(page.locator('iframe[title="Chess"]')).toHaveAttribute('aria-busy', 'false', { timeout: 20000 })
  await game.getByRole('button', { name: /^Local/ }).click(); await game.getByRole('button', { name: 'Start pass-and-play' }).click()
  const initial = (await game.locator('.chess-board-wrap').boundingBox())!
  await window.getByRole('button', { name: 'Maximize', exact: true }).click()
  await expect.poll(async () => (await game.locator('.chess-board-wrap').boundingBox())!.width).toBeGreaterThan(720)
  const expanded = (await game.locator('.chess-board-wrap').boundingBox())!
  expect(expanded.width).toBeGreaterThan(initial.width)
  expect(Math.abs(expanded.width - expanded.height)).toBeLessThanOrEqual(1)
  await expectActionReady(game.getByRole('button', { name: 'Leave game' }))
  await captureExperience(page, info, 'chess-resize', 'large-board', 'maximized')
  for (const viewport of [{ width: 1280, height: 576 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => overflowIssues(game.locator('.chess-app'), { allow: ['chess-utility-details'] })).toEqual([])
    await expectActionReady(game.getByRole('button', { name: 'Leave game' }))
    await expectActionReady(game.getByRole('button', { name: 'New game', exact: true }))
    await captureExperience(page, info, 'chess-resize', `constrained-${viewport.width}`, 'maximized')
  }
})

test('reference matrix captures actual requested glossy and solid app windows', async ({ page }, info) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 1280, height: 800 })
  for (const [title, selector] of [['Minefield', '.minefield-app'], ['Chess', '.chess-app'], ['Space Cadet Pinball', 'body']] as const) {
    await page.goto('/')
    await page.locator(`.desktop-icon[aria-label="Open ${title}"]`).dblclick()
    const frame = page.frameLocator(`iframe[title="${title}"]`)
    await expect(page.locator(`iframe[title="${title}"]`)).toHaveAttribute('aria-busy', 'false', { timeout: 20000 })
    await expect(frame.locator(selector)).toBeVisible()
    if (title === 'Space Cadet Pinball') await expect(frame.frameLocator('iframe[title="Space Cadet runtime"]').locator('#score')).toBeVisible()
    await captureExperience(page, info, 'visual-matrix', `${title}-requested`)
    const window = page.locator(`iframe[title="${title}"]`).locator('xpath=ancestor::article')
    await window.getByRole('button', { name: 'Maximize', exact: true }).click()
    await captureExperience(page, info, 'visual-matrix', `${title}-maximized`, 'maximized')
  }
  await page.evaluate(() => localStorage.setItem('analytics-games.material.v1', 'solid'))
  await page.reload()
  await page.locator('.desktop-icon[aria-label="Open Chess"]').dblclick()
  const chess = page.frameLocator('iframe[title="Chess"]')
  await expect(chess.locator('html')).toHaveAttribute('data-ui-material', 'solid')
  await expect(page.locator('iframe[title="Chess"]')).toHaveAttribute('aria-busy', 'false', { timeout: 20000 })
  await captureExperience(page, info, 'visual-matrix', 'chess-solid')
})
