import { describe, expect, it, vi } from 'vitest'
import { engineResponse } from './progress-response'

describe('observable engine responses', () => {
  it('preserves the JSON API for existing callers', async () => {
    const response = await engineResponse(new Request('http://localhost'), async report => {
      report({ stage: 'starting', message: 'Starting' })
      return { move: 'e2e4' }
    })
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ move: 'e2e4' })
  })
  it('flushes startup while the real work is still pending, then returns its result', async () => {
    let finish!: () => void
    const pending = new Promise<void>(resolve => { finish = resolve })
    const response = await engineResponse(new Request('http://localhost', { headers: { accept: 'text/event-stream' } }), async report => {
      report({ stage: 'starting', message: 'Loading selected model' })
      await pending
      report({ stage: 'thinking', message: 'Searching', depth: 8 })
      return { move: 'd2d4' }
    })
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let output = ''
    while (!output.includes('Loading selected model')) output += decoder.decode((await reader.read()).value)
    expect(output).not.toContain('event: result')
    finish()
    for (;;) { const next = await reader.read(); if (next.done) break; output += decoder.decode(next.value) }
    expect(output).toContain('"depth":8')
    expect(output).toContain('event: result\ndata: {"move":"d2d4"}')
  })
  it('replaces failed work with a terminal error event', async () => {
    const response = await engineResponse(new Request('http://localhost', { headers: { accept: 'text/event-stream' } }), async () => { throw new Error('Model unavailable') })
    const output = await response.text()
    expect(output).toContain('event: error\ndata: {"error":"Model unavailable"}')
    expect(output).not.toContain('event: result')
  })
})

describe('engine response cancellation propagation', () => {
  it.each(['request', 'reader'])('aborts actual work on %s cancellation', async source => {
    const controller = new AbortController()
    let workSignal!: AbortSignal
    let finish!: () => void
    const pending = new Promise<void>(resolve => { finish = resolve })
    const response = await engineResponse(new Request('http://localhost', { signal: controller.signal, headers: { accept: 'text/event-stream' } }), async (_report, signal) => {
      workSignal = signal
      await pending
      return { move: 'e2e4' }
    })
    const reader = response.body!.getReader()
    await reader.read()
    if (source === 'request') controller.abort()
    else await reader.cancel()
    expect(workSignal.aborted).toBe(true)
    finish()
    await Promise.resolve()
    let output = ''
    for (;;) { const next = await reader.read(); if (next.done) break; output += new TextDecoder().decode(next.value) }
    expect(output).not.toContain('event: result')
  })
  it('does not start work for an already aborted request', async () => {
    const work = vi.fn()
    await expect(engineResponse(new Request('http://localhost', { signal: AbortSignal.abort(), headers: { accept: 'text/event-stream' } }), work)).rejects.toThrow()
    expect(work).not.toHaveBeenCalled()
  })
})
