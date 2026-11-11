import type { EngineProgress, ReportEngineProgress } from '../engine-progress'

/** Supports streaming production responses and legacy JSON integrations. */
export async function requestEngine<T>(url: string, body: unknown, options: { signal?: AbortSignal; onProgress?: ReportEngineProgress } = {}): Promise<T> {
  try { return await performEngineRequest<T>(url, body, options) } catch (error) {
    if (options.signal?.aborted) throw new Error('Engine request stopped. Retry when ready.')
    if (error instanceof Error && error.name === 'TimeoutError') throw new Error('The selected engine took too long. Please retry or choose another engine.')
    throw error
  }
}

async function performEngineRequest<T>(url: string, body: unknown, options: { signal?: AbortSignal; onProgress?: ReportEngineProgress }): Promise<T> {
  options.onProgress?.({ stage: 'connecting', message: 'Connecting to the selected engine' })
  const response = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(body), signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(55_000)]) : AbortSignal.timeout(55_000),
  })
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    const value = await response.json() as T & { error?: string }
    if (!response.ok) throw new Error(value.error || 'Engine request failed')
    return value
  }
  if (!response.ok || !response.body) throw new Error('Engine connection failed')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      buffer = (buffer + decoder.decode(value, { stream: !done })).replaceAll('\r\n', '\n')
      if (buffer.length > 1024 * 1024) throw new Error('Engine response exceeded its size limit')
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const event = frame.split('\n').find(line => line.startsWith('event:'))?.slice(6).trim()
        const json = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
        if (!json) continue
        const data = JSON.parse(json)
        if (event === 'progress') options.onProgress?.(data as EngineProgress)
        if (event === 'error') throw new Error(typeof data.error === 'string' ? data.error : 'Engine request failed')
        if (event === 'result') return data as T
      }
      if (done) throw new Error('Engine connection ended before a result arrived. Please retry.')
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock() }
}
