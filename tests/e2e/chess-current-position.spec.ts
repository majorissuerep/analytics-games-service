import { expect, test, type FrameLocator, type Page } from '@playwright/test'
import { Chess } from 'chess.js'
import { captureExperience, expectActionReady, overflowIssues } from './helpers/experience'
import { presentAnalysis } from '../../lib/engine/reckless-presentation'

type Pending = { fen: string; url: string; aborted: boolean; settled: boolean; previousAborted: boolean; resolve: (response: Response) => void }
declare global {
  interface Window { chessCancellationFixture?: { requests: Pending[]; clickStates: boolean[] }; chessCancellationEvents?: string[] }
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
})

async function adversarialTransport(page: Page) {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window)
    const state = window.chessCancellationFixture = { requests: [] as Pending[], clickStates: [] as boolean[] }
    window.chessCancellationEvents = []
    window.addEventListener('message', event => { if (event.origin === location.origin && event.data?.kind === 'chess-fixture-abort') window.chessCancellationEvents?.push(event.data.url) })
    document.addEventListener('click', event => {
      if ((event.target as Element).closest?.('#analytics-chess-board-square-e4')) state.clickStates.push(state.requests.at(-1)?.aborted ?? false)
    })
    window.fetch = (input, init) => {
      const url = String(input)
      if (!url.endsWith('/api/chess/analyse') && !/\/api\/chess-models\/[^/]+\/move$/.test(url)) return original(input, init)
      return new Promise<Response>(resolve => {
        const item: Pending = { fen: JSON.parse(String(init?.body)).fen, url, aborted: Boolean(init?.signal?.aborted), settled: false, previousAborted: state.requests.filter(r => !r.settled).every(r => r.aborted), resolve }
        state.requests.push(item)
        init?.signal?.addEventListener('abort', () => { item.aborted = true; window.top?.postMessage({ kind: 'chess-fixture-abort', url }, location.origin) }, { once: true })
        // Intentionally ignores abort when completing fetch: tests obsolete buffered data,
        // independently of normal browser fetch's automatic AbortError rejection.
      })
    }
  })
}
async function openChess(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const welcome = page.locator('[data-window-id="system:welcome"]:visible')
  await expect(welcome).toBeVisible()
  await expectActionReady(welcome.getByRole('button', { name: 'Close', exact: true }))
  await welcome.getByRole('button', { name: 'Close', exact: true }).click()
  await page.locator('.desktop-icon[aria-label="Open Chess"]').dblclick()
  const frame = page.frameLocator('iframe[title="Chess"]:visible')
  await expect(frame.getByRole('navigation', { name: 'Game mode', exact: true })).toBeVisible()
  await expect(page.locator('.desktop-game-loader')).toHaveCount(0)
  return frame
}
async function startFree(frame: FrameLocator, engine = 'builtin-stockfish-18') {
  await frame.getByRole('button', { name: 'Free both sides', exact: true }).click()
  await frame.getByLabel('Analysis engine', { exact: true }).selectOption(engine)
  await frame.getByRole('button', { name: 'Play both sides · free moves', exact: true }).click()
}
async function requests(frame: FrameLocator) {
  return frame.locator('html').evaluate(() => window.chessCancellationFixture!.requests.map(({ fen, url, aborted, settled, previousAborted }) => ({ fen, url, aborted, settled, previousAborted })))
}
async function requestCount(frame: FrameLocator, count: number) { await expect.poll(async () => (await requests(frame)).length).toBe(count) }
async function move(frame: FrameLocator, from: string, to: string) {
  await frame.locator(`#analytics-chess-board-square-${from}`).click()
  await frame.locator(`#analytics-chess-board-square-${to}`).click()
}
async function deliver(frame: FrameLocator, index: number, label = 'Current result', error = false, stream = false) {
  const rows = await requests(frame), chess = new Chess(rows[index].fen)
  const legal = chess.moves({ verbose: true }).map(m => `${m.from}${m.to}${m.promotion ?? ''}`), uci = legal[0]
  const analysis = presentAnalysis(chess.fen(), chess.turn(), { bestMove: uci, lines: [{ multipv: 1, uci, scoreCp: 20, mateIn: null, bounded: false, depth: 12, pv: [uci] }] }, new Set(legal))
  analysis.balanceLabel = label
  await frame.locator('html').evaluate((_, { index, analysis, error, stream, uci }) => {
    const item = window.chessCancellationFixture!.requests[index]
    item.settled = true
    const body = error ? { error: 'Obsolete failure must never appear' } : item.url.endsWith('/move') ? { move: uci } : { analysis }
    const text = stream ? `event: progress\ndata: {"stage":"thinking","message":"OBSOLETE PROGRESS"}\n\nevent: result\ndata: ${JSON.stringify(body)}\n\n` : JSON.stringify(body)
    item.resolve(new Response(text, { status: error ? 503 : 200, headers: { 'content-type': stream ? 'text/event-stream' : 'application/json' } }))
  }, { index, analysis, error, stream, uci })
  return uci
}

