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

describe('current request identity survives noncooperative transports', () => {
  it('does not fetch or publish connecting for an already aborted operation', async () => {
    const fetcher = vi.fn()
    const progress = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(requestEngine('/engine', {}, { signal: AbortSignal.abort(), onProgress: progress })).rejects.toThrow('stopped')
    expect(fetcher).not.toHaveBeenCalled()
    expect(progress).not.toHaveBeenCalled()
  })
  it('settles cancellation before an ignored fetch resolves, and disposes its late response', async () => {
    let finish!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve })))
    const controller = new AbortController()
    const pending = requestEngine('/engine', {}, { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toThrow('stopped')
    const cancel = vi.fn()
    finish(new Response(new ReadableStream({ cancel })))
    await Promise.resolve()
    await Promise.resolve()
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('rejects late JSON even when body parsing ignores abort', async () => {
    let finish!: (result: unknown) => void
    const response = Response.json({})
    response.json = () => new Promise(resolve => { finish = resolve })
    vi.stubGlobal('fetch', vi.fn(async () => response))
    const controller = new AbortController()
    const pending = requestEngine('/engine', {}, { signal: controller.signal })
    for (let i = 0; i < 5; i++) await Promise.resolve()
    controller.abort()
    await expect(pending).rejects.toThrow('stopped')
    finish({ move: 'e2e4' })
  })
  it('suppresses a buffered result if its preceding progress callback cancels', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => stream(['event: progress\ndata: {"stage":"thinking","message":"Searching"}\n\nevent: result\ndata: {"move":"e2e4"}\n\n'])))
    const controller = new AbortController()
    await expect(requestEngine('/engine', {}, { signal: controller.signal, onProgress: progress => { if (progress.stage === 'thinking') controller.abort() } })).rejects.toThrow('stopped')
  })
  it('cancels a pending reader without waiting on an uncooperative cancel promise', async () => {
    const cancel = vi.fn(() => new Promise<void>(() => undefined))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ cancel }), { headers: { 'content-type': 'text/event-stream' } })))
    const controller = new AbortController()
    const pending = requestEngine('/engine', {}, { signal: controller.signal })
    for (let i = 0; i < 5; i++) await Promise.resolve()
    controller.abort()
    await expect(pending).rejects.toThrow('stopped')
    expect(cancel).toHaveBeenCalledOnce()
  })
})
