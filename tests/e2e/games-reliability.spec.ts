import { expect, test, type Page } from '@playwright/test'
import { Chess } from 'chess.js'
import { presentAnalysis } from '../../lib/engine/reckless-presentation'

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
    const rowBounds = await first.boundingBox()
    const continuationBounds = await first.locator('.chess-suggestion-pv').boundingBox()
    expect(continuationBounds!.y + continuationBounds!.height, 'the full continuation must fit inside its hint row').toBeLessThanOrEqual(rowBounds!.y + rowBounds!.height)
    await expect(first.locator('.chess-suggestion-score')).toHaveText('0.00')
    await expect(first).toHaveCSS('border-left-color', 'rgb(29, 118, 65)')
    await first.click()
    await expect(page.getByRole('heading', { name: 'Black to move' })).toBeVisible()
    await expect(page.locator('.chess-suggestion').first()).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.chess-suggestion').first().locator('.chess-suggestion-score')).toHaveText('0.00')
    await expect(page.locator('.chess-suggestion').first()).toHaveCSS('border-left-color', 'rgb(29, 118, 65)')
    await page.screenshot({ path: `test-results/qa-${engine}-hints.png`, fullPage: true })
  })
}

test('move quality uses zero-based loss, a half-pawn red cutoff, and matching board colors', async ({ page }) => {
  await page.route('**/api/chess/analyse', async route => {
    const { fen } = route.request().postDataJSON() as { fen: string }
    const chess = new Chess(fen)
    const moves = chess.turn() === 'b' ? ['e7e6', 'e7e5', 'c7c5', 'g8f6', 'b8c6', 'd7d6'] : ['e2e4', 'd2d4', 'c2c4', 'g1f3', 'b1c3', 'a2a3']
    const losses = [0, 2, 10, 25, 50, 90]
    const lines = moves.map((uci, index) => ({ multipv: index + 1, uci, scoreCp: -30 - losses[index], mateIn: null, bounded: false, depth: 18, pv: [uci] }))
    const legal = new Set(chess.moves({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion ?? ''}`))
    await route.fulfill({ json: { analysis: presentAnalysis(fen, chess.turn(), { bestMove: moves[0], lines: [...lines].reverse() }, legal) } })
  })
  await page.goto('/games/chess')
  await page.getByRole('button', { name: 'Free both sides' }).click()
  await page.getByRole('button', { name: 'Play both sides · free moves' }).click()
  await expect(page.locator('.chess-suggestion').first()).toBeVisible()
  await page.locator('#analytics-chess-board-square-e2').click()
  await page.locator('#analytics-chess-board-square-e4').click()
  await expect(page.locator('.chess-suggestion-balance')).toContainText('White +0.30')
  await expect(page.getByRole('img', { name: /Move quality: 0.00 is best/ })).toBeVisible()
  const rows = page.locator('.chess-suggestion')
  await expect(rows.locator('.chess-suggestion-score')).toHaveText(['0.00', '−0.02', '−0.10', '−0.25', '−0.50', '−0.90'])
  await expect(rows.first().locator('.chess-suggestion-eval')).toHaveText('Eval −0.30')
  await expect(rows.first()).toHaveCSS('border-left-color', 'rgb(29, 118, 65)')
  await expect(rows.nth(1)).toHaveCSS('border-left-color', 'rgb(37, 119, 65)')
  await expect(rows.nth(2)).toHaveCSS('border-left-color', 'rgb(70, 125, 64)')
  await expect(rows.nth(3)).toHaveCSS('border-left-color', 'rgb(143, 102, 27)')
  for (const index of [4, 5]) await expect(rows.nth(index)).toHaveCSS('border-left-color', 'rgb(181, 48, 44)')
  await rows.first().hover()
  await expect(page.locator('.chess-hover-card')).toContainText('0.00 vs best · Eval −0.30')
  await expect(page.locator('#analytics-chess-board-square-e6 > div')).toHaveCSS('box-shadow', /rgb\(29, 118, 65\)/)
  await expect(page.locator('.chess-board-wrap svg path[marker-end]')).toHaveAttribute('stroke', 'rgb(29, 118, 65)')
  await page.screenshot({ path: 'test-results/chess-quality-calibration.png', fullPage: true })
  await page.setViewportSize({ width: 320, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.locator('.chess-suggestions').screenshot({ path: 'test-results/chess-quality-calibration-phone.png' })
})

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
