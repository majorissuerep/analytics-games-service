import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { pool } from '@/lib/db/index'
import { applyMatchMove, createModelMatchState, setMatchPaused, type ModelMatchState } from './model-match'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

async function resolveModel(revisionId: string) {
  if (revisionId === 'builtin-stockfish-18') return { revisionId, displayName: 'Stockfish 18' }
  const result = await pool.query<{ revision_id: string; display_name: string }>(
    `SELECT r.id AS revision_id, m.display_name FROM chess_models m
     JOIN chess_model_revisions r ON r.id = m.current_ready_revision
     JOIN chess_model_deployments d ON d.revision_id = r.id AND d.state = 'ready'
     WHERE r.id = $1 AND r.state = 'ready' AND m.disabled = FALSE AND m.archived = FALSE`, [revisionId])
  return result.rows[0] ? { revisionId: result.rows[0].revision_id, displayName: result.rows[0].display_name } : null
}

export async function createPersistedModelMatch(whiteRevisionId: string, blackRevisionId: string, sourceIpHash?: string) {
  if (process.env.NODE_ENV === 'production' && !sourceIpHash) throw new Error('Match abuse protection is not configured')
  if (sourceIpHash) {
    const recent = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM chess_model_matches
      WHERE source_ip_hash=$1 AND created_at > NOW() - INTERVAL '24 hours'`, [sourceIpHash])
    if (Number(recent.rows[0]?.count ?? 0) >= 10) throw new Error('Daily model match limit reached')
  }
  const [white, black] = await Promise.all([resolveModel(whiteRevisionId), resolveModel(blackRevisionId)])
  if (!white || !black) throw new Error('Both model revisions must be ready')
  const id = `match_${randomUUID()}`
  const controlToken = randomBytes(32).toString('base64url')
  const state = createModelMatchState(white.revisionId, black.revisionId, new Date())
  await pool.query(`INSERT INTO chess_model_matches
    (id, white_revision_id, black_revision_id, white_model_name, black_model_name, control_token_hash, source_ip_hash, state, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
  [id, white.revisionId, black.revisionId, white.displayName, black.displayName, hashToken(controlToken), sourceIpHash ?? null, JSON.stringify(state), state.status])
  return { id, controlToken, state, whiteModelName: white.displayName, blackModelName: black.displayName }
}

export type ModelMatchRecord = {
  id: string
  white_revision_id: string
  black_revision_id: string
  white_model_name: string
  black_model_name: string
  state: ModelMatchState
  status: string
  result: string
  version: number
  created_at: Date
  updated_at: Date
}

export async function getModelMatch(id: string) {
  const result = await pool.query<ModelMatchRecord>(`SELECT id, white_revision_id, black_revision_id, white_model_name,
    black_model_name, state, status, result, version, created_at, updated_at FROM chess_model_matches WHERE id = $1`, [id])
  return result.rows[0] ?? null
}

export async function listModelMatches(limit = 30) {
  const result = await pool.query<ModelMatchRecord>(`SELECT id, white_revision_id, black_revision_id, white_model_name,
    black_model_name, state, status, result, version, created_at, updated_at FROM chess_model_matches
    ORDER BY created_at DESC LIMIT $1`, [Math.min(Math.max(limit, 1), 100)])
  return result.rows
}

async function requireControl(id: string, token: string) {
  const result = await pool.query<ModelMatchRecord & { control_token_hash: string }>(`SELECT * FROM chess_model_matches WHERE id = $1`, [id])
  const row = result.rows[0]
  if (!row) throw new Error('Match not found')
  const supplied = Buffer.from(hashToken(token))
  const expected = Buffer.from(row.control_token_hash)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error('Invalid match control token')
  return row
}

export async function appendPersistedMatchMove(id: string, token: string, uci: string, durationMs: number, expectedPly: number) {
  const row = await requireControl(id, token)
  const state = applyMatchMove(row.state, uci, durationMs, new Date(), expectedPly)
  const result = await pool.query<ModelMatchRecord>(`UPDATE chess_model_matches SET state=$1, status=$2, result=$3,
    ply_count=$4, version=version+1, updated_at=NOW(), completed_at=CASE WHEN $2='completed' THEN NOW() ELSE NULL END
    WHERE id=$5 AND version=$6 RETURNING *`, [JSON.stringify(state), state.status, state.result, state.moves.length, id, row.version])
  if (!result.rowCount) throw new Error('Match update is stale')
  return result.rows[0]
}

export async function pausePersistedModelMatch(id: string, token: string, paused: boolean) {
  const row = await requireControl(id, token)
  const state = setMatchPaused(row.state, paused)
  const result = await pool.query<ModelMatchRecord>(`UPDATE chess_model_matches SET state=$1, status=$2,
    version=version+1, updated_at=NOW() WHERE id=$3 AND version=$4 RETURNING *`, [JSON.stringify(state), state.status, id, row.version])
  if (!result.rowCount) throw new Error('Match update is stale')
  return result.rows[0]
}
