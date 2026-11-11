/* eslint-disable security/detect-non-literal-fs-filename -- Paths come only from the checked-in provenance allowlist. */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
const root = new URL('../public/vendor/space-cadet/', import.meta.url)
const provenance = JSON.parse(await readFile(new URL('provenance.json', root), 'utf8'))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
async function download(url, expected) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed: ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (hash(bytes) !== expected) throw new Error(`Checksum mismatch: ${url}`)
  return bytes
}
if (process.argv.includes('--verify')) {
  for (const [name, artifact] of Object.entries(provenance.artifacts)) {
    const bytes = await readFile(new URL(name, root))
    if (hash(bytes) !== artifact.sha256 || bytes.length !== artifact.bytes) throw new Error(`Asset changed: ${name}`)
  }
  console.log('Space Cadet engine and CC0 data checksums verified.')
} else {
  const { spawnSync } = await import('node:child_process')
  const { mkdtemp, cp, copyFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join, dirname } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const repository = dirname(dirname(fileURLToPath(import.meta.url)))
  const build = await mkdtemp(join(tmpdir(), 'aster-cadet-'))
  const run = (command, args, cwd = build) => {
    const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
    if (result.error || result.status !== 0) throw result.error ?? new Error(`${command} failed`)
  }
  run('git', ['init', '-q'])
  run('git', ['remote', 'add', 'origin', provenance.engine.repository])
  run('git', ['fetch', '-q', '--depth', '1', 'origin', provenance.engine.commit])
  run('git', ['checkout', '-q', 'FETCH_HEAD'])
  run('git', ['apply', join(repository, 'scripts/space-cadet-cabinet.patch')])
  run('python', [join(repository, 'scripts/generate-pinball-art.py'), '--check'])
  await cp(join(repository, 'public/vendor/space-cadet/PINBALL.DAT'), join(build, 'game_resources/PINBALL.DAT'))
  await cp(join(repository, 'public/vendor/space-cadet/ASTER-BACKING.BGRA'), join(build, 'game_resources/ASTER-BACKING.BGRA'))
  for (const file of provenance.data.files.filter(file => file.name !== 'PINBALL.DAT')) {
    const bytes = await download(`https://raw.githubusercontent.com/andrewnakas/open-cadet/${provenance.data.commit}/${file.name.toLowerCase()}`, file.sha256)
    await writeFile(join(build, 'game_resources', file.name.toLowerCase()), bytes)
  }
  run('emcmake', ['cmake', '-S', '.', '-B', 'build', '-DCMAKE_BUILD_TYPE=Release'])
  run('cmake', ['--build', 'build', '-j4'])
  for (const extension of ['js', 'wasm', 'data']) await copyFile(join(build, 'bin', `SpaceCadetPinball.${extension}`), new URL(`SpaceCadetPinball.${extension}`, root))
  console.log('Built patched native cabinet with Aster art. Verify/review artifact hashes after intentional rebuilds; Emscripten preload UUIDs are not byte deterministic.')
}
