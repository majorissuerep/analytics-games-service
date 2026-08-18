import { describe, expect, it } from 'vitest'
import {
  createInitialState,
  createBall,
  launchBall,
  handleCollision,
  checkDropTargets,
  handleBallDrain,
  startGame,
} from './model'
import type { CircleWall, Slingshot, SegmentWall } from './physics'
import { vec, type Ball } from './physics'

describe('createInitialState', () => {
  it('starts in ready phase with 3 balls', () => {
    const s = createInitialState(0)
    expect(s.phase).toBe('ready')
    expect(s.balls).toBe(3)
    expect(s.maxBalls).toBe(3)
    expect(s.score).toBe(0)
    expect(s.multiplier).toBe(1)
    expect(s.dropTargets).toHaveLength(4)
    expect(s.rolloverLanes).toHaveLength(3)
    expect(s.scoreZones).toHaveLength(3)
  })

  it('preserves high score', () => {
    const s = createInitialState(5000)
    expect(s.highScore).toBe(5000)
  })
})

describe('createBall', () => {
  it('creates a ball in the plunger lane', () => {
    const ball = createBall()
    expect(ball.alive).toBe(true)
    expect(ball.radius).toBe(9)
    expect(ball.pos.x).toBeGreaterThan(230) // right side of table
    expect(ball.vel.x).toBe(0)
    expect(ball.vel.y).toBe(0)
  })
})

describe('launchBall', () => {
  it('produces upward velocity', () => {
    const vel = launchBall(1.0)
    expect(vel.y).toBeLessThan(0) // upward (negative y)
    expect(Math.abs(vel.y)).toBeGreaterThan(1000)
  })

  it('scales with power', () => {
    const full = launchBall(1.0)
    const half = launchBall(0.5)
    expect(Math.abs(half.y)).toBeLessThan(Math.abs(full.y))
  })

  it('has minimum power even at 0', () => {
    const vel = launchBall(0)
    expect(Math.abs(vel.y)).toBeGreaterThan(100)
  })
})

describe('handleCollision', () => {
  it('scores bumper hits', () => {
    const state = createInitialState(0)
    const bumper: CircleWall = {
      kind: 'circle',
      center: vec(100, 100),
      radius: 14,
      restitution: 0.85,
      bumper: true,
    }
    const next = handleCollision(state, bumper, 1000)
    expect(next.score).toBe(100) // BUMPER_POINTS = 100, multiplier 1
    expect(next.combo).toBe(1)
  })

  it('scores slingshot hits', () => {
    const state = createInitialState(0)
    const sling: Slingshot = {
      kind: 'slingshot',
      vertices: [vec(0, 0), vec(0, 50), vec(50, 25)],
      faceNormal: vec(1, 0),
      restitution: 0.5,
      kick: 300,
    }
    const next = handleCollision(state, sling, 1000)
    expect(next.score).toBe(50) // SLINGSHOT_POINTS = 50
  })

  it('increases multiplier with combo', () => {
    let state = createInitialState(0)
    const bumper: CircleWall = {
      kind: 'circle',
      center: vec(100, 100),
      radius: 14,
      restitution: 0.85,
      bumper: true,
    }
    // Hit bumper 3 times quickly
    state = handleCollision(state, bumper, 1000)
    state = handleCollision(state, bumper, 1100)
    state = handleCollision(state, bumper, 1200)
    expect(state.combo).toBe(3)
    expect(state.multiplier).toBe(2) // 1 + floor(3/3) = 2
  })

  it('resets combo after timeout', () => {
    let state = createInitialState(0)
    const bumper: CircleWall = {
      kind: 'circle',
      center: vec(100, 100),
      radius: 14,
      restitution: 0.85,
      bumper: true,
    }
    state = handleCollision(state, bumper, 1000)
    state = handleCollision(state, bumper, 1100)
    // Hit after 3 seconds (outside 2s combo window)
    state = handleCollision(state, bumper, 4000)
    expect(state.combo).toBe(1)
    expect(state.multiplier).toBe(1)
  })

  it('does not score on plain wall hits', () => {
    const state = createInitialState(0)
    const wall: SegmentWall = {
      kind: 'segment',
      a: vec(0, 0),
      b: vec(100, 0),
      normal: vec(0, -1),
      restitution: 0.3,
    }
    const next = handleCollision(state, wall, 1000)
    expect(next.score).toBe(0)
  })
})

