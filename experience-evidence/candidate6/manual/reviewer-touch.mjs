import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const directory = dirname(fileURLToPath(import.meta.url)), base = 'http://localhost:3132'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 320, height: 640 }, hasTouch: true })
await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
const page = await context.newPage(), cdp = await context.newCDPSession(page), observations = []
const touchPoint = (x, y) => ({ x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 })
async function touch(type, points) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points }) }
async function capture(scenarioId, state, window = 'touch-pan') {
  const filename = `${scenarioId}-${state}`, path = join(directory, `${filename}.png`)
  await page.screenshot({ path, animations: 'disabled' })
  const identity = await (await page.request.get(`${base}/api/build-identity`)).json()
  assert.equal(identity.commit, '145ef28f571da314f9b4f3376b9318611a80eea8')
  assert.equal(identity.tree, '5ce1fa38c0a107c0b5173f436d5cfebac7abfafb')
  const metadata = { scenarioId, state, window, viewport: page.viewportSize(), capturedAt: new Date().toISOString(), url: page.url(), identity, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }
  writeFileSync(join(directory, `${filename}.json`), `${JSON.stringify(metadata, null, 2)}\n`)
}
async function open(title) {
  await page.goto(base)
  await page.locator('[data-window-id="system:welcome"]').getByRole('button', { name: 'Close', exact: true }).click()
  await page.locator('.start-button').click()
  await page.locator('.start-menu').getByRole('button', { name: new RegExp(title) }).click()
}
try {
  await open('Minefield')
  const mine = page.frameLocator('iframe[title="Minefield"]')
  for (const level of ['intermediate', 'expert']) {
    await mine.getByLabel('Level', { exact: true }).selectOption(level)
    await mine.locator('.minefield-board-scroll[data-panning="true"]').waitFor()
    const scroller = mine.locator('.minefield-board-scroll')
    await mine.locator('.minefield-cell').first().focus()
    const before = await scroller.evaluate(el => ({ left: el.scrollLeft, top: el.scrollTop, width: el.clientWidth, scrollWidth: el.scrollWidth }))
    const bounds = await scroller.boundingBox()
    await capture('mine-narrow', `touch-${level}-before`)
    const startX = bounds.x + bounds.width - 24, endX = bounds.x + 24, y = bounds.y + bounds.height * .48
    await touch('touchStart', [touchPoint(startX, y)])
    for (let n = 1; n <= 12; n++) {
      await touch('touchMove', [touchPoint(startX + (endX - startX) * n / 12, y)])
      await page.waitForTimeout(15)
    }
    await touch('touchEnd', [])
    await page.waitForTimeout(400)
    const after = await scroller.evaluate(el => ({ left: el.scrollLeft, top: el.scrollTop, width: el.clientWidth, scrollWidth: el.scrollWidth }))
    const marks = { flags: await mine.locator('.minefield-cell.flagged').count(), reveals: await mine.locator('.minefield-cell.revealed').count() }
    const host = await page.evaluate(() => [document.documentElement.scrollLeft, document.documentElement.scrollWidth - innerWidth])
    const app = await mine.locator('html').evaluate(el => [el.scrollLeft, el.scrollWidth - innerWidth])
    assert.ok(after.left > before.left + 20, 'Actual touch swipe must pan board horizontally')
    assert.deepEqual(marks, { flags: 0, reveals: 0 })
    assert.deepEqual(host, [0, 0]); assert.deepEqual(app, [0, 0])
    observations.push({ scenario: 'mine-narrow', level, gesture: 'CDP touchStart, 12 touchMove events, touchEnd', before, after, marks, host, app })
    await capture('mine-narrow', `touch-${level}-after`)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await open('Space Cadet Pinball')
  const game = page.frameLocator('iframe[title="Space Cadet Pinball"]').frameLocator('iframe[title="Space Cadet runtime"]')
  await game.locator('#new-game:not([disabled])').waitFor({ timeout: 30000 })
  await game.locator('#canvas').waitFor({ state: 'visible' })
  const pull = () => game.locator('canvas').evaluate(() => window.Module.cabinetState.plungerPull)
  for (const [name, duration, state] of [['Left flipper', 200, 'left'], ['Right flipper', 200, 'right'], ['Hold to launch', 1200, 'launch']]) {
    const button = game.getByRole('button', { name, exact: true }), bounds = await button.boundingBox()
    assert.equal(await button.isEnabled(), true)
    await touch('touchStart', [touchPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)])
    assert.equal(await button.getAttribute('data-held'), 'true')
    const heldAt = Date.now()
    let nativePull = null, firstPositivePull = null
    if (state === 'launch') {
      while ((nativePull = await pull()) <= 0 && Date.now() - heldAt < 3000) await page.waitForTimeout(25)
      assert.ok(nativePull > 0, 'First native-ready true touch must charge immediately without another input')
      firstPositivePull = { pull: nativePull, observedAfterMs: Date.now() - heldAt }
      while ((nativePull = await pull()) < 100 && Date.now() - heldAt < 10000) await page.waitForTimeout(50)
      assert.equal(nativePull, 100, 'Release scoring shot only after observed native maximum charge')
    } else await page.waitForTimeout(duration)
    await capture('pinball-narrow', `true-touch-${state}-held`, 'touch-clamped')
    await touch('touchEnd', [])
    assert.equal(await button.getAttribute('data-held'), 'false')
    await page.waitForTimeout(140)
    await capture('pinball-narrow', `true-touch-${state}-released`, 'touch-clamped')
    observations.push({ scenario: 'pinball-narrow', control: name, gesture: 'actual touchStart/touchEnd', held: true, released: true, elapsedThroughReleasedCaptureMs: Date.now() - heldAt, firstPositivePull, nativePullAtRelease: nativePull })
  }
  const started = Date.now()
  while (Number((await game.locator('#score').innerText()).replaceAll(',', '')) === 0 && Date.now() - started < 20000) await page.waitForTimeout(200)
  const score = Number((await game.locator('#score').innerText()).replaceAll(',', ''))
  assert.ok(score > 0, 'One true touch launch after native readiness must score without retry')
  observations.push({ scenario: 'pinball-narrow', score, ball: await game.locator('#ball').innerText(), relaunches: 0 })
  await capture('pinball-narrow', 'true-touch-live-score', 'touch-clamped')
  writeFileSync(join(directory, 'true-touch-observations.json'), `${JSON.stringify({ input: 'Chrome Input.dispatchTouchEvent in hasTouch browser context', observations }, null, 2)}\n`)
  console.log(JSON.stringify(observations))
} finally { await browser.close() }
