/* eslint-disable security/detect-non-literal-fs-filename -- All evidence reads resolve inside the explicitly selected repository root. */
import { createHash } from 'node:crypto'
import { readFileSync, realpathSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { inflateSync } from 'node:zlib'
import { z } from 'zod'

const text = z.string().trim().min(1)
const sha = z.string().regex(/^[a-f0-9]{64}$/)
const gitId = z.string().regex(/^[a-f0-9]{40,64}$/)
const timestamp = z.string().datetime({ offset: true })
const viewport = z.object({ width: z.number().int().positive(), height: z.number().int().positive() })
const strings = z.array(text).min(1)
const kinds = ['viewport', 'sequence', 'video', 'log']
const finding = z.object({ id: text, severity: z.enum(['minor', 'major', 'blocker']), status: z.enum(['open', 'resolved']), description: text, resolution: text.optional() })

export function assert(condition, message) { if (!condition) throw new Error(message) }
export function digest(bytes) { return createHash('sha256').update(bytes).digest('hex') }
export function parse(schema, value, label) {
  const result = schema.safeParse(value)
  assert(result.success, `${label}: ${result.success ? '' : result.error.issues.map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ')}`)
  return result.data
}
export function containedFile(root, path) {
  assert(typeof path === 'string' && path.length > 0 && !isAbsolute(path), `Evidence path must be relative to repository: ${path}`)
  const absolute = realpathSync(resolve(root, path))
  const rel = relative(realpathSync(root), absolute)
  assert(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), `Evidence path escapes repository: ${path}`)
  assert(statSync(absolute).isFile(), `Evidence is not a regular file: ${path}`)
  return absolute
}
export function fileRecord(root, path) {
  const absolute = containedFile(root, path)
  const bytes = readFileSync(absolute)
  return { path, sha256: digest(bytes), bytes: bytes.length }
}
export function readJson(root, path) {
  try { return JSON.parse(readFileSync(containedFile(root, path), 'utf8')) }
  catch (error) { throw new Error(`Cannot read ${path}: ${error.message}`) }
}
function unique(items, label) {
  const ids = items.map(item => typeof item === 'string' ? item : item.id)
  assert(new Set(ids).size === ids.length, `${label}: duplicate IDs`)
}
function covers(actual, required, label) {
  for (const id of required) assert(actual.includes(id), `${label}: missing ${id}`)
}
function known(actual, valid, label) {
  for (const id of actual) assert(valid.includes(id), `${label}: unknown ${id}`)
}

const requestSchema = z.object({
  schemaVersion: z.literal(1), id: text, title: text,
  source: z.object({ date: text, requestor: text, summary: text }),
  baseline: z.object({ commit: gitId, url: z.string().url() }),
  scope: strings, outOfScope: strings,
  references: z.array(z.object({ url: z.string().url(), adopt: text, reject: text })).min(1),
  requirements: z.array(z.object({ id: text, app: text, title: text, expected: text, proof: z.enum(['visual', 'geometry', 'interaction', 'dynamic', 'process']), severity: z.enum(['minor', 'major', 'blocker']), scenarios: strings })).min(1),
  scenarios: z.array(z.object({ id: text, app: text, viewport, window: text, initialState: text, actions: strings, expected: strings, artifacts: z.array(z.enum(kinds)).min(1), critical: z.boolean() })).min(1),
  risks: z.array(z.object({ risk: text, resolution: text })).min(1),
  rollout: z.object({ target: text, requiredGates: strings, rollbackCommit: gitId, rollbackTriggers: strings, hotfixPolicy: text, acceptanceOwner: text, reviewer: text }),
})
const appSchema = z.object({
  schemaVersion: z.literal(1), id: text, vision: text, request: text, route: text,
  preferredWindow: viewport.nullable(), scrollOwners: z.array(text), requiredControls: strings, states: strings, forbidden: strings,
})