test('only current predictions survive rapid free moves and late buffered responses', async ({ page }, info) => {
  await adversarialTransport(page)
  const frame = await openChess(page)
  await startFree(frame)
  await requestCount(frame, 1)
  await captureExperience(page, info, 'current-position', 'initial-current-loading')
  await move(frame, 'e2', 'e4')
  await requestCount(frame, 2)
  expect((await requests(frame))[0].aborted).toBe(true)
  expect(await frame.locator('html').evaluate(() => window.chessCancellationFixture!.clickStates)).toEqual([true])
  await move(frame, 'e7', 'e5')
  await move(frame, 'g1', 'f3')
  await requestCount(frame, 4)
  const pending = await requests(frame)
  expect(pending.slice(0, 3).every(r => r.aborted)).toBe(true)
  expect(pending.every(r => r.previousAborted)).toBe(true)
  expect(pending[3].aborted).toBe(false)
  await deliver(frame, 0, 'OLD INITIAL', false, true)
  await deliver(frame, 1, 'OLD AFTER E4')
  await deliver(frame, 2, 'OLD ERROR', true)
  await expect(frame.locator('.chess-suggestion')).toHaveCount(0)
  await expect(frame.getByText(/OLD INITIAL|OLD AFTER E4|OBSOLETE PROGRESS|Obsolete failure/)).toHaveCount(0)
  await expect(frame.getByRole('heading', { name: 'Black to move' })).toBeVisible()
  await captureExperience(page, info, 'current-position', 'rapid-moves-obsolete-work-aborted')
  const uci = await deliver(frame, 3)
  await expect(frame.locator('.chess-suggestion-balance')).toContainText('Current result')
  await expect(frame.locator('.chess-suggestion')).toHaveAttribute('data-uci', uci)
  await frame.locator('.chess-suggestion').hover()
  await expect(frame.locator('.chess-hover-card')).toBeVisible()
  await captureExperience(page, info, 'current-position', 'only-current-hint-and-arrow')
  await frame.locator('.chess-suggestion').click()
  await requestCount(frame, 5)
  await expect(frame.locator('.chess-hover-card')).toHaveCount(0)
  await expect(frame.locator('.chess-suggestion')).toHaveCount(0)
  await expect(frame.getByRole('heading', { name: 'White to move' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expectActionReady(frame.getByRole('button', { name: 'New game', exact: true }))
  await expectActionReady(frame.getByRole('button', { name: 'Leave game', exact: true }))
  await expect.poll(() => overflowIssues(frame.locator('.chess-app'), { allow: ['chess-utility-details'] })).toEqual([])
  await captureExperience(page, info, 'current-position', 'current-loading-narrow', 'clamped')
})

test('undo same FEN cancel retry reset and window close invalidate prediction generations', async ({ page }, info) => {
  await adversarialTransport(page)
  const frame = await openChess(page)
  await startFree(frame)
  await requestCount(frame, 1)
  await move(frame, 'e2', 'e4')
  await requestCount(frame, 2)
  await frame.getByRole('button', { name: /Undo/ }).click()
  await requestCount(frame, 3)
  let pending = await requests(frame)
  expect(pending[2].fen).toBe(pending[0].fen)
  expect(pending.slice(0, 2).every(r => r.aborted)).toBe(true)
  await deliver(frame, 0, 'OLD SAME FEN', false, true)
  await deliver(frame, 1, 'OLD OTHER FEN', true)
  await expect(frame.locator('.chess-suggestion')).toHaveCount(0)
  await expect(frame.getByText(/OLD SAME FEN|OBSOLETE PROGRESS|Obsolete failure/)).toHaveCount(0)
  await captureExperience(page, info, 'chess-lifecycle', 'same-fen-new-generation')
  await expectActionReady(frame.getByRole('button', { name: 'Cancel', exact: true }))
  await frame.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(frame.getByText('Engine request stopped. Retry when ready.')).toBeVisible()
  await deliver(frame, 2, 'CANCELED CURRENT', false, true)
  await expect(frame.locator('.chess-suggestion')).toHaveCount(0)
  await expect(frame.getByRole('progressbar')).toHaveCount(0)
  await requestCount(frame, 3)
  await captureExperience(page, info, 'chess-lifecycle', 'explicit-cancel-awaits-retry')
  await frame.getByRole('button', { name: 'Retry', exact: true }).click()
  await requestCount(frame, 4)
  await frame.getByRole('button', { name: 'New game', exact: true }).click()
  pending = await requests(frame)
  expect(pending[3].aborted).toBe(true)
  await startFree(frame, 'builtin-stockfish-19')
  await requestCount(frame, 5)
  await deliver(frame, 3, 'OLD RESET RESULT')
  await expect(frame.locator('.chess-suggestion')).toHaveCount(0)
  await deliver(frame, 4, 'Fresh selected model')
  await expect(frame.locator('.chess-suggestion-balance')).toContainText('Fresh selected model')
  await captureExperience(page, info, 'chess-lifecycle', 'new-game-current-engine-result')
  await move(frame, 'e2', 'e4')
  await requestCount(frame, 6)
  const before = await page.evaluate(() => window.chessCancellationEvents!.length)
  await page.locator('[data-window-id="game:chess"]:visible').getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.locator('iframe[title="Chess"]')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => window.chessCancellationEvents!.length)).toBeGreaterThan(before)
  await captureExperience(page, info, 'chess-lifecycle', 'closing-window-aborts-current-work')
})

test('restored cached page starts a fresh generation for the same board', async ({ page }, info) => {
  await adversarialTransport(page)
  const frame = await openChess(page)
  await startFree(frame)
  await requestCount(frame, 1)
  await frame.locator('html').evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })))
  expect((await requests(frame))[0].aborted).toBe(true)
  await frame.locator('html').evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
  await requestCount(frame, 2)
  const pending = await requests(frame)
  expect(pending[1].fen).toBe(pending[0].fen)
  await deliver(frame, 0, 'OLD CACHED PAGE', false, true)
  await expect(frame.locator('.chess-suggestion')).toHaveCount(0)
  await captureExperience(page, info, 'chess-lifecycle', 'restored-page-fresh-loading')
  await deliver(frame, 1, 'Current restored board')
  await expect(frame.locator('.chess-suggestion-balance')).toContainText('Current restored board')
  await captureExperience(page, info, 'chess-lifecycle', 'restored-page-current-result')
})

