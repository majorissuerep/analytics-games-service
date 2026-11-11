import { expect, test, type FrameLocator, type Page } from '@playwright/test'
import { captureExperience, expectActionReady, overflowIssues } from './helpers/experience'

const cabinet = (page: Page) => page.frameLocator('iframe[title="Space Cadet Pinball"]:visible').frameLocator('iframe[title="Space Cadet runtime"]')
const score = async (game: FrameLocator) => Number((await game.locator('#score').innerText()).replaceAll(',', ''))
async function ready(page: Page) {
  await page.goto('/')
  if ((page.viewportSize()?.width ?? 1280) < 600) {
    await page.locator('.start-button').click()
    await page.locator('.start-menu').getByRole('button', { name: /Space Cadet Pinball/ }).click()
  } else await page.locator('.desktop-icon[aria-label="Open Space Cadet Pinball"]').dblclick()
  const game = cabinet(page)
  await expect(game.getByRole('button', { name: 'New game', exact: true })).toBeEnabled({ timeout: 30_000 })
  return game
}
async function launch(page: Page, game: FrameLocator) {
  await game.locator('canvas').focus()
  await page.keyboard.down('Space')
  await expect.poll(() => game.locator('canvas').evaluate(() => (window as unknown as { Module: { cabinetState: { plungerPull: number } } }).Module.cabinetState.plungerPull)).toBeGreaterThan(0)
  await page.waitForTimeout(1200)
  await page.keyboard.up('Space')
}
async function heldPointer(page: Page, control: ReturnType<FrameLocator['locator']>, duration: number) {
  await expectActionReady(control)
  const box = (await control.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(control).toHaveAttribute('data-held', 'true')
  await page.waitForTimeout(duration)
  await page.mouse.up()
  await expect(control).toHaveAttribute('data-held', 'false')
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
})

test('pinball-play: real native flight, flippers, physical pause, natural drain and next flight in requested XP window', async ({ page }, info) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1280, height: 844 })
  const game = await ready(page)
  const window = page.locator('.desktop-rnd-window').filter({ has: page.locator('iframe[title="Space Cadet Pinball"]') })
  await expect.poll(async () => { const b = (await window.boundingBox())!; return [Math.round(b.width), Math.round(b.height)] }).toEqual([920, 740])
  await expectActionReady(game.getByRole('button', { name: 'Pause', exact: true }))
  await expect(game.locator('input, select, details, nav')).toHaveCount(0)
  await expect(game.locator('#score')).toHaveText('0')
  await expect(game.locator('#ball')).toHaveText('1 / 3')
  await captureExperience(page, info, 'pinball-play', 'ready-original-art')
  const canvas = game.locator('canvas')
  const bounds = (await canvas.boundingBox())!
  const flippers = { x: bounds.x + bounds.width * .25, y: bounds.y + bounds.height * .76, width: bounds.width * .50, height: bounds.height * .14 }
  await canvas.focus()
  const resting = await page.screenshot({ clip: flippers })
  for (const key of ['ArrowLeft', 'ArrowRight']) {
    await page.keyboard.down(key)
    await page.waitForTimeout(140)
    expect((await page.screenshot({ clip: flippers })).equals(resting), `${key} must visibly move its flipper`).toBe(false)
    await captureExperience(page, info, 'pinball-play', `${key}-held`)
    await page.keyboard.up(key)
    await page.waitForTimeout(180)
  }
  for (const key of ['ArrowUp', 'ArrowDown']) await page.keyboard.press(key)
  expect(await game.locator('html').evaluate(e => [e.scrollTop, e.scrollLeft])).toEqual([0, 0])
  await launch(page, game)
  await page.waitForTimeout(600)
  await captureExperience(page, info, 'pinball-play', 'first-ball-upper-orbit')
  await game.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(game.locator('#pause-veil')).toBeVisible()
  await captureExperience(page, info, 'pinball-play', 'paused-in-flight')
  // Hide only the HTML veil for pixel comparison, so a static overlay cannot
  // conceal a still-moving native ball. The retained viewport keeps the veil.
  const nativeFrame = () => canvas.screenshot({ style: '#pause-veil { visibility: hidden !important }' })
  const frozen = await nativeFrame()
  await page.waitForTimeout(900)
  expect((await nativeFrame()).equals(frozen), 'Actual physical canvas must freeze while paused').toBe(true)
  await expectActionReady(game.locator('#pause'))
  await game.locator('#pause').focus()
  await page.keyboard.press('Enter')
  await expect(game.locator('body')).toHaveAttribute('data-paused', 'false')
  await expect(game.locator('#pause')).toHaveAttribute('aria-label', 'Pause')
  await page.waitForTimeout(450)
  expect((await nativeFrame()).equals(frozen), 'Actual physical canvas must move after Resume').toBe(false)
  await captureExperience(page, info, 'pinball-play', 'resumed-moving-ball')
  await expect.poll(() => score(game), { timeout: 20_000 }).toBeGreaterThan(0)
  await captureExperience(page, info, 'pinball-play', 'genuine-native-score')
  // Native early-drain protection can return the same ball to the shooter.
  // Observe the real state and use only genuine player inputs: no injected drain,
  // forced counter, timer change or assumed completion from an elapsed timeout.
  let previousScore = await score(game)
  let relaunches = 0
  for (let observation = 1; observation <= 8; observation++) {
    for (let second = 0; second < 10; second++) {
      if ((await game.locator('#ball').innerText()) !== '1 / 3') break
      await page.waitForTimeout(1000)
    }
    const ball = await game.locator('#ball').innerText()
    const currentScore = await score(game)
    await captureExperience(page, info, 'pinball-play', `drain-observation-${observation}-ball-${ball.replaceAll(/[^0-9]/g, '')}-score-${currentScore}`)
    if (ball === '2 / 3') break
    expect(ball, 'Real ball lifecycle must remain in the first or second ball').toBe('1 / 3')
    if (currentScore === previousScore && relaunches < 5) {
      // A saved/replayed ball needs another physical plunger pull. In-flight
      // Space is harmless; the engine alone decides whether a ball is launchable.
      await launch(page, game)
      await page.waitForTimeout(900)
      relaunches++
      await captureExperience(page, info, 'pinball-play', `real-space-relaunch-${relaunches}-observation-${observation}`)
    }
    previousScore = currentScore
  }
  await expect(game.locator('#ball')).toHaveText('2 / 3')
  await captureExperience(page, info, 'pinball-play', 'natural-drain-next-ball-counter')
  // Native feed animation takes several seconds after Ball changes.
  await page.waitForTimeout(6000)
  await captureExperience(page, info, 'pinball-play', 'next-ball-fed-at-plunger')
  await launch(page, game)
  await page.waitForTimeout(1200)
  await captureExperience(page, info, 'pinball-play', 'second-ball-real-flight')
  await expect(game.locator('#ball')).toHaveText('2 / 3')
  expect(await overflowIssues(game.locator('body'))).toEqual([])
})

