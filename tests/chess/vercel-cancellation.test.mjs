import { readFileSync, readdirSync } from 'node:fs'
import { minimatch } from 'minimatch'
import { expect, it } from 'vitest'

it('enables Vercel disconnect cancellation only for the two chess inference routes', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
  const handlers = readdirSync('app/api', { recursive: true }).filter(path => path.endsWith('/route.ts')).map(path => `app/api/${path}`)
  const rules = Object.entries(config.functions ?? {}).filter(([, value]) => value.supportsCancellation === true)
  for (const [pattern] of rules) expect(handlers.some(path => minimatch(path, pattern)), `${pattern} must match an actual function source`).toBe(true)
  const enabled = handlers.filter(path => rules.some(([pattern]) => minimatch(path, pattern)))
  expect(enabled.sort()).toEqual(['app/api/chess-models/[revisionId]/move/route.ts', 'app/api/chess/analyse/route.ts'])
})
