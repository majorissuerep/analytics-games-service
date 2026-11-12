/* eslint-disable security/detect-non-literal-fs-filename -- Isolated fixture roots intentionally include invalid evidence and traversal cases. */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import { collectPlaywright } from '../../scripts/experience/collect-playwright.mjs'
import { digest, fileRecord, loadContext, readJson, validateCaptureMetadata } from '../../scripts/experience/contracts.mjs'
import { currentCandidate, git, writeJson } from '../../scripts/experience/runtime.mjs'

const context = loadContext(process.cwd(), 'experience/requests/desktop-refinement.json')
const directories = [], ago = seconds => new Date(Date.now() - seconds * 1000).toISOString()
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }) })
function png(shade, width = 2, height = 2) {
  function chunk(type, bytes) {
    const data = Buffer.concat([Buffer.from(type), bytes]); let crc = 0xffffffff
    for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1 }
    const size = Buffer.alloc(4), checksum = Buffer.alloc(4); size.writeUInt32BE(bytes.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
    return Buffer.concat([size, data, checksum])
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2
  const row = Buffer.alloc(width * 3 + 1, shade); row[0] = 0
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.concat(Array(height).fill(row)))), chunk('IEND', Buffer.alloc(0))])
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'experience-collect-')); directories.push(root)
  execFileSync('git', ['init', '-q', root]); mkdirSync(join(root, 'public/vendor/space-cadet'), { recursive: true })
  const nativeAssets = {}
  for (const extension of ['js', 'wasm', 'data']) {
    const path = `public/vendor/space-cadet/SpaceCadetPinball.${extension}`
    writeFileSync(join(root, path), `test-native-${extension}`); nativeAssets[path] = digest(`test-native-${extension}`)
  }
  git(root, ['add', '.']); git(root, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'candidate'])
  const candidate = currentCandidate(root, { clean: true }), reportPath = 'evidence/candidate.json', directory = 'evidence/browser'
  const report = {
    schemaVersion: 1, requestId: context.request.id, requestSha256: context.requestSha256, contractsSha256: context.contractsSha256,
    candidate, author: 'root', startedAt: ago(120), finishedAt: null,
    environment: { name: 'candidate', url: 'http://localhost:3132', configuration: {} }, artifacts: [], automation: [],
    requirements: context.request.requirements.map(r => ({ id: r.id, status: 'pending', scenarioIds: r.scenarios, artifactIds: [] })),
    scenarios: context.request.scenarios.map(s => ({ id: s.id, status: 'pending', observed: '', artifactIds: [] })),
  }
  writeJson(root, reportPath, report)
  function capture(name, shade, override = {}) {
    const path = `${directory}/${name}.png`; mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), png(shade))
    const metadata = { scenarioId: 'mine-input', state: name, window: 'clamped', viewport: { width: 2, height: 2 }, capturedAt: ago(60 - shade), url: 'http://localhost:3132/', identity: { ...candidate, nativeAssets: { ...nativeAssets } }, sha256: fileRecord(root, path).sha256, ...override }
    writeJson(root, path.slice(0, -4) + '.json', metadata)
    return { path, metadataPath: path.slice(0, -4) + '.json', metadata }
  }
  const collect = () => collectPlaywright({ root, context, report: readJson(root, reportPath), reportPath, directory })
  return { root, reportPath, report, directory, nativeAssets, capture, collect }
}