test('automatic move and evaluation cannot complete into a reset board', async ({ page }, info) => {
  await adversarialTransport(page)
  const frame = await openChess(page)
  await frame.locator('.chess-primary').filter({ hasText: /^Play / }).click()
  await expect.poll(async () => (await requests(frame)).some(r => r.url.endsWith('/analyse'))).toBe(true)
  await move(frame, 'e2', 'e4')
  await expect.poll(async () => (await requests(frame)).some(r => r.url.endsWith('/move'))).toBe(true)
  await frame.getByRole('button', { name: 'New game', exact: true }).click()
  const stale = await requests(frame)
  expect(stale.every(r => r.aborted)).toBe(true)
  await frame.locator('.chess-primary').filter({ hasText: /^Play / }).click()
  await expect.poll(async () => (await requests(frame)).length).toBeGreaterThan(stale.length)
  for (let i = 0; i < stale.length; i++) await deliver(frame, i, 'STALE AUTO OR EVALUATION', false, true)
  await expect(frame.getByRole('heading', { name: 'White to move' })).toBeVisible()
  await expect(frame.locator('#analytics-chess-board-square-e2 [data-piece="wP"]')).toHaveCount(1)
  await expect(frame.getByText(/STALE AUTO|OBSOLETE PROGRESS/)).toHaveCount(0)
  await captureExperience(page, info, 'chess-lifecycle', 'late-auto-and-evaluation-ignored')
})

