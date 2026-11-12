import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const directory = dirname(fileURLToPath(import.meta.url)), base = 'http://localhost:3132'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
const page = await context.newPage(), observations = []
async function capture(state, window) {
  const scenarioId = 'visual-matrix', filename = `${scenarioId}-${state}`, path = join(directory, `${filename}.png`)
  await page.screenshot({ path, animations: 'disabled' })
  const identity = await (await page.request.get(`${base}/api/build-identity`)).json()
  assert.equal(identity.commit, '145ef28f571da314f9b4f3376b9318611a80eea8')
  assert.equal(identity.tree, '5ce1fa38c0a107c0b5173f436d5cfebac7abfafb')
  const record = { scenarioId, state, window, viewport: page.viewportSize(), capturedAt: new Date().toISOString(), url: page.url(), identity, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }
  writeFileSync(join(directory, `${filename}.json`), JSON.stringify(record, null, 2) + String.fromCharCode(10))
}
try {
  await page.goto(base)
  await page.locator('[data-window-id="system:welcome"]').waitFor()
  await capture('welcome-task-first', 'requested')
  const privacy = page.getByRole('button', { name: 'Privacy', exact: true })
  const dialog = page.getByRole('dialog', { name: 'Analytics privacy settings' })
  await privacy.focus()
  for (let index = 0; index < 3; index++) {
    await page.keyboard.press('Enter')
    await dialog.waitFor({ state: 'visible' })
    const closeFocused = await dialog.getByRole('button', { name: 'Close privacy settings' }).evaluate(element => element === document.activeElement)
    assert.ok(closeFocused, 'Committed dialog must focus Close after actual keyboard open')
    if (!index) await capture('manual-privacy-keyboard-open', 'privacy')
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    const returned = await privacy.evaluate(element => element === document.activeElement)
    assert.ok(returned, 'Escape must restore focus to the actual taskbar opener')
    if (!index) await capture('manual-privacy-returned-focus', 'privacy')
    observations.push({ iteration: index + 1, keys: 'Enter then Escape', closeFocused, returned })
  }
  writeFileSync(join(directory, 'privacy-observations.json'), JSON.stringify(observations, null, 2) + String.fromCharCode(10))
  console.log(JSON.stringify(observations))
} finally { await browser.close() }
