import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
import { cacheRoot, gameRoot, repoRoot } from './content-lib.mjs'

async function freePort() {
  const probe = createServer()
  await new Promise((resolve, reject) => {
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', resolve)
  })
  const address = probe.address()
  const port = typeof address === 'object' && address ? address.port : null
  await new Promise(resolve => probe.close(resolve))
  if (!port) throw new Error('Could not reserve a verification port')
  return port
}

async function waitForServer(url, process) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (process.exitCode !== null) throw new Error(`Development server exited with ${process.exitCode}`)
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // The server may still be assembling the runtime.
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Development server did not become ready')
}

const port = await freePort()
const origin = `http://127.0.0.1:${port}`
const serverOutput = []
const developmentServer = spawn(process.execPath, [join(gameRoot, 'tools/serve.mjs')], {
  cwd: repoRoot,
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
})
developmentServer.stdout.on('data', chunk => serverOutput.push(chunk.toString()))
developmentServer.stderr.on('data', chunk => serverOutput.push(chunk.toString()))

let browser
try {
  await waitForServer(origin, developmentServer)
  browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  })
  const page = await browser.newPage()
  const consoleMessages = []
  const pageErrors = []
  const failedRequests = []
  const requestedUrls = []
  page.on('console', message => consoleMessages.push(`${message.type()}: ${message.text()}`))
  page.on('pageerror', error => pageErrors.push(error.stack ?? String(error)))
  page.on('request', request => requestedUrls.push(request.url()))
  page.on('requestfailed', request => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`))

  await page.goto(`${origin}/?evaluation=cinder-material-lab`, { waitUntil: 'domcontentloaded' })
  await page.locator('#canvas.ready').waitFor({ state: 'visible', timeout: 60_000 })
  await page.waitForFunction(() => Boolean(window.powderDev?.module?.FS), null, { timeout: 60_000 })
  await page.locator('#canvas').click()
  await page.keyboard.press('F1')
  await page.waitForTimeout(1_000)

  const result = await page.evaluate(() => {
    const canvas = document.querySelector('#canvas')
    const sceneBytes = window.powderDev.module.FS.readFile('/workspace/autorun.lua')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    return {
      crossOriginIsolated: window.crossOriginIsolated,
      evaluationId: window.powderDev.evaluation.id,
      sceneBytes: sceneBytes.length,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      renderer: gl ? 'webgl' : 'unknown',
    }
  })

  const screenshot = join(cacheRoot, 'cinder-material-lab-canvas.png')
  await page.locator('#canvas').screenshot({ path: screenshot })
  const { data: pixels, info } = await sharp(screenshot).raw().toBuffer({ resolveWithObject: true })
  const region = {
    left: Math.floor(info.width / 2) - 100,
    right: Math.floor(info.width / 2) + 100,
    top: 80,
    bottom: 290,
  }
  const layers = { brightCore: 0, grayMantle: 0, blueAtmosphere: 0 }
  for (let y = region.top; y < region.bottom; y += 1) {
    for (let x = region.left; x < region.right; x += 1) {
      const offset = (y * info.width + x) * info.channels
      const red = pixels[offset]
      const green = pixels[offset + 1]
      const blue = pixels[offset + 2]
      if (red > 190 && green > 175 && blue > 150) layers.brightCore += 1
      if (red > 80 && Math.abs(red - green) < 25 && Math.abs(green - blue) < 25) layers.grayMantle += 1
      if (blue > 80 && blue > red * 1.2 && blue > green * 1.1) layers.blueAtmosphere += 1
    }
  }

  if (!result.crossOriginIsolated) throw new Error('Page is not cross-origin isolated')
  if (result.evaluationId !== 'cinder-material-lab') throw new Error('Wrong evaluation loaded')
  if (result.sceneBytes < 100) throw new Error('Scene was not mounted into Emscripten FS')
  if (!consoleMessages.some(message => message.includes('Cosmic Forge: loaded Cinder material lab'))) throw new Error('Evaluation scene did not finish')
  if (layers.brightCore < 500 || layers.grayMantle < 2_000 || layers.blueAtmosphere < 100) {
    throw new Error(`Expected planet layers are missing: ${JSON.stringify(layers)}`)
  }
  const remoteRequests = requestedUrls.filter(url => !url.startsWith(origin))
  if (remoteRequests.length) throw new Error(`Unexpected remote requests:\n${remoteRequests.join('\n')}`)
  if (failedRequests.length) throw new Error(`Failed requests:\n${failedRequests.join('\n')}`)
  if (pageErrors.length) throw new Error(`Page errors:\n${pageErrors.join('\n')}`)

  console.log(JSON.stringify({ ...result, layers, screenshot }, null, 2))
} catch (error) {
  console.error(serverOutput.join(''))
  throw error
} finally {
  await browser?.close()
  developmentServer.kill('SIGTERM')
}
