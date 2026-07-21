/**
 * Idempotent database migration script.
 *
 * - Uses only the built-in `pg` driver (already in dependencies).
 * - Every statement is safe to re-run: CREATE TABLE IF NOT EXISTS,
 *   ALTER TABLE … ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.
 * - Runs one statement at a time (Neon prepared-statement constraint).
 * - Safe against concurrent deploys: IF NOT EXISTS guards are atomic in Postgres.
 * - Exit code 0 on success, 1 on failure (workflow will abort the deploy).
 *
 * Add new migrations at the BOTTOM of the `migrations` array. Never modify
 * existing entries — treat each one as an append-only log entry.
 */

import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  console.error('[migrate] ERROR: DATABASE_URL is not set')
  process.exit(1)
}

const databaseUrl = new URL(process.env.DATABASE_URL)
const sslMode = databaseUrl.searchParams.get('sslmode') ?? process.env.PGSSLMODE
const ssl = sslMode === 'disable' ? false : { rejectUnauthorized: false }

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
  max: 1,
  connectionTimeoutMillis: 10_000,
})

// ── Migrations ──────────────────────────────────────────────────────────────
// Each entry is a single SQL statement.  Keep them APPEND-ONLY.
const migrations = [
  // v1 — initial schema
  `CREATE TABLE IF NOT EXISTS leaderboard (
    id         SERIAL PRIMARY KEY,
    player_id  TEXT NOT NULL,
    name       TEXT NOT NULL,
    score      INTEGER NOT NULL DEFAULT 0,
    rounds     INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS rooms (
    code       TEXT PRIMARY KEY,
    host_id    TEXT NOT NULL,
    state      TEXT NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  // v2 — index for fast leaderboard reads
  `CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard (score DESC)`,

  // v3 — auto-expire stale rooms after 24 h (requires pg_cron or manual cleanup;
  // this column is additive and safe to add even if cleanup isn't wired yet)
  `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`,

  // v4 — shared multi-game room engine
  `CREATE TABLE IF NOT EXISTS game_rooms (
    code       TEXT PRIMARY KEY,
    game_id    TEXT NOT NULL,
    host_id    TEXT NOT NULL,
    state      TEXT NOT NULL,
    revision   INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS game_rooms_game_updated_idx
    ON game_rooms (game_id, updated_at DESC)`,

  // v5 — leaderboard entries are isolated by game and room
  `CREATE TABLE IF NOT EXISTS game_leaderboard (
    id         BIGSERIAL PRIMARY KEY,
    game_id    TEXT NOT NULL,
    room_code  TEXT NOT NULL,
    player_id  TEXT NOT NULL,
    name       TEXT NOT NULL,
    score      INTEGER NOT NULL DEFAULT 0,
    rounds     INTEGER NOT NULL DEFAULT 0,
    metadata   TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (game_id, room_code, player_id)
  )`,

  `CREATE INDEX IF NOT EXISTS game_leaderboard_rank_idx
    ON game_leaderboard (game_id, score DESC, updated_at ASC)`,

  // v6 — registry for games hosted and released by other repositories
  `CREATE TABLE IF NOT EXISTS platform_games (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    manifest   TEXT NOT NULL,
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS platform_games_enabled_title_idx
    ON platform_games (enabled, title)`,
]
// ────────────────────────────────────────────────────────────────────────────

async function run() {
  const client = await pool.connect()
  console.log('[migrate] Connected to database')

  try {
    for (let i = 0; i < migrations.length; i++) {
      const sql = migrations[i].trim()
      const preview = sql.split('\n')[0].slice(0, 80)
      console.log(`[migrate] Running migration ${i + 1}/${migrations.length}: ${preview}…`)
      await client.query(sql)
      console.log(`[migrate] Migration ${i + 1} OK`)
    }
    console.log('[migrate] All migrations complete')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(err => {
  console.error('[migrate] FAILED:', err.message)
  process.exit(1)
})
