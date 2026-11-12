import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

const behavior = vi.hoisted(() => ({ hold: '' }))
const children = vi.hoisted(() => [] as Array<{ kill: ReturnType<typeof vi.fn>; writes: string[]; emit: (line: string) => void }>)
vi.mock('node:child_process', () => ({ spawn: vi.fn(() => {
  const child = new EventEmitter() as EventEmitter & Record<string, unknown>
  const stdout = Object.assign(new EventEmitter(), { setEncoding: vi.fn() })
  const writes: string[] = []
  const stdin = Object.assign(new EventEmitter(), { write: (commands: string) => {
    writes.push(commands)
    queueMicrotask(() => {
      if (behavior.hold && commands.includes(behavior.hold)) return
      if (commands === 'uci\n') stdout.emit('data', 'id name test\nuciok\n')
      else if (commands.includes('isready')) stdout.emit('data', 'readyok\n')
      else if (commands.includes('go movetime')) stdout.emit('data', 'info depth 10 multipv 1 score cp 30 pv e2e4\nbestmove e2e4\n')
    })
  } })
  const kill = vi.fn()
  Object.assign(child, { stdout, stdin, stderr: { resume: vi.fn() }, kill })
  children.push({ kill, writes, emit: line => stdout.emit('data', `${line}\n`) })
  return child
}) }))
import { ENGINE_IDLE_MS, UciRuntime } from './uci-runtime'
const request = { fen: 'test-fen', multiPv: 1, moveTimeMs: 100 }

