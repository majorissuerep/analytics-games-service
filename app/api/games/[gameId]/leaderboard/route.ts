import { type NextRequest, NextResponse } from 'next/server'
import { engineErrorResponse } from '@/lib/engine/errors'
import { readBearerToken } from '@/lib/engine/server/player-capability'
import {
  listLeaderboard,
  submitLeaderboardScore,
} from '@/lib/engine/server/leaderboard-store'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params
    const rows = await listLeaderboard(gameId)
    return NextResponse.json(
      { rows },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const mapped = engineErrorResponse(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params
    const body = (await request.json()) as {
      roomCode?: unknown
      playerId?: unknown
    }
    if (typeof body.roomCode !== 'string' || typeof body.playerId !== 'string') {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'roomCode and playerId are required' } },
        { status: 400 },
      )
    }
    const row = await submitLeaderboardScore(
      gameId,
      body.roomCode,
      body.playerId,
      readBearerToken(request.headers),
    )
    return NextResponse.json({ row })
  } catch (error) {
    const mapped = engineErrorResponse(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
