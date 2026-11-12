import { expect, test } from '@playwright/test'
import { captureExperience } from './helpers/experience'

for (const path of ['/', '/develop']) {
  test(`Privacy commits keyboard focus on open and dismissal at ${path}`, async ({ page, context }, info) => {
    await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
    const session = await context.newCDPSession(page)
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.goto(path)
    const privacy = page.getByRole('button', { name: 'Privacy', exact: true })
    const dialog = page.getByRole('dialog', { name: 'Analytics privacy settings' })
    for (let iteration = 0; iteration < 8; iteration++) {
      await privacy.click()
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Close privacy settings' })).toBeFocused()
      if (iteration === 0) await captureExperience(page, info, 'visual-matrix', `privacy-${path === '/' ? 'desktop' : 'document'}-open`, 'privacy')
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(privacy).toBeFocused()
      if (iteration === 0) await captureExperience(page, info, 'visual-matrix', `privacy-${path === '/' ? 'desktop' : 'document'}-returned-focus`, 'privacy')
    }
    expect(await page.evaluate(() => localStorage.getItem('analytics-games.analytics-consent.v1'))).toBe('denied')
  })
}