afterEach(() => { vi.useRealTimers(); children.length = 0; behavior.hold = '' })
describe('demand-loaded shared UCI runtime', () => {
  it('reports cold startup, real search depth, and warm reuse without claiming a cold start', async () => {
    const runtime = new UciRuntime('builtin-stockfish-18')
    const cold = vi.fn()
    await runtime.search({ ...request, onProgress: cold })
    expect(cold.mock.calls.map(([event]) => event.stage)).toEqual(['starting', 'initializing', 'thinking', 'thinking'])
    expect(cold).toHaveBeenCalledWith(expect.objectContaining({ depth: 10 }))
    const warm = vi.fn()
    await runtime.search({ ...request, onProgress: warm })
    expect(warm.mock.calls.map(([event]) => event.stage)).not.toContain('starting')
    runtime.dispose()
  })
  it('reports queued work and never starts a cancelled queued search', async () => {
    const runtime = new UciRuntime('reckless-local')
    const active = runtime.search(request)
    const controller = new AbortController()
    const report = vi.fn()
    const queued = runtime.search({ ...request, signal: controller.signal, onProgress: report })
    const rejection = expect(queued).rejects.toThrow()
    controller.abort()
    await active
    await rejection
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ stage: 'queued' }))
    expect(children[0].writes.filter(write => write.includes('go movetime'))).toHaveLength(1)
    runtime.dispose()
  })
  it('does not spawn a runtime for an already cancelled request', async () => {
    const runtime = new UciRuntime('builtin-stockfish-19')
    await expect(runtime.search({ ...request, signal: AbortSignal.abort() })).rejects.toThrow()
    expect(children).toHaveLength(0)
  })
  it('starts only on a request, reuses the process, and serializes simultaneous searches', async () => {
    const runtime = new UciRuntime('builtin-stockfish-18')
    expect(children).toHaveLength(0)
    const results = await Promise.all([runtime.search(request), runtime.search(request)])
    expect(results.map(result => result.bestMove)).toEqual(['e2e4', 'e2e4'])
    expect(children).toHaveLength(1)
    expect(children[0].writes.filter(write => write === 'uci\n')).toHaveLength(1)
    expect(children[0].writes.filter(write => write.includes('go movetime'))).toHaveLength(2)
    runtime.dispose()
  })
  it('unloads after two idle hours and restarts only when selected again', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    const runtime = new UciRuntime('reckless-local')
    await runtime.search(request)
    await vi.advanceTimersByTimeAsync(ENGINE_IDLE_MS - 1)
    expect(children[0].kill).not.toHaveBeenCalled()
    await runtime.search(request)
    await vi.advanceTimersByTimeAsync(ENGINE_IDLE_MS - 1)
    expect(children[0].kill).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(children[0].kill).toHaveBeenCalledOnce()
    expect(children).toHaveLength(1)
    await runtime.search(request)
    expect(children).toHaveLength(2)
    runtime.dispose()
  })
  it('expires a frozen serverless instance using wall time', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    const runtime = new UciRuntime('builtin-stockfish-19')
    await runtime.search(request)
    vi.setSystemTime(Date.now() + ENGINE_IDLE_MS + 1)
    await runtime.search(request)
    expect(children[0].kill).toHaveBeenCalledOnce()
    expect(children).toHaveLength(2)
    runtime.dispose()
  })
})

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
describe('cancellation owns a removable job and isolated UCI channel', () => {
  it('removes canceled queue entries immediately while preserving other-client FIFO', async () => {
    behavior.hold = 'go movetime'
    const runtime = new UciRuntime('builtin-stockfish-18')
    const active = runtime.search(request)
    await flush()
    for (let i = 0; i < 20; i++) {
      const controller = new AbortController()
      const queued = runtime.search({ ...request, signal: controller.signal })
      controller.abort()
      await expect(queued).rejects.toMatchObject({ name: 'AbortError' })
    }
    const other = runtime.search({ ...request, fen: 'other-client' })
    const last = runtime.search({ ...request, fen: 'latest-client' })
    expect(children[0].writes.filter(write => write.includes('go movetime'))).toHaveLength(1)
    children[0].emit('bestmove e2e4')
    await active
    await flush()
    expect(children[0].writes.at(-1)).toContain('other-client')
    children[0].emit('bestmove e2e4')
    await other
    await flush()
    expect(children[0].writes.at(-1)).toContain('latest-client')
    children[0].emit('bestmove e2e4')
    await last
    runtime.dispose()
  })
  it('rejects active cancellation promptly but waits for bestmove before reuse', async () => {
    behavior.hold = 'go movetime'
    const runtime = new UciRuntime('builtin-stockfish-18')
    const controller = new AbortController()
    const report = vi.fn()
    const active = runtime.search({ ...request, signal: controller.signal, onProgress: report })
    await flush()
    const next = runtime.search({ ...request, fen: 'new-position' })
    controller.abort()
    await expect(active).rejects.toMatchObject({ name: 'AbortError' })
    expect(children[0].writes.at(-1)).toBe('stop\n')
    report.mockClear()
    children[0].emit('info depth 99 nodes 100')
    expect(report).not.toHaveBeenCalled()
    expect(children[0].writes.some(write => write.includes('new-position'))).toBe(false)
    children[0].emit('bestmove a2a3')
    await flush()
    expect(children[0].writes.at(-1)).toContain('new-position')
    children[0].emit('bestmove e2e4')
    await expect(next).resolves.toMatchObject({ bestMove: 'e2e4' })
    runtime.dispose()
  })
  it.each(['uci', 'isready'])('aborts %s startup work without stranding another client', async hold => {
    behavior.hold = hold
    const runtime = new UciRuntime('builtin-stockfish-18')
    const controller = new AbortController()
    const active = runtime.search({ ...request, signal: controller.signal })
    await flush()
    const next = runtime.search(request)
    behavior.hold = ''
    controller.abort()
    await expect(active).rejects.toMatchObject({ name: 'AbortError' })
    await expect(next).resolves.toMatchObject({ bestMove: 'e2e4' })
    expect(children[0].kill).toHaveBeenCalledOnce()
    expect(children).toHaveLength(2)
    runtime.dispose()
  })
  it('kills a silent stopped engine after one second and ignores its late stdout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    behavior.hold = 'go movetime'
    const runtime = new UciRuntime('builtin-stockfish-18')
    const controller = new AbortController()
    const active = runtime.search({ ...request, signal: controller.signal })
    await flush()
    const next = runtime.search(request)
    controller.abort()
    await expect(active).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(999)
    expect(children).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(children[0].kill).toHaveBeenCalledOnce()
    expect(children).toHaveLength(2)
    let completed = false
    void next.then(() => { completed = true })
    children[0].emit('bestmove a2a3')
    await flush()
    expect(completed).toBe(false)
    children[1].emit('bestmove e2e4')
    await expect(next).resolves.toMatchObject({ bestMove: 'e2e4' })
    runtime.dispose()
  })
  it('repeated dispose rejects active work and permits restart', async () => {
    behavior.hold = 'go movetime'
    const runtime = new UciRuntime('builtin-stockfish-18')
    const active = runtime.search(request)
    await flush()
    runtime.dispose()
    runtime.dispose()
    await expect(active).rejects.toThrow('stopped')
    behavior.hold = ''
    await expect(runtime.search(request)).resolves.toMatchObject({ bestMove: 'e2e4' })
    runtime.dispose()
  })
})

