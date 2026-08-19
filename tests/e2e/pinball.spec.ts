import { expect, test } from '@playwright/test'

test('Neon Forge launches, scores, flips, saves, and tilts without runtime errors', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/games/orbit-pinball')
  const canvas = page.getByLabel('Neon Forge pinball playfield')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveJSProperty('width', 420)
  await expect(canvas).toHaveJSProperty('height', 720)
  await expect(page.getByRole('button', { name: 'Enable pinball sounds' })).toHaveText('SOUND OFF')

  await page.getByRole('button', { name: 'START GAME' }).click()
  await expect(page.getByRole('button', { name: 'HOLD LAUNCH' })).toBeEnabled()

  await page.keyboard.down('Space')
  await page.waitForTimeout(700)
  await page.keyboard.up('Space')
  await expect(page.getByText('BALL SAVE LIT')).toBeVisible()

  await page.keyboard.down('ArrowLeft')
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(150)
  await page.keyboard.up('ArrowLeft')
  await page.keyboard.up('ArrowRight')

  await expect.poll(async () => {
    const score = await page.locator('.forge-dmd > div').first().locator('strong').textContent()
    return Number(score?.replaceAll(',', ''))
  }, { timeout: 8_000 }).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'NUDGE' }).click()
  await page.getByRole('button', { name: 'NUDGE' }).click()
  await page.getByRole('button', { name: 'NUDGE' }).click()
  await expect(page.getByText('TILT · FLIPPERS DISABLED')).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('Neon Forge remains playable when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('blocked', 'SecurityError') }
    Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError') }
  })
  await page.goto('/games/orbit-pinball')
  await expect(page.getByLabel('Neon Forge pinball playfield')).toBeVisible()
  await page.getByRole('button', { name: 'START GAME' }).click()
  await expect(page.getByRole('button', { name: 'HOLD LAUNCH' })).toBeEnabled()
})

test('focused controls retain native Space-key activation', async ({ page }) => {
  await page.goto('/games/orbit-pinball')

  const start = page.getByRole('button', { name: 'START GAME' })
  await start.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'HOLD LAUNCH' })).toBeEnabled()

  const sound = page.getByRole('button', { name: 'Enable pinball sounds' })
  await sound.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Mute pinball sounds' })).toBeVisible()

  const launch = page.getByRole('button', { name: 'HOLD LAUNCH' })
  await launch.focus()
  await page.keyboard.down('Space')
  await page.waitForTimeout(200)
  await page.keyboard.up('Space')
  await expect(launch).toBeDisabled()
})

test('compact desktop shell keeps the full table and controls readable', async ({ page }) => {
  await page.setViewportSize({ width: 560, height: 780 })
  await page.goto('/games/orbit-pinball')
  await page.getByRole('button', { name: 'START GAME' }).click()
  await expect(page.getByRole('button', { name: 'HOLD LAUNCH' })).toBeEnabled()

  const layout = await page.evaluate(() => {
    const machine = document.querySelector('.forge-machine')?.getBoundingClientRect()
    const canvas = document.querySelector('.forge-canvas-wrap canvas')?.getBoundingClientRect()
    const controls = document.querySelector('.forge-controls')?.getBoundingClientRect()
    const statuses = [...document.querySelectorAll('.forge-status-strip span')]
      .map((element) => element.getBoundingClientRect())
    return {
      machineBottom: machine?.bottom ?? Infinity,
      canvasWidth: canvas?.width ?? 0,
      controlsBottom: controls?.bottom ?? Infinity,
      statuses: statuses.map(({ left, right, top, bottom }) => ({ left, right, top, bottom })),
      viewportHeight: window.innerHeight,
    }
  })

  expect(layout.machineBottom).toBeLessThanOrEqual(layout.viewportHeight)
  expect(layout.controlsBottom).toBeLessThanOrEqual(layout.viewportHeight)
  expect(layout.canvasWidth).toBeGreaterThanOrEqual(300)
  expect(layout.statuses).toHaveLength(4)
  for (let left = 0; left < layout.statuses.length; left += 1) {
    for (let right = left + 1; right < layout.statuses.length; right += 1) {
      const a = layout.statuses[left]
      const b = layout.statuses[right]
      const overlaps = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
      expect(overlaps).toBe(false)
    }
  }
})

