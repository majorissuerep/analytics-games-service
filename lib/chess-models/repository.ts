import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { pool } from '@/lib/db/index'
import { BUILTIN_STOCKFISH, type ChessModelSubmission, type PublicChessModel } from './contracts'

function hashReceipt(receipt: string) {
  return createHash('sha256').update(receipt).digest('hex')
}

export function isAdminRequest(request: Request) {
  const expected = process.env.CHESS_MODEL_ADMIN_TOKEN
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!expected || !supplied) return false
  const left = Buffer.from(expected)
  const right = Buffer.from(supplied)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function listPublicModels(): Promise<PublicChessModel[]> {
  const result = await pool.query<{
    id: string; slug: string; display_name: string; description: string; runtime_id: string
    revision_id: string; source_type: string; license: string
  }>(`SELECT m.id, m.slug, m.display_name, m.description, r.runtime_id,
      r.id AS revision_id, r.source_type, r.license
    FROM chess_models m
    JOIN chess_model_revisions r ON r.id = m.current_ready_revision
    WHERE m.visibility = 'public' AND m.disabled = FALSE AND m.archived = FALSE AND r.state = 'ready'
    ORDER BY m.display_name ASC`)
  return [BUILTIN_STOCKFISH, ...result.rows.map(row => ({
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    description: row.description,
    runtimeId: row.runtime_id,
    revisionId: row.revision_id,
    sourceType: row.source_type,
    license: row.license,
    status: 'ready' as const,
  }))]
}

export async function listAdminModels() {
  const result = await pool.query(`SELECT m.id, m.slug, m.display_name, m.description, m.disabled, m.archived,
    r.id AS revision_id, r.revision_number, r.runtime_id, r.source_type, r.source_ref, r.license, r.state,
    r.scan_report, r.rejection_reason, r.created_at, r.updated_at
    FROM chess_models m JOIN chess_model_revisions r ON r.model_id = m.id
    ORDER BY r.created_at DESC LIMIT 100`)
  return result.rows
}

export async function listPublicModelRegistry() {
  const result = await pool.query(`SELECT m.slug, m.display_name, m.description, r.runtime_id, r.source_type,
    r.license, r.state, r.updated_at FROM chess_models m JOIN chess_model_revisions r ON r.model_id = m.id
    WHERE m.visibility = 'public' AND m.archived = FALSE ORDER BY r.created_at DESC LIMIT 100`)
  return result.rows.map(row => ({ slug: row.slug, displayName: row.display_name, description: row.description,
    runtimeId: row.runtime_id, sourceType: row.source_type, license: row.license, state: row.state, updatedAt: row.updated_at }))
}

export async function assertSubmissionAllowed(sourceIpHash?: string) {
  if (process.env.NODE_ENV === 'production' && !sourceIpHash) throw new Error('Public submission abuse protection is not configured')
  if (!sourceIpHash) return
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM chess_model_submissions
     WHERE source_ip_hash = $1 AND created_at > NOW() - INTERVAL '24 hours'`, [sourceIpHash])
  if (Number(result.rows[0]?.count ?? 0) >= 3) throw new Error('Submission limit reached; try again later')
}

export async function createSubmission(input: ChessModelSubmission, sourceIpHash?: string) {
  const modelId = `mdl_${randomUUID()}`
  const revisionId = `rev_${randomUUID()}`
  const submissionId = `sub_${randomUUID()}`
  const receipt = randomBytes(32).toString('base64url')
  const sourceRef = input.source === 'direct'
    ? `quarantine/${revisionId}/${input.fileName}`
    : `hf://${input.repoId}@${input.revision}`
  const size = input.source === 'direct' ? input.sizeBytes : null
  const sha256 = input.source === 'direct' ? input.sha256 : null
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`INSERT INTO chess_models (id, slug, display_name, description)
      VALUES ($1, $2, $3, $4)`, [modelId, input.name, input.displayName, input.description])
    await client.query(`INSERT INTO chess_model_revisions
      (id, model_id, revision_number, source_type, source_ref, runtime_id, sha256, size_bytes, license)
      VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8)`,
    [revisionId, modelId, input.source, sourceRef, input.runtime, sha256, size, input.license])
    await client.query(`INSERT INTO chess_model_submissions
      (id, model_id, revision_id, receipt_hash, submitter_contact, source_ip_hash)
      VALUES ($1, $2, $3, $4, $5, $6)`,
    [submissionId, modelId, revisionId, hashReceipt(receipt), input.submitterContact ?? null, sourceIpHash ?? null])
    await client.query(`INSERT INTO chess_model_audit (actor, action, model_id, revision_id)
      VALUES ('public', 'submitted', $1, $2)`, [modelId, revisionId])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
  return { modelId, revisionId, receipt, sourceRef }
}

