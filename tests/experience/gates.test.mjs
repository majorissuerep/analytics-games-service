/* eslint-disable security/detect-non-literal-fs-filename -- Tests create isolated temporary fixture roots and intentionally test traversal rejection. */
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { digest, fileRecord, loadContext, validateDecision, validateReport, validateRequest, validateReview, validateRollback } from '../../scripts/experience/contracts.mjs'
import { verifyPromotion } from '../../scripts/experience/gate.mjs'
import { currentCandidate, git, probeIdentity } from '../../scripts/experience/runtime.mjs'

const repository = process.cwd()
const context = loadContext(repository, 'experience/requests/desktop-refinement.json')
const apps = Object.fromEntries(context.request.scope.filter(id => id !== 'process').map(id => [id, JSON.parse(readFileSync(join(repository, `experience/apps/${id}.json`), 'utf8'))]))
const directories = []
const tree = 'a'.repeat(40), commit = 'b'.repeat(40)
const ago = seconds => new Date(Date.now() - seconds * 1000).toISOString()
function temporary() { const path = mkdtempSync(join(tmpdir(), 'experience-test-')); directories.push(path); return path }
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); vi.unstubAllGlobals() })

// Real, small-compressed PNGs avoid passing renamed text files as rendered evidence.
function png(width, height, shade) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  function chunk(type, payload) {
    const data = Buffer.concat([Buffer.from(type), payload])
    let crc = 0xffffffff
    for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1 }
    const size = Buffer.alloc(4), checksum = Buffer.alloc(4)
    size.writeUInt32BE(payload.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
    return Buffer.concat([size, data, checksum])
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2
  const scanline = Buffer.alloc(width * 3 + 1, shade); scanline[0] = 0
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.concat(Array(height).fill(scanline)))), chunk('IEND', Buffer.alloc(0))])
}
function fixture() {
  const root = temporary(), capturedAt = ago(60)
  const report = {
    schemaVersion: 1, requestId: context.request.id, requestSha256: context.requestSha256, contractsSha256: context.contractsSha256,
    candidate: { commit, tree }, author: 'root', startedAt: ago(120), finishedAt: ago(30),
    environment: { name: 'candidate', url: 'http://localhost:3132', configuration: { analytics: 'disabled' } },
    artifacts: [], requirements: [], scenarios: [], automation: [],
  }
  const images = new Map()
  function image(size, shade) {
    const path = `${size.width}-${size.height}-${shade}.png`
    if (!images.has(path)) { writeFileSync(join(root, path), png(size.width, size.height, shade)); images.set(path, fileRecord(root, path)) }
    return images.get(path)
  }
  for (const scenario of context.request.scenarios) {
    const ids = []
    for (const kind of new Set([...scenario.artifacts, 'log'])) {
      const id = `${scenario.id}-${kind}`
      let record
      if (kind === 'viewport') record = image(scenario.viewport, 230)
      if (kind === 'sequence') {
        const path = `${id}.json`
        writeFileSync(join(root, path), JSON.stringify({ frames: [230, 180].map((shade, i) => ({ ...image(scenario.viewport, shade), capturedAt: ago(80 - i * 10), state: i ? 'active' : 'ready' })), actions: [{ action: scenario.actions[0], observed: scenario.expected[0] }] }))
        record = fileRecord(root, path)
      }
      if (kind === 'log') { const path = `${id}.log`; writeFileSync(join(root, path), `Fixture command succeeded: ${scenario.id}\n`); record = fileRecord(root, path) }
      report.artifacts.push({ id, scenarioId: scenario.id, kind, ...record, capturedAt, tree, environment: 'candidate', viewport: scenario.viewport, window: scenario.window, state: 'observed fixture state' })
      ids.push(id)
    }
    report.scenarios.push({ id: scenario.id, status: 'passed', artifactIds: ids, observed: 'Actual fixture outcome recorded for negative validation tests' })
  }
  for (const requirement of context.request.requirements) report.requirements.push({ id: requirement.id, status: 'passed', scenarioIds: requirement.scenarios, artifactIds: report.artifacts.filter(a => requirement.scenarios.includes(a.scenarioId)).map(a => a.id) })
  report.automation.push({ id: 'fixture-checks', command: 'vitest acceptance fixtures', status: 'passed', artifactIds: report.artifacts.filter(a => a.kind === 'log').map(a => a.id), requirementIds: report.requirements.map(r => r.id), scenarioIds: report.scenarios.map(s => s.id) })
  const review = {
    schemaVersion: 1, requestId: context.request.id, requestSha256: context.requestSha256, contractsSha256: context.contractsSha256,
    reviewer: context.request.rollout.reviewer, authors: ['root'], reviewedAt: ago(10), verdict: 'approve', challenges: ['Checked all expected outcomes against realistic negative fixtures.'], findings: [],
    tree, environment: 'candidate', reportSha256: digest(JSON.stringify(report)), referenceComparison: 'Fixture observation; not real product visual approval.',
    observations: report.requirements.map(r => ({ requirementId: r.id, note: `Inspected the fixture captures covering ${r.id}`, artifactIds: r.artifactIds })),
  }
  const validate = () => validateReport(report, context, { root, expectedTree: tree })
  const reviewIt = () => validateReview(review, context, { report, reportSha256: digest(JSON.stringify(report)) })
  return { root, report, review, validate, reviewIt }
}

