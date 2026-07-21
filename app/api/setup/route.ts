import { NextResponse } from 'next/server'
import { pool } from '@/lib/db/index'

export async function GET() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id         SERIAL PRIMARY KEY,
        player_id  TEXT NOT NULL,
        name       TEXT NOT NULL,
        score      INTEGER NOT NULL DEFAULT 0,
        rounds     INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        code       TEXT PRIMARY KEY,
        host_id    TEXT NOT NULL,
        state      TEXT NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  } finally {
    client.release()
  }
}
