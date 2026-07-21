import { type NextRequest, NextResponse } from 'next/server'
import { disableExternalGame } from '@/lib/platform/external-game-store'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const expected = process.env.PLATFORM_ADMIN_TOKEN
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { gameId } = await params
  const disabled = await disableExternalGame(gameId)
  return NextResponse.json({ disabled }, { status: disabled ? 200 : 404 })
}