describe('current request readiness', () => {
  it('validates the actual current request and all actual scoped app contracts', () => expect(validateRequest(context.request, apps).id).toBe('desktop-refinement'))
  it.each(['expected', 'proof'])('rejects a requirement without %s', key => {
    const request = structuredClone(context.request); delete request.requirements[0][key]
    expect(() => validateRequest(request, apps)).toThrow(key)
  })
  it('rejects a missing scenario and an app with no requested dimensions', () => {
    const request = structuredClone(context.request); request.requirements[0].scenarios.push('missing-scenario')
    expect(() => validateRequest(request, apps)).toThrow('unknown missing-scenario')
    expect(() => validateRequest(context.request, { ...apps, chess: { ...apps.chess, preferredWindow: null } })).toThrow('preferred outer window')
  })
  it('requires an independent challenge, current contract hash and complete observations', () => {
    const { review } = fixture()
    expect(validateReview(review, context).verdict).toBe('approve')
    expect(() => validateReview({ ...review, challenges: [] }, context)).toThrow()
    expect(() => validateReview({ ...review, contractsSha256: '0'.repeat(64) }, context)).toThrow('stale app/vision')
    expect(() => validateReview({ ...review, observations: review.observations.slice(1) }, context)).toThrow('missing REF-01')
  })
  it('invalidates review when only normative workflow policy changes', () => {
    const root = temporary()
    cpSync(join(repository, 'experience'), join(root, 'experience'), { recursive: true })
    mkdirSync(join(root, 'docs'), { recursive: true }); cpSync(join(repository, 'docs/experience'), join(root, 'docs/experience'), { recursive: true })
    const before = loadContext(root, 'experience/requests/desktop-refinement.json'), { review } = fixture()
    writeFileSync(join(root, 'docs/experience/WORKFLOW.md'), 'Changed deployment and promotion policy.\n')
    const after = loadContext(root, 'experience/requests/desktop-refinement.json')
    expect(after.requestSha256).toBe(before.requestSha256); expect(after.contractsSha256).not.toBe(before.contractsSha256)
    expect(() => validateReview(review, after)).toThrow('stale app/vision contracts')
  })
})

