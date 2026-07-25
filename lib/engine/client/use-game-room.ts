'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { EnginePlayer, RoomSnapshot } from '@/lib/engine/types'

interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
  }
}

export class GameRoomClientError extends Error {
  constructor(
    message: string,
    public readonly code = 'REQUEST_FAILED',
    public readonly status = 500,
  ) {
    super(message)
    this.name = 'GameRoomClientError'
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody & T
  if (!response.ok) {
    throw new GameRoomClientError(
      body.error?.message ?? 'Game request failed',
      body.error?.code ?? 'REQUEST_FAILED',
      response.status,
    )
  }
  return body
}

interface UseGameRoomOptions {
  gameId: string
  playerId: string
  pollMs?: number
}

function capabilityKey(code: string, playerId: string) {
  return `analytics_games_room_capability:${code.toUpperCase()}:${playerId}`
}

function readCapability(code: string, playerId: string) {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(capabilityKey(code, playerId)) ?? ''
  } catch {
    return ''
  }
}

function storeCapability(code: string, playerId: string, token: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(capabilityKey(code, playerId), token)
  } catch {
    // Current tab still keeps token in memory when browser blocks persistence.
  }
}

function requestHeaders(token: string, includeJson = false): HeadersInit {
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export function useGameRoom<TGameView>({
  gameId,
  playerId,
  pollMs = 2_000,
}: UseGameRoomOptions) {
  const [room, setRoom] = useState<RoomSnapshot<TGameView> | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<GameRoomClientError | null>(null)
  const roomRef = useRef<RoomSnapshot<TGameView> | null>(null)
  const tokenRef = useRef('')
  const pollingRef = useRef(false)

  const acceptRoom = useCallback((nextRoom: RoomSnapshot<TGameView>) => {
    if (nextRoom.gameId !== gameId) {
      throw new GameRoomClientError('Room belongs to another game', 'WRONG_GAME', 409)
    }
    const currentRoom = roomRef.current
    if (
      currentRoom?.code === nextRoom.code &&
      currentRoom.revision > nextRoom.revision
    ) {
      return currentRoom
    }
    roomRef.current = nextRoom
    setRoom(nextRoom)
    setError(null)
    return nextRoom
  }, [gameId])

  const create = useCallback(async (host: EnginePlayer, password = '') => {
    setPending(true)
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, host, password }),
      })
      const body = await readResponse<{
        room: RoomSnapshot<TGameView>
        playerToken: string
      }>(response)
      tokenRef.current = body.playerToken
      storeCapability(body.room.code, host.id, body.playerToken)
      return acceptRoom(body.room)
    } catch (caught) {
      const nextError = caught instanceof GameRoomClientError
        ? caught
        : new GameRoomClientError(String(caught))
      setError(nextError)
      throw nextError
    } finally {
      setPending(false)
    }
  }, [acceptRoom, gameId])

  const join = useCallback(async (code: string, player: EnginePlayer, password = '') => {
    setPending(true)
    try {
      const currentToken = readCapability(code, player.id)
      const response = await fetch(`/api/rooms/${encodeURIComponent(code)}/join`, {
        method: 'POST',
        headers: requestHeaders(currentToken, true),
        body: JSON.stringify({ player, password }),
      })
      const body = await readResponse<{
        room: RoomSnapshot<TGameView>
        playerToken: string
      }>(response)
      tokenRef.current = body.playerToken
      storeCapability(body.room.code, player.id, body.playerToken)
      return acceptRoom(body.room)
    } catch (caught) {
      const nextError = caught instanceof GameRoomClientError
        ? caught
        : new GameRoomClientError(String(caught))
      setError(nextError)
      throw nextError
    } finally {
      setPending(false)
    }
  }, [acceptRoom])

  const refresh = useCallback(async (code = roomRef.current?.code) => {
    if (!code || !playerId || pollingRef.current) return roomRef.current
    pollingRef.current = true
    try {
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(code)}?viewerId=${encodeURIComponent(playerId)}`,
        {
          cache: 'no-store',
          headers: requestHeaders(tokenRef.current || readCapability(code, playerId)),
        },
      )
      const body = await readResponse<{ room: RoomSnapshot<TGameView> }>(response)
      return acceptRoom(body.room)
    } catch (caught) {
      const nextError = caught instanceof GameRoomClientError
        ? caught
        : new GameRoomClientError(String(caught))
      setError(nextError)
      return roomRef.current
    } finally {
      pollingRef.current = false
    }
  }, [acceptRoom, playerId])

  const dispatch = useCallback(async (action: unknown) => {
    const currentRoom = roomRef.current
    if (!currentRoom) throw new GameRoomClientError('Join a room first', 'NO_ROOM', 400)
    if (!playerId) throw new GameRoomClientError('Player identity is not ready', 'NO_PLAYER', 400)
    setPending(true)
    try {
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(currentRoom.code)}/actions`,
        {
          method: 'POST',
          headers: requestHeaders(tokenRef.current, true),
          body: JSON.stringify({ actorId: playerId, action }),
        },
      )
      const body = await readResponse<{ room: RoomSnapshot<TGameView> }>(response)
      return acceptRoom(body.room)
    } catch (caught) {
      const nextError = caught instanceof GameRoomClientError
        ? caught
        : new GameRoomClientError(String(caught))
      setError(nextError)
      throw nextError
    } finally {
      setPending(false)
    }
  }, [acceptRoom, playerId])

  useEffect(() => {
    if (!room?.code || !playerId) return
    const timer = window.setInterval(() => {
      void refresh(room.code)
    }, pollMs)
    return () => window.clearInterval(timer)
  }, [playerId, pollMs, refresh, room?.code])

  const authorizedFetch = useCallback((input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    if (tokenRef.current) headers.set('Authorization', `Bearer ${tokenRef.current}`)
    return fetch(input, { ...init, headers })
  }, [])

  const clear = useCallback(() => {
    roomRef.current = null
    tokenRef.current = ''
    setRoom(null)
    setError(null)
  }, [])

  return {
    room,
    pending,
    error,
    create,
    join,
    dispatch,
    refresh,
    authorizedFetch,
    clear,
  }
}
