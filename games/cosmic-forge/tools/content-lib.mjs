/* eslint-disable security/detect-non-literal-fs-filename -- all paths are derived from fixed repo roots and validated asset IDs */
import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const gameRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const repoRoot = resolve(gameRoot, '..', '..')
export const contentRoot = join(gameRoot, 'content')
export const cacheRoot = join(repoRoot, '.cache', 'powder-toy')
export const runtimeOutputRoot = join(cacheRoot, 'runtime')
export const upstreamRoot = join(cacheRoot, 'upstream')
export const buildRoot = join(cacheRoot, 'build')

function validId(value) {
  return typeof value === 'string'
    && value.length > 0
    && !value.startsWith('-')
    && !value.endsWith('-')
    && !value.includes('--')
    && [...value].every(character => 'abcdefghijklmnopqrstuvwxyz0123456789-'.includes(character))
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message)
}

function positiveNumber(value) {
  return Number.isFinite(value) && value > 0
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function readAssetGroup(root, group, filename) {
  root = join(root, group)
  const entries = await readdir(root, { withFileTypes: true })
  return Promise.all(entries
    .filter(entry => entry.isDirectory())
    .map(async entry => {
      const path = join(root, entry.name, filename)
      return { directoryId: entry.name, path, value: await readJson(path) }
    }))
}

function validateCommon(asset, directoryId, expectedKind, source, errors) {
  assert(asset.schemaVersion === 1, `${source}: schemaVersion must be 1`, errors)
  assert(asset.kind === expectedKind, `${source}: kind must be ${expectedKind}`, errors)
  assert(validId(asset.id), `${source}: invalid id`, errors)
  assert(asset.id === directoryId, `${source}: id must match directory ${directoryId}`, errors)
  assert(Number.isInteger(asset.version) && asset.version > 0, `${source}: version must be a positive integer`, errors)
  assert(typeof asset.name === 'string' && asset.name.trim().length > 0, `${source}: name is required`, errors)
}

export async function loadAndValidateContent(root = contentRoot) {
  const [bodyFiles, systemFiles, evaluationFiles] = await Promise.all([
    readAssetGroup(root, 'bodies', 'body.json'),
    readAssetGroup(root, 'systems', 'system.json'),
    readAssetGroup(root, 'evaluations', 'evaluation.json'),
  ])
  const errors = []
  const bodies = new Map()
  const systems = new Map()
  const evaluations = new Map()

  for (const file of bodyFiles) {
    const { value: body } = file
    validateCommon(body, file.directoryId, 'body', file.path, errors)
    assert(['star', 'rocky-planet', 'gas-giant', 'moon'].includes(body.classification), `${file.path}: unsupported classification`, errors)
    assert(positiveNumber(body.physics?.massKg), `${file.path}: physics.massKg must be positive`, errors)
    assert(positiveNumber(body.physics?.radiusM), `${file.path}: physics.radiusM must be positive`, errors)
    assert(positiveNumber(body.physics?.surfaceTemperatureK), `${file.path}: physics.surfaceTemperatureK must be positive`, errors)
    assert(!bodies.has(body.id), `${file.path}: duplicate body id ${body.id}`, errors)
    bodies.set(body.id, body)
  }

  for (const file of systemFiles) {
    const { value: system } = file
    validateCommon(system, file.directoryId, 'system', file.path, errors)
    assert(Array.isArray(system.bodyIds) && system.bodyIds.length >= 2, `${file.path}: bodyIds needs at least two bodies`, errors)
    assert(new Set(system.bodyIds ?? []).size === (system.bodyIds?.length ?? 0), `${file.path}: bodyIds must be unique`, errors)
    for (const bodyId of system.bodyIds ?? []) {
      assert(bodies.has(bodyId), `${file.path}: unknown body ${bodyId}`, errors)
    }
    assert(system.bodyIds?.includes(system.primaryBodyId), `${file.path}: primaryBodyId must be in bodyIds`, errors)
    for (const orbit of system.orbits ?? []) {
      assert(system.bodyIds?.includes(orbit.bodyId), `${file.path}: orbit body ${orbit.bodyId} is not in bodyIds`, errors)
      assert(system.bodyIds?.includes(orbit.parentBodyId), `${file.path}: orbit parent ${orbit.parentBodyId} is not in bodyIds`, errors)
      assert(orbit.bodyId !== orbit.parentBodyId, `${file.path}: an orbit cannot parent itself`, errors)
      assert(positiveNumber(orbit.semiMajorAxisM), `${file.path}: semiMajorAxisM must be positive`, errors)
      assert(Number.isFinite(orbit.eccentricity) && orbit.eccentricity >= 0 && orbit.eccentricity < 1, `${file.path}: eccentricity must be in [0, 1)`, errors)
    }
    assert(!systems.has(system.id), `${file.path}: duplicate system id ${system.id}`, errors)
    systems.set(system.id, system)
  }

  for (const file of evaluationFiles) {
    const { value: evaluation } = file
    validateCommon(evaluation, file.directoryId, 'evaluation', file.path, errors)
    const system = systems.get(evaluation.systemId)
    assert(Boolean(system), `${file.path}: unknown system ${evaluation.systemId}`, errors)
    assert(Boolean(system?.bodyIds?.includes(evaluation.focusBodyId)), `${file.path}: focus body must belong to the system`, errors)
    assert(evaluation.projection === 'local-material-lab', `${file.path}: unsupported projection`, errors)
    assert(positiveNumber(evaluation.scale?.widthM), `${file.path}: scale.widthM must be positive`, errors)
    assert(positiveNumber(evaluation.scale?.heightM), `${file.path}: scale.heightM must be positive`, errors)
    assert(positiveNumber(evaluation.scale?.metersPerCell), `${file.path}: scale.metersPerCell must be positive`, errors)
    const script = evaluation.sceneScript
    assert(typeof script === 'string' && script.endsWith('.lua') && !isAbsolute(script) && !script.includes('..') && !script.includes('/') && !script.includes('\\'), `${file.path}: sceneScript must be a local .lua filename`, errors)
    if (typeof script === 'string') {
      const scriptPath = resolve(dirname(file.path), script)
      assert(scriptPath.startsWith(`${dirname(file.path)}${sep}`), `${file.path}: sceneScript escapes its asset directory`, errors)
      try {
        assert((await stat(scriptPath)).isFile(), `${file.path}: sceneScript is not a file`, errors)
      } catch {
        errors.push(`${file.path}: missing sceneScript ${script}`)
      }
    }
    assert(!evaluations.has(evaluation.id), `${file.path}: duplicate evaluation id ${evaluation.id}`, errors)
    evaluations.set(evaluation.id, evaluation)
  }

  if (errors.length) throw new Error(`Content validation failed:\n- ${errors.join('\n- ')}`)
  return { bodies, systems, evaluations, bodyFiles, systemFiles, evaluationFiles }
}

export async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

export function repoRelative(path) {
  return relative(repoRoot, path).split(sep).join('/')
}
