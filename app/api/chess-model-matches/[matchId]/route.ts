import { NextResponse } from 'next/server'
import { getModelMatch } from '@/lib/chess-models/match-repository'

export async function GET(_request: Request, context: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await context.params
  const match = await getModelMatch(matchId)
  return match ? NextResponse.json({ match }) : NextResponse.json({ error: 'Match not found' }, { status: 404 })
}