describe('candidate evidence and independent review', () => {
  it('accepts a complete internally consistent fixture (never a product aesthetic verdict)', () => {
    const f = fixture(); expect(f.validate().candidate.tree).toBe(tree); expect(f.reviewIt().reviewer).toBe(context.request.rollout.reviewer)
  })
  it('rejects missing requirement and scenario coverage', () => {
    const f = fixture(); f.report.requirements.pop(); expect(f.validate).toThrow('requirement coverage: missing')
    const g = fixture(); g.report.scenarios.pop(); expect(g.validate).toThrow('scenario coverage: missing')
  })
  it('rejects a stale source tree in the report or a single capture', () => {
    const f = fixture(); f.report.candidate.tree = 'c'.repeat(40); expect(f.validate).toThrow('exact current/approved source tree')
    const g = fixture(); g.report.artifacts[0].tree = 'c'.repeat(40); expect(g.validate).toThrow('stale/wrong candidate tree')
  })
  it('rehashes bytes, rejecting replaced evidence and stale capture timestamps', () => {
    const f = fixture(); writeFileSync(join(f.root, f.report.artifacts[0].path), 'replaced screenshot'); expect(f.validate).toThrow(/bytes mismatch|checksum mismatch/)
    const g = fixture(); g.report.artifacts[0].capturedAt = ago(200); expect(g.validate).toThrow('outside this evidence run')
  })
  it('rejects path traversal and a symlink outside the evidence repository', () => {
    const f = fixture(), outside = temporary(); writeFileSync(join(outside, 'foreign.txt'), 'foreign')
    const original = f.report.artifacts[0]; symlinkSync(join(outside, 'foreign.txt'), join(f.root, 'escaped.txt')); original.path = 'escaped.txt'
    expect(f.validate).toThrow('escapes repository')
    original.path = '../not-here'; expect(f.validate).toThrow()
  })
  it('rejects CSS/log/file-existence evidence in place of actual viewport and dynamic captures', () => {
    const f = fixture(); const capture = f.report.artifacts.find(a => a.kind === 'viewport'); writeFileSync(join(f.root, capture.path), 'backdrop-filter: blur(12px)'); Object.assign(capture, fileRecord(f.root, capture.path)); expect(f.validate).toThrow('real PNG')
    const g = fixture(); const sequence = g.report.artifacts.find(a => a.kind === 'sequence'); sequence.kind = 'log'; expect(g.validate).toThrow('missing required sequence')
  })
  it('rejects full-page images relabeled as viewport screenshots', () => {
    const f = fixture(), artifact = f.report.artifacts.find(a => a.kind === 'viewport'); artifact.viewport.height -= 1; expect(f.validate).toThrow('full-page capture')
  })
  it('rejects duplicate sequence frames and modified frame checksums', () => {
    const f = fixture(), artifact = f.report.artifacts.find(a => a.kind === 'sequence')
    const sequence = JSON.parse(readFileSync(join(f.root, artifact.path), 'utf8')); sequence.frames[1] = sequence.frames[0]
    writeFileSync(join(f.root, artifact.path), JSON.stringify(sequence)); Object.assign(artifact, fileRecord(f.root, artifact.path)); expect(f.validate).toThrow('visibly different')
    const g = fixture(), other = g.report.artifacts.find(a => a.kind === 'sequence'), frames = JSON.parse(readFileSync(join(g.root, other.path), 'utf8')); frames.frames[0].sha256 = '0'.repeat(64)
    writeFileSync(join(g.root, other.path), JSON.stringify(frames)); Object.assign(other, fileRecord(g.root, other.path)); expect(g.validate).toThrow('checksum mismatch')
  })
  it('rejects failed automation, missing log proof, and uncovered checks', () => {
    const f = fixture(); f.report.automation[0].status = 'failed'; expect(f.validate).toThrow('Automation fixture-checks failed')
    const g = fixture(); g.report.automation[0].artifactIds = [g.report.artifacts.find(a => a.kind === 'viewport').id]; expect(g.validate).toThrow('retained command log')
    const h = fixture(); h.report.automation[0].requirementIds.pop(); expect(h.validate).toThrow('automated requirement coverage')
  })
  it('rejects self-only approval and missing observed artifact references', () => {
    const f = fixture(); f.review.authors.push(f.review.reviewer); expect(f.reviewIt).toThrow('Self-only')
    const g = fixture(); g.review.observations[0].artifactIds = []; expect(g.reviewIt).toThrow('actually inspected artifacts')
  })
  it('requires the independent reviewer to inspect every linked scenario and dynamic proof', () => {
    const f = fixture(), observation = f.review.observations.find(o => o.requirementId === 'MINE-02')
    observation.artifactIds = observation.artifactIds.filter(id => !id.startsWith('mine-expert'))
    expect(f.reviewIt).toThrow('reviewer must inspect mine-expert')
  })
  it('rejects mismatched review report/tree/environment and unresolved major findings', () => {
    const f = fixture(); f.review.reportSha256 = '0'.repeat(64); expect(f.reviewIt).toThrow('frozen evidence report')
    const g = fixture(); g.review.tree = 'f'.repeat(40); expect(g.reviewIt).toThrow('Review tree')
    const h = fixture(); h.review.environment = 'deployed'; expect(h.reviewIt).toThrow('Review environment')
    const i = fixture(); i.review.findings.push({ id: 'occlusion', severity: 'major', status: 'open', description: 'Primary action clipped in requested window.' }); expect(i.reviewIt).toThrow('unresolved major/blocker')
  })
  it('revalidates retained promotion inputs instead of trusting an approved label', () => {
    const f = fixture(); writeFileSync(join(f.root, 'report.json'), JSON.stringify(f.report)); writeFileSync(join(f.root, 'review.json'), JSON.stringify(f.review)); writeFileSync(join(f.root, 'request-review.json'), JSON.stringify({ ...f.review, reviewedAt: ago(180) }))
    const receipt = { schemaVersion: 1, stage: 'promotion', verdict: 'approved', requestId: context.request.id, requestSha256: context.requestSha256, contractsSha256: context.contractsSha256, tree, commit, createdAt: ago(1), inputs: { requestReview: fileRecord(f.root, 'request-review.json'), report: fileRecord(f.root, 'report.json'), review: fileRecord(f.root, 'review.json') } }
    expect(verifyPromotion(f.root, context, receipt).report.candidate.tree).toBe(tree)
    writeFileSync(join(f.root, 'report.json'), '{}'); expect(() => verifyPromotion(f.root, context, receipt)).toThrow('Approved input changed')
  })
})

