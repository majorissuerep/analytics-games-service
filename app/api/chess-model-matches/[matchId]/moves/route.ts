import { NextResponse } from 'next/server'
import { modelMatchMoveSchema } from '@/lib/chess-models/contracts'
import { appendPersistedMatchMove } from '@/lib/chess-models/match-repository'

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const parsed = modelMatchMoveSchema.safeParse(await request.json().catch(() => null))
  if (!token) return NextResponse.json({ error: 'Match control token required' }, { status: 401 })
  if (!parsed.success) return NextResponse.json({ error: 'Invalid match move' }, { status: 400 })
  const { matchId } = await context.params
  try {
    return NextResponse.json({ match: await appendPersistedMatchMove(matchId, token, parsed.data.uci, parsed.data.durationMs, parsed.data.expectedPly) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not record move'
    const status = /token/.test(message) ? 401 : /not found/.test(message) ? 404 : /stale/.test(message) ? 409 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
