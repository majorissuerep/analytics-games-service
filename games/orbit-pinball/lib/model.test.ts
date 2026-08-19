import { describe, expect, it } from 'vitest'
import type { PhysicsEvent, PhysicsEventKind } from './physics'
import {
  createInitialState,
  handleDrain,
  handlePhysicsEvent,
  launchBall,
  objectiveFor,
  registerNudge,
  serveNextBall,
  startGame,
  tickState,
  type PinballState,
} from './model'
import { rolloverIds, targetIds } from './table'

function playing(now = 1_000): PinballState {
  return launchBall(startGame(now), now)
}

function event(kind: PhysicsEventKind, elementId: string, ballId = 'ball-1'): PhysicsEvent {
  return { kind, elementId, ballId, speed: 500, x: 200, y: 300 }
}

describe('Neon Forge rules', () => {
  it('starts in attract mode with three balls', () => {
    const state = createInitialState()
    expect(state.phase).toBe('attract')
    expect(state.ballsRemaining).toBe(3)
    expect(state.dropTargets).toEqual(Object.fromEntries(targetIds().map((id) => [id, false])))
  })

  it('arms ball save only after a real launch', () => {
    const ready = startGame(1_000)
    expect(ready.phase).toBe('plunger')
    expect(ready.ballSaveUntil).toBe(0)
    const launched = launchBall(ready, 2_000)
    expect(launched.phase).toBe('playing')
    expect(launched.ballSaveUntil).toBeGreaterThan(10_000)
  })

  it('builds a bounded shot combo', () => {
    let state = playing()
    for (let index = 0; index < 8; index += 1) {
      state = handlePhysicsEvent(state, event('bumper', `bumper-${index}`), 1_100 + index * 100).state
    }
    expect(state.combo).toBe(5)
    expect(state.score).toBeGreaterThan(5_000)
  })

  it('completes F·O·R·G·E and lights lock once', () => {
    let state = playing()
    let lastEffects: string[] = []
    targetIds().forEach((id, index) => {
      const update = handlePhysicsEvent(state, event('target', id), 1_100 + index * 100)
      state = update.state
      lastEffects = update.effects.map((effect) => effect.type)
    })
    expect(Object.values(state.dropTargets).every(Boolean)).toBe(true)
    expect(state.lockLit).toBe(true)
    expect(state.message).toBe('BALL LOCK LIT')
    expect(lastEffects).toContain('target-down')
  })

  it('captures the first locked ball and serves a replacement', () => {
    const state = { ...playing(), lockLit: true }
    const update = handlePhysicsEvent(state, event('lock', 'lock'), 2_000)
    expect(update.state.lockedBalls).toBe(1)
    expect(update.state.phase).toBe('plunger')
    expect(update.effects).toEqual(expect.arrayContaining([
      { type: 'capture-ball', ballId: 'ball-1' },
      { type: 'serve-ball' },
      { type: 'reset-targets' },
    ]))
  })

  it('starts three-ball multiball on the second qualified lock', () => {
    const state = { ...playing(), lockLit: true, lockedBalls: 1 }
    const update = handlePhysicsEvent(state, event('lock', 'lock', 'ball-2'), 3_000)
    expect(update.state.multiball).toBe(true)
    expect(update.state.lockedBalls).toBe(0)
    expect(update.effects).toContainEqual({ type: 'spawn-multiball', count: 3 })
    expect(update.effects).toContainEqual({ type: 'capture-ball', ballId: 'ball-2' })
  })

  it('raises the playfield multiplier when all N·E·O·N lanes roll over', () => {
    let state = playing()
    rolloverIds().forEach((id, index) => {
      state = handlePhysicsEvent(state, event('rollover', id), 2_000 + index * 100).state
    })
    expect(state.multiplier).toBe(2)
    expect(Object.values(state.rollovers).every((lit) => !lit)).toBe(true)
  })

  it('charges the turbine and cashes it out at the ramp', () => {
    let state = playing()
    for (let index = 0; index < 9; index += 1) {
      state = handlePhysicsEvent(state, event('spinner', 'spinner'), 2_000 + index * 100).state
    }
    const before = state.score
    const update = handlePhysicsEvent(state, event('ramp', 'reactor-ramp'), 3_200)
    expect(update.state.spinnerCharge).toBe(0)
    expect(update.state.score - before).toBeGreaterThanOrEqual(14_000)
    expect(update.state.message).toBe('TURBINE CASHOUT')
  })

  it('starts Reactor Rush and doubles scoring for thirty seconds', () => {
    const baseline = handlePhysicsEvent(playing(), event('bumper', 'bumper-a'), 2_000).points
    const rush = handlePhysicsEvent(playing(), event('scoop', 'scoop'), 1_500).state
    const doubled = handlePhysicsEvent(rush, event('bumper', 'bumper-a'), 5_000).points
    expect(rush.mode).toBe('reactor-rush')
    expect(doubled).toBe(baseline * 2)
  })

  it('awards and escalates multiball jackpots', () => {
    const state = { ...playing(), multiball: true, jackpotValue: 50_000 }
    const update = handlePhysicsEvent(state, event('jackpot', 'reactor-core'), 2_000)
    expect(update.points).toBe(50_000)
    expect(update.state.jackpots).toBe(1)
    expect(update.state.jackpotValue).toBe(75_000)
  })

  it('returns a saved ball without consuming inventory', () => {
    const state = { ...playing(1_000), score: 500, bonus: 2_000, ballSaveUntil: 10_000 }
    const update = handleDrain(state, 5_000, 0)
    expect(update.state.phase).toBe('plunger')
    expect(update.state.ballsRemaining).toBe(3)
    expect(update.state.score).toBe(500)
    expect(update.effects).toContainEqual({ type: 'serve-ball' })
  })

  it('ends multiball without ending the current ball while another ball remains', () => {
    const state = { ...playing(), score: 500, bonus: 2_000, multiball: true, ballSaveUntil: 0 }
    const update = handleDrain(state, 5_000, 1)
    expect(update.state.phase).toBe('playing')
    expect(update.state.multiball).toBe(false)
    expect(update.state.ballsRemaining).toBe(3)
    expect(update.state.score).toBe(500)
  })

  it('counts bonus, advances balls, and serves the next ball', () => {
    const state = { ...playing(), bonus: 2_000, multiplier: 3, ballSaveUntil: 0 }
    const drained = handleDrain(state, 5_000, 0)
    expect(drained.state.score).toBe(6_000)
    expect(drained.state.phase).toBe('ball-over')
    expect(drained.state.ballNumber).toBe(2)
    const served = serveNextBall(drained.state, drained.state.messageUntil)
    expect(served.state.phase).toBe('plunger')
    expect(served.effects).toContainEqual({ type: 'serve-ball' })
  })

  it('reaches a real game-over terminal state after ball three', () => {
    const state = { ...playing(), ballsRemaining: 1, ballNumber: 3, ballSaveUntil: 0 }
    const update = handleDrain(state, 8_000, 0)
    expect(update.state.phase).toBe('game-over')
    expect(update.state.ballsRemaining).toBe(0)
  })

  it('tilts after three nudges inside the danger window', () => {
    let state = playing()
    state = registerNudge(state, 2_000)
    state = registerNudge(state, 2_800)
    expect(state.message).toBe('DANGER')
    state = registerNudge(state, 3_500)
    expect(state.tilted).toBe(true)
    expect(state.ballSaveUntil).toBe(0)
    expect(objectiveFor(state)).toBe('TILT')
    expect(handlePhysicsEvent(state, event('bumper', 'bumper-a'), 3_600).points).toBe(0)
  })

  it('expires combos and timed modes deterministically', () => {
    const state = { ...playing(), combo: 4, comboExpiresAt: 2_000, mode: 'reactor-rush' as const, modeEndsAt: 2_500 }
    const next = tickState(state, 3_000)
    expect(next.combo).toBe(0)
    expect(next.mode).toBeNull()
  })

  it('settles an expired message once instead of forcing a render every frame', () => {
    const expired = tickState({ ...playing(), message: 'OLD', messageUntil: 1_000 }, 2_000)
    expect(expired.message).toBe('COMPLETE F·O·R·G·E TO LIGHT LOCK')
    expect(expired.messageUntil).toBe(Number.POSITIVE_INFINITY)
    expect(tickState(expired, 2_100)).toBe(expired)
  })
})
