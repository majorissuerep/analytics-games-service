import { type NextRequest, NextResponse } from 'next/server'
import { engineErrorResponse } from '@/lib/engine/errors'
import { readBearerToken } from '@/lib/engine/server/player-capability'
import { getRoom } from '@/lib/engine/server/room-store'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params
    const viewerId = request.nextUrl.searchParams.get('viewerId') ?? ''
    const room = await getRoom(code, viewerId, readBearerToken(request.headers))
    return NextResponse.json(
      { room },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const mapped = engineErrorResponse(error)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
