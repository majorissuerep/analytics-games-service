/* eslint-disable security/detect-non-literal-fs-filename -- all paths are derived from fixed repo and cache roots */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  gameRoot,
  loadAndValidateContent,
  repoRelative,
  runtimeOutputRoot,
  sha256,
} from './content-lib.mjs'

const content = await loadAndValidateContent()
await rm(runtimeOutputRoot, { recursive: true, force: true })
await mkdir(runtimeOutputRoot, { recursive: true })
await cp(join(gameRoot, 'runtime'), runtimeOutputRoot, { recursive: true })

const assets = []
for (const [group, files] of [
  ['bodies', content.bodyFiles],
  ['systems', content.systemFiles],
  ['evaluations', content.evaluationFiles],
]) {
  for (const file of files) {
    const sourceDirectory = dirname(file.path)
    const targetDirectory = join(runtimeOutputRoot, 'content', group, file.directoryId)
    await mkdir(dirname(targetDirectory), { recursive: true })
    await cp(sourceDirectory, targetDirectory, { recursive: true })
    const metadataName = file.path.slice(sourceDirectory.length + 1)
    assets.push({
      kind: file.value.kind,
      id: file.value.id,
      version: file.value.version,
      metadataSha256: await sha256(file.path),
      source: repoRelative(file.path),
      metadataUrl: `/content/${group}/${file.directoryId}/${metadataName}`,
    })
  }
}

const evaluations = []
for (const file of content.evaluationFiles) {
  const evaluation = file.value
  const scenePath = join(dirname(file.path), evaluation.sceneScript)
  evaluations.push({
    ...evaluation,
    sceneSha256: await sha256(scenePath),
    sceneUrl: `/content/evaluations/${evaluation.id}/${evaluation.sceneScript}`,
  })
}

const lock = JSON.parse(await readFile(join(gameRoot, 'upstream.lock.json'), 'utf8'))
const index = {
  schemaVersion: 1,
  engine: {
    repository: lock.repository,
    commit: lock.commit,
    patches: lock.patches,
  },
  assets: assets.sort((left, right) => `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`)),
  bodies: [...content.bodies.values()],
  systems: [...content.systems.values()],
  evaluations,
}
await writeFile(join(runtimeOutputRoot, 'content-index.json'), `${JSON.stringify(index, null, 2)}\n`)
console.log(`Runtime assembled at ${runtimeOutputRoot}`)
