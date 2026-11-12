import { assertDeployedIdentity } from './deployed-identity.mjs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const directory = dirname(fileURLToPath(import.meta.url)), base = 'https://analytics-games-service.vercel.app'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const context = await browser.newContext({proxy:{server:process.env.HTTPS_PROXY||process.env.HTTP_PROXY}, viewport: { width: 1280, height: 800 } })
await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
const page = await context.newPage(), observations = []
async function capture(state, window) {
  const scenarioId = 'visual-matrix', filename = `${scenarioId}-${state}`, path = join(directory, `${filename}.png`)
  await page.screenshot({ path, animations: 'disabled' })
  const identity = await (await page.request.get(`${base}/api/build-identity`)).json()
  assertDeployedIdentity(identity)
  const record = { scenarioId, state, window, viewport: page.viewportSize(), capturedAt: new Date().toISOString(), url: page.url(), identity, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }
  writeFileSync(join(directory, `${filename}.json`), JSON.stringify(record, null, 2) + String.fromCharCode(10))
}
try {
  await page.goto(base)
  await page.locator('[data-window-id="system:welcome"]').waitFor()
  await capture('welcome-task-first', 'requested')
  const privacy = page.getByRole('button', { name: 'Privacy', exact: true })
  assert.equal(await privacy.count(), 0, 'Production analytics-disabled configuration must omit Privacy entry')
  observations.push({ configuration: 'Production analytics disabled; Privacy UI intentionally absent. Enabled-state focus proof is retained in candidate6.', privacyControls: 0 })
  writeFileSync(join(directory, 'privacy-observations.json'), JSON.stringify(observations, null, 2) + String.fromCharCode(10))
  console.log(JSON.stringify(observations))
} finally { await browser.close() }