describe('actual engine cleanup lifetime', () => {
  it('registers before startup and settles active cleanup only after stop/bestmove releases the channel', async () => {
    behavior.hold = 'go movetime'
    const runtime = new UciRuntime('builtin-stockfish-18')
    const controller = new AbortController()
    let cleanup!: Promise<void>
    let released = false
    const active = runtime.search({ ...request, signal: controller.signal, onCleanup: done => {
      expect(children).toHaveLength(0)
      cleanup = done
      void done.then(() => { released = true })
    } })
    await flush()
    controller.abort()
    await expect(active).rejects.toThrow()
    expect(released).toBe(false)
    children[0].emit('bestmove e2e4')
    await cleanup
    expect(released).toBe(true)
    // The canceled job must not retain another client's subsequent search.
    const next = runtime.search(request)
    await flush()
    expect(released).toBe(true)
    children[0].emit('bestmove e2e4')
    await next
    runtime.dispose()
  })
  it('releases a canceled queue job lifetime while the active search still runs', async () => {
    behavior.hold = 'go movetime'
    const runtime = new UciRuntime('builtin-stockfish-18')
    const active = runtime.search(request)
    await flush()
    const controller = new AbortController()
    let cleanup!: Promise<void>
    const queued = runtime.search({ ...request, signal: controller.signal, onCleanup: done => { cleanup = done } })
    controller.abort()
    await expect(queued).rejects.toThrow()
    await cleanup
    expect(children[0].writes.at(-1)).toContain('go movetime')
    children[0].emit('bestmove e2e4')
    await active
    runtime.dispose()
  })
  it('releases cleanup after the one-second silent-stop kill', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    behavior.hold = 'go movetime'
    const runtime = new UciRuntime('builtin-stockfish-18')
    const controller = new AbortController()
    let cleanup!: Promise<void>
    let released = false
    const active = runtime.search({ ...request, signal: controller.signal, onCleanup: done => { cleanup = done; void done.then(() => { released = true }) } })
    await flush()
    controller.abort()
    await expect(active).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(999)
    expect(released).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await cleanup
    expect(children[0].kill).toHaveBeenCalledOnce()
    expect(released).toBe(true)
    runtime.dispose()
  })
  it('settles cleanup for early rejected and successfully completed work', async () => {
    const runtime = new UciRuntime('builtin-stockfish-18')
    const cleanups: Promise<void>[] = []
    await expect(runtime.search({ ...request, signal: AbortSignal.abort(), onCleanup: done => cleanups.push(done) })).rejects.toThrow()
    await runtime.search({ ...request, onCleanup: done => cleanups.push(done) })
    await Promise.all(cleanups)
    expect(cleanups).toHaveLength(2)
    runtime.dispose()
  })
})

describe('cleanup lifetime on admission failures', () => {
  it('settles cleanup and preserves a queued progress callback error', async () => {
    behavior.hold = 'go movetime'
    const runtime = new UciRuntime('builtin-stockfish-18')
    const active = runtime.search(request)
    await flush()
    let cleanup!: Promise<void>
    const failed = runtime.search({ ...request, onCleanup: done => { cleanup = done }, onProgress: () => { throw new Error('consumer failed') } })
    await expect(failed).rejects.toThrow('consumer failed')
    await cleanup
    children[0].emit('bestmove e2e4')
    await active
    runtime.dispose()
  })
})

describe('queue saturation cleanup', () => {
  it('settles rejected capacity lifetime without waiting for admitted searches', async () => {
    behavior.hold = 'go movetime'
    const runtime = new UciRuntime('builtin-stockfish-18')
    const active = runtime.search(request)
    await flush()
    const controllers = Array.from({ length: 7 }, () => new AbortController())
    const queued = controllers.map(controller => runtime.search({ ...request, signal: controller.signal }))
    const rejections = queued.map(pending => expect(pending).rejects.toThrow())
    let cleanup!: Promise<void>
    await expect(runtime.search({ ...request, onCleanup: done => { cleanup = done } })).rejects.toThrow('busy')
    await cleanup
    controllers.forEach(controller => controller.abort())
    await Promise.all(rejections)
    children[0].emit('bestmove e2e4')
    await active
    runtime.dispose()
  })
})