export function validateRequest(value, apps) {
  const request = parse(requestSchema, value, 'request')
  unique(request.requirements, 'requirements'); unique(request.scenarios, 'scenarios'); unique(request.scope, 'scope')
  const scenarioIds = request.scenarios.map(s => s.id)
  const linked = new Set()
  for (const requirement of request.requirements) {
    assert(requirement.app === 'all' || request.scope.includes(requirement.app), `${requirement.id}: app is outside scope`)
    known(requirement.scenarios, scenarioIds, requirement.id)
    for (const id of requirement.scenarios) linked.add(id)
    if (['dynamic', 'interaction'].includes(requirement.proof)) {
      assert(requirement.scenarios.some(id => request.scenarios.find(s => s.id === id).artifacts.some(kind => ['sequence', 'video'].includes(kind))), `${requirement.id}: dynamic/interaction proof needs a sequence or video scenario`)
    }
  }
  for (const scenario of request.scenarios) {
    assert(linked.has(scenario.id), `Scenario ${scenario.id} has no accountable requirement`)
    assert(scenario.app === 'all' || request.scope.includes(scenario.app), `${scenario.id}: app is outside scope`)
  }
  covers(request.rollout.requiredGates, ['request', 'promotion', 'deployed'], 'rollout.requiredGates')
  for (const id of request.scope.filter(id => id !== 'process')) {
    const app = parse(appSchema, apps[id], `app ${id}`)
    assert(app.id === id && app.request === request.id, `app ${id}: wrong identity or request`)
    assert(app.vision === 'docs/experience/VISION.md', `app ${id}: wrong vision authority`)
    assert(id === 'desktop' || app.preferredWindow !== null, `app ${id}: preferred outer window dimensions required`)
  }
  return request
}

export function loadContext(root, requestPath) {
  const raw = readJson(root, requestPath)
  assert(Array.isArray(raw.scope), 'request.scope must be an array')
  const appPaths = raw.scope.filter(id => id !== 'process').map(id => {
    assert(/^[a-z0-9-]+$/.test(id), `Invalid app ID: ${id}`)
    return `experience/apps/${id}.json`
  })
  const paths = ['docs/experience/VISION.md', 'docs/experience/WORKFLOW.md', ...appPaths]
  const apps = Object.fromEntries(appPaths.map(path => { const app = readJson(root, path); return [app.id, app] }))
  return {
    request: validateRequest(raw, apps), requestPath,
    requestSha256: fileRecord(root, requestPath).sha256,
    contractsSha256: digest(JSON.stringify(paths.sort().map(path => fileRecord(root, path)))),
  }
}

const reviewSchema = z.object({
  schemaVersion: z.literal(1), requestId: text, requestSha256: sha, contractsSha256: sha,
  reviewer: text, authors: strings, reviewedAt: timestamp, verdict: z.enum(['approve', 'reject']),
  findings: z.array(finding),
  observations: z.array(z.object({ requirementId: text, note: text, artifactIds: z.array(text).optional() })).min(1),
  challenges: strings.optional(), tree: gitId.optional(), environment: text.optional(), reportSha256: sha.optional(), referenceComparison: text.optional(),
})
function validateIdentity(value, context, label) {
  assert(value.requestId === context.request.id, `${label}: wrong request ID`)
  assert(value.requestSha256 === context.requestSha256, `${label}: stale request checksum`)
  assert(value.contractsSha256 === context.contractsSha256, `${label}: stale app/vision contracts checksum`)
}
function validateFindings(findings) {
  unique(findings, 'findings')
  for (const finding of findings) if (finding.status === 'resolved') assert(finding.resolution?.trim(), `${finding.id}: resolved finding needs a resolution`)
}
function approved(review) {
  assert(review.verdict === 'approve', 'Independent review did not approve')
  assert(!review.findings.some(f => f.status === 'open' && ['major', 'blocker'].includes(f.severity)), 'Independent review has an unresolved major/blocker finding')
}
export function validateReview(value, context, { report, reportSha256, requireApproval = true } = {}) {
  const review = parse(reviewSchema, value, 'review')
  validateIdentity(review, context, 'review')
  assert(!review.authors.includes(review.reviewer), 'Self-only review: reviewer must be independent of authors')
  assert(review.reviewer === context.request.rollout.reviewer, 'Review must identify the request’s accountable independent reviewer')
  assert(Date.parse(review.reviewedAt) <= Date.now() + 60_000, 'Review timestamp is in the future')
  validateFindings(review.findings)
  unique(review.observations.map(o => o.requirementId), 'review observations')
  covers(review.observations.map(o => o.requirementId), context.request.requirements.map(r => r.id), 'review observations')
  known(review.observations.map(o => o.requirementId), context.request.requirements.map(r => r.id), 'review observations')
  if (report) {
    assert(review.authors.includes(report.author), 'Review authors must include the implementation author')
    assert(review.tree === report.candidate.tree, 'Review tree differs from candidate tree')
    assert(review.environment === report.environment.name, 'Review environment differs from evidence environment')
    assert(review.reportSha256 === reportSha256, 'Review checksum differs from the frozen evidence report')
    assert(Date.parse(review.reviewedAt) >= Date.parse(report.finishedAt), 'Review predates the completed evidence report')
    assert(review.referenceComparison?.trim(), 'Visual review needs observed reference comparison')
    for (const observation of review.observations) {
      const requirement = report.requirements.find(r => r.id === observation.requirementId)
      assert(observation.artifactIds?.length, `${observation.requirementId}: reviewer must name actually inspected artifacts`)
      known(observation.artifactIds, requirement.artifactIds, `${observation.requirementId} review artifact`)
      const contract = context.request.requirements.find(r => r.id === observation.requirementId)
      for (const scenarioId of contract.scenarios) {
        const scenario = context.request.scenarios.find(s => s.id === scenarioId)
        const inspected = observation.artifactIds.map(id => report.artifacts.find(a => a.id === id)).filter(a => a.scenarioId === scenarioId)
        for (const kind of scenario.artifacts) assert(inspected.some(a => a.kind === kind || (kind === 'sequence' && a.kind === 'video')), `${contract.id}: reviewer must inspect ${scenarioId} ${kind} evidence`)
      }
      if (contract.proof !== 'process') assert(observation.artifactIds.some(id => ['viewport', 'sequence', 'video'].includes(report.artifacts.find(a => a.id === id).kind)), `${contract.id}: visual observation must cite rendered evidence`)
      if (['interaction', 'dynamic'].includes(contract.proof)) assert(observation.artifactIds.some(id => ['sequence', 'video'].includes(report.artifacts.find(a => a.id === id).kind)), `${contract.id}: reviewer must inspect dynamic evidence`)
    }
  } else assert(review.challenges?.length, 'Request review must record completeness challenges and their disposition')
  if (requireApproval) approved(review)
  return review
}

