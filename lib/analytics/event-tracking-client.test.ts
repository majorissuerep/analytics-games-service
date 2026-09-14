import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventTrackingClient } from './event-tracking-client'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EventTrackingClient', () => {
  it('sends the exact server-mode route and never Authorization', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }))
    const client = new EventTrackingClient({
      writeKey: 'site-write-key',
      baseUrl: 'https://events.theincompetent.app/',
      maxAttempts: 1,
      fetchImpl: fetchMock,
    })

    const result = await client.track('game_session_started', {
      platform: 'web',
      game_id: 'paintbox',
    }, {
      anonymousId: 'anon_test',
      messageId: 'web_test_1',
    })

    expect(result).toEqual({ messageId: 'web_test_1', status: 202 })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://events.theincompetent.app/api/s/s2s/track')
    expect(init?.method).toBe('POST')
    const headers = new Headers(init?.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-Write-Key')).toBe('site-write-key')
    expect(headers.get('Authorization')).toBeNull()
    expect(JSON.parse(String(init?.body))).toMatchObject({
      type: 'track',
      event: 'game_session_started',
      messageId: 'web_test_1',
      anonymousId: 'anon_test',
    })
  })

  it('reuses one messageId across transient retries', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const client = new EventTrackingClient({
      writeKey: 'site-write-key',
      maxAttempts: 2,
      fetchImpl: fetchMock,
    })

    const result = await client.track('platform_viewed', {
      platform: 'web',
      games_available: 5,
      path: '/',
    }, { anonymousId: 'anon_test' })

    expect(result.status).toBe(204)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { messageId: string }
    const second = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as { messageId: string }
    expect(first.messageId).toBeTruthy()
    expect(second.messageId).toBe(first.messageId)
  })

  it('does not retry permanent errors and rejects oversized payloads locally', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 }))
    const client = new EventTrackingClient({
      writeKey: 'site-write-key',
      maxAttempts: 3,
      fetchImpl: fetchMock,
    })

    await expect(client.track('platform_viewed', {
      platform: 'web',
      games_available: 1,
      path: '/',
    }, { anonymousId: 'anon_test' })).rejects.toMatchObject({
      status: 401,
      retryable: false,
      attempts: 1,
    })
    expect(fetchMock).toHaveBeenCalledOnce()

    const oversized = new EventTrackingClient({
      writeKey: 'site-write-key',
      maxAttempts: 1,
      fetchImpl: fetchMock,
    })
    await expect(oversized.track('platform_viewed', {
      platform: 'web',
      games_available: 1,
      path: '/',
      oversized: 'x'.repeat(1024 * 1024),
    }, { anonymousId: 'anon_test' })).rejects.toThrow('1 MiB')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('rejects non-approved event endpoints', () => {
    expect(() => new EventTrackingClient({
      writeKey: 'site-write-key',
      baseUrl: 'http://events.theincompetent.app',
    })).toThrow('approved HTTPS event host')
    expect(() => new EventTrackingClient({
      writeKey: 'site-write-key',
      baseUrl: 'https://collector.example.test',
    })).toThrow('approved HTTPS event host')
  })
})
