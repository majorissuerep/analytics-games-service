import { expect, test, type Page } from '@playwright/test'
import { Chess } from 'chess.js'
import { heatColor } from '../../lib/engine/reckless-presentation'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
})

const engines = ['builtin-stockfish-18', 'builtin-stockfish-19', 'reckless-local']

for (const engine of [...engines, 'builtin-styled-opening']) {
  test(`real ${engine} plays legal consecutive moves with history`, async ({ request }) => {
    const chess = new Chess()
    const history: string[] = []
    for (let ply = 0; ply < 8; ply += 1) {
      const legalMoves = chess.moves({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion ?? ''}`)
      const response = await request.post(`/api/chess-models/${engine}/move`, { data: { fen: chess.fen(), legalMoves, history, moveTimeMs: 150 } })
      expect(response.ok(), await response.text()).toBe(true)
      const { move } = await response.json() as { move: string }
      expect(legalMoves).toContain(move)
      chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] })
      history.push(move)
    }
  })
}

for (const engine of engines) {
  test(`${engine} answers a human move and supports free play hints`, async ({ page }) => {
    await page.goto('/games/chess')
    await page.getByLabel('Opponent model').selectOption(engine)
    await page.locator('.chess-primary').filter({ hasText: /^Play / }).click()
    await page.locator('#analytics-chess-board-square-e2').click()
    await page.locator('#analytics-chess-board-square-e4').click()
    await expect(page.locator('.chess-moves > div')).toContainText(/1\. e4 [a-zA-Z]/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: 'White to move' })).toBeVisible()
    await page.getByRole('button', { name: 'New game' }).click()
    await page.getByRole('button', { name: 'Free both sides' }).click()
    await page.getByLabel('Analysis engine').selectOption(engine)
    await page.getByRole('button', { name: 'Play both sides · free moves' }).click()
    await expect(page.locator('.chess-suggestion').first()).toBeVisible({ timeout: 30_000 })
    const first = page.locator('.chess-suggestion').first()
    const score = (await first.locator('.chess-suggestion-score').innerText()).replace('−', '-')
    expect(await first.evaluate(element => (element as HTMLElement).style.borderLeftColor)).toBe(heatColor(Math.round(Number(score) * 100)))
    await first.click()
    await expect(page.getByRole('heading', { name: 'Black to move' })).toBeVisible()
    await expect(page.locator('.chess-suggestion').first()).toBeVisible({ timeout: 30_000 })
    await page.screenshot({ path: `test-results/qa-${engine}-hints.png`, fullPage: true })
  })
}

for (const [white, black] of [['builtin-stockfish-19', 'reckless-local'], ['builtin-styled-opening', 'builtin-stockfish-18']]) {
  test(`arena ${white} versus ${black} advances, pauses, and resumes`, async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/games/chess')
    await page.getByRole('button', { name: /Model arena/ }).click()
    await page.getByLabel('White model').selectOption(white)
    await page.getByLabel('Black model').selectOption(black)
    await page.getByLabel('Turn budget').selectOption('1000')
    await page.getByRole('button', { name: 'Start model match' }).click()
    await expect.poll(() => page.locator('.chess-arena-moves button').count(), { timeout: 40_000 }).toBeGreaterThanOrEqual(6)
    await page.getByRole('button', { name: 'Pause match' }).click()
    await expect(page.getByRole('button', { name: 'Resume match' })).toBeVisible()
    const pausedCount = await page.locator('.chess-arena-moves button').count()
    await page.screenshot({ path: `test-results/qa-arena-${white}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Resume match' }).click()
    await expect.poll(() => page.locator('.chess-arena-moves button').count(), { timeout: 20_000 }).toBeGreaterThan(pausedCount)
    await page.getByRole('button', { name: 'Pause match' }).click()
    await page.reload()
    await page.getByRole('button', { name: /Model arena/ }).click()
    await expect(page.locator('.chess-match-archive button').first()).toBeVisible()
  })
}

async function clearVisibleBoard(page: Page) {
  // Independent browser solver: reads public clues only, no hidden board state.
  for (let step = 0; step < 500; step += 1) {
    if ((await page.locator('.minefield-status').innerText()).startsWith('Cleared')) return
    const cells = await page.locator('.minefield-cell').evaluateAll(elements => elements.map(element => ({
      open: element.classList.contains('revealed'), flag: element.classList.contains('flagged'), clue: Number(element.getAttribute('data-adjacent')),
    })))
    const neighbors = (index: number) => {
      const x = index % 30, y = Math.floor(index / 30), result: number[] = []
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && x + dx >= 0 && x + dx < 30 && y + dy >= 0 && y + dy < 16) result.push((y + dy) * 30 + x + dx)
      }
      return result
    }
    const constraints = cells.flatMap((cell, i) => cell.open ? [{
      unknown: neighbors(i).filter(j => !cells[j].open && !cells[j].flag),
      mines: cell.clue - neighbors(i).filter(j => cells[j].flag).length,
    }] : []).filter(c => c.unknown.length)
    constraints.push({ unknown: cells.flatMap((cell, i) => !cell.open && !cell.flag ? [i] : []), mines: 99 - cells.filter(cell => cell.flag).length })
    const safe = new Set<number>(), mines = new Set<number>()
    const infer = (unknown: number[], count: number) => {
      if (count === 0) unknown.forEach(i => safe.add(i))
      else if (count === unknown.length) unknown.forEach(i => mines.add(i))
    }
    for (const c of constraints) infer(c.unknown, c.mines)
    for (const a of constraints) for (const b of constraints) {
      if (a.unknown.length < b.unknown.length && a.unknown.every(i => b.unknown.includes(i))) infer(b.unknown.filter(i => !a.unknown.includes(i)), b.mines - a.mines)
    }
    expect(safe.size + mines.size, 'every move must follow from visible clues').toBeGreaterThan(0)
    for (const i of mines) await page.locator('.minefield-cell').nth(i).click({ button: 'right' })
    for (const i of safe) {
      const cell = page.locator('.minefield-cell').nth(i)
      if (!(await cell.getAttribute('class'))?.includes('revealed')) await cell.click()
    }
    const progress = cells.filter(cell => cell.open).length / 381
    if (progress >= .7 && progress < .95) await page.screenshot({ path: 'test-results/qa-minefield-expert-70percent.png', fullPage: true })
  }
  throw new Error('Board did not finish')
}

test('99-mine expert board clears entirely without a guess and supports zoom and touch flags', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/games/minefield')
  await page.getByRole('combobox', { name: 'Level', exact: true }).selectOption('expert')
  await page.getByLabel('Covered cell, row 1, column 1', { exact: true }).click()
  await expect(page.locator('.minefield-cell.revealed').first()).toBeVisible({ timeout: 30_000 })
  await clearVisibleBoard(page)
  await expect(page.locator('.minefield-status')).toContainText('Cleared')
  await page.getByRole('button', { name: 'New game' }).click()
  await page.getByLabel('Cell size').selectOption('44')
  await page.getByRole('button', { name: 'Flag mode' }).click()
  await page.locator('.minefield-cell').first().click()
  await expect(page.locator('.minefield-cell.flagged')).toHaveCount(1)
  await page.locator('.minefield-cell').first().click()
  await expect(page.locator('.minefield-cell.flagged')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/qa-minefield-mobile-large.png', fullPage: true })
})
