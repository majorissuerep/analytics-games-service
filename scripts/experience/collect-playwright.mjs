#!/usr/bin/env node
/* eslint-disable security/detect-non-literal-fs-filename -- All discovered files and directories are checked against the repository root. */
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { assert, checkPng, containedFile, digest, fileRecord, loadContext, readJson, validateCaptureMetadata } from './contracts.mjs'
import { committedNativeAssets, git, options, required, writeJson } from './runtime.mjs'

function captureFiles(root, directory) {
  assert(!isAbsolute(directory), '--dir must be relative to the repository root')
  const absolute = realpathSync(resolve(root, directory)), rel = relative(realpathSync(root), absolute)
  assert(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'Capture directory must be inside the repository')
  assert(statSync(absolute).isDirectory(), '--dir must name a directory')
  const found = []
  function visit(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      assert(!entry.isSymbolicLink(), `Capture collection rejects symbolic links: ${join(path, entry.name)}`)
      const child = join(path, entry.name)
      if (entry.isDirectory()) visit(child)
      else if (entry.isFile() && entry.name.endsWith('.json')) found.push(relative(root, child))
    }
  }
  visit(absolute)
  return found.sort()
}
function attach(report, artifact) {
  const existing = report.artifacts.find(a => a.id === artifact.id)
  if (existing) {
    assert(existing.path === artifact.path && existing.sha256 === artifact.sha256 && existing.capture?.sha256 === artifact.capture?.sha256, `Previously imported artifact changed: ${artifact.id}`)
    return false
  }
  report.artifacts.push(artifact)
  report.scenarios.find(s => s.id === artifact.scenarioId).artifactIds.push(artifact.id)
  for (const requirement of report.requirements.filter(r => r.scenarioIds.includes(artifact.scenarioId))) requirement.artifactIds.push(artifact.id)
  return true
}

