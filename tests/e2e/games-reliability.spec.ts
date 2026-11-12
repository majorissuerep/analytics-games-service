import { expect, test, type Page } from '@playwright/test'
import { Chess } from 'chess.js'
import { captureExperience, expectActionReady, overflowIssues } from './helpers/experience'
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
  test(`${engine} answers a human move and supports free play hints`, async ({ page }, info) => {
    test.setTimeout(60_000)
    await page.goto('/games/chess')
    await expect(page.getByRole('navigation', { name: 'Game mode', exact: true })).toBeVisible({ timeout: 20_000 })
    await page.getByLabel('Opponent model').selectOption(engine)
    await page.locator('.chess-primary').filter({ hasText: /^Play / }).click()
    await page.locator('#analytics-chess-board-square-e2').click()
    await page.locator('#analytics-chess-board-square-e4').click()
    await page.getByRole('button', { name: 'Moves', exact: true }).click()
    await expect(page.locator('.chess-moves > div')).toContainText(/1\. e4 [a-zA-Z]/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: 'White to move' })).toBeVisible()
    await expectActionReady(page.getByRole('button', { name: /Undo/ }))
    await captureExperience(page, info, 'chess-play', `${engine}-genuine-response`)
    await page.getByRole('button', { name: 'New game' }).click()
    await page.getByRole('button', { name: 'Free both sides' }).click()
    await page.getByLabel('Analysis engine').selectOption(engine)
    await page.getByRole('button', { name: 'Play both sides · free moves' }).click()
    await page.getByRole('navigation', { name: 'Game details' }).getByRole('button').first().click()
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
    await expectActionReady(page.getByRole('button', { name: 'Leave game', exact: true }))
    await captureExperience(page, info, 'chess-play', `${engine}-selected-hint`)
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
  await expect(page.getByRole('navigation', { name: 'Game mode', exact: true })).toBeVisible({ timeout: 20_000 })
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
  await rows.last().scrollIntoViewIfNeeded()
  await expect(page.locator('.chess-board-wrap'), 'the board stays visible while reading lower candidate moves').toBeInViewport({ ratio: 1 })
  await rows.first().hover()
  await expect(page.locator('.chess-hover-card')).toContainText('0.00 vs best · Eval −0.30')
  await expect(page.locator('#analytics-chess-board-square-e6 > div')).toHaveCSS('box-shadow', /rgb\(29, 118, 65\)/)
  await expect(page.locator('.chess-board-wrap svg path[marker-end]')).toHaveAttribute('stroke', 'rgb(29, 118, 65)')
  await page.screenshot({ path: 'test-results/chess-quality-calibration.png', fullPage: true })
  await page.setViewportSize({ width: 320, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.locator('.chess-utility-details').evaluate(element => { element.scrollTop = 0 })
  await expectActionReady(page.getByRole('button', { name: 'Leave game', exact: true }))
  await page.screenshot({ path: 'test-results/chess-quality-calibration-phone.png' })
})

