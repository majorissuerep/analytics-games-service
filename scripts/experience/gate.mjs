#!/usr/bin/env node
import { pathToFileURL } from 'node:url'
import { assert, currentExperience, fileRecord, loadContext, readJson, validateDecision, validateReport, validateReview, validateRollback } from './contracts.mjs'
import { currentCandidate, options, probeIdentity, required, writeJson } from './runtime.mjs'

export function checkedInput(root, record) {
  assert(record?.path && record?.sha256, 'Promotion receipt is missing an input path/checksum')
  assert(fileRecord(root, record.path).sha256 === record.sha256, `Approved input changed: ${record.path}`)
  return readJson(root, record.path)
}
export function verifyPromotion(root, context, receipt) {
  assert(receipt.schemaVersion === 1 && receipt.stage === 'promotion' && receipt.verdict === 'approved', 'Deployment needs an approved promotion receipt')
  assert(receipt.requestId === context.request.id && receipt.requestSha256 === context.requestSha256 && receipt.contractsSha256 === context.contractsSha256, 'Promotion receipt request/contracts mismatch')
  const requestReview = checkedInput(root, receipt.inputs.requestReview)
  const readiness = validateReview(requestReview, context)
  const report = validateReport(checkedInput(root, receipt.inputs.report), context, { root, expectedTree: receipt.tree })
  assert(Date.parse(readiness.reviewedAt) <= Date.parse(report.startedAt), 'Request readiness review must precede candidate evidence collection')
  const review = validateReview(checkedInput(root, receipt.inputs.review), context, { report, reportSha256: receipt.inputs.report.sha256 })
  assert(receipt.commit === report.candidate.commit, 'Promotion receipt commit mismatch')
  assert(Date.parse(receipt.createdAt) >= Date.parse(review.reviewedAt), 'Promotion receipt predates independent review')
  return { report, review }
}

export async function runGate(argv) {
  const { command, flags, root } = options(argv)
  const context = loadContext(root, flags.request)
  if (command === 'contracts') return { stage: 'contracts', verdict: 'valid', requestId: context.request.id, requestSha256: context.requestSha256, contractsSha256: context.contractsSha256 }
  if (command === 'request') {
    const review = validateReview(readJson(root, flags.review ?? currentExperience(root).review), context)
    return { stage: 'request', verdict: 'ready', requestId: context.request.id, reviewer: review.reviewer }
  }
  if (command === 'promotion') {
    const candidate = currentCandidate(root, { clean: true })
    const requestReviewPath = required(flags, 'request-review')
    const readiness = validateReview(readJson(root, requestReviewPath), context)
    const reportPath = required(flags, 'report'), reviewPath = required(flags, 'review')
    const report = validateReport(readJson(root, reportPath), context, { root, expectedTree: candidate.tree })
    assert(Date.parse(readiness.reviewedAt) <= Date.parse(report.startedAt), 'Request readiness review must precede candidate evidence collection')
    assert(report.candidate.commit === candidate.commit, 'Candidate report commit differs from frozen HEAD')
    const review = validateReview(readJson(root, reviewPath), context, { report, reportSha256: fileRecord(root, reportPath).sha256 })
    const identity = await probeIdentity(root, flags['identity-url'] ?? new URL('/api/build-identity', report.environment.url).href, report.environment.url, candidate.commit, candidate.tree)
    const receipt = {
      schemaVersion: 1, stage: 'promotion', verdict: 'approved', requestId: context.request.id,
      requestSha256: context.requestSha256, contractsSha256: context.contractsSha256,
      ...candidate, createdAt: new Date().toISOString(), reviewer: review.reviewer, identity,
      inputs: { requestReview: fileRecord(root, requestReviewPath), report: fileRecord(root, reportPath), review: fileRecord(root, reviewPath) },
    }
    writeJson(root, required(flags, 'out'), receipt)
    return receipt
  }
  if (command === 'deployed') {
    const promotionPath = required(flags, 'promotion'), promotion = readJson(root, promotionPath)
    verifyPromotion(root, context, promotion)
    const reportPath = required(flags, 'report'), reviewPath = required(flags, 'review')
    const report = validateReport(readJson(root, reportPath), context, { root, expectedTree: promotion.tree, environment: 'deployed', requirePassed: false, after: promotion.createdAt })
    assert(report.deployment, 'Deployed evidence needs a verified build identity')
    assert(report.deployment.commit === report.candidate.commit, 'Deployment identity commit differs from evidence commit')
    assert(Date.parse(report.deployment.identityVerifiedAt) >= Date.parse(promotion.createdAt) && Date.parse(report.deployment.identityVerifiedAt) <= Date.parse(report.startedAt), 'Verify live identity after promotion and before collecting deployed evidence')
    const identity = await probeIdentity(root, report.deployment.identityUrl, report.environment.url, report.deployment.commit, promotion.tree)
    const review = validateReview(readJson(root, reviewPath), context, { report, reportSha256: fileRecord(root, reportPath).sha256, requireApproval: false })
    const decisionPath = required(flags, 'decision'), decision = validateDecision(readJson(root, decisionPath), context, report, review)
    if (decision.decision === 'hotfix') {
      const followup = readJson(root, decision.issueRequest)
      assert(followup.id && followup.id !== context.request.id && followup.parentRequest === context.request.id && followup.owner === decision.owner, 'Hotfix follow-up must name its distinct ID, parent request and accountable owner')
      assert(Array.isArray(followup.scenarios) && followup.scenarios.length && followup.scenarios.every(id => context.request.scenarios.some(s => s.id === id)), 'Hotfix follow-up must name the affected scenarios to repeat')
      assert(followup.expected?.trim() && followup.defect?.trim(), 'Hotfix follow-up must describe the observed defect and expected correction')
      assert(report.scenarios.filter(s => s.status === 'failed').every(s => followup.scenarios.includes(s.id)), 'Hotfix follow-up must cover every failed deployed scenario')
    }
    if (decision.decision === 'rollback') {
      // A rollback verifies the previous release's declared smoke checks, not the new visual contract.
      const rollback = validateRollback(readJson(root, decision.rollbackReport), readJson(root, decision.rollbackReview), context, { root, failedRun: report, reportSha256: fileRecord(root, decision.rollbackReport).sha256 })
      await probeIdentity(root, rollback.identityUrl, rollback.environment.url, rollback.candidate.commit, rollback.candidate.tree)
    }
    const receipt = {
      schemaVersion: 1, stage: 'deployed', decision: decision.decision, accepted: decision.decision === 'accept',
      requestId: context.request.id, tree: promotion.tree, commit: report.deployment.commit,
      createdAt: new Date().toISOString(), owner: decision.owner, rationale: decision.rationale, identity,
      inputs: { promotion: fileRecord(root, promotionPath), report: fileRecord(root, reportPath), review: fileRecord(root, reviewPath), decision: fileRecord(root, decisionPath) },
    }
    writeJson(root, required(flags, 'out'), receipt)
    return receipt
  }
  throw new Error('Usage: experience:gate -- contracts|request|promotion|deployed --request PATH [--review PATH --report PATH --out PATH]; see scripts/experience/README.md')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await runGate(process.argv.slice(2)), null, 2)) }
  catch (error) { console.error(`Experience gate rejected: ${error.message}`); process.exitCode = 1 }
}
