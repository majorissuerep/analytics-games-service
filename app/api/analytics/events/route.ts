import { NextResponse } from 'next/server'
import {
  EventTrackingClient,
  EventTrackingError,
} from '@/lib/analytics/event-tracking-client'
import {
  isAnalyticsEventName,
  isOpaqueId,
  sanitizeAnalyticsProperties,
} from '@/lib/analytics/event-contract'
import { eventTrackingEnabled } from '@/lib/analytics/server-config'

export const runtime = 'nodejs'

const MAX_RELAY_BODY_BYTES = 64 * 1024

type RelayBody = {
  event?: unknown
  messageId?: unknown
  anonymousId?: unknown
  properties?: unknown
}

const globalForEventTracking = globalThis as typeof globalThis & {
  analyticsGamesEventTrackingClient?: EventTrackingClient
}

export async function POST(request: Request) {
  if (!eventTrackingEnabled()) return json({ accepted: false }, 404)

  const contentType = request.headers.get('content-type') ?? ''
  if (!/^application\/json(?:;|$)/iu.test(contentType)) return json({ accepted: false }, 415)

  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return json({ accepted: false }, 403)

  let body: RelayBody
  try {
    body = JSON.parse(await readLimitedBody(request)) as RelayBody
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return json({ accepted: false }, 413)
    return json({ accepted: false }, 400)
  }

  if (!isRecord(body) || !isAnalyticsEventName(body.event)) return json({ accepted: false }, 400)
  if (!isOpaqueId(body.anonymousId)) return json({ accepted: false }, 400)
  if (body.messageId !== undefined && !isOpaqueId(body.messageId)) return json({ accepted: false }, 400)

  const properties = sanitizeAnalyticsProperties(body.event, body.properties)
  if (!properties) return json({ accepted: false }, 400)

  let client: EventTrackingClient | null
  try {
    client = getEventTrackingClient()
  } catch {
    console.error('event tracking relay is misconfigured')
    return json({ accepted: false }, 503)
  }
  if (!client) return json({ accepted: false }, 503)

  try {
    await client.track(body.event, properties, {
      anonymousId: body.anonymousId,
      ...(body.messageId === undefined ? {} : { messageId: body.messageId }),
    })
    return json({ accepted: true }, 202)
  } catch (error) {
    const ingestError = error instanceof EventTrackingError ? error : undefined
    console.warn('event tracking relay failed', {
      event: body.event,
      status: ingestError?.status ?? 'network',
      retryable: ingestError?.retryable ?? true,
      attempts: ingestError?.attempts ?? 1,
    })
    return json({ accepted: false }, 503)
  }
}

function getEventTrackingClient() {
  if (globalForEventTracking.analyticsGamesEventTrackingClient) {
    return globalForEventTracking.analyticsGamesEventTrackingClient
  }

  const writeKey = process.env.EVENT_WRITE_KEY
  if (!writeKey) return null

  const client = new EventTrackingClient({
    writeKey,
    baseUrl: process.env.EVENT_TRACKING_URL,
    timeoutMs: 5_000,
    maxAttempts: 3,
  })
  globalForEventTracking.analyticsGamesEventTrackingClient = client
  return client
}

function json(body: { accepted: boolean }, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

async function readLimitedBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) return ''

  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      total += next.value.byteLength
      if (total > MAX_RELAY_BODY_BYTES) throw new PayloadTooLargeError()
      chunks.push(next.value)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  }

  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}

class PayloadTooLargeError extends Error {}

function isRecord(value: unknown): value is RelayBody {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