export async function getSubmissionStatus(receipt: string) {
  const result = await pool.query<{ display_name: string; state: string; rejection_reason: string | null; updated_at: Date }>(
    `SELECT m.display_name, r.state, r.rejection_reason, r.updated_at
     FROM chess_model_submissions s
     JOIN chess_models m ON m.id = s.model_id
     JOIN chess_model_revisions r ON r.id = s.revision_id
     WHERE s.receipt_hash = $1`, [hashReceipt(receipt)])
  return result.rows[0] ?? null
}

export async function recordAutomatedInspection(revisionId: string, report: unknown) {
  await pool.query(`UPDATE chess_model_revisions
    SET state = 'pending_review', scan_report = $1, scan_policy = 'hf-metadata-v1', updated_at = NOW()
    WHERE id = $2 AND state = 'pending_scan'`, [JSON.stringify(report), revisionId])
  await pool.query(`INSERT INTO chess_model_audit (actor, action, revision_id, metadata)
    VALUES ('scanner', 'scan_passed', $1, $2)`, [revisionId, JSON.stringify({ policy: 'hf-metadata-v1' })])
}

export async function patchModel(modelId: string, patch: { displayName?: string; description?: string; disabled?: boolean; archived?: boolean }) {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined)
  const columns: Record<string, string> = { displayName: 'display_name', description: 'description', disabled: 'disabled', archived: 'archived' }
  const set = entries.map(([key], index) => `${columns[key]} = $${index + 2}`).join(', ')
  const result = await pool.query(`UPDATE chess_models SET ${set}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [modelId, ...entries.map(([, value]) => value)])
  if (!result.rowCount) return null
  await pool.query(`INSERT INTO chess_model_audit (actor, action, model_id, metadata) VALUES ('admin', 'metadata_updated', $1, $2)`,
    [modelId, JSON.stringify(patch)])
  return result.rows[0]
}

export async function decideRevision(modelId: string, revisionId: string, decision: 'approve' | 'reject', reason?: string) {
  const nextState = decision === 'approve' ? 'approved' : 'rejected'
  const result = await pool.query(`UPDATE chess_model_revisions SET state = $1, approved_by = $2,
    approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE NULL END, rejection_reason = $3, updated_at = NOW()
    WHERE id = $4 AND model_id = $5 AND state = 'pending_review' RETURNING *`,
  [nextState, decision === 'approve' ? 'admin' : null, reason ?? null, revisionId, modelId])
  if (!result.rowCount) return null
  await pool.query(`INSERT INTO chess_model_audit (actor, action, model_id, revision_id, metadata)
    VALUES ('admin', $1, $2, $3, $4)`, [decision, modelId, revisionId, JSON.stringify({ reason })])
  return result.rows[0]
}

export async function getReadyModelDeployment(revisionId: string) {
  const result = await pool.query<{ slug: string; revision_id: string; endpoint: string }>(
    `SELECT m.slug, r.id AS revision_id, d.endpoint
     FROM chess_model_revisions r
     JOIN chess_models m ON m.id = r.model_id
     JOIN chess_model_deployments d ON d.revision_id = r.id
     WHERE r.id = $1 AND r.state = 'ready' AND d.state = 'ready'
       AND d.endpoint IS NOT NULL AND m.disabled = FALSE AND m.archived = FALSE
     ORDER BY d.updated_at DESC LIMIT 1`, [revisionId])
  return result.rows[0] ?? null
}
