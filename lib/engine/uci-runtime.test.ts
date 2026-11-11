import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

const children = vi.hoisted(() => [] as Array<{ kill: ReturnType<typeof vi.fn>; writes: string[] }>)
vi.mock('node:child_process', () => ({ spawn: vi.fn(() => {
  const child = new EventEmitter() as EventEmitter & Record<string, unknown>
  const stdout = Object.assign(new EventEmitter(), { setEncoding: vi.fn() })
  const writes: string[] = []
  const stdin = Object.assign(new EventEmitter(), { write: (commands: string) => {
    writes.push(commands)
    queueMicrotask(() => {
      if (commands === 'uci\n') stdout.emit('data', 'id name test\nuciok\n')
      else if (commands.includes('isready')) stdout.emit('data', 'readyok\n')
      else if (commands.includes('go movetime')) stdout.emit('data', 'info depth 10 multipv 1 score cp 30 pv e2e4\nbestmove e2e4\n')
    })
  } })
  const kill = vi.fn()
  Object.assign(child, { stdout, stdin, stderr: { resume: vi.fn() }, kill })
  children.push({ kill, writes })
  return child
}) }))
import { ENGINE_IDLE_MS, UciRuntime } from './uci-runtime'
const request = { fen: 'test-fen', multiPv: 1, moveTimeMs: 100 }

afterEach(() => { vi.useRealTimers(); children.length = 0 })
describe('demand-loaded shared UCI runtime', () => {
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
