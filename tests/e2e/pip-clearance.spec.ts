import { expect, test } from '@playwright/test'
import { expectActionReady } from './helpers/experience'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
})

test('Pip yields the game workspace while taskbar chat remains available', async ({ page }, info) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  const guide = page.getByLabel('Pip desktop guide')
  const launcher = page.getByRole('button', { name: 'Talk to Pip', exact: true })
  await expect(guide.getByRole('button', { name: 'Surprise me' })).toBeVisible()
  await expectActionReady(launcher)
  await page.locator('.desktop-icon[aria-label="Open Chess"]').dblclick()
  const frame = page.frameLocator('iframe[title="Chess"]')
  const window = page.locator('[data-window-id="game:chess"]')
  await expect(page.locator('iframe[title="Chess"]')).toHaveAttribute('aria-busy', 'false', { timeout: 20000 })
  await frame.getByRole('button', { name: /^Local/ }).click()
  await frame.getByRole('button', { name: 'Start pass-and-play' }).click()
  for (const state of ['requested', 'maximized', 'phone', 'small-phone'] as const) {
    if (state === 'maximized') await window.getByRole('button', { name: 'Maximize', exact: true }).click()
    if (state === 'phone') await page.setViewportSize({ width: 390, height: 844 })
    if (state === 'small-phone') await page.setViewportSize({ width: 320, height: 640 })
    await expect(guide.getByRole('button', { name: 'Talk to me' })).toBeHidden()
    await expectActionReady(frame.getByRole('button', { name: 'Leave game', exact: true }))
    await expectActionReady(frame.getByRole('button', { name: 'New game', exact: true }))
    await expectActionReady(launcher)
    await info.attach(`pip-clearance-${state}`, { body: await page.screenshot(), contentType: 'image/png' })
    await launcher.click()
    const chat = page.getByRole('dialog', { name: 'Talk to Pip' })
    await expect(chat).toBeVisible()
    await expect(chat.getByRole('textbox')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(chat).toBeHidden()
    await expect(launcher).toBeFocused()
    await expectActionReady(frame.getByRole('button', { name: 'Leave game', exact: true }))
  }
  // A minimized game no longer owns the workspace; desktop tips return.
  await page.setViewportSize({ width: 1280, height: 800 })
  await window.getByRole('button', { name: 'Minimize', exact: true }).click()
  await expect(guide.getByRole('button', { name: 'Surprise me' })).toBeVisible()
})
