import { randomUUID } from 'node:crypto'

const ALLOWED_TYPES = new Set(['track', 'page', 'identify', 'group', 'event'])
const PAYLOAD_TYPES = new Set(['track', 'page', 'identify', 'group'])
const MAX_BODY_BYTES = 1024 * 1024
const DEFAULT_BASE_URL = 'https://events.theincompetent.app'

type EventPayload = Record<string, unknown>
type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export class EventTrackingError extends Error {
  status: number | undefined
  retryable: boolean
  attempts: number

  constructor(
    message: string,
    { status, retryable = false, attempts = 1 }: { status?: number; retryable?: boolean; attempts?: number } = {},
  ) {
    super(message)
    this.name = 'EventTrackingError'
    this.status = status
    this.retryable = retryable
    this.attempts = attempts
  }
}

export class EventTrackingClient {
  private readonly writeKey: string
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly maxAttempts: number
  private readonly fetchImpl: FetchImplementation

  constructor({
    writeKey,
    baseUrl = DEFAULT_BASE_URL,
    timeoutMs = 10_000,
    maxAttempts = 3,
    fetchImpl = globalThis.fetch.bind(globalThis),
  }: {
    writeKey: string
    baseUrl?: string
    timeoutMs?: number
    maxAttempts?: number
    fetchImpl?: FetchImplementation
  }) {
    if (!writeKey) throw new Error('EVENT_WRITE_KEY is required')
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) {
      throw new Error('maxAttempts must be an integer from 1 to 5')
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30_000) {
      throw new Error('timeoutMs must be greater than 0 and no more than 30000')
    }
    this.writeKey = writeKey
    this.baseUrl = normalizeBaseUrl(baseUrl)
    this.timeoutMs = timeoutMs
    this.maxAttempts = maxAttempts
    this.fetchImpl = fetchImpl
  }

  async send(eventType: string, payload: EventPayload) {
    if (!ALLOWED_TYPES.has(eventType)) throw new Error(`Unsupported event type: ${eventType}`)
    if (eventType === 'event' && (typeof payload.type !== 'string' || !PAYLOAD_TYPES.has(payload.type))) {
      throw new Error('The generic event route requires a concrete payload type')
    }
    if (eventType !== 'event' && payload.type && payload.type !== eventType) {
      throw new Error('Payload type conflicts with the selected event route')
    }

    const now = new Date().toISOString()
    const context = isRecord(payload.context) ? payload.context : {}
    const event = {
      ...payload,
      type: payload.type ?? eventType,
      messageId: payload.messageId ?? randomUUID(),
      timestamp: payload.timestamp ?? now,
      sentAt: now,
      context: {
        ...context,
        library: {
          name: 'analytics-games-event-http-adapter',
          version: '1',
        },
      },
    }
    const body = JSON.stringify(event)
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      throw new Error('Event exceeds the 1 MiB public-ingest limit')
    }

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      let response: Response
      try {
        response = await this.fetchImpl(`${this.baseUrl}/api/s/s2s/${eventType}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'analytics-games-event-http-adapter/1',
            'X-Write-Key': this.writeKey,
          },
          body,
          redirect: 'manual',
          signal: AbortSignal.timeout(this.timeoutMs),
        })
      } catch {
        if (attempt === this.maxAttempts) {
          throw new EventTrackingError('Event ingest failed after bounded retries', {
            retryable: true,
            attempts: attempt,
          })
        }
        await sleep(retryDelayMs(undefined, attempt))
        continue
      }

      await discardResponseBody(response)
      if (response.ok) {
        return { messageId: event.messageId as string, status: response.status }
      }

      const retryable = response.status === 429 || response.status >= 500
      if (!retryable || attempt === this.maxAttempts) {
        throw new EventTrackingError(`Event ingest returned HTTP ${response.status}`, {
          status: response.status,
          retryable,
          attempts: attempt,
        })
      }
      await sleep(retryDelayMs(response.headers.get('retry-after'), attempt))
    }

    throw new EventTrackingError('Event ingest failed', { retryable: true, attempts: this.maxAttempts })
  }

  track(event: string, properties: EventPayload, options: EventPayload = {}) {
    return this.send('track', { event, properties, ...options })
  }

  page(name: string, properties: EventPayload, options: EventPayload = {}) {
    return this.send('page', { name, properties, ...options })
  }

  identify(userId: string, traits: EventPayload, options: EventPayload = {}) {
    return this.send('identify', { userId, traits, ...options })
  }

  group(groupId: string, traits: EventPayload, options: EventPayload = {}) {
    return this.send('group', { groupId, traits, ...options })
  }
}

function normalizeBaseUrl(value: string) {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('EVENT_TRACKING_URL must be the approved HTTPS event host')
  }
  if (parsed.origin !== DEFAULT_BASE_URL || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('EVENT_TRACKING_URL must be the approved HTTPS event host')
  }
  return parsed.origin
}

function isRecord(value: unknown): value is EventPayload {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function retryDelayMs(retryAfter: string | null | undefined, attempt: number) {
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) return Math.min(Math.max(seconds, 0) * 1000, 30_000)
    const dateDelay = Date.parse(retryAfter) - Date.now()
    if (Number.isFinite(dateDelay) && dateDelay > 0) return Math.min(dateDelay, 30_000)
  }
  const exponential = Math.min(250 * 2 ** (attempt - 1), 5_000)
  return exponential + Math.floor(Math.random() * 250)
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function discardResponseBody(response: Response) {
  try {
    await response.body?.cancel()
  } catch {
    // Cleanup failure must not resend an event already accepted by ingest.
  }
}
