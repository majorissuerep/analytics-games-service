#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename -- Evidence paths are resolved and contained before access. */
import { spawnSync } from 'node:child_process'
import { statSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { assert, containedFile, fileRecord, loadContext, readJson } from './contracts.mjs'
import { currentCandidate, git, options, outputPath, probeIdentity, required, writeJson } from './runtime.mjs'
import { collectPlaywright } from './collect-playwright.mjs'

function csv(value) { return value.split(',').map(s => s.trim()).filter(Boolean) }
function addArtifact(root, report, context, flags) {
  const scenarioId = required(flags, 'scenario'), scenario = context.request.scenarios.find(s => s.id === scenarioId)
  assert(scenario, `Unknown scenario ${scenarioId}`)
  const kind = required(flags, 'kind'), path = required(flags, 'path')
  assert(['viewport', 'sequence', 'video', 'log'].includes(kind), `Unknown artifact kind ${kind}`)
  const artifact = {
    id: flags.id ?? `${scenarioId}-${kind}-${report.artifacts.length + 1}`,
    scenarioId, kind, ...fileRecord(root, path),
    capturedAt: flags.at ?? statSync(containedFile(root, path)).mtime.toISOString(),
    tree: report.candidate.tree, environment: report.environment.name,
    viewport: { width: Number(flags.width ?? scenario.viewport.width), height: Number(flags.height ?? scenario.viewport.height) },
    window: flags.window ?? scenario.window, state: required(flags, 'state'),
  }
  assert(!report.artifacts.some(a => a.id === artifact.id), `Artifact ID already exists: ${artifact.id}`)
  report.artifacts.push(artifact)
  report.scenarios.find(s => s.id === scenarioId).artifactIds.push(artifact.id)
  for (const requirement of report.requirements.filter(r => r.scenarioIds.includes(scenarioId))) requirement.artifactIds.push(artifact.id)
  return artifact
}

export async function runEvidence(argv) {
  const { command, flags, root } = options(argv)
  const requestPath = flags.request
  const context = loadContext(root, requestPath)
  if (command === 'context') return { requestId: context.request.id, requestSha256: context.requestSha256, contractsSha256: context.contractsSha256, candidate: currentCandidate(root) }
  if (command === 'init') {
    const environment = flags.environment ?? 'candidate', url = required(flags, 'url')
    let candidate = currentCandidate(root), deployment
    if (environment === 'deployed') {
      const commit = required(flags, 'commit'), tree = git(root, ['rev-parse', `${commit}^{tree}`])
      const identityUrl = flags['identity-url'] ?? new URL('/api/build-identity', url).href
      const verified = await probeIdentity(root, identityUrl, url, commit, tree)
      candidate = { commit, tree }
      deployment = { commit, identityUrl, identityVerifiedAt: verified.checkedAt }
    }
    const report = {
      schemaVersion: 1, requestId: context.request.id, requestSha256: context.requestSha256, contractsSha256: context.contractsSha256,
      candidate, author: required(flags, 'author'), startedAt: new Date().toISOString(), finishedAt: null,
      environment: { name: environment, url, configuration: flags.configuration ? JSON.parse(flags.configuration) : {} },
      automation: [], artifacts: [],
      requirements: context.request.requirements.map(r => ({ id: r.id, status: 'pending', scenarioIds: r.scenarios, artifactIds: [] })),
      scenarios: context.request.scenarios.map(s => ({ id: s.id, status: 'pending', artifactIds: [], observed: '' })),
      ...(deployment ? { deployment } : {}),
    }
    writeJson(root, required(flags, 'out'), report)
    return { report: flags.out, candidate, status: 'initialized; collect evidence, record results, then finish' }
  }
  const reportPath = required(flags, 'report'), report = readJson(root, reportPath)
  assert(!report.finishedAt || command === 'inspect', 'Report is frozen; initialize a new report for more evidence')
  if (command === 'collect') return collectPlaywright({ root, context, report, reportPath, directory: required(flags, 'dir'), sequenceDirectory: flags['sequence-dir'] })
  if (command === 'add') {
    const artifact = addArtifact(root, report, context, flags)
    writeJson(root, reportPath, report)
    return artifact
  }
  if (command === 'sequence') {
    const paths = csv(required(flags, 'frames')), states = csv(required(flags, 'states'))
    assert(paths.length >= 2 && states.length === paths.length, 'A sequence needs at least two frame paths and one state per frame')
    const sequence = {
      frames: paths.map((path, i) => ({ ...fileRecord(root, path), capturedAt: statSync(containedFile(root, path)).mtime.toISOString(), state: states[i] })),
      actions: [{ action: required(flags, 'action'), observed: required(flags, 'observed') }],
    }
    const path = required(flags, 'out')
    writeJson(root, path, sequence)
    const artifact = addArtifact(root, report, context, { ...flags, kind: 'sequence', path, state: states.join(' → ') })
    writeJson(root, reportPath, report)
    return artifact
  }
  if (command === 'run') {
    const args = JSON.parse(required(flags, 'command-json'))
    assert(Array.isArray(args) && args.length && args.every(s => typeof s === 'string'), '--command-json must be a JSON array of executable and arguments')
    const id = required(flags, 'id'), requirementIds = csv(required(flags, 'requirements')), scenarioIds = csv(required(flags, 'scenarios'))
    assert(!report.automation.some(c => c.id === id), `Check ID already exists: ${id}`)
    const result = spawnSync(args[0], args.slice(1), { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: Number(flags['timeout-ms'] ?? 600_000) })
    const path = required(flags, 'log'), absolute = outputPath(root, path)
    writeFileSync(absolute, `$ ${args.join(' ')}\n${result.stdout ?? ''}\n${result.stderr ?? ''}\nexit=${result.status}; error=${result.error?.message ?? 'none'}\n`)
    const artifact = addArtifact(root, report, context, { ...flags, scenario: flags.scenario ?? scenarioIds[0], kind: 'log', path, state: `command exit ${result.status}`, id: `${id}-log` })
    const check = { id, command: JSON.stringify(args), status: result.status === 0 ? 'passed' : 'failed', artifactIds: [artifact.id], requirementIds, scenarioIds }
    report.automation.push(check)
    writeJson(root, reportPath, report)
    if (result.status !== 0) throw new Error(`Recorded failed automation ${id}; see ${path}`)
    return check
  }
  if (command === 'result') {
    const scenario = report.scenarios.find(s => s.id === required(flags, 'scenario'))
    assert(scenario, `Unknown scenario ${flags.scenario}`)
    assert(['passed', 'failed'].includes(flags.status), '--status must be passed or failed')
    scenario.status = flags.status; scenario.observed = required(flags, 'observed')
    for (const requirement of report.requirements) {
      const statuses = requirement.scenarioIds.map(id => report.scenarios.find(s => s.id === id).status)
      requirement.status = statuses.includes('failed') ? 'failed' : statuses.every(s => s === 'passed') ? 'passed' : 'pending'
    }
    writeJson(root, reportPath, report)
    return scenario
  }
  if (command === 'finish') {
    assert(report.requirements.every(r => r.status !== 'pending') && report.scenarios.every(s => s.status !== 'pending'), 'Cannot freeze report with pending scenario/requirement results')
    report.finishedAt = new Date().toISOString()
    writeJson(root, reportPath, report)
    return { ...fileRecord(root, reportPath), tree: report.candidate.tree, status: 'frozen; independent reviewer must open the named artifacts' }
  }
  if (command === 'inspect') return { ...fileRecord(root, reportPath), ...report }
  throw new Error('Usage: experience:evidence -- context|init|collect|add|sequence|run|result|finish|inspect [options]; see scripts/experience/README.md')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await runEvidence(process.argv.slice(2)), null, 2)) }
  catch (error) { console.error(`Experience evidence: ${error.message}`); process.exitCode = 1 }
}
