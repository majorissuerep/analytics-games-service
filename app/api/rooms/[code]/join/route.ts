import { type NextRequest, NextResponse } from 'next/server'
import { engineErrorResponse } from '@/lib/engine/errors'
import { readBearerToken } from '@/lib/engine/server/player-capability'
import { joinRoom } from '@/lib/engine/server/room-store'
import type { EnginePlayer } from '@/lib/engine/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params
    const body = (await request.json()) as { player?: EnginePlayer; password?: unknown }
    const membership = await joinRoom(
      code,
      body.player as EnginePlayer,
      readBearerToken(request.headers),
      typeof body.password === 'string' ? body.password : '',
    )
    return NextResponse.json(membership)
  } catch (error) {
    const mapped = engineErrorResponse(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