for (const [white, black] of [['builtin-stockfish-19', 'reckless-local'], ['builtin-styled-opening', 'builtin-stockfish-18']]) {
  test(`arena ${white} versus ${black} advances, pauses, and resumes`, async ({ page }, info) => {
    test.setTimeout(60_000)
    await page.goto('/games/chess')
    await expect(page.getByRole('navigation', { name: 'Game mode', exact: true })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /Model arena/ }).click()
    await page.getByLabel('White model').selectOption(white)
    await page.getByLabel('Black model').selectOption(black)
    await page.getByLabel('Turn budget').selectOption('1000')
    const created = page.waitForResponse(response => response.url().endsWith('/api/chess-model-matches') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Start model match' }).click()
    const creationResponse = await created
    expect(creationResponse.status(), await creationResponse.text()).toBe(201)
    await expect.poll(() => page.locator('.chess-arena-moves button').count(), { timeout: 40_000 }).toBeGreaterThanOrEqual(6)
    await page.getByRole('button', { name: 'Pause match' }).click()
    await expect(page.getByRole('button', { name: 'Resume match' })).toBeVisible()
    const pausedCount = await page.locator('.chess-arena-moves button').count()
    await expectActionReady(page.getByRole('button', { name: 'Resume match' }))
    await captureExperience(page, info, 'chess-sections', `${white}-arena-paused`)
    await page.getByRole('button', { name: 'First position', exact: true }).click()
    await expect(page.getByText(`Replay position 0/${pausedCount}`)).toBeVisible()
    await page.getByRole('button', { name: 'Play replay', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Pause replay', exact: true })).toBeVisible()
    await captureExperience(page, info, 'chess-sections', `${white}-replay-playing`)
    await page.getByRole('button', { name: 'Pause replay', exact: true }).click()
    await page.getByRole('button', { name: 'Resume match' }).click()
    await expect.poll(() => page.locator('.chess-arena-moves button').count(), { timeout: 20_000 }).toBeGreaterThan(pausedCount)
    await page.getByRole('button', { name: 'Pause match' }).click()
    await page.reload()
    await expect(page.getByRole('navigation', { name: 'Game mode', exact: true })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /Model arena/ }).click()
    await page.getByRole('button', { name: 'Saved matches', exact: true }).click()
    await expect(page.locator('.chess-match-archive button').first()).toBeVisible()
    await captureExperience(page, info, 'chess-sections', `${white}-durable-archive`)
  })
}

test('Chess engine waiting, failure and retry preserve reachable actions', async ({ page }, info) => {
  let releaseFailure!: () => void
  const pendingFailure = new Promise<void>(resolve => { releaseFailure = resolve })
  let first = true
  await page.route('**/api/chess/analyse', async route => {
    if (!first) return route.continue()
    first = false
    await pendingFailure
    await route.fulfill({ status: 503, json: { error: 'Engine temporarily unavailable for recovery verification' } })
  })
  await page.goto('/games/chess')
  await expect(page.getByRole('navigation', { name: 'Game mode', exact: true })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Free both sides', exact: true }).click()
  await page.getByRole('button', { name: 'Play both sides · free moves', exact: true }).click()
  await expect(page.locator('.chess-utility-details .ui-loading')).toBeVisible()
  await expectActionReady(page.getByRole('button', { name: 'Leave game', exact: true }))
  await captureExperience(page, info, 'chess-play', 'engine-waiting-response')
  releaseFailure()
  await expect(page.locator('.chess-notice')).toContainText('Engine temporarily unavailable')
  await expectActionReady(page.getByRole('button', { name: 'Retry', exact: true }))
  await captureExperience(page, info, 'chess-play', 'recoverable-engine-failure')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.locator('.chess-suggestion').first()).toBeVisible({ timeout: 30_000 })
  await expectActionReady(page.getByRole('button', { name: 'Leave game', exact: true }))
  await captureExperience(page, info, 'chess-play', 'genuine-analysis-after-retry')
})

async function openMinefieldWindow(page: Page) {
  await page.goto('/')
  const welcome = page.locator('.desktop-rnd-window').filter({ has: page.getByRole('heading', { name: /Welcome/ }) })
  if (await welcome.count()) await welcome.getByRole('button', { name: 'Close', exact: true }).click()
  // The welcome window may overlap icons; its title is not a game input.
  const close = page.getByRole('button', { name: 'Close', exact: true })
  if (await close.count()) await close.first().click()
  await page.locator('.desktop-icon[aria-label="Open Minefield"]').dblclick()
  const scope = page.frameLocator('iframe[title="Minefield"]')
  await expect(scope.locator('.minefield-cell').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('progressbar', { name: 'Opening Minefield', exact: true })).toBeHidden({ timeout: 30_000 })
  await expectActionReady(scope.getByRole('button', { name: 'New game', exact: true }))
  return scope
}

async function clearVisibleBoard(scope: Pick<Page, 'locator'>, hooks: { late?: () => Promise<void>; chord?: () => Promise<void>; stopAfterChord?: boolean } = {}) {
  // Independent browser solver: reads public rendered clues, never hidden state.
  const dimensions = await scope.locator('.minefield-dimensions').innerText()
  const [width, height, mineCount] = dimensions.match(/\d+/g)!.map(Number)
  const totalSafe = width * height - mineCount
  let capturedLate = false, chorded = false
  const read = () => scope.locator('.minefield-cell').evaluateAll(elements => elements.map(element => ({
    open: element.classList.contains('revealed'), flag: element.classList.contains('flagged'), clue: Number(element.getAttribute('data-adjacent')),
  })))
  const neighbors = (index: number) => {
    const x = index % width, y = Math.floor(index / width), result: number[] = []
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height) result.push((y + dy) * width + x + dx)
    }
    return result
  }
  const captureLate = async () => {
    if (!hooks.late || capturedLate) return
    const count = await scope.locator('.minefield-cell.revealed').count()
    if (count >= Math.ceil(totalSafe * .7) && count < totalSafe) { capturedLate = true; await hooks.late() }
  }
  for (let step = 0; step < 500; step += 1) {
    if ((await scope.locator('.minefield-status').innerText()).startsWith('Cleared')) return { capturedLate, chorded }
    const cells = await read()
    const constraints = cells.flatMap((cell, i) => cell.open ? [{
      unknown: neighbors(i).filter(j => !cells[j].open && !cells[j].flag),
      mines: cell.clue - neighbors(i).filter(j => cells[j].flag).length,
    }] : []).filter(c => c.unknown.length)
    constraints.push({ unknown: cells.flatMap((cell, i) => !cell.open && !cell.flag ? [i] : []), mines: mineCount - cells.filter(cell => cell.flag).length })
    const safe = new Set<number>(), mines = new Set<number>()
    const infer = (unknown: number[], count: number) => {
      if (count === 0) unknown.forEach(i => safe.add(i))
      else if (count === unknown.length) unknown.forEach(i => mines.add(i))
    }
    for (const c of constraints) infer(c.unknown, c.mines)
    for (const a of constraints) for (const b of constraints) {
      if (a.unknown.length < b.unknown.length && a.unknown.every(i => b.unknown.includes(i))) infer(b.unknown.filter(i => !a.unknown.includes(i)), b.mines - a.mines)
    }
    expect(safe.size + mines.size, 'every move follows visible clues').toBeGreaterThan(0)
    for (const i of mines) await scope.locator('.minefield-cell').nth(i).dispatchEvent('contextmenu')
    const marked = await read()
    const chord = marked.findIndex((cell, i) => cell.open && cell.clue > 0 && neighbors(i).filter(j => marked[j].flag).length === cell.clue && neighbors(i).some(j => !marked[j].open && !marked[j].flag))
    if (chord >= 0) {
      const before = await scope.locator('.minefield-cell.revealed').count()
      const control = scope.locator('.minefield-cell').nth(chord)
      await expectActionReady(control)
      await control.click()
      expect(await scope.locator('.minefield-cell.revealed').count(), 'matching flags let a clue open neighbors').toBeGreaterThan(before)
      await captureLate()
      if (!chorded) { chorded = true; await hooks.chord?.() }
      if (hooks.stopAfterChord) return { capturedLate, chorded }
    }
    for (const i of safe) {
      const cell = scope.locator('.minefield-cell').nth(i)
      if (!(await cell.getAttribute('class'))?.includes('revealed')) { await cell.dispatchEvent('click'); await captureLate() }
    }
  }
  throw new Error('Board did not finish')
}

