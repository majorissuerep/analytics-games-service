import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createModelMatchSchema } from '@/lib/chess-models/contracts'
import { createPersistedModelMatch, listModelMatches } from '@/lib/chess-models/match-repository'

export async function GET() {
  return NextResponse.json({ matches: await listModelMatches() })
}

export async function POST(request: Request) {
  const parsed = createModelMatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid model match request' }, { status: 400 })
  try {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
    const salt = process.env.CHESS_MODEL_ABUSE_SALT
    const sourceIpHash = forwarded && salt ? createHash('sha256').update(`${salt}:${forwarded}`).digest('hex') : undefined
    const match = await createPersistedModelMatch(parsed.data.whiteRevisionId, parsed.data.blackRevisionId, sourceIpHash)
    return NextResponse.json({ match }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create model match'
    return NextResponse.json({ error: message }, { status: message.includes('limit reached') ? 429 : message.includes('not configured') ? 503 : 400 })
  }
}
