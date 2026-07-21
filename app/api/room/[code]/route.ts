import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { rooms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// A room state is only accepted if it has the core shape. This stops a stray or
// malicious POST with junk like {foo:1} from overwriting (destroying) a live room.
function isValidState(s: unknown): boolean {
  if (!s || typeof s !== 'object') return false
  const st = s as Record<string, unknown>
  return (
    typeof st.phase === 'string' &&
    typeof st.hostId === 'string' &&
    Array.isArray(st.players)
  )
}

// The secret target must never reach a plain guesser before the reveal, or they
// can read it straight out of the network response / DevTools. We only include it
// for the clue-giver of the active round and the host (who needs it to score).
function redactTarget(state: Record<string, unknown>, pid: string): Record<string, unknown> {
  const round = state.round as Record<string, unknown> | null
  const phase = state.phase as string
  if (!round) return state
  const revealed = phase === 'result' || phase === 'final'
  const privileged = pid === round.cluegiver || pid === state.hostId
  if (revealed || privileged) return state
  return { ...state, round: { ...round, target: null } }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const pid = req.nextUrl.searchParams.get('pid') ?? ''
  try {
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code.toUpperCase()))
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    const state = redactTarget(JSON.parse(room.state), pid)
    return NextResponse.json({ room: { ...room, state } })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  try {
    const body = await req.json()
    const { state, hostId } = body
    const upper = code.toUpperCase()

    if (!isValidState(state)) {
      return NextResponse.json({ error: 'Invalid room state' }, { status: 400 })
    }

    const existing = await db.select().from(rooms).where(eq(rooms.code, upper))
    if (existing.length === 0) {
      const [room] = await db
        .insert(rooms)
        .values({ code: upper, state: JSON.stringify(state), hostId: String(hostId) })
        .returning()
      return NextResponse.json({ room: { ...room, state: JSON.parse(room.state) } })
    } else {
      // A guesser's client receives a redacted (null) target from GET, so when it
      // writes state back (e.g. on lock) we must NOT let that null clobber the real
      // target. Restore the authoritative target from the stored round.
      const prev = JSON.parse(existing[0].state) as Record<string, any>
      const incoming = state as Record<string, any>
      if (
        incoming.round &&
        (incoming.round.target === null || incoming.round.target === undefined) &&
        prev.round && typeof prev.round.target === 'number'
      ) {
        incoming.round.target = prev.round.target
      }
      const [room] = await db
        .update(rooms)
        .set({ state: JSON.stringify(incoming), updatedAt: new Date() })
        .where(eq(rooms.code, upper))
        .returning()
      return NextResponse.json({ room: { ...room, state: JSON.parse(room.state) } })
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
