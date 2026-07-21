import { type NextRequest, NextResponse } from 'next/server'
import { engineErrorResponse } from '@/lib/engine/errors'
import { readBearerToken } from '@/lib/engine/server/player-capability'
import { applyRoomAction } from '@/lib/engine/server/room-store'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params
    const body = (await request.json()) as {
      actorId?: unknown
      action?: unknown
    }
    if (typeof body.actorId !== 'string') {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'actorId is required' } },
        { status: 400 },
      )
    }
    const room = await applyRoomAction(
      code,
      body.actorId,
      readBearerToken(request.headers),
      body.action,
    )
    return NextResponse.json({ room })
  } catch (error) {
    const mapped = engineErrorResponse(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