for (const engine of ['builtin-stockfish-18', 'builtin-stockfish-19', 'reckless-local']) {
  test(`real ${engine} aborts a streamed search and predicts the current board`, async ({ page }, info) => {
    test.setTimeout(60_000)
    const frame = await openChess(page)
    const observation = await frame.locator('html').evaluate(async (_, revisionId) => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const controller = new AbortController(), started = performance.now()
      const response = await fetch('/api/chess/analyse', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/event-stream' }, body: JSON.stringify({ revisionId, fen, moveTimeMs: 10000, multiPv: 20 }), signal: controller.signal })
      if (!response.ok || !response.body) throw Error('Real analysis stream unavailable')
      const reader = response.body.getReader(), decoder = new TextDecoder(); let text = ''
      while (!text.includes('"stage":"thinking"')) { const part = await reader.read(); if (part.done) throw Error('Search ended before genuine thinking progress'); text += decoder.decode(part.value) }
      controller.abort()
      await reader.cancel().catch(() => undefined)
      const afterAbort = performance.now()
      const next = await fetch('/api/chess/analyse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revisionId, fen, moveTimeMs: 150, multiPv: 1 }) })
      const body = await next.json()
      return { engine: revisionId, status: next.status, coldUntilAbortMs: afterAbort - started, replacementMs: performance.now() - afterAbort, lines: body.analysis?.lines, note: 'Live HTTP observation; independent runtime tests prove same-process queue removal. Vercel routing may select another instance.' }
    }, engine)
    expect(observation.status).toBe(200)
    expect(observation.lines?.length).toBeGreaterThan(0)
    expect(observation.replacementMs).toBeLessThan(5000)
    await info.attach(`live-cancel-${engine}`, { body: JSON.stringify(observation, null, 2), contentType: 'application/json' })
    console.log('LIVE_CANCEL', JSON.stringify(observation))
    await startFree(frame, engine)
    await expect(frame.locator('.chess-suggestion').first()).toBeVisible({ timeout: 30000 })
    await captureExperience(page, info, 'live-engine', `${engine}-current-initial-hints`)
    await move(frame, 'e2', 'e4')
    await move(frame, 'e7', 'e5')
    await expect(frame.getByRole('heading', { name: 'White to move' })).toBeVisible()
    await expect(frame.locator('.chess-suggestion').first()).toBeVisible({ timeout: 30000 })
    const board = new Chess(); board.move('e4'); board.move('e5')
    const legal = board.moves({ verbose: true }).map(m => `${m.from}${m.to}${m.promotion ?? ''}`)
    for (const uci of await frame.locator('.chess-suggestion').evaluateAll(rows => rows.map(row => row.getAttribute('data-uci')))) expect(legal).toContain(uci)
    await expectActionReady(frame.getByRole('button', { name: 'Leave game', exact: true }))
    await captureExperience(page, info, 'live-engine', `${engine}-current-after-rapid-moves`)
  })
}