const artifactSchema = z.object({
  id: text, scenarioId: text, kind: z.enum(kinds), path: text, sha256: sha, bytes: z.number().int().positive(),
  capturedAt: timestamp, tree: gitId, environment: text, viewport, window: text, state: text,
  capture: z.object({ path: text, sha256: sha, bytes: z.number().int().positive() }).optional(),
})
const captureSchema = z.object({
  scenarioId: text, state: text, window: text, viewport, capturedAt: timestamp, url: z.string().url(), sha256: sha,
  identity: z.object({ commit: gitId, tree: gitId.nullable(), nativeAssets: z.record(z.string(), sha) }),
})
export function validateCaptureMetadata(value, report, artifact) {
  const capture = parse(captureSchema, value, 'Playwright capture metadata')
  assert(capture.identity.commit === report.candidate.commit, 'Playwright capture belongs to a different candidate commit')
  assert(capture.identity.tree === null || capture.identity.tree === report.candidate.tree, 'Playwright capture belongs to a different candidate tree')
  assert(new URL(capture.url).origin === new URL(report.environment.url).origin, 'Playwright capture URL differs from the report environment origin')
  assert(Date.parse(capture.capturedAt) >= Date.parse(report.startedAt) && Date.parse(capture.capturedAt) <= Date.now() + 60_000, 'Playwright capture timestamp is stale or in the future')
  if (artifact) {
    for (const key of ['scenarioId', 'state', 'window', 'capturedAt', 'sha256']) assert(capture[key] === artifact[key], `Playwright capture metadata differs from artifact ${key}`)
    assert(capture.viewport.width === artifact.viewport.width && capture.viewport.height === artifact.viewport.height, 'Playwright capture metadata differs from artifact viewport')
  }
  return capture
}
const reportSchema = z.object({
  schemaVersion: z.literal(1), requestId: text, requestSha256: sha, contractsSha256: sha,
  candidate: z.object({ commit: gitId, tree: gitId }), author: text, startedAt: timestamp, finishedAt: timestamp,
  environment: z.object({ name: z.enum(['candidate', 'deployed', 'rollback']), url: z.string().url(), configuration: z.record(z.string(), z.unknown()) }),
  artifacts: z.array(artifactSchema).min(1),
  automation: z.array(z.object({ id: text, command: text, status: z.enum(['passed', 'failed']), artifactIds: strings, requirementIds: strings, scenarioIds: strings })).min(1),
  requirements: z.array(z.object({ id: text, status: z.enum(['passed', 'failed']), scenarioIds: strings, artifactIds: strings })).min(1),
  scenarios: z.array(z.object({ id: text, status: z.enum(['passed', 'failed']), artifactIds: strings, observed: text })).min(1),
  deployment: z.object({ commit: gitId, identityUrl: z.string().url(), identityVerifiedAt: timestamp }).optional(),
})
function checkFile(root, record) {
  const actual = fileRecord(root, record.path)
  assert(actual.bytes > 0 && actual.bytes === record.bytes, `Artifact bytes mismatch: ${record.path}`)
  assert(actual.sha256 === record.sha256, `Artifact checksum mismatch: ${record.path}`)
  return readFileSync(containedFile(root, record.path))
}
export function checkPng(bytes, size, path) {
  assert(bytes.length > 44 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR' && bytes.toString('ascii', bytes.length - 8, bytes.length - 4) === 'IEND', `Viewport must be a real PNG image: ${path}`)
  assert(bytes.readUInt32BE(16) === size.width && bytes.readUInt32BE(20) === size.height, `Viewport PNG dimensions do not match declared viewport (full-page capture is not viewport proof): ${path}`)
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[bytes[25]]
  assert(bytes[24] === 8 && bytes[28] === 0 && channels, `Viewport PNG must use standard non-interlaced 8-bit browser capture encoding: ${path}`)
  const compressed = []
  for (let offset = 8; offset < bytes.length;) {
    assert(offset + 12 <= bytes.length, `Invalid PNG chunk: ${path}`)
    const length = bytes.readUInt32BE(offset)
    assert(offset + length + 12 <= bytes.length, `Truncated PNG chunk: ${path}`)
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT') compressed.push(bytes.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  assert(compressed.length, `Viewport PNG has no image data: ${path}`)
  const decodedLength = (size.width * channels + 1) * size.height
  assert(decodedLength <= 128 * 1024 * 1024, `Viewport PNG exceeds bounded capture size: ${path}`)
  assert(inflateSync(Buffer.concat(compressed), { maxOutputLength: decodedLength }).length === decodedLength, `Viewport PNG pixel data does not match dimensions: ${path}`)
}
const sequenceSchema = z.object({
  frames: z.array(z.object({ path: text, sha256: sha, bytes: z.number().int().positive(), capturedAt: timestamp, state: text })).min(2),
  actions: z.array(z.object({ action: text, observed: text })).min(1),
})
function checkArtifact(root, artifact, report) {
  const label = `Artifact ${artifact.id}`
  assert(artifact.tree === report.candidate.tree, `${label}: stale/wrong candidate tree`)
  assert(artifact.environment === report.environment.name, `${label}: wrong environment`)
  const start = Date.parse(report.startedAt), end = Date.parse(report.finishedAt)
  assert(Date.parse(artifact.capturedAt) >= start && Date.parse(artifact.capturedAt) <= end, `${label}: capture is outside this evidence run`)
  const bytes = checkFile(root, artifact)
  if (artifact.capture) validateCaptureMetadata(JSON.parse(checkFile(root, artifact.capture).toString('utf8')), report, artifact)
  if (artifact.kind === 'viewport') checkPng(bytes, artifact.viewport, artifact.path)
  if (artifact.kind === 'video') {
    assert(bytes.length > 1024 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) && bytes.subarray(0, 512).includes(Buffer.from('webm')), `${label}: video must be a real WebM recording`)
  }
  if (artifact.kind === 'sequence') {
    const sequence = parse(sequenceSchema, JSON.parse(bytes.toString('utf8')), `${label} sequence`)
    assert(new Set(sequence.frames.map(f => f.sha256)).size >= 2, `${label}: dynamic sequence needs visibly different frame captures`)
    let previous = start
    for (const frame of sequence.frames) {
      checkPng(checkFile(root, frame), artifact.viewport, frame.path)
      const time = Date.parse(frame.capturedAt)
      assert(time >= previous && time <= end, `${label}: frame timestamps are stale or out of order`)
      previous = time
    }
  }
}

export function validateReport(value, context, { root, expectedTree, environment = 'candidate', requirePassed = true, after } = {}) {
  const report = parse(reportSchema, value, 'evidence report')
  validateIdentity(report, context, 'evidence report')
  assert(report.environment.name === environment, `Expected ${environment} evidence, received ${report.environment.name}`)
  assert(report.candidate.tree === expectedTree, 'Candidate tree differs from exact current/approved source tree')
  const start = Date.parse(report.startedAt), end = Date.parse(report.finishedAt)
  assert(start <= end && end <= Date.now() + 60_000, 'Evidence run timestamps are invalid/future')
  if (after) assert(start > Date.parse(after), 'Deployed evidence must be newly captured after promotion')
  for (const field of ['artifacts', 'automation', 'requirements', 'scenarios']) unique(report[field], field)
  const requiredIds = context.request.requirements.map(r => r.id), scenarioIds = context.request.scenarios.map(s => s.id), artifactIds = report.artifacts.map(a => a.id)
  covers(report.requirements.map(r => r.id), requiredIds, 'requirement coverage')
  covers(report.scenarios.map(s => s.id), scenarioIds, 'scenario coverage')
  known(report.requirements.map(r => r.id), requiredIds, 'requirement coverage')
  known(report.scenarios.map(s => s.id), scenarioIds, 'scenario coverage')
  for (const artifact of report.artifacts) {
    known([artifact.scenarioId], scenarioIds, `Artifact ${artifact.id}`)
    checkArtifact(root, artifact, report)
  }
  for (const scenario of context.request.scenarios) {
    const result = report.scenarios.find(s => s.id === scenario.id)
    if (requirePassed) assert(result.status === 'passed', `Scenario ${scenario.id} did not pass`)
    known(result.artifactIds, artifactIds, scenario.id)
    const artifacts = result.artifactIds.map(id => report.artifacts.find(a => a.id === id))
    assert(artifacts.every(a => a.scenarioId === scenario.id), `${scenario.id}: cross-scenario artifacts cannot substitute for evidence`)
    for (const kind of scenario.artifacts) assert(artifacts.some(a => a.kind === kind || (kind === 'sequence' && a.kind === 'video')), `${scenario.id}: missing required ${kind} evidence`)
    if (scenario.artifacts.includes('viewport')) assert(artifacts.some(a => a.kind === 'viewport' && a.viewport.width === scenario.viewport.width && a.viewport.height === scenario.viewport.height), `${scenario.id}: missing actual requested viewport capture`)
  }
  for (const requirement of context.request.requirements) {
    const result = report.requirements.find(r => r.id === requirement.id)
    if (requirePassed) assert(result.status === 'passed', `Requirement ${requirement.id} did not pass`)
    covers(result.scenarioIds, requirement.scenarios, `${requirement.id} scenario coverage`)
    known(result.scenarioIds, scenarioIds, requirement.id)
    known(result.artifactIds, artifactIds, requirement.id)
    for (const id of requirement.scenarios) assert(result.artifactIds.some(a => report.artifacts.find(artifact => artifact.id === a).scenarioId === id), `${requirement.id}: missing evidence for ${id}`)
    if (requirePassed) for (const id of requirement.scenarios) assert(report.scenarios.find(s => s.id === id).status === 'passed', `${requirement.id}: linked scenario ${id} failed`)
  }
  for (const check of report.automation) {
    if (requirePassed) assert(check.status === 'passed', `Automation ${check.id} failed`)
    known(check.artifactIds, artifactIds, check.id); known(check.requirementIds, requiredIds, check.id); known(check.scenarioIds, scenarioIds, check.id)
    assert(check.artifactIds.some(id => report.artifacts.find(a => a.id === id).kind === 'log'), `Automation ${check.id}: retained command log required`)
  }
  covers(report.automation.flatMap(check => check.requirementIds), requiredIds, 'automated requirement coverage')
  covers(report.automation.flatMap(check => check.scenarioIds), scenarioIds, 'automated scenario coverage')
  return report
}

const decisionSchema = z.object({
  decision: z.enum(['accept', 'hotfix', 'rollback']), owner: text, rationale: text,
  primaryTaskUsable: z.boolean(), dataRisk: z.boolean(), widespreadFailure: z.boolean(), recoveryFailed: z.boolean(),
  issueRequest: text.optional(), rollbackCommit: gitId.optional(), rollbackReport: text.optional(), rollbackReview: text.optional(),
})
export function validateDecision(value, context, report, review) {
  const decision = parse(decisionSchema, value, 'deployment decision')
  assert(decision.owner === context.request.rollout.acceptanceOwner, 'Decision owner differs from accountable acceptance owner')
  const catastrophic = !decision.primaryTaskUsable || decision.dataRisk || decision.widespreadFailure || decision.recoveryFailed || review.findings.some(f => f.status === 'open' && f.severity === 'blocker')
  const failed = report.requirements.some(r => r.status !== 'passed') || report.scenarios.some(s => s.status !== 'passed') || report.automation.some(c => c.status !== 'passed')
  const unresolved = review.findings.some(f => f.status === 'open' && ['major', 'blocker'].includes(f.severity))
  if (decision.decision === 'accept') {
    assert(!catastrophic && !failed && !unresolved, 'Accept is blocked by failed checks, unresolved major findings, or rollback triggers')
    approved(review)
  } else if (decision.decision === 'hotfix') {
    assert(!catastrophic, 'Rollback required: primary interaction/data/recovery policy forbids hotfix')
    assert(failed || unresolved, 'Hotfix requires a concrete failed check or unresolved finding')
    assert(decision.issueRequest && decision.issueRequest !== context.request.id, 'Hotfix needs a linked follow-up request')
  } else {
    assert(decision.rollbackCommit === context.request.rollout.rollbackCommit, 'Rollback target differs from the recorded known-good release')
    assert(decision.rollbackReport && decision.rollbackReview, 'Rollback requires newly verified live smoke evidence and independent review')
  }
  return decision
}

export function validateRollback(value, review, context, { root, failedRun, reportSha256 }) {
  const schema = z.object({
    schemaVersion: z.literal(1), requestId: text, candidate: z.object({ commit: gitId, tree: gitId }),
    author: text, startedAt: timestamp, finishedAt: timestamp, identityUrl: z.string().url(),
    environment: z.object({ name: z.literal('rollback'), url: z.string().url() }),
    artifacts: z.array(artifactSchema).min(1),
    checks: z.array(z.object({ app: text, scenarioId: text, status: z.literal('passed'), command: text, observed: text, artifactIds: strings })).min(1),
  })
  const rollback = parse(schema, value, 'rollback smoke')
  assert(rollback.requestId === context.request.id && rollback.candidate.commit === context.request.rollout.rollbackCommit, 'Rollback smoke must identify this request and the known-good target')
  assert(Date.parse(rollback.startedAt) > Date.parse(failedRun.finishedAt) && Date.parse(rollback.finishedAt) >= Date.parse(rollback.startedAt) && Date.parse(rollback.finishedAt) <= Date.now() + 60_000, 'Rollback smoke must be a new completed live run after the failed deployment')
  unique(rollback.artifacts, 'rollback artifacts')
  for (const artifact of rollback.artifacts) checkArtifact(root, artifact, rollback)
  for (const check of rollback.checks) {
    assert(context.request.scenarios.some(s => s.id === check.scenarioId && s.app === check.app), `Rollback ${check.app}: unknown smoke scenario`)
    known(check.artifactIds, rollback.artifacts.map(a => a.id), `rollback ${check.app}`)
    const artifacts = check.artifactIds.map(id => rollback.artifacts.find(a => a.id === id))
    assert(artifacts.every(a => a.scenarioId === check.scenarioId), `Rollback ${check.app}: evidence belongs to a different smoke scenario`)
    assert(artifacts.some(a => a.kind === 'log') && artifacts.some(a => ['sequence', 'video'].includes(a.kind)), `Rollback ${check.app}: retain automation log and dynamic primary-task evidence`)
  }
  covers(rollback.checks.map(c => c.app), context.request.scope.filter(app => app !== 'process'), 'rollback primary app smoke coverage')
  assert(review.reviewer === context.request.rollout.reviewer && review.reviewer !== rollback.author && review.verdict === 'approve', 'Rollback needs independent approval')
  assert(review.reportSha256 === reportSha256 && Date.parse(review.reviewedAt) >= Date.parse(rollback.finishedAt), 'Rollback review must bind the completed smoke report')
  assert(Array.isArray(review.observations), 'Rollback review needs actual observations')
  for (const check of rollback.checks) assert(review.observations.some(o => o.scenarioId === check.scenarioId && o.note?.trim() && Array.isArray(o.artifactIds) && check.artifactIds.every(id => o.artifactIds.includes(id))), `Rollback review must observe smoke artifacts for ${check.scenarioId}`)
  assert(Array.isArray(review.findings), 'Rollback review must list findings')
  validateFindings(parse(z.array(finding), review.findings, 'rollback findings')); approved(review)
  return rollback
}
