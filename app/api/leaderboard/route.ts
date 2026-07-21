import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { leaderboard } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(leaderboard)
      .orderBy(desc(leaderboard.score))
      .limit(25)
    return NextResponse.json({ rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, playerId, score, rounds } = body
    if (!name || !playerId || score == null || rounds == null) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const [row] = await db
      .insert(leaderboard)
      .values({
        name:     String(name).slice(0, 40),
        playerId: String(playerId),
        score:    Number(score),
        rounds:   Number(rounds),
      })
      .returning()
    return NextResponse.json({ row })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