export function collectPlaywright({ root, context, report, reportPath, directory, sequenceDirectory }) {
  assert(report.schemaVersion === 1 && !report.finishedAt, 'Collect into an initialized, unfinished evidence report')
  assert(/^[a-f0-9]{40,64}$/.test(report.candidate?.commit) && /^[a-f0-9]{40,64}$/.test(report.candidate?.tree) && Number.isFinite(Date.parse(report.startedAt)), 'Report needs a valid source identity and evidence start timestamp')
  assert(!sequenceDirectory || !isAbsolute(sequenceDirectory), '--sequence-dir must be relative to the repository root')
  assert(report.requestId === context.request.id && report.requestSha256 === context.requestSha256 && report.contractsSha256 === context.contractsSha256, 'Evidence report uses stale request or contract identity')
  assert(git(root, ['rev-parse', `${report.candidate.commit}^{tree}`]) === report.candidate.tree, 'Capture report candidate commit does not resolve to its source tree')
  const captures = [], now = new Date().toISOString()
  let nativeAssets
  for (const metadataPath of captureFiles(root, directory)) {
    const metadata = readJson(root, metadataPath), pngPath = metadataPath.slice(0, -5) + '.png'
    // Playwright also writes unrelated JSON such as .last-run.json.
    if (!existsSync(resolve(root, pngPath)) && !metadata?.scenarioId) continue
    const capture = validateCaptureMetadata(metadata, report)
    assert(context.request.scenarios.some(s => s.id === capture.scenarioId), `Capture references unknown scenario ${capture.scenarioId}`)
    assert(report.scenarios.some(s => s.id === capture.scenarioId), `Report has no scenario row for ${capture.scenarioId}`)
    const record = fileRecord(root, pngPath)
    assert(record.sha256 === capture.sha256, `Playwright capture checksum mismatch: ${pngPath}`)
    checkPng(readFileSync(containedFile(root, pngPath)), capture.viewport, pngPath)
    nativeAssets ??= committedNativeAssets(root, report.candidate.commit)
    for (const [path, checksum] of Object.entries(nativeAssets)) assert(capture.identity.nativeAssets[path] === checksum, `Playwright capture has stale native asset identity: ${path}`)
    captures.push({
      id: `${capture.scenarioId}-viewport-${digest(metadataPath).slice(0, 16)}`,
      scenarioId: capture.scenarioId, kind: 'viewport', ...record, capturedAt: capture.capturedAt,
      tree: report.candidate.tree, environment: report.environment.name, viewport: capture.viewport,
      window: capture.window, state: capture.state, capture: fileRecord(root, metadataPath),
    })
  }
  assert(captures.length, 'No paired captureExperience PNG/JSON sidecars found under --dir')
  // Validate the complete input set before changing the report or writing sequences.
  const next = structuredClone(report), groups = new Map()
  let addedCaptures = 0, addedSequences = 0
  for (const artifact of captures) if (attach(next, artifact)) addedCaptures++
  for (const artifact of next.artifacts.filter(a => a.kind === 'viewport' && a.capture)) {
    const key = JSON.stringify([artifact.scenarioId, artifact.viewport.width, artifact.viewport.height, artifact.window])
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(artifact)
  }
  const sequenceWrites = []
  for (const [key, group] of groups) {
    group.sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt) || a.path.localeCompare(b.path))
    const ordered = group.filter((frame, index) => index === 0 || frame.sha256 !== group[index - 1].sha256)
    if (new Set(ordered.map(frame => frame.sha256)).size < 2) continue
    const first = ordered[0], id = `${first.scenarioId}-sequence-${digest(key + JSON.stringify(ordered.map(a => [a.id, a.sha256]))).slice(0, 16)}`
    if (next.artifacts.some(a => a.id === id)) continue
    const path = join(sequenceDirectory ?? join(dirname(reportPath), 'sequences'), `${id}.json`)
    const sequence = {
      frames: ordered.map(a => ({ path: a.path, sha256: a.sha256, bytes: a.bytes, capturedAt: a.capturedAt, state: a.state })),
      actions: [{ action: 'Capture successive rendered states during the browser scenario', observed: `Recorded capture state labels: ${ordered.map(a => a.state).join(' → ')}. Interaction outcomes require the command result and independent observation.` }],
    }
    sequenceWrites.push({ path, sequence, artifact: {
      id, scenarioId: first.scenarioId, kind: 'sequence', path,
      sha256: digest(`${JSON.stringify(sequence, null, 2)}\n`), bytes: Buffer.byteLength(`${JSON.stringify(sequence, null, 2)}\n`),
      capturedAt: now, tree: report.candidate.tree, environment: report.environment.name,
      viewport: first.viewport, window: first.window, state: ordered.map(a => a.state).join(' → '),
    } })
  }
  for (const { path, sequence, artifact } of sequenceWrites) { writeJson(root, path, sequence); if (attach(next, artifact)) addedSequences++ }
  writeJson(root, reportPath, next)
  return {
    report: reportPath, capturesFound: captures.length, addedCaptures, addedSequences,
    missingDynamicScenarios: context.request.scenarios.filter(s => s.artifacts.some(kind => ['sequence', 'video'].includes(kind)) && !next.artifacts.some(a => a.scenarioId === s.id && ['sequence', 'video'].includes(a.kind))).map(s => s.id),
    status: 'Evidence collected; scenario/requirement outcomes are unchanged. Record actual results before finishing.',
  }
}

export function runCollector(argv) {
  const { flags, root } = options(['collect', ...argv]), reportPath = required(flags, 'report')
  return collectPlaywright({ root, context: loadContext(root, flags.request ?? 'experience/requests/desktop-refinement.json'), report: readJson(root, reportPath), reportPath, directory: required(flags, 'dir'), sequenceDirectory: flags['sequence-dir'] })
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(runCollector(process.argv.slice(2)), null, 2)) }
  catch (error) { console.error(`Experience capture collection rejected: ${error.message}`); process.exitCode = 1 }
}
