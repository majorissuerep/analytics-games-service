import type { EngineProgress, ReportEngineProgress } from '../engine-progress'

/** Settle even when an integration fails to honor fetch/reader cancellation. */
function abortable<T>(pending: Promise<T>, signal: AbortSignal, discard?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason) }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    pending.then(value => {
      if (signal.aborted) { discard?.(value); reject(signal.reason) }
      else resolve(value)
    }, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

/** Supports streaming production responses and legacy JSON integrations. */
export async function requestEngine<T>(url: string, body: unknown, options: { signal?: AbortSignal; onProgress?: ReportEngineProgress } = {}): Promise<T> {
  try { return await performEngineRequest<T>(url, body, options) } catch (error) {
    if (options.signal?.aborted) throw new Error('Engine request stopped. Retry when ready.')
    if (error instanceof Error && error.name === 'TimeoutError') throw new Error('The selected engine took too long. Please retry or choose another engine.')
    throw error
  }
}

async function performEngineRequest<T>(url: string, body: unknown, options: { signal?: AbortSignal; onProgress?: ReportEngineProgress }): Promise<T> {
  options.signal?.throwIfAborted()
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(55_000)]) : AbortSignal.timeout(55_000)
  options.onProgress?.({ stage: 'connecting', message: 'Connecting to the selected engine' })
  signal.throwIfAborted()
  const response = await abortable(fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(body), signal,
  }), signal, response => { void response.body?.cancel().catch(() => undefined) })
  signal.throwIfAborted()
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    const value = await abortable(response.json(), signal) as T & { error?: string }
    signal.throwIfAborted()
    if (!response.ok) throw new Error(value.error || 'Engine request failed')
    return value
  }
  if (!response.ok || !response.body) throw new Error('Engine connection failed')
  const reader = response.body.getReader()
  const cancel = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener('abort', cancel, { once: true })
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await abortable(reader.read(), signal)
      signal.throwIfAborted()
      buffer = (buffer + decoder.decode(value, { stream: !done })).replaceAll('\r\n', '\n')
      if (buffer.length > 1024 * 1024) throw new Error('Engine response exceeded its size limit')
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, boundary)
        signal.throwIfAborted()
        buffer = buffer.slice(boundary + 2)
        const event = frame.split('\n').find(line => line.startsWith('event:'))?.slice(6).trim()
        const json = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
        if (!json) continue
        signal.throwIfAborted()
        const data = JSON.parse(json)
        if (event === 'progress') options.onProgress?.(data as EngineProgress)
        signal.throwIfAborted()
        if (event === 'error') throw new Error(typeof data.error === 'string' ? data.error : 'Engine request failed')
        if (event === 'result') return data as T
      }
      if (done) throw new Error('Engine connection ended before a result arrived. Please retry.')
    }
  } finally { signal.removeEventListener('abort', cancel); void reader.cancel().catch(() => undefined); reader.releaseLock() }
}
