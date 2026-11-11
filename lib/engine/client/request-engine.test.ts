import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestEngine } from './request-engine'
afterEach(() => vi.unstubAllGlobals())
function stream(chunks: string[]) {
  return new Response(new ReadableStream({ start(controller) {
    for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
    controller.close()
  } }), { headers: { 'content-type': 'text/event-stream' } })
}
describe('engine progress client', () => {
  it('reads split CRLF frames, heartbeats, real depth, and the final result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => stream([': heartbeat\r', '\n\r\nevent: prog', 'ress\r\ndata: {"stage":"thinking","message":"Searching","depth":12}\r\n\r', '\nevent: result\ndata: {"move":"e2e4"}\n\n'])))
    const progress = vi.fn()
    expect(await requestEngine('/engine', {}, { onProgress: progress })).toEqual({ move: 'e2e4' })
    expect(progress).toHaveBeenCalledWith({ stage: 'thinking', message: 'Searching', depth: 12 })
  })
  it('supports JSON responses without manufacturing completion', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ move: 'e2e4' })))
    expect(await requestEngine('/engine', {})).toEqual({ move: 'e2e4' })
  })
  it.each([
    ['event: error\ndata: {"error":"Model unavailable"}\n\n', 'Model unavailable'],
    ['event: progress\ndata: {"stage":"starting","message":"Starting"}\n\n', 'ended before a result'],
  ])('reports stream failure instead of leaving a loader stuck', async (body, message) => {
    vi.stubGlobal('fetch', vi.fn(async () => stream([body])))
    await expect(requestEngine('/engine', {})).rejects.toThrow(message)
  })
  it('explains cancellation and timeouts with a recovery action', async () => {
    const controller = new AbortController()
    controller.abort()
    vi.stubGlobal('fetch', vi.fn(async () => { throw controller.signal.reason }))
    await expect(requestEngine('/engine', {}, { signal: controller.signal })).rejects.toThrow('stopped. Retry')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('Timeout', 'TimeoutError') }))
    await expect(requestEngine('/engine', {})).rejects.toThrow('retry or choose another engine')
  })
})