describe('deployment identity and explicit rollout policy', () => {
  const decision = { decision: 'accept', owner: context.request.rollout.acceptanceOwner, rationale: 'Observed critical journeys pass.', primaryTaskUsable: true, dataRisk: false, widespreadFailure: false, recoveryFailed: false }
  it('requires fresh live evidence after promotion', () => {
    const f = fixture(); expect(() => validateReport(f.report, context, { root: f.root, expectedTree: tree, environment: 'deployed' })).toThrow('Expected deployed evidence')
    f.report.environment.name = 'deployed'; expect(() => validateReport(f.report, context, { root: f.root, expectedTree: tree, environment: 'deployed', after: ago(100) })).toThrow('newly captured after promotion')
  })
  it('rejects wrong live commit and cross-origin identity', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ commit: 'd'.repeat(40) })))
    await expect(probeIdentity(repository, 'https://live.example/api/build-identity', 'https://live.example', commit, tree)).rejects.toThrow('Wrong deployment identity')
    await expect(probeIdentity(repository, 'https://other.example/api/build-identity', 'https://live.example', commit, tree)).rejects.toThrow('share the tested environment origin')
  })
  it('supports a different squash/release commit only when its exact tree matches', async () => {
    const root = temporary()
    execFileSync('git', ['init', '-q', root]); writeFileSync(join(root, 'source.txt'), 'source')
    git(root, ['add', '.']); git(root, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'candidate'])
    const approved = currentCandidate(root, { clean: true })
    git(root, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'squash metadata'])
    const released = currentCandidate(root, { clean: true }); expect(released.commit).not.toBe(approved.commit); expect(released.tree).toBe(approved.tree)
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(released)))
    await expect(probeIdentity(root, 'https://live.example/api/build-identity', 'https://live.example', released.commit, approved.tree)).resolves.toMatchObject({ tree: approved.tree })
    await expect(probeIdentity(root, 'https://live.example/api/build-identity', 'https://live.example', released.commit, '0'.repeat(40))).rejects.toThrow('tree differs')
    writeFileSync(join(root, 'source.txt'), 'unreviewed edit'); expect(() => currentCandidate(root, { clean: true })).toThrow('clean committed source tree')
  })
  it('rejects a stale native asset bundle even when the deployment commit matches', async () => {
    const root = temporary(), nativeAssets = {}
    execFileSync('git', ['init', '-q', root]); mkdirSync(join(root, 'public/vendor/space-cadet'), { recursive: true })
    for (const extension of ['js', 'wasm', 'data']) { const path = `public/vendor/space-cadet/SpaceCadetPinball.${extension}`; writeFileSync(join(root, path), `fixture-${extension}`); nativeAssets[path] = digest(`fixture-${extension}`) }
    git(root, ['add', '.']); git(root, ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'native candidate'])
    const candidate = currentCandidate(root, { clean: true })
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ...candidate, nativeAssets })))
    await expect(probeIdentity(root, 'https://live.example/api/build-identity', 'https://live.example', candidate.commit, candidate.tree)).resolves.toHaveProperty('nativeAssets')
    nativeAssets['public/vendor/space-cadet/SpaceCadetPinball.data'] = '0'.repeat(64)
    await expect(probeIdentity(root, 'https://live.example/api/build-identity', 'https://live.example', candidate.commit, candidate.tree)).rejects.toThrow('Wrong native build identity')
  })
  it('accepts only passed runs; hotfix remains unaccepted and needs an owned follow-up', () => {
    const f = fixture(); expect(validateDecision(decision, context, f.report, f.review).decision).toBe('accept')
    f.report.requirements[0].status = 'failed'
    expect(() => validateDecision(decision, context, f.report, f.review)).toThrow('Accept is blocked')
    expect(() => validateDecision({ ...decision, decision: 'hotfix' }, context, f.report, f.review)).toThrow('linked follow-up')
    expect(validateDecision({ ...decision, decision: 'hotfix', issueRequest: 'experience/requests/fix-isolated-defect.json' }, context, f.report, f.review).decision).toBe('hotfix')
    expect(() => validateDecision({ ...decision, decision: 'hotfix', primaryTaskUsable: false, issueRequest: 'fix' }, context, f.report, f.review)).toThrow('Rollback required')
    f.review.findings.push({ id: 'broken-primary', severity: 'blocker', status: 'open', description: 'Primary task cannot be completed.' })
    expect(() => validateDecision({ ...decision, decision: 'hotfix', issueRequest: 'fix' }, context, f.report, f.review)).toThrow('Rollback required')
  })
  it('requires the known-good target and verified rollback smoke', () => {
    const f = fixture()
    expect(() => validateDecision({ ...decision, decision: 'rollback', rollbackCommit: commit }, context, f.report, f.review)).toThrow('known-good')
    expect(() => validateDecision({ ...decision, decision: 'rollback', rollbackCommit: context.request.rollout.rollbackCommit }, context, f.report, f.review)).toThrow('newly verified live smoke')
  })
  it('validates actual rollback smoke and rejects missing app coverage or self-review', () => {
    const f = fixture(), rollback = {
      schemaVersion: 1, requestId: context.request.id, candidate: { commit: context.request.rollout.rollbackCommit, tree }, author: 'root',
      startedAt: f.report.startedAt, finishedAt: f.report.finishedAt, identityUrl: 'https://live.example/api/build-identity',
      environment: { name: 'rollback', url: 'https://live.example' }, artifacts: f.report.artifacts.map(a => ({ ...a, environment: 'rollback' })),
      checks: context.request.scope.filter(app => app !== 'process').map(app => {
        const scenario = context.request.scenarios.find(s => s.app === app && s.artifacts.includes('sequence'))
        return { app, scenarioId: scenario.id, status: 'passed', command: 'primary-task smoke', observed: 'Primary interaction succeeds on the prior release.', artifactIds: f.report.artifacts.filter(a => a.scenarioId === scenario.id).map(a => a.id) }
      }),
    }
    const review = { reviewer: context.request.rollout.reviewer, verdict: 'approve', reviewedAt: ago(10), reportSha256: 'f'.repeat(64), findings: [], observations: rollback.checks.map(c => ({ scenarioId: c.scenarioId, note: 'Observed actual rolled-back primary interaction.', artifactIds: c.artifactIds })) }
    const validate = () => validateRollback(rollback, review, context, { root: f.root, failedRun: { finishedAt: ago(200) }, reportSha256: 'f'.repeat(64) })
    expect(validate().candidate.commit).toBe(context.request.rollout.rollbackCommit)
    review.reviewer = 'root'; expect(validate).toThrow('independent approval'); review.reviewer = context.request.rollout.reviewer
    rollback.checks.pop(); expect(validate).toThrow('rollback primary app smoke coverage')
  })
})
