/* eslint-disable security/detect-non-literal-fs-filename -- Paths are explicit CLI paths; evidence reads are separately contained. */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { assert, digest } from './contracts.mjs'

export function git(root, args, env) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
export function currentCandidate(root, { clean = false } = {}) {
  const commit = git(root, ['rev-parse', 'HEAD'])
  if (clean) {
    assert(!git(root, ['status', '--porcelain', '--untracked-files=all']), 'Promotion requires a clean committed source tree; commit source and request review before freezing the candidate')
    return { commit, tree: git(root, ['rev-parse', 'HEAD^{tree}']) }
  }
  const temp = mkdtempSync(join(tmpdir(), 'experience-index-'))
  try {
    const env = { GIT_INDEX_FILE: join(temp, 'index') }
    git(root, ['read-tree', 'HEAD'], env)
    git(root, ['add', '-A'], env)
    return { commit, tree: git(root, ['write-tree'], env) }
  } finally { rmSync(temp, { recursive: true, force: true }) }
}
export function writeJson(root, path, value) {
  const absolute = outputPath(root, path)
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`)
}
export function outputPath(root, path) {
  const absolute = resolve(root, path), realRoot = realpathSync(root)
  const rel = relative(resolve(root), absolute)
  assert(rel && !rel.startsWith('../') && rel !== '..', `Output escapes repository: ${path}`)
  let ancestor = absolute
  while (!existsSync(ancestor)) ancestor = dirname(ancestor)
  const resolved = relative(realRoot, realpathSync(ancestor))
  assert(resolved !== '..' && !resolved.startsWith('../'), `Output symlink escapes repository: ${path}`)
  mkdirSync(dirname(absolute), { recursive: true })
  return absolute
}
export function options(argv) {
  const [command, ...args] = argv
  const flags = {}
  for (let i = 0; i < args.length; i += 2) {
    assert(args[i].startsWith('--') && args[i + 1] && !args[i + 1].startsWith('--'), `Expected --option value near ${args[i]}`)
    assert(!Object.hasOwn(flags, args[i].slice(2)), `Repeated option ${args[i]}`)
    flags[args[i].slice(2)] = args[i + 1]
  }
  return { command, flags, root: resolve(flags.root ?? process.cwd()) }
}
export function required(flags, key) { assert(flags[key], `Missing --${key}`); return flags[key] }
export function committedNativeAssets(root, commit) {
  return Object.fromEntries(['js', 'wasm', 'data'].map(extension => {
    const path = `public/vendor/space-cadet/SpaceCadetPinball.${extension}`
    const bytes = execFileSync('git', ['show', `${commit}:${path}`], { cwd: root, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
    return [path, digest(bytes)]
  }))
}
export async function probeIdentity(root, url, environmentUrl, expectedCommit, expectedTree) {
  assert(/^[a-f0-9]{40,64}$/.test(expectedCommit), 'Build identity requires a full commit SHA')
  assert(new URL(url).origin === new URL(environmentUrl).origin, 'Build identity endpoint must share the tested environment origin')
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: 'no-store', redirect: 'error', headers: { 'cache-control': 'no-cache' } })
  assert(response.ok, `Build identity probe failed: HTTP ${response.status}`)
  const identity = await response.json()
  assert(identity.commit === expectedCommit, 'Wrong deployment identity: live build commit differs from evidence commit')
  const deployedTree = git(root, ['rev-parse', `${expectedCommit}^{tree}`])
  assert(deployedTree === expectedTree, 'Wrong deployment identity: deployed commit tree differs from approved candidate tree')
  if (identity.tree) assert(identity.tree === expectedTree, 'Wrong deployment identity: live build tree differs from approved candidate tree')
  if (identity.nativeAssets !== undefined) {
    for (const [path, checksum] of Object.entries(committedNativeAssets(root, expectedCommit))) assert(identity.nativeAssets[path] === checksum, `Wrong native build identity: checksum differs for ${path}`)
  }
  return { url, checkedAt: new Date().toISOString(), commit: identity.commit, tree: deployedTree, ...(identity.nativeAssets ? { nativeAssets: identity.nativeAssets } : {}) }
}
