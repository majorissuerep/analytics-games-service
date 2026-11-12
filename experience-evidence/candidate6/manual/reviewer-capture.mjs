import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const directory = dirname(fileURLToPath(import.meta.url))
const base = 'http://localhost:3132'
const expectedCommit = '145ef28f571da314f9b4f3376b9318611a80eea8'
const expectedTree = '5ce1fa38c0a107c0b5173f436d5cfebac7abfafb'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
const page = await context.newPage()
const measurements = []

async function capture(scenarioId, state, window) {
  const filename = `${scenarioId}-${state}`
  const path = join(directory, `${filename}.png`)
  await page.screenshot({ path, animations: 'disabled' })
  const identity = await (await page.request.get(`${base}/api/build-identity`)).json()
  assert.equal(identity.commit, expectedCommit)
  assert.equal(identity.tree, expectedTree)
  const metadata = { scenarioId, state, window, viewport: page.viewportSize(), capturedAt: new Date().toISOString(), url: page.url(), identity, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }
  writeFileSync(join(directory, `${filename}.json`), `${JSON.stringify(metadata, null, 2)}\n`)
}
async function newDesktop() {
  await page.goto(base)
  await page.locator('[data-window-id="system:welcome"]').getByRole('button', { name: 'Close', exact: true }).click()
}
async function actionReady(control) {
  const result = await control.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const points = [[rect.x + rect.width / 2, rect.y + rect.height / 2], [rect.left + 4, rect.top + 4], [rect.right - 4, rect.bottom - 4]]
    let left = 0, top = 0, right = innerWidth, bottom = innerHeight
    for (let node = element.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node), bounds = node.getBoundingClientRect()
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, bounds.left + node.clientLeft); right = Math.min(right, bounds.left + node.clientLeft + node.clientWidth) }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, bounds.top + node.clientTop); bottom = Math.min(bottom, bounds.top + node.clientTop + node.clientHeight) }
    }
    return { label: element.textContent.trim(), rendered: rect.width > 0 && rect.height > 0, contained: rect.left >= left && rect.right <= right && rect.top >= top && rect.bottom <= bottom, hit: points.every(([x, y]) => element.contains(document.elementFromPoint(x, y))), enabled: !element.matches(':disabled,[aria-disabled="true"]') }
  })
  assert.ok(result.rendered && result.contained && result.hit && result.enabled, JSON.stringify(result))
  const box = await control.boundingBox()
  const parentHit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.matches('iframe[title="Chess"]'), { x: box.x + box.width / 2, y: box.y + box.height / 2 })
  assert.ok(parentHit, `Desktop must not occlude ${result.label}`)
  return result
}
try {
  await newDesktop()
  await page.locator('.desktop-icon[aria-label="Open Space Cadet Pinball"]').dblclick()
  const pinball = page.frameLocator('iframe[title="Space Cadet Pinball"]').frameLocator('iframe[title="Space Cadet runtime"]')
  await pinball.locator('#new-game:not([disabled])').waitFor({ timeout: 30000 })
  await pinball.locator('#canvas').waitFor({ state: 'visible' })
  assert.equal(await pinball.locator('#loader').isVisible(), false)
  await capture('visual-matrix', 'native-ready-requested', 'requested')
  await page.locator('[data-window-id="game:orbit-pinball"]').getByRole('button', { name: 'Maximize', exact: true }).click()
  await page.waitForTimeout(100)
  await capture('visual-matrix', 'native-ready-maximized', 'maximized')

  console.log(JSON.stringify({ captures: 2, states: ['native-ready-requested', 'native-ready-maximized'] }))
} finally { await browser.close() }
