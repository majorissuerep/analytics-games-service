/* eslint-disable security/detect-non-literal-fs-filename -- tests operate only inside a fresh temporary directory */
import assert from 'node:assert/strict'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { contentRoot, loadAndValidateContent } from './content-lib.mjs'

test('the checked-in content graph is valid', async () => {
  const content = await loadAndValidateContent()
  assert.equal(content.bodies.size, 2)
  assert.equal(content.systems.size, 1)
  assert.equal(content.evaluations.size, 1)
})

test('a missing body invalidates its system and evaluation', async t => {
  const sandbox = await mkdtemp(join(tmpdir(), 'cosmic-forge-content-'))
  t.after(() => rm(sandbox, { recursive: true, force: true }))
  await cp(contentRoot, sandbox, { recursive: true })

  const systemPath = join(sandbox, 'systems', 'first-light', 'system.json')
  const system = JSON.parse(await readFile(systemPath, 'utf8'))
  system.bodyIds[1] = 'missing-planet'
  await writeFile(systemPath, `${JSON.stringify(system, null, 2)}\n`)

  await assert.rejects(
    loadAndValidateContent(sandbox),
    /unknown body missing-planet/,
  )
})
