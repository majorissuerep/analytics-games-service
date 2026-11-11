import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
})

test('engine startup is scoped, staged, timed, cancellable, and never invents a percentage', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      if (!String(input).endsWith('/api/chess/analyse')) return original(input, init)
      const encoder = new TextEncoder()
      return new Response(new ReadableStream({ start(controller) {
        controller.enqueue(encoder.encode('event: progress\ndata: {"stage":"starting","message":"Loading selected model files"}\n\n'))
        const timer = setTimeout(() => controller.enqueue(encoder.encode('event: progress\ndata: {"stage":"initializing","message":"Preparing model session"}\n\n')), 1500)
        init?.signal?.addEventListener('abort', () => { clearTimeout(timer); controller.error(new DOMException('Cancelled', 'AbortError')) }, { once: true })
      } }), { headers: { 'content-type': 'text/event-stream' } })
    }
  })
  await page.goto('/games/chess')
  await page.getByRole('button', { name: 'Free both sides' }).click()
  await page.getByRole('button', { name: 'Play both sides · free moves' }).click()
  const loader = page.locator('.ui-loading').filter({ hasText: 'Loading selected model files' })
  await expect(loader.getByRole('progressbar')).toBeVisible()
  await expect(loader.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
  await expect(page.getByRole('progressbar', { name: /Preparing model session/ })).toBeVisible()
  await expect(page.getByRole('timer')).toHaveText(/[1-9]\d*s/)
  await page.screenshot({ path: 'test-results/loading-chess-startup.png', fullPage: true })
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByText('Engine request stopped. Retry when ready.')).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await page.getByRole('button', { name: 'New game' }).click()
  await expect(page.getByRole('button', { name: 'Play both sides · free moves' })).toBeVisible()
})

test('opening an app keeps the XP desktop usable and supports closing just that app', async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/games/minefield?embedded=1', async route => { await pending; await route.continue().catch(() => undefined) })
  await page.goto('/')
  await page.locator('.desktop-icon[aria-label="Open Minefield"]').dblclick()
  const loader = page.locator('.desktop-game-loader')
  await expect(loader.getByRole('progressbar', { name: 'Opening Minefield' })).toBeVisible()
  await expect(page.locator('.desktop-taskbar')).toBeVisible()
  await page.screenshot({ path: 'test-results/loading-app-window.png', fullPage: true })
  await loader.getByRole('button', { name: 'Close app' }).click()
  await expect(page.locator('iframe[title="Minefield"]')).toHaveCount(0)
  release()
})

test('PNG export shows local progress while drawing controls remain usable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      setTimeout(() => original.call(this, callback, type, quality), 1600)
    }
  })
  await page.goto('/games/paintbox')
  const downloadReady = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save PNG', exact: true }).click()
  await expect(page.getByRole('progressbar', { name: 'Preparing your PNG download' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save PNG', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: /Eraser/ }).click()
  await expect(page.getByRole('button', { name: /Eraser/ })).toHaveAttribute('aria-pressed', 'true')
  const download = await downloadReady
  expect(download.suggestedFilename()).toBe('paintbox-drawing.png')
  await expect(page.getByRole('progressbar')).toHaveCount(0)
})

test('Pip shows request progress and lets the user stop a stalled response', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      if (!String(input).endsWith('/api/pip/chat')) return original(input, init)
      return new Response(new ReadableStream({ start(controller) {
        init?.signal?.addEventListener('abort', () => controller.error(new DOMException('Stopped', 'AbortError')), { once: true })
      } }), { headers: { 'content-type': 'text/event-stream' } })
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Talk to me' }).click()
  const chat = page.getByRole('dialog', { name: 'Talk to Pip' })
  await chat.getByRole('button', { name: 'How do I play Minefield?' }).click()
  await chat.getByRole('button', { name: 'Send message' }).click()
  await expect(chat.getByRole('progressbar')).toBeVisible()
  await chat.getByRole('button', { name: 'Stop response' }).click()
  await expect(chat.getByText('Response stopped. Send another message when ready.')).toBeVisible()
  await expect(chat.getByRole('progressbar')).toHaveCount(0)
})

test('shared progress supports keyboard cancellation and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/design-system')
  await page.getByRole('button', { name: 'Preview feedback' }).click()
  const bar = page.getByRole('progressbar', { name: 'Preparing the preview' })
  await expect(bar).toBeVisible()
  await expect(bar.locator('span')).toHaveCSS('animation-name', 'none')
  await page.getByRole('button', { name: 'Cancel', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(bar).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('interactive component example')
})

test('an app that cannot open replaces its loader with retry inside the same window', async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  let attempts = 0
  await page.route('**/games/minefield?embedded=1', async route => {
    if (++attempts === 1) await pending
    await route.continue().catch(() => undefined)
  })
  await page.goto('/')
  await page.clock.install()
  await page.locator('.desktop-icon[aria-label="Open Minefield"]').dblclick()
  await expect(page.getByRole('progressbar', { name: 'Opening Minefield' })).toBeVisible()
  await page.clock.fastForward(46_000)
  await expect(page.locator('.desktop-game-loader').getByRole('alert')).toContainText('Minefield could not finish opening')
  await page.getByRole('button', { name: 'Retry app' }).click()
  await page.clock.resume()
  await expect(page.frameLocator('iframe[title="Minefield"]').getByRole('button', { name: 'New game' })).toBeVisible()
  await expect(page.locator('.desktop-game-loader')).toHaveCount(0)
  release()
})

test('real Vercel-compatible engine endpoints return progress and a legal result over SSE', async ({ request }) => {
  const { Chess } = await import('chess.js')
  const chess = new Chess()
  const legalMoves = chess.moves({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion ?? ''}`)
  for (const engine of ['builtin-stockfish-18', 'builtin-stockfish-19', 'reckless-local', 'builtin-styled-opening']) {
    const response = await request.post(`/api/chess-models/${engine}/move`, {
      headers: { accept: 'text/event-stream' },
      data: { fen: chess.fen(), legalMoves, history: [], moveTimeMs: 150 },
    })
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain('text/event-stream')
    const body = await response.text()
    expect(body).toContain('event: progress')
    expect(body).toContain('"stage":"thinking"')
    const result = /event: result\ndata: (.+)/.exec(body)
    expect(result, body).not.toBeNull()
    expect(legalMoves).toContain(JSON.parse(result![1]).move)
  }
})

test('Minefield verification reports actual attempts and can be stopped without blocking app controls', async ({ page }) => {
  await page.addInitScript(() => {
    // Slow generator fixture exercises the real worker-message UI contract.
    window.Worker = class {
      onmessage: ((event: MessageEvent) => void) | null = null
      onerror = null
      timer: ReturnType<typeof setTimeout> | undefined
      postMessage() { this.timer = setTimeout(() => this.onmessage?.({ data: { attempt: 42 } } as MessageEvent), 150) }
      terminate() { clearTimeout(this.timer) }
    } as unknown as typeof Worker
  })
  await page.goto('/games/minefield')
  await page.getByRole('button', { name: 'Covered cell, row 5, column 5', exact: true }).click()
  await expect(page.getByRole('progressbar', { name: 'Verifying a deduction-only board' })).toBeVisible()
  await expect(page.getByText(/Checking candidate 42/)).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Verifying a deduction-only board' })).not.toHaveAttribute('aria-valuenow')
  await expect(page.getByRole('button', { name: 'New game' })).toBeEnabled()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('progressbar', { name: 'Verifying a deduction-only board' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Covered cell, row 5, column 5', exact: true })).toBeEnabled()
})
