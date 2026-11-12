import { expect, test, type FrameLocator, type Page, type TestInfo } from '@playwright/test'
import { armMinefield, createMinefield } from '../../games/minefield/model'
import { analyzeMinefield, type VisibleMinefield } from '../../games/minefield/solver'
import { captureExperience, expectActionReady, overflowIssues } from './helpers/experience'

test.setTimeout(120_000)
test.beforeEach(async ({ context }) => { await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied')) })
async function open(page: Page, elite = true) {
  await page.goto('/')
  const welcome = page.locator('[data-window-id="system:welcome"]:visible')
  if (await welcome.count()) await welcome.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'Open Minefield', exact: true }).dblclick()
  const frame = page.frameLocator('iframe[title="Minefield"]:visible')
  await expect(page.locator('iframe[title="Minefield"]:visible')).toHaveAttribute('aria-busy', 'false', { timeout: 30000 })
  await expect(frame.getByRole('button', { name: 'New game', exact: true })).toBeVisible()
  if (elite) await frame.getByLabel('Level', { exact: true }).selectOption({ label: 'Extreme Elite' })
  return frame
}
async function layer(frame: FrameLocator, value: number) { await frame.getByRole('tab', { name: `Layer ${value + 1}`, exact: true }).click() }
async function publicBoard(frame: FrameLocator) {
  const view: VisibleMinefield = { width: 8, height: 8, layers: 2, mineCount: 28, cells: [] }
  for (let z = 0; z < 2; z++) {
    await layer(frame, z)
    const cells = await frame.locator('.minefield-cell').evaluateAll(nodes => nodes.map(node => ({
      revealed: node.classList.contains('revealed'), flagged: node.classList.contains('flagged'),
      adjacent: node.hasAttribute('data-adjacent') ? Number(node.getAttribute('data-adjacent')) : null,
      echo: node.hasAttribute('data-echo') ? Number(node.getAttribute('data-echo')) : null,
    })))
    expect(cells).toHaveLength(64); view.cells.push(...cells)
  }
  return view
}
async function select(frame: FrameLocator, index: number) {
  await layer(frame, Math.floor(index / 64))
  const cell = frame.locator(`.minefield-cell[data-index="${index}"]`)
  await expectActionReady(cell); await cell.click()
  return cell
}
async function solveElite(frame: FrameLocator, page: Page, info: TestInfo) {
  let scans = 0, cross = false, subset = false, captured = false
  for (let round = 0; round < 180; round++) {
    if ((await frame.locator('.minefield-status').innerText()).startsWith('Cleared')) return { scans, cross, subset }
    const view = await publicBoard(frame), result = analyzeMinefield(view)
    expect(result.kind).not.toBe('contradiction')
    cross ||= result.steps.some(step => step.sources.some(source => source.kind === 'echo'))
    subset ||= result.steps.some(step => step.rule === 'subset')
    if (result.safe.length) {
      for (const index of result.safe) {
        await layer(frame, Math.floor(index / 64))
        const cell = frame.locator(`.minefield-cell[data-index="${index}"]`)
        if ((await cell.getAttribute('class'))?.includes('revealed')) continue
        await expectActionReady(cell); await cell.click()
      }
    } else {
      const scan = view.cells.findIndex(cell => cell.revealed && cell.echo === null)
      expect(scan, 'verified route has another deduction or available truthful scan').toBeGreaterThanOrEqual(0)
      await select(frame, scan)
      const button = frame.getByRole('button', { name: 'Scan echo', exact: true })
      await expectActionReady(button); await button.click(); scans++
      await expect(frame.locator(`.minefield-cell[data-index="${scan}"]`)).toHaveAttribute('data-echo', /^\d$/)
    }
    const opened = (await publicBoard(frame)).cells.filter(cell => cell.revealed).length
    if (!captured && opened >= 70 && opened < 100) {
      await captureExperience(page, info, 'elite-play', `late-${opened}-safe`); captured = true
    }
  }
  throw new Error('Elite did not finish from public clues and unlimited scans')
}