test('landscape cabinet stays large and contained at common desktop sizes', async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 700 }, { width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/games/orbit-pinball')
    await expect(page.getByLabel('Current pinball objectives')).toBeVisible()

    const layout = await page.evaluate(() => {
      const machine = document.querySelector('.forge-machine')?.getBoundingClientRect()
      const canvas = document.querySelector('.forge-canvas-wrap canvas')?.getBoundingClientRect()
      const controls = document.querySelector('.forge-controls')?.getBoundingClientRect()
      const briefing = document.querySelector('.forge-briefing')
      const status = document.querySelector('.forge-status-strip')
      const directive = document.querySelector('.forge-briefing > small')
      const objective = document.querySelector('.forge-briefing > strong')
      const mission = document.querySelector('.forge-briefing li span')
      const instruction = document.querySelector('.forge-briefing p')
      const progressLabel = document.querySelector('.forge-progress-grid i')
      const progressCell = progressLabel?.parentElement
      const parseRgb = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number)
      const labelRgb = progressLabel ? parseRgb(getComputedStyle(progressLabel).color).slice(0, 3) : []
      const cellRgba = progressCell ? parseRgb(getComputedStyle(progressCell).backgroundColor) : []
      const baseRgb = [5, 13, 23]
      const alpha = cellRgba[3] ?? 1
      const effectiveBackground = baseRgb.map((channel, index) => alpha * (cellRgba[index] ?? channel) + (1 - alpha) * channel)
      const luminance = (rgb: number[]) => {
        const [red, green, blue] = rgb.map((channel) => {
          const normalized = channel / 255
          return normalized <= .04045 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4
        })
        return .2126 * red + .7152 * green + .0722 * blue
      }
      const labelLuminance = luminance(labelRgb)
      const backgroundLuminance = luminance(effectiveBackground)
      return {
        machineLeft: machine?.left ?? -Infinity,
        machineRight: machine?.right ?? Infinity,
        machineBottom: machine?.bottom ?? Infinity,
        canvasWidth: canvas?.width ?? 0,
        controlsBottom: controls?.bottom ?? Infinity,
        briefingFits: briefing ? briefing.scrollHeight <= briefing.clientHeight : false,
        statusFontSize: status ? getComputedStyle(status).fontSize : '',
        directiveFontSize: directive ? getComputedStyle(directive).fontSize : '',
        directiveColor: directive ? getComputedStyle(directive).color : '',
        objectiveFontSize: objective ? getComputedStyle(objective).fontSize : '',
        missionFontSize: mission ? getComputedStyle(mission).fontSize : '',
        instructionColor: instruction ? getComputedStyle(instruction).color : '',
        progressLabelColor: progressLabel ? getComputedStyle(progressLabel).color : '',
        progressLabelContrast: (Math.max(labelLuminance, backgroundLuminance) + .05) / (Math.min(labelLuminance, backgroundLuminance) + .05),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }
    })

    expect(layout.machineLeft).toBeGreaterThanOrEqual(0)
    expect(layout.machineRight).toBeLessThanOrEqual(layout.viewportWidth)
    expect(layout.machineBottom).toBeLessThanOrEqual(layout.viewportHeight)
    expect(layout.controlsBottom).toBeLessThanOrEqual(layout.viewportHeight)
    expect(layout.canvasWidth).toBeGreaterThanOrEqual(350)
    expect(layout.briefingFits).toBe(true)
    expect(layout.statusFontSize).toBe('8px')
    expect(layout.directiveFontSize).toBe('8px')
    expect(layout.directiveColor).toBe('rgb(105, 139, 164)')
    expect(layout.objectiveFontSize).toBe('12px')
    expect(layout.missionFontSize).toBe('9px')
    expect(layout.instructionColor).toBe('rgb(105, 139, 164)')
    expect(layout.progressLabelColor).toBe('rgb(120, 149, 171)')
    expect(layout.progressLabelContrast).toBeGreaterThanOrEqual(4.5)
  }
})