describe('Playwright capture collection', () => {
  it('imports actual captures and ordered distinct sequences without granting passed statuses', () => {
    const f = fixture(); f.capture('nested/late', 20); f.capture('nested/early', 10); f.capture('repeat', 20)
    writeJson(f.root, `${f.directory}/.last-run.json`, { status: 'passed' })
    const collected = f.collect(), report = readJson(f.root, f.reportPath)
    expect(collected).toMatchObject({ capturesFound: 3, addedCaptures: 3, addedSequences: 1 })
    expect(collected.missingDynamicScenarios).not.toContain('mine-input')
    expect(report.requirements.every(r => r.status === 'pending')).toBe(true); expect(report.scenarios.every(s => s.status === 'pending' && s.observed === '')).toBe(true); expect(report.automation).toEqual([])
    const sequence = readJson(f.root, report.artifacts.find(a => a.kind === 'sequence').path)
    expect(sequence.frames).toHaveLength(2); expect(sequence.frames.map(frame => frame.state)).toEqual(['nested/early', 'nested/late'])
    expect(report.artifacts.filter(a => a.kind === 'viewport').every(a => a.capture?.sha256 && !a.path.startsWith('/'))).toBe(true)
    expect(f.collect()).toMatchObject({ addedCaptures: 0, addedSequences: 0 })
  })
  it('does not build fake dynamics by combining different scenarios, viewports or windows', () => {
    const f = fixture(); f.capture('first', 10); f.capture('other-window', 20, { window: 'maximized' }); f.capture('other-scenario', 30, { scenarioId: 'shell-focus' })
    const viewport = f.capture('other-viewport', 40, { viewport: { width: 3, height: 2 } }); writeFileSync(join(f.root, viewport.path), png(40, 3, 2)); viewport.metadata.sha256 = fileRecord(f.root, viewport.path).sha256; writeJson(f.root, viewport.metadataPath, viewport.metadata)
    const result = f.collect(); expect(result.addedCaptures).toBe(4); expect(result.addedSequences).toBe(0); expect(result.missingDynamicScenarios).toContain('mine-input')
  })
  it('rejects altered bytes or declared dimensions and keeps the report unchanged', () => {
    const f = fixture(), capture = f.capture('altered', 10); writeFileSync(join(f.root, capture.path), png(20)); expect(f.collect).toThrow('checksum mismatch'); expect(readJson(f.root, f.reportPath)).toEqual(f.report)
    capture.metadata.sha256 = fileRecord(f.root, capture.path).sha256; capture.metadata.viewport.width = 3; writeJson(f.root, capture.metadataPath, capture.metadata); expect(f.collect).toThrow('dimensions do not match')
  })
  it.each(['commit', 'tree'])('rejects capture from a different %s', key => {
    const f = fixture(); f.capture('wrong', 10, { identity: { ...f.report.candidate, nativeAssets: f.nativeAssets, [key]: 'f'.repeat(40) } }); expect(f.collect).toThrow(`different candidate ${key}`)
  })
  it('rejects stale time, wrong origin and stale native assets', () => {
    const f = fixture(), capture = f.capture('stale', 10, { capturedAt: ago(180) }); expect(f.collect).toThrow('timestamp is stale')
    capture.metadata.capturedAt = ago(30); capture.metadata.url = 'https://elsewhere.example/'; writeJson(f.root, capture.metadataPath, capture.metadata); expect(f.collect).toThrow('environment origin')
    capture.metadata.url = f.report.environment.url; capture.metadata.identity.nativeAssets['public/vendor/space-cadet/SpaceCadetPinball.data'] = '0'.repeat(64); writeJson(f.root, capture.metadataPath, capture.metadata); expect(f.collect).toThrow('stale native asset')
  })
  it('resolves a null deployed tree through the verified full commit object', () => {
    const f = fixture(); f.capture('live', 10, { identity: { commit: f.report.candidate.commit, tree: null, nativeAssets: f.nativeAssets } }); expect(f.collect().addedCaptures).toBe(1)
    f.report.candidate.tree = '0'.repeat(40); writeJson(f.root, f.reportPath, f.report); expect(f.collect).toThrow('does not resolve to its source tree')
  })
  it('rejects unknown scenarios, incomplete metadata and missing screenshot pairs', () => {
    const f = fixture(), capture = f.capture('missing', 10, { scenarioId: 'unknown' }); expect(f.collect).toThrow('unknown scenario')
    capture.metadata.scenarioId = 'mine-input'; delete capture.metadata.identity; writeJson(f.root, capture.metadataPath, capture.metadata); expect(f.collect).toThrow('identity')
    capture.metadata.identity = { ...f.report.candidate, nativeAssets: f.nativeAssets }; writeJson(f.root, capture.metadataPath, capture.metadata); rmSync(join(f.root, capture.path)); expect(f.collect).toThrow()
  })
  it('rejects escaped directories/symlinks and changes to already imported metadata', () => {
    const f = fixture(), capture = f.capture('original', 10); f.collect()
    capture.metadata.state = 'rewritten observation'; writeJson(f.root, capture.metadataPath, capture.metadata); expect(f.collect).toThrow('Previously imported artifact changed')
    expect(() => collectPlaywright({ root: f.root, context, report: f.report, reportPath: f.reportPath, directory: '..' })).toThrow('inside the repository')
    symlinkSync(join(f.root, f.reportPath), join(f.root, f.directory, 'linked.json')); expect(f.collect).toThrow('symbolic links')
  })
  it('rehashes retained sidecars and detects metadata/report mismatches at validation', () => {
    const f = fixture(); f.capture('captured', 10); f.collect(); const report = readJson(f.root, f.reportPath), artifact = report.artifacts[0]
    const metadata = JSON.parse(readFileSync(join(f.root, artifact.capture.path), 'utf8')); expect(validateCaptureMetadata(metadata, report, artifact).state).toBe('captured')
    metadata.window = 'maximized'; expect(() => validateCaptureMetadata(metadata, report, artifact)).toThrow('differs from artifact window')
    writeJson(f.root, artifact.capture.path, metadata); expect(fileRecord(f.root, artifact.capture.path).sha256).not.toBe(artifact.capture.sha256)
  })
})
