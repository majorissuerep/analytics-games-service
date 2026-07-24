import { describe, expect, it } from 'vitest'
import {
  createPinballState,
  launchPinball,
  PINBALL_BUMPERS,
  stepPinball,
  type PinballState,
} from './model'

const idle = { left: false, right: false }

describe('orbit pinball model', () => {
  it('launches a ready ball', () => {
    const launched = launchPinball(createPinballState())
    expect(launched.status).toBe('playing')
    expect(launched.ball.vy).toBeLessThan(0)
  })

  it('scores a bumper collision', () => {
    const bumper = PINBALL_BUMPERS[0]
    const state: PinballState = {
      ball: { x: bumper.x, y: bumper.y - bumper.radius - 8, vx: 0, vy: 200 },
      score: 0,
      lives: 3,
      status: 'playing',
    }
    const next = stepPinball(state, 0.01, idle)
    expect(next.score).toBe(bumper.points)
    expect(next.ball.vy).toBeLessThan(0)
  })

  it('uses an active flipper to return a descending ball', () => {
    const state: PinballState = {
      ball: { x: 200, y: 640, vx: 0, vy: 100 },
      score: 0,
      lives: 3,
      status: 'playing',
    }
    const next = stepPinball(state, 0.01, { left: true, right: false })
    expect(next.ball.vy).toBe(-590)
    expect(next.score).toBe(25)
  })

  it('returns a drained ball with one fewer life', () => {
    const state: PinballState = {
      ball: { x: 300, y: 780, vx: 0, vy: 100 },
      score: 500,
      lives: 3,
      status: 'playing',
    }
    const next = stepPinball(state, 0.01, idle)
    expect(next.status).toBe('ready')
    expect(next.lives).toBe(2)
    expect(next.score).toBe(500)
  })
})
