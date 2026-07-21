import { type NextRequest, NextResponse } from 'next/server'
import { listExternalGames, upsertExternalGame } from '@/lib/platform/external-game-store'

function hasAdminCapability(request: NextRequest) {
  const expected = process.env.PLATFORM_ADMIN_TOKEN
  return Boolean(expected && request.headers.get('authorization') === `Bearer ${expected}`)
}

export async function GET() {
  try {
    return NextResponse.json(
      { games: await listExternalGames() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'External catalog unavailable' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.PLATFORM_ADMIN_TOKEN) {
    return NextResponse.json({ error: 'External catalog registration is disabled' }, { status: 503 })
  }
  if (!hasAdminCapability(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const game = await upsertExternalGame(await request.json())
    return NextResponse.json({ game }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid game manifest' },
      { status: 400 },
    )
  }
}
