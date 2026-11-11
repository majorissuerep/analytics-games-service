import type { ReportEngineProgress } from './engine-progress'

/** JSON remains the default API; browsers opt into observable work via SSE. */
export async function engineResponse<T>(request: Request, work: (report: ReportEngineProgress) => Promise<T>): Promise<Response> {
  if (!request.headers.get('accept')?.includes('text/event-stream')) return Response.json(await work(() => undefined))
  const encoder = new TextEncoder()
  let closed = false
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let cleanup: () => void = () => undefined
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        request.signal.removeEventListener('abort', close)
        controller.close()
      }
      cleanup = close
      const send = (event: string, data: unknown) => {
        if (!closed && !request.signal.aborted) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      // A real initial frame also clears buffering in browsers with a minimum chunk size.
      controller.enqueue(encoder.encode(`: ${' '.repeat(2048)}\n\n`))
      send('progress', { stage: 'connecting', message: 'Connected to engine service' })
      heartbeat = setInterval(() => { if (!closed) controller.enqueue(encoder.encode(': heartbeat\n\n')) }, 10_000)
      request.signal.addEventListener('abort', close, { once: true })
      void Promise.resolve().then(() => work(progress => send('progress', progress))).then(result => send('result', result)).catch(error => send('error', { error: error instanceof Error ? error.message : 'Engine request failed. Please retry.' })).finally(close)
    },
    cancel() { closed = true; clearInterval(heartbeat); request.signal.removeEventListener('abort', cleanup) },
  })
  return new Response(stream, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no' } })
}
