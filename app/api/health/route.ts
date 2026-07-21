import { NextResponse } from 'next/server'
import { pool } from '@/lib/db/index'

/**
 * GET /api/health
 *
 * Used by the blue/green deploy workflow to verify the new deployment is live
 * and can reach the database before the old deployment is swapped out.
 *
 * Returns 200 when:
 *   - The Next.js server is responding
 *   - The database connection is healthy (simple SELECT 1)
 *
 * Returns 503 if the database is unreachable.
 */
export async function GET() {
  try {
    const client = await pool.connect()
    try {
      await client.query('SELECT 1')
    } finally {
      client.release()
    }

    return NextResponse.json(
      { status: 'ok', db: 'ok', ts: new Date().toISOString() },
      { status: 200 }
    )
  } catch (err) {
    console.error('[health] DB check failed:', err)
    return NextResponse.json(
      { status: 'error', db: 'unreachable', error: String(err) },
      { status: 503 }
    )
  }
}
