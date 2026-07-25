import { type NextRequest, NextResponse } from 'next/server'
import { engineErrorResponse } from '@/lib/engine/errors'
import { createRoom } from '@/lib/engine/server/room-store'
import type { EnginePlayer } from '@/lib/engine/types'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      gameId?: unknown
      host?: EnginePlayer
      password?: unknown
    }
    if (typeof body.gameId !== 'string') {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'gameId is required' } },
        { status: 400 },
      )
    }
    const membership = await createRoom(
      body.gameId,
      body.host as EnginePlayer,
      typeof body.password === 'string' ? body.password : '',
    )
    return NextResponse.json(membership, { status: 201 })
  } catch (error) {
    const mapped = engineErrorResponse(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