test('pinball-narrow: visible score and ball, held pointer controls, live resize, pause and no page scrolling', async ({ page }, info) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 390, height: 844 })
  const game = await ready(page)
  for (const id of ['score', 'ball']) await expect(game.locator(`#${id}`)).toBeVisible()
  await captureExperience(page, info, 'pinball-narrow', 'ready-score-and-ball', 'clamped')
  await heldPointer(page, game.getByRole('button', { name: 'Left flipper', exact: true }), 180)
  await heldPointer(page, game.getByRole('button', { name: 'Right flipper', exact: true }), 180)
  const plunger = game.getByRole('button', { name: 'Hold to launch', exact: true })
  await expectActionReady(plunger)
  const box = (await plunger.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(plunger).toHaveAttribute('data-held', 'true')
  await captureExperience(page, info, 'pinball-narrow', 'touch-plunger-held', 'clamped')
  await page.waitForTimeout(1200)
  await page.mouse.up()
  await expect(plunger).toHaveAttribute('data-held', 'false')
  await expect.poll(() => score(game), { timeout: 20_000 }).toBeGreaterThan(0)
  await captureExperience(page, info, 'pinball-narrow', 'touch-flight-native-score', 'clamped')
  await page.setViewportSize({ width: 320, height: 640 })
  await expectActionReady(game.getByRole('button', { name: 'Right flipper', exact: true }))
  const b = (await game.locator('canvas').boundingBox())!
  expect(Math.abs(b.width / b.height - 365 / 470)).toBeLessThan(.005)
  await captureExperience(page, info, 'pinball-narrow', 'live-resize-320', 'clamped')
  await game.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(game.locator('#pause-veil')).toBeVisible()
  await captureExperience(page, info, 'pinball-narrow', 'paused-320', 'clamped')
  for (const key of ['ArrowUp', 'ArrowDown']) await page.keyboard.press(key)
  expect(await game.locator('html').evaluate(e => [e.scrollTop, e.scrollLeft, e.scrollHeight - innerHeight, e.scrollWidth - innerWidth])).toEqual([0, 0, 0, 0])
  expect(await overflowIssues(game.locator('body'))).toEqual([])
})

test('pinball-play: a failed real WASM download exposes Retry and returns to a playable cabinet', async ({ page }, info) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1280, height: 844 })
  await page.route('**/SpaceCadetPinball.wasm', route => route.abort())
  await page.goto('/games/orbit-pinball')
  const game = cabinet(page)
  await expect(game.getByRole('button', { name: 'Retry Pinball' })).toBeVisible({ timeout: 20_000 })
  await expect(game.getByRole('button', { name: 'New game', exact: true })).toBeDisabled()
  await expectActionReady(game.getByRole('button', { name: 'Retry Pinball' }))
  await captureExperience(page, info, 'pinball-play', 'real-asset-failure-retry')
  await page.unroute('**/SpaceCadetPinball.wasm')
  await game.getByRole('button', { name: 'Retry Pinball' }).click()
  await expect(game.getByRole('button', { name: 'New game', exact: true })).toBeEnabled({ timeout: 30_000 })
  await launch(page, game)
  await expect.poll(() => score(game), { timeout: 20_000 }).toBeGreaterThan(0)
  await captureExperience(page, info, 'pinball-play', 'retry-recovered-real-flight')
})