test('99-mine expert fits its requested window and clears entirely from public clues', async ({ page }, info) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 1000 })
  const scope = await openMinefieldWindow(page)
  await expect(scope.getByLabel('Cell size')).toHaveCount(0)
  await expect(scope.getByRole('button', { name: /Flag mode/ })).toHaveCount(0)
  await scope.getByLabel('Level', { exact: true }).selectOption('expert')
  const window = page.locator('.desktop-rnd-window').filter({ has: page.locator('iframe[title="Minefield"]') })
  await expect.poll(() => window.evaluate(e => [e.clientWidth, e.clientHeight])).toEqual([1120, 760])
  await expect.poll(() => overflowIssues(scope.locator('.minefield-app'))).toEqual([])
  await expect(scope.locator('[data-scroll-owner="minefield-board"]')).toHaveAttribute('data-panning', 'false')
  await expectActionReady(scope.locator('.minefield-cell').first())
  await captureExperience(page, info, 'classic-play', 'ready', 'requested-expert1120x760')
  await scope.locator('.minefield-cell').first().click()
  await expect(scope.locator('.minefield-cell.revealed').first()).toBeVisible({ timeout: 30_000 })
  const result = await clearVisibleBoard(scope, { late: async () => {
    const revealed = await scope.locator('.minefield-cell.revealed').count()
    expect(revealed).toBeGreaterThanOrEqual(267)
    expect(revealed).toBeLessThan(381)
    await captureExperience(page, info, 'classic-play', `late99-${revealed}-of381`, 'requested-expert1120x760')
  } })
  expect(result.capturedLate, 'capture an actual nonterminal late field').toBe(true)
  await expect(scope.locator('.minefield-status')).toContainText('Cleared')
  await captureExperience(page, info, 'classic-play', 'won', 'requested-expert1120x760')
  await scope.getByRole('button', { name: 'New game', exact: true }).click()
  await expect(scope.locator('.minefield-cell.revealed')).toHaveCount(0)
})

