import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/index'
import { rooms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  try {
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code.toUpperCase()))
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    // Parse the JSON state blob before returning
    return NextResponse.json({ room: { ...room, state: JSON.parse(room.state) } })
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
    const stateStr = JSON.stringify(state ?? {})

    const existing = await db.select().from(rooms).where(eq(rooms.code, upper))
    if (existing.length === 0) {
      const [room] = await db
        .insert(rooms)
        .values({ code: upper, state: stateStr, hostId: String(hostId) })
        .returning()
      return NextResponse.json({ room: { ...room, state: JSON.parse(room.state) } })
    } else {
      const [room] = await db
        .update(rooms)
        .set({ state: stateStr, updatedAt: new Date() })
        .where(eq(rooms.code, upper))
        .returning()
      return NextResponse.json({ room: { ...room, state: JSON.parse(room.state) } })
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