test('Extreme Elite plays through truthful scans and cross-layer deductions to a real win', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const frame = await open(page)
  await expect.poll(() => overflowIssues(frame.locator('.minefield-app'))).toEqual([])
  await captureExperience(page, info, 'elite-play', 'ready')
  await frame.locator('.minefield-cell[data-index="0"]').click()
  await expect(frame.locator('.minefield-cell.revealed').first()).toBeVisible({ timeout: 15000 })
  await expect(frame.locator('.minefield-cell[data-index="0"]')).toHaveAttribute('data-adjacent', '0')
  await expect(frame.locator('.minefield-cell[data-index="0"]')).not.toHaveAttribute('data-echo')
  await select(frame, 0)
  const before = await frame.locator('.minefield-cell.revealed').count()
  await frame.locator('.minefield-cell[data-index="0"]').click()
  expect(await frame.locator('.minefield-cell.revealed').count(), 'selecting a revealed tile does not chord').toBe(before)
  await expectActionReady(frame.getByRole('button', { name: 'Scan echo', exact: true }))
  await frame.getByRole('button', { name: 'Scan echo', exact: true }).click()
  await expect(frame.locator('.minefield-cell[data-index="0"]')).toHaveAttribute('data-echo', /^\d$/)
  await captureExperience(page, info, 'elite-play', 'first-echo')
  await layer(frame, 1)
  await expect(frame.locator('.minefield-inspector')).toHaveAttribute('data-source-index', '0')
  expect(await frame.locator('.minefield-cell[data-echo-target="true"]').evaluateAll(nodes => nodes.map(n => Number(n.getAttribute('data-index'))))).toEqual([64, 65, 72, 73])
  await captureExperience(page, info, 'elite-play', 'other-layer-edge-footprint')
  const result = await solveElite(frame, page, info)
  expect(result.cross).toBe(true); expect(result.subset).toBe(true)
  await expect(frame.locator('.minefield-status')).toContainText('Cleared')
  expect((await publicBoard(frame)).cells.filter(cell => cell.revealed)).toHaveLength(100)
  await captureExperience(page, info, 'elite-play', 'won-both-layers')
  await frame.getByRole('button', { name: 'New game', exact: true }).click()
  await expect(frame.locator('.minefield-cell.revealed')).toHaveCount(0)
  await captureExperience(page, info, 'elite-play', 'reset')
})

test('Extreme Elite keeps its controls and readable board through resize material and keyboard changes', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const frame = await open(page), window = page.locator('[data-window-id="game:minefield"]:visible')
  const bounds = (await window.locator('..').boundingBox())!
  expect([bounds.width, bounds.height]).toEqual([720, 760])
  await frame.locator('.minefield-cell[data-index="0"]').click()
  await expect(frame.locator('.minefield-cell.revealed').first()).toBeVisible({ timeout: 15000 })
  await captureExperience(page, info, 'elite-layout', 'requested')
  await window.getByRole('button', { name: 'Maximize', exact: true }).click()
  await captureExperience(page, info, 'elite-layout', 'maximized')
  await window.getByRole('button', { name: /Restore/ }).click()
  await captureExperience(page, info, 'elite-layout', 'restored')
  for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 1280, height: 576 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => overflowIssues(frame.locator('.minefield-app'), { allow: ['minefield-board', 'minefield-proof'] })).toEqual([])
    await expectActionReady(frame.getByLabel('Level', { exact: true }))
    await expectActionReady(frame.getByRole('button', { name: 'New game', exact: true }))
    await expectActionReady(frame.getByRole('tab', { name: 'Layer 1', exact: true }))
    await expectActionReady(frame.getByRole('tab', { name: 'Layer 2', exact: true }))
    expect(await frame.locator('.minefield-cell').first().evaluate(e => e.getBoundingClientRect().width)).toBeGreaterThanOrEqual(32)
    if (viewport.width === 320) expect((await frame.locator('.minefield-stage').boundingBox())!.height).toBeGreaterThanOrEqual(192)
    await captureExperience(page, info, 'elite-layout', `glass-${viewport.width}x${viewport.height}`, 'clamped')
    await layer(frame, 0)
    await frame.locator('.minefield-cell[data-index="0"]').focus()
    await page.keyboard.press('ArrowRight')
    await expect(frame.locator('.minefield-cell[data-index="1"]')).toBeFocused()
    await captureExperience(page, info, 'elite-layout', `keyboard-${viewport.width}x${viewport.height}`, 'clamped')
  }
  await page.setViewportSize({ width: 320, height: 640 })
  await page.evaluate(() => localStorage.setItem('analytics-games.material.v1', 'solid'))
  await expect(frame.locator('html')).toHaveAttribute('data-ui-material', 'solid')
  await captureExperience(page, info, 'elite-layout', 'solid-320x640', 'clamped')
  await page.emulateMedia({ reducedMotion: 'reduce', contrast: 'more' })
  await expect.poll(() => overflowIssues(frame.locator('.minefield-app'), { allow: ['minefield-board'] })).toEqual([])
  await captureExperience(page, info, 'elite-layout', 'reduced-motion-contrast-320x640', 'clamped')
})