test('Minefield input keeps reveal marking cancellation generation reset and Retry distinct', async ({ page }, info) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    const NativeWorker = window.Worker
    let failNext = true
    window.Worker = new Proxy(NativeWorker, { construct(Target, args) {
      if (failNext) { failNext = false; throw new Error('Controlled Minefield worker startup failure') }
      const worker = Reflect.construct(Target, args) as Worker
      const post = worker.postMessage.bind(worker)
      worker.postMessage = (message: unknown) => { window.setTimeout(() => post(message), 3000) }
      return worker
    } })
  })
  const scope = await openMinefieldWindow(page)
  const first = scope.locator('.minefield-cell').first()
  await first.click({ button: 'right' })
  await expect(first).toHaveClass(/flagged/)
  await captureExperience(page, info, 'generation-recovery', 'right-click-flag', 'clamped-request')
  await first.focus()
  await first.press('f')
  await expect(first).not.toHaveClass(/flagged/)
  await first.press('ArrowRight')
  await expect(scope.locator('.minefield-cell').nth(1)).toBeFocused()
  await scope.locator('.minefield-cell').nth(1).press('Enter')
  await expect(scope.locator('.minefield-status')).toContainText('could not start')
  await expectActionReady(scope.getByRole('button', { name: 'Retry verification' }))
  await captureExperience(page, info, 'generation-recovery', 'worker-failed', 'clamped-request')
  await scope.getByRole('button', { name: 'Retry verification' }).click()
  await expect(scope.getByRole('progressbar', { name: 'Verifying a deduction-only board' })).toBeVisible()
  await expect(scope.getByRole('progressbar', { name: 'Verifying a deduction-only board' })).not.toHaveAttribute('aria-valuenow')
  await expectActionReady(scope.getByRole('button', { name: 'New game', exact: true }))
  await captureExperience(page, info, 'generation-recovery', 'generating-before-reset', 'clamped-request')
  await expect(scope.getByRole('progressbar', { name: 'Verifying a deduction-only board' })).toBeVisible()
  await scope.getByRole('button', { name: 'New game', exact: true }).click()
  await page.waitForTimeout(3200) // A delayed, cancelled worker must not repopulate the reset field.
  await expect(scope.locator('.minefield-cell.revealed')).toHaveCount(0)
  await captureExperience(page, info, 'generation-recovery', 'reset-rejects-stale-generation', 'clamped-request')
  await first.click()
  await expect(scope.locator('.minefield-cell.revealed').first()).toBeVisible({ timeout: 30_000 })
  await captureExperience(page, info, 'generation-recovery', 'retry-playable', 'clamped-request')
  const result = await clearVisibleBoard(scope, { stopAfterChord: true, chord: () => captureExperience(page, info, 'generation-recovery', 'chord-opened-neighbors', 'clamped-request').then(() => undefined) })
  expect(result.chorded, 'prove real matching-flags clue click').toBe(true)
  await scope.getByRole('button', { name: 'New game', exact: true }).click()
  const session = await page.context().newCDPSession(page)
  const bounds = (await first.boundingBox())!
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await page.waitForTimeout(550)
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(first).toHaveClass(/flagged/)
  await expect(scope.locator('.minefield-cell.revealed')).toHaveCount(0)
  await captureExperience(page, info, 'generation-recovery', 'held-flag-no-reveal', 'clamped-request')
  await scope.getByRole('button', { name: 'New game', exact: true }).click()
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 30, y: y + 30 }] })
  await page.waitForTimeout(550)
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  await expect(scope.locator('.minefield-cell.flagged')).toHaveCount(0)
  await expect(scope.locator('.minefield-cell.revealed')).toHaveCount(0)
  await captureExperience(page, info, 'generation-recovery', 'moved-cancelled-no-mark-no-reveal', 'clamped-request')
  await expectActionReady(first)
  await first.click()
  await expect(first).toHaveClass(/revealed/, { timeout: 15000 })
  await captureExperience(page, info, 'generation-recovery', 'mouse-after-touch-cancel-opens-once', 'clamped-request')
})

test('Minefield constrained intermediate and expert pan only their readable board', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 640 })
  const scope = await openMinefieldWindow(page)
  for (const [level, columns] of [['intermediate', 16], ['expert', 30]] as const) {
    await scope.getByLabel('Level', { exact: true }).selectOption(level)
    const board = scope.locator('[data-scroll-owner="minefield-board"]')
    await expect(board).toHaveAttribute('data-panning', 'true')
    await expect.poll(() => overflowIssues(scope.locator('.minefield-app'), { allow: ['minefield-board'] })).toEqual([])
    expect(await scope.locator('.minefield-cell').first().evaluate(e => e.getBoundingClientRect().width)).toBe(24)
    await expect(scope.locator('.minefield-pan-help')).toContainText('Pan the board')
    await scope.locator('.minefield-cell').first().focus()
    for (let i = 1; i < columns; i++) await page.keyboard.press('ArrowRight')
    const edge = scope.locator('.minefield-cell').nth(columns - 1)
    await expect(edge).toBeFocused()
    await expectActionReady(edge)
    await edge.press('f')
    await expect(edge).toHaveClass(/flagged/)
    await edge.press('f')
    await edge.press('Enter')
    await expect(scope.locator('.minefield-cell.revealed').first()).toBeVisible({ timeout: 30_000 })
    await captureExperience(page, info, 'mine-narrow', `${level}-edge-reveal`, 'workspace-clamped')
  }
})