test('responsive boundaries do not collapse the playfield', async ({ page }) => {
  const widths: Record<string, number> = {}
  await page.goto('/games/orbit-pinball')
  for (const viewport of [
    { width: 520, height: 800 },
    { width: 521, height: 800 },
    { width: 520, height: 900 },
    { width: 521, height: 900 },
    { width: 599, height: 900 },
    { width: 600, height: 900 },
    { width: 800, height: 600 },
    { width: 800, height: 601 },
    { width: 1024, height: 768 },
    { width: 1024, height: 769 },
  ]) {
    await page.setViewportSize(viewport)
    await page.evaluate(async () => {
      await document.fonts.ready
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
    widths[`${viewport.width}x${viewport.height}`] = await page.locator('.forge-canvas-wrap canvas').evaluate((canvas) => canvas.getBoundingClientRect().width)
  }

  for (const width of Object.values(widths)) expect(width).toBeGreaterThanOrEqual(290)
  expect(Math.abs(widths['520x800'] - widths['521x800'])).toBeLessThanOrEqual(4)
  expect(Math.abs(widths['520x900'] - widths['521x900'])).toBeLessThanOrEqual(4)
  expect(Math.abs(widths['599x900'] - widths['600x900'])).toBeLessThanOrEqual(20)
  expect(Math.abs(widths['800x600'] - widths['800x601'])).toBeLessThanOrEqual(3)
  expect(Math.abs(widths['1024x768'] - widths['1024x769'])).toBeLessThanOrEqual(3)
})

test('short desktop cabinet contains the playfield and controls', async ({ page }) => {
  await page.setViewportSize({ width: 599, height: 480 })
  await page.goto('/games/orbit-pinball')
  const narrowCanvasWidth = await page.locator('.forge-canvas-wrap canvas').evaluate((canvas) => canvas.getBoundingClientRect().width)

  await page.setViewportSize({ width: 600, height: 480 })
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })

  const layout = await page.evaluate(() => {
    const machine = document.querySelector('.forge-machine')?.getBoundingClientRect()
    const canvas = document.querySelector('.forge-canvas-wrap canvas')?.getBoundingClientRect()
    const controls = document.querySelector('.forge-controls')?.getBoundingClientRect()
    const briefing = document.querySelector<HTMLElement>('.forge-briefing')
    if (briefing) briefing.scrollTop = briefing.scrollHeight
    const briefingBounds = briefing?.getBoundingClientRect()
    const instructionBounds = document.querySelector('.forge-briefing p')?.getBoundingClientRect()
    return {
      canvasBottom: canvas?.bottom ?? Infinity,
      canvasWidth: canvas?.width ?? 0,
      controlsBottom: controls?.bottom ?? Infinity,
      briefingScrollable: briefing ? getComputedStyle(briefing).overflowY === 'auto' && briefing.scrollHeight > briefing.clientHeight : false,
      instructionVisibleAfterScroll: Boolean(
        briefingBounds && instructionBounds
        && instructionBounds.top >= briefingBounds.top
        && instructionBounds.bottom <= briefingBounds.bottom + 1,
      ),
      machineBottom: machine?.bottom ?? -Infinity,
      viewportHeight: window.innerHeight,
    }
  })

  expect(layout.canvasWidth).toBeGreaterThanOrEqual(180)
  expect(Math.abs(narrowCanvasWidth - layout.canvasWidth)).toBeLessThanOrEqual(90)
  expect(layout.canvasBottom).toBeLessThanOrEqual(layout.machineBottom)
  expect(layout.controlsBottom).toBeLessThanOrEqual(layout.machineBottom)
  expect(layout.machineBottom).toBeLessThanOrEqual(layout.viewportHeight)
  expect(layout.briefingScrollable).toBe(true)
  expect(layout.instructionVisibleAfterScroll).toBe(true)
})
