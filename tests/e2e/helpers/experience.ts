import { expect, type Locator, type Page, type TestInfo, type Frame } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

/** Measure rendered affordances before any Playwright action can auto-scroll. */
export async function actionIssues(control: Locator): Promise<string[]> {
  const issues = await control.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const defects: string[] = []
    let left = 0, top = 0, right = innerWidth, bottom = innerHeight
    for (let node = element.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node), bounds = node.getBoundingClientRect()
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
        left = Math.max(left, bounds.left + node.clientLeft)
        right = Math.min(right, bounds.left + node.clientLeft + node.clientWidth)
      }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
        top = Math.max(top, bounds.top + node.clientTop)
        bottom = Math.min(bottom, bounds.top + node.clientTop + node.clientHeight)
      }
    }
    if (!rect.width || !rect.height || rect.left < left - .5 || rect.right > right + .5 || rect.top < top - .5 || rect.bottom > bottom + .5) defects.push('clipped or outside the viewport')
    const insetX = Math.min(5, rect.width / 4), insetY = Math.min(5, rect.height / 4)
    const points = [[rect.x + rect.width / 2, rect.y + rect.height / 2], [rect.left + insetX, rect.top + insetY], [rect.right - insetX, rect.bottom - insetY]]
    if (points.some(([x, y]) => { const hit = document.elementFromPoint(x, y); return !hit || !element.contains(hit) })) defects.push('covered or not pointer reachable')
    if (element.matches(':disabled,[aria-disabled="true"]')) defects.push('disabled')
    return defects
  })
  const box = await control.boundingBox()
  const handle = await control.elementHandle()
  const owner = await handle?.ownerFrame()
  if (!box || !owner) return [...issues, 'not rendered']
  let frame: Frame = owner
  const points = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }, { x: box.x + 4, y: box.y + 4 }, { x: box.x + box.width - 4, y: box.y + box.height - 4 }]
  // Repeat hit-testing through each embedding document, including the desktop's
  // stacking order and the native cabinet's nested iframe.
  while (frame.parentFrame()) {
    const parent: Frame = frame.parentFrame()!
    let origin = { x: 0, y: 0 }
    if (parent.parentFrame()) {
      const parentElement = await parent.frameElement(), bounds = await parentElement.boundingBox()
      const border = await parentElement.evaluate(element => ({ x: (element as HTMLElement).clientLeft, y: (element as HTMLElement).clientTop }))
      if (bounds) origin = { x: bounds.x + border.x, y: bounds.y + border.y }
    }
    const frameElement = await frame.frameElement()
    const covered = await frameElement.evaluate((element, localPoints) => localPoints.some(({ x, y }) => {
      const hit = document.elementFromPoint(x, y)
      return !hit || !element.contains(hit)
    }), points.map(point => ({ x: point.x - origin.x, y: point.y - origin.y })))
    if (covered) issues.push('covered by an embedding window or overlay')
    frame = parent
  }
  return [...new Set(issues)]
}

export async function expectActionReady(control: Locator) {
  await expect(control).toBeVisible()
  await expect.poll(() => actionIssues(control), { message: 'Required action must be reachable before any auto-scroll' }).toEqual([])
}

/** Native overflow is permitted only in a named, intentionally scrolling pane. */
export async function overflowIssues(root: Locator, { document = true, allow = [] as string[] } = {}) {
  return root.evaluate((element, options) => {
    const failures: string[] = []
    const doc = element.ownerDocument.documentElement
    if (options.document && doc.scrollWidth > doc.clientWidth) failures.push(`document horizontal overflow ${doc.scrollWidth - doc.clientWidth}px`)
    if (options.document && doc.scrollHeight > doc.clientHeight) failures.push(`document vertical overflow ${doc.scrollHeight - doc.clientHeight}px`)
    for (const node of [element, ...element.querySelectorAll<HTMLElement>('*')]) {
      if (!(node instanceof HTMLElement) || !node.getClientRects().length) continue
      const style = getComputedStyle(node)
      const x = /(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth
      const y = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight
      if (!(x || y)) continue
      const owner = node.dataset.scrollOwner
      if (!owner || !options.allow.includes(owner)) failures.push(`${node.className || node.tagName} has undeclared ${x ? 'horizontal' : 'vertical'} overflow`)
    }
    return failures
  }, { document, allow })
}

export async function expectFocusedWindow(page: Page, windowId: string) {
  await expect(page.locator(`[data-window-id="${windowId}"]`)).toHaveAttribute('data-focused', 'true')
}

export async function captureExperience(page: Page, info: TestInfo, scenarioId: string, state: string, windowState = 'requested') {
  const filename = `${scenarioId}-${state.replaceAll(/[^a-z0-9-]/gi, '-')}`
  const path = info.outputPath(`${filename}.png`)
  await page.screenshot({ path, animations: 'disabled' })
  // Path is allocated by Playwright inside this test output directory.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const bytes = readFileSync(path)
  const response = await page.request.get('/api/build-identity')
  const identity = response.ok() ? await response.json() : null
  const record = { scenarioId, state, window: windowState, viewport: page.viewportSize(), capturedAt: new Date().toISOString(), url: page.url(), identity, sha256: createHash('sha256').update(bytes).digest('hex') }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Playwright-owned artifact path.
  writeFileSync(info.outputPath(`${filename}.json`), `${JSON.stringify(record, null, 2)}\n`)
  await info.attach(filename, { path, contentType: 'image/png' })
  return record
}