describe('checkDropTargets', () => {
  it('knocks down a target when ball overlaps', () => {
    const state = createInitialState(0)
    const target = state.dropTargets[0]
    const ball: Ball = {
      pos: { x: target.pos.x + target.width / 2, y: target.pos.y + target.height / 2 },
      vel: vec(0, 0),
      radius: 9,
      alive: true,
    }
    const { state: next, newColliders } = checkDropTargets(state, ball, 1000)
    expect(next.dropTargets[0].knockedDown).toBe(true)
    expect(next.score).toBeGreaterThan(0)
    // Standing targets still produce colliders
    expect(newColliders.length).toBeLessThan(state.dropTargets.length * 3)
  })

  it('does nothing when ball is far away', () => {
    const state = createInitialState(0)
    const ball: Ball = { pos: vec(200, 200), vel: vec(0, 0), radius: 9, alive: true }
    const { state: next, newColliders } = checkDropTargets(state, ball, 1000)
    expect(next).toBe(state)
    expect(newColliders.length).toBe(0)
  })

  it('awards bank clear bonus when all targets down', () => {
    let state = createInitialState(0)
    // Knock down all targets one by one
    for (let i = 0; i < state.dropTargets.length; i++) {
      const target = state.dropTargets[i]
      const ball: Ball = {
        pos: { x: target.pos.x + target.width / 2, y: target.pos.y + target.height / 2 },
        vel: vec(0, 0),
        radius: 9,
        alive: true,
      }
      const result = checkDropTargets(state, ball, 1000 + i * 100)
      state = result.state
    }
    // All targets should be down
    expect(state.dropTargets.every((t) => t.knockedDown)).toBe(true)
    // Bank clear bonus (500) + 4 * 100 = 900
    expect(state.score).toBe(900)
  })
})

describe('handleBallDrain', () => {
  it('decrements balls and goes to plunger', () => {
    const state = createInitialState(0)
    const next = handleBallDrain(state, 1000)
    expect(next.balls).toBe(2)
    expect(next.phase).toBe('plunger')
    expect(next.score).toBe(state.score + state.bonus) // bonus added
  })

  it('ends game on last ball', () => {
    const state = { ...createInitialState(0), balls: 1, score: 5000, bonus: 200 }
    const next = handleBallDrain(state, 1000)
    expect(next.balls).toBe(0)
    expect(next.phase).toBe('game_over')
    expect(next.highScore).toBe(5200) // score + bonus
  })

  it('handles multiball drain', () => {
    const state = { ...createInitialState(0), multiball: true, multiballBalls: 2 }
    const next = handleBallDrain(state, 1000)
    expect(next.multiball).toBe(true)
    expect(next.multiballBalls).toBe(1)
  })

  it('ends multiball when last extra ball drains', () => {
    const state = { ...createInitialState(0), multiball: true, multiballBalls: 1 }
    const next = handleBallDrain(state, 1000)
    expect(next.multiball).toBe(false)
    expect(next.multiballBalls).toBe(0)
  })
})

describe('startGame', () => {
  it('resets to fresh state with plunger phase', () => {
    const state = { ...createInitialState(0), score: 9999, balls: 0, phase: 'game_over' as const, highScore: 9999 }
    const next = startGame(state)
    expect(next.phase).toBe('plunger')
    expect(next.score).toBe(0)
    expect(next.balls).toBe(3)
    expect(next.highScore).toBe(9999) // preserved
  })
})
