import { pool } from '@/lib/db/index'

let schemaPromise: Promise<void> | null = null

async function applySchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chess_models (
      id                     TEXT PRIMARY KEY,
      slug                   TEXT NOT NULL UNIQUE,
      display_name           TEXT NOT NULL,
      description            TEXT NOT NULL DEFAULT '',
      visibility             TEXT NOT NULL DEFAULT 'public',
      disabled               BOOLEAN NOT NULL DEFAULT FALSE,
      archived               BOOLEAN NOT NULL DEFAULT FALSE,
      current_ready_revision TEXT,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chess_model_revisions (
      id               TEXT PRIMARY KEY,
      model_id         TEXT NOT NULL REFERENCES chess_models(id) ON DELETE CASCADE,
      revision_number  INTEGER NOT NULL,
      source_type      TEXT NOT NULL,
      source_ref       TEXT,
      runtime_id       TEXT NOT NULL,
      sha256           TEXT,
      size_bytes       BIGINT,
      license          TEXT,
      state            TEXT NOT NULL DEFAULT 'pending_scan',
      scan_report      JSONB,
      scan_policy      TEXT,
      rejection_reason TEXT,
      approved_by      TEXT,
      approved_at      TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS chess_model_revisions_model_idx
      ON chess_model_revisions (model_id)
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chess_model_submissions (
      id                TEXT PRIMARY KEY,
      model_id          TEXT NOT NULL REFERENCES chess_models(id) ON DELETE CASCADE,
      revision_id       TEXT NOT NULL REFERENCES chess_model_revisions(id) ON DELETE CASCADE,
      receipt_hash      TEXT NOT NULL,
      submitter_contact TEXT,
      source_ip_hash    TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS chess_model_submissions_abuse_idx
      ON chess_model_submissions (source_ip_hash, created_at)
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chess_model_audit (
      id          BIGSERIAL PRIMARY KEY,
      actor       TEXT NOT NULL,
      action      TEXT NOT NULL,
      model_id    TEXT REFERENCES chess_models(id) ON DELETE SET NULL,
      revision_id TEXT REFERENCES chess_model_revisions(id) ON DELETE SET NULL,
      metadata    JSONB NOT NULL DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chess_model_deployments (
      id          TEXT PRIMARY KEY,
      revision_id TEXT NOT NULL REFERENCES chess_model_revisions(id) ON DELETE CASCADE,
      state       TEXT NOT NULL DEFAULT 'deploying',
      endpoint    TEXT,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS chess_model_deployments_revision_idx
      ON chess_model_deployments (revision_id)
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chess_model_matches (
      id                 TEXT PRIMARY KEY,
      white_revision_id  TEXT NOT NULL,
      black_revision_id  TEXT NOT NULL,
      white_model_name   TEXT NOT NULL,
      black_model_name   TEXT NOT NULL,
      control_token_hash TEXT NOT NULL,
      source_ip_hash     TEXT,
      state              JSONB NOT NULL,
      status             TEXT NOT NULL,
      result             TEXT NOT NULL DEFAULT '',
      ply_count          INTEGER NOT NULL DEFAULT 0,
      version            INTEGER NOT NULL DEFAULT 0,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at       TIMESTAMPTZ
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS chess_model_matches_created_idx
      ON chess_model_matches (created_at DESC)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS chess_model_matches_abuse_idx
      ON chess_model_matches (source_ip_hash, created_at)
  `)
}

export async function ensureChessModelSchema() {
  if (!schemaPromise) {
    schemaPromise = applySchema().catch((error) => {
      schemaPromise = null
      throw error
    })
  }
  await schemaPromise
}
