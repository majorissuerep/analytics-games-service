import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('analytics-games.analytics-consent.v1', 'denied'))
})

test('retired Radar is absent from discovery, routes, leaderboards and room creation', async ({ page, request }) => {
  expect((await request.get('/games/consensus-radar')).status()).toBe(410)
  // The per-ID registration route is DELETE-only; no retired manifest is served.
  expect([404, 405]).toContain((await request.get('/api/platform/games/consensus-radar')).status())
  expect((await request.get('/api/games/consensus-radar/leaderboard')).status()).toBe(404)
  const create = await request.post('/api/rooms', { data: { gameId: 'consensus-radar', host: { id: 'retirement-qa', name: 'QA' } } })
  expect(create.status()).toBe(404)
  // This endpoint also exercises the deployment's lazy schema/retirement migration.
  const external = await request.get('/api/platform/games')
  expect(external.ok()).toBe(true)
  expect(JSON.stringify(await external.json())).not.toContain('consensus-radar')
  await page.goto('/')
  await expect(page.locator('.desktop-icon').filter({ hasText: /Radar/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'start', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Start menu' }).getByText(/Radar/)).toHaveCount(0)
})

test('Mafia has its own Coming soon icon and preview without starting a game or requesting media', async ({ page }) => {
  const actions: string[] = []
  page.on('request', request => { if (/\/api\/(rooms|mafia|.*token)|livekit/i.test(request.url())) actions.push(request.url()) })
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: () => { throw new Error('Coming soon must not request media') } })
  })
  await page.goto('/')
  const icon = page.getByRole('button', { name: 'Mafia Online — Coming soon', exact: true })
  await expect(icon.getByText('Coming soon', { exact: true })).toBeVisible()
  const iconSource = await icon.locator('img').getAttribute('src')
  expect(new URL(iconSource!, page.url()).pathname).toBe('/icons/mafia.svg')
  await expect(page.getByLabel('4 games installed')).toBeVisible()
  await icon.dblclick()
  const preview = page.locator('.desktop-window').filter({ has: page.getByRole('heading', { name: 'Mafia Online' }) })
  await expect(preview.getByText('Gameplay, rooms, and video are not available yet.', { exact: false })).toBeVisible()
  await expect(preview.locator('iframe')).toHaveCount(0)
  expect(actions).toEqual([])
  await preview.getByRole('button', { name: 'Back to desktop' }).click()
  await expect(preview).toHaveCount(0)
  await page.goto('/games/mafia')
  await expect(page.getByRole('heading', { name: 'Mafia Online' })).toBeVisible()
  await page.setViewportSize({ width: 320, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/mafia-coming-soon-phone.png', fullPage: true })
  await page.getByRole('link', { name: 'Back to desktop' }).click()
  await expect(page).toHaveURL('/')
})
