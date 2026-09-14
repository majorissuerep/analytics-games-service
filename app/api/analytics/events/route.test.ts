import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalEnvironment = {
  EVENT_TRACKING_ENABLED: process.env.EVENT_TRACKING_ENABLED,
  EVENT_TRACKING_URL: process.env.EVENT_TRACKING_URL,
  EVENT_WRITE_KEY: process.env.EVENT_WRITE_KEY,
}

beforeEach(() => {
  process.env.EVENT_TRACKING_ENABLED = 'true'
  process.env.EVENT_TRACKING_URL = 'https://events.theincompetent.app'
  process.env.EVENT_WRITE_KEY = 'site-write-key'
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('analytics relay route', () => {
  it('validates the browser envelope and forwards a server-only event', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 202 }))
    const { POST } = await import('@/app/api/analytics/events/route')

    const response = await POST(new Request('https://app.example.test/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'platform_viewed',
        messageId: 'web_test_1',
        anonymousId: 'anon_test',
        properties: {
          platform: 'web',
          games_available: 5,
          path: '/',
        },
      }),
    }))

    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ accepted: true })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://events.theincompetent.app/api/s/s2s/track')
    const headers = new Headers(init?.headers)
    expect(headers.get('X-Write-Key')).toBe('site-write-key')
    expect(headers.get('Authorization')).toBeNull()
    expect(JSON.parse(String(init?.body))).toMatchObject({
      type: 'track',
      event: 'platform_viewed',
      messageId: 'web_test_1',
      anonymousId: 'anon_test',
    })
  })

  it('rejects a payload outside the fixed taxonomy before network I/O', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 202 }))
    const { POST } = await import('@/app/api/analytics/events/route')

    const response = await POST(new Request('https://app.example.test/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'platform_viewed',
        anonymousId: 'anon_test',
        properties: {
          platform: 'web',
          games_available: 5,
          path: '/',
          prompt: 'not allowed',
        },
      }),
    }))

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
