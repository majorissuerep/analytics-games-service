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
    // Anti-cheat: a game is at most 50 rounds and each round awards at most
    // 10 points (a supershot), so reject anything outside the achievable range.
    const r = Number(rounds)
    const s = Number(score)
    if (!Number.isFinite(r) || !Number.isFinite(s)) {
      return NextResponse.json({ error: 'Invalid numbers' }, { status: 400 })
    }
    if (r < 1 || r > 50) {
      return NextResponse.json({ error: 'Invalid round count' }, { status: 400 })
    }
    const maxScore = r * 10
    if (s < 0 || s > maxScore) {
      return NextResponse.json({ error: 'Score out of range' }, { status: 400 })
    }
    const [row] = await db
      .insert(leaderboard)
      .values({
        name:     String(name).slice(0, 40),
        playerId: String(playerId),
        score:    Math.round(s),
        rounds:   Math.round(r),
      })
      .returning()
    return NextResponse.json({ row })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
