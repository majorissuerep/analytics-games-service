import { NextResponse } from 'next/server'
import { modelMatchPauseSchema } from '@/lib/chess-models/contracts'
import { pausePersistedModelMatch } from '@/lib/chess-models/match-repository'

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const parsed = modelMatchPauseSchema.safeParse(await request.json().catch(() => null))
  if (!token) return NextResponse.json({ error: 'Match control token required' }, { status: 401 })
  if (!parsed.success) return NextResponse.json({ error: 'Invalid pause request' }, { status: 400 })
  const { matchId } = await context.params
  try {
    return NextResponse.json({ match: await pausePersistedModelMatch(matchId, token, parsed.data.paused) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not pause match'
    return NextResponse.json({ error: message }, { status: /token/.test(message) ? 401 : /not found/.test(message) ? 404 : 409 })
  }
}