test('silent generation times out and Retry returns to a real verified game', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript((staleBoard) => {
    const Original = window.Worker
    let first = true
    window.Worker = new Proxy(Original, { construct(Target, args) {
      if (!first) return Reflect.construct(Target, args)
      first = false
      const fake = { onmessage: null as ((event: MessageEvent) => void) | null, onerror: null, postMessage() {
        setTimeout(() => { fake.onmessage?.({ data: { board: staleBoard } } as MessageEvent); document.documentElement.dataset.staleWorkerSent = 'true' }, 12000)
      }, terminate() {} }
      return fake
    } })
  }, createMinefield(9, 9, 10))
  const frame = await open(page)
  await frame.locator('.minefield-cell').first().click()
  await expect(frame.getByRole('progressbar', { name: 'Verifying a deduction-only board' })).toBeVisible()
  await captureExperience(page, info, 'generation-recovery', 'silent-worker-loading', 'clamped')
  await expect(frame.getByRole('button', { name: 'Retry verification', exact: true })).toBeVisible({ timeout: 13000 })
  await expect(frame.getByRole('progressbar', { name: 'Verifying a deduction-only board' })).toHaveCount(0)
  await captureExperience(page, info, 'generation-recovery', 'watchdog-error', 'clamped')
  await expectActionReady(frame.getByRole('button', { name: 'Retry verification', exact: true }))
  await frame.getByRole('button', { name: 'Retry verification', exact: true }).click()
  await expect(frame.locator('.minefield-cell.revealed').first()).toBeVisible({ timeout: 15000 })
  await captureExperience(page, info, 'generation-recovery', 'retry-genuine-play', 'clamped')
  await expect(frame.locator('html')).toHaveAttribute('data-stale-worker-sent', 'true', { timeout: 5000 })
  await expect(frame.locator('.minefield-cell')).toHaveCount(64)
  await expect(frame.locator('.minefield-cell.revealed').first()).toBeVisible()
  await captureExperience(page, info, 'generation-recovery', 'late-completion-ignored', 'clamped')
})


test('Classic explains a publicly provable safe misplaced flag and recovers the endgame', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  // Deterministic UI fixture: fixed valid zero-opening board with only the
  // pre-opening misplaced flag left safe. Production inference still sees DOM/public clues.
  const board = armMinefield(createMinefield(9, 9, 10), 40, [8, 17, 26, 35, 44, 53, 62, 71, 79, 80])
  await page.addInitScript((fixture) => {
    window.Worker = class {
      onmessage: ((event: MessageEvent) => void) | null = null
      onerror = null
      timer: ReturnType<typeof setTimeout> | undefined
      postMessage() { this.timer = setTimeout(() => this.onmessage?.({ data: { board: fixture } } as MessageEvent), 50) }
      terminate() { clearTimeout(this.timer) }
    } as unknown as typeof Worker
  }, board)
  const frame = await open(page, false)
  await expect.poll(() => overflowIssues(frame.locator('.minefield-app'))).toEqual([])
  await captureExperience(page, info, 'classic-play', 'beginner-ready')
  const mistaken = frame.locator('.minefield-cell[data-index="0"]')
  await expectActionReady(mistaken); await mistaken.click({ button: 'right' })
  await frame.locator('.minefield-cell[data-index="40"]').click()
  await expect(frame.locator('.minefield-cell.revealed')).toHaveCount(70)
  await expect(mistaken).toHaveClass(/flagged/)
  await expectActionReady(frame.getByRole('button', { name: 'Explain move', exact: true }))
  await frame.getByRole('button', { name: 'Explain move', exact: true }).click()
  const proof = frame.locator('.minefield-explanation')
  await expect(proof).toHaveAttribute('data-target-index', '0')
  await expect(proof).toContainText('Remove its flag before opening')
  await expect(proof).toContainText('safe')
  await expectActionReady(proof.getByRole('button', { name: 'Unflag and open', exact: true }))
  await captureExperience(page, info, 'classic-play', 'safe-flag-explained')
  await proof.getByRole('button', { name: 'Unflag and open', exact: true }).click()
  await expect(frame.locator('.minefield-status')).toContainText('Cleared')
  await expect(mistaken).toHaveClass(/revealed/)
  await captureExperience(page, info, 'classic-play', 'wrong-flag-corrected-win')
})


test('switching level cancels pending Elite verification and ignores its late result', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(stale => {
    window.Worker = class {
      onmessage: ((event: MessageEvent) => void) | null = null
      onerror = null
      postMessage() {
        this.onmessage?.({ data: { attempt: 12 } } as MessageEvent)
        setTimeout(() => { this.onmessage?.({ data: { board: stale } } as MessageEvent); document.documentElement.dataset.cancelledResultSent = 'true' }, 1500)
      }
      terminate() {} // Deliberately delivers a queued completion after cancellation.
    } as unknown as typeof Worker
  }, createMinefield(8, 8, 28, 2))
  const frame = await open(page)
  await frame.locator('.minefield-cell').first().click()
  await expect(frame.getByRole('progressbar', { name: 'Verifying a deduction-only board' })).toBeVisible()
  await captureExperience(page, info, 'generation-recovery', 'pending-before-level-change', 'clamped')
  await expectActionReady(frame.getByLabel('Level', { exact: true }))
  await frame.getByLabel('Level', { exact: true }).selectOption('beginner')
  await expect(frame.locator('html')).toHaveAttribute('data-cancelled-result-sent', 'true')
  await expect(frame.locator('.minefield-cell')).toHaveCount(81)
  await expect(frame.locator('.minefield-cell.revealed')).toHaveCount(0)
  await expect(frame.getByRole('progressbar', { name: 'Verifying a deduction-only board' })).toHaveCount(0)
  await captureExperience(page, info, 'generation-recovery', 'level-change-stale-result-rejected', 'clamped')
})
