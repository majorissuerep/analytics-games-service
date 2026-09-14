/* eslint-disable security/detect-non-literal-fs-filename -- lock and checkout paths are fixed under this repository */
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { cacheRoot, gameRoot, upstreamRoot } from './content-lib.mjs'

const lock = JSON.parse(await readFile(join(gameRoot, 'upstream.lock.json'), 'utf8'))
await mkdir(cacheRoot, { recursive: true })

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

let cloned = true
try {
  await stat(join(upstreamRoot, '.git'))
} catch {
  cloned = false
}

if (!cloned) {
  run('git', ['clone', '--filter=blob:none', '--no-checkout', lock.repository, upstreamRoot])
}
run('git', ['-C', upstreamRoot, 'fetch', '--depth=1', 'origin', lock.commit])
run('git', ['-C', upstreamRoot, 'checkout', '--detach', '--force', lock.commit])

const head = spawnSync('git', ['-C', upstreamRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
if (head.status !== 0 || head.stdout.trim() !== lock.commit) {
  throw new Error(`Expected ${lock.commit}, got ${head.stdout.trim()}`)
}
const diff = spawnSync('git', ['-C', upstreamRoot, 'diff', '--quiet'])
if (diff.status !== 0) throw new Error('Tracked upstream source differs from the pinned commit')
console.log(`Powder Toy source ready: ${lock.commit}`)
