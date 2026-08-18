import { describe, expect, it } from 'vitest'
import {
  vec,
  vadd,
  vsub,
  vscale,
  vlen,
  vdist,
  vnorm,
  vdot,
  vperp,
  reflect,
  clamp,
  lerp,
  closestPointOnSegment,
  circleVsSegment,
  circleVsCircle,
  circleVsArc,
  circleVsFlipper,
  flipperTip,
  createWorld,
  stepWorld,
  type Ball,
  type Flipper,
  type SegmentWall,
  type CircleWall,
  type ArcWall,
} from './physics'

describe('Vector math', () => {
  it('adds vectors', () => {
    expect(vadd(vec(1, 2), vec(3, 4))).toEqual(vec(4, 6))
  })

  it('subtracts vectors', () => {
    expect(vsub(vec(5, 6), vec(2, 3))).toEqual(vec(3, 3))
  })

  it('scales vectors', () => {
    expect(vscale(vec(2, 3), 2)).toEqual(vec(4, 6))
  })

  it('computes length', () => {
    expect(vlen(vec(3, 4))).toBe(5)
  })

  it('computes distance', () => {
    expect(vdist(vec(0, 0), vec(3, 4))).toBe(5)
  })

  it('normalizes', () => {
    const n = vnorm(vec(3, 4))
    expect(n.x).toBeCloseTo(0.6)
    expect(n.y).toBeCloseTo(0.8)
  })

  it('computes dot product', () => {
    expect(vdot(vec(1, 2), vec(3, 4))).toBe(11)
  })

  it('computes perpendicular', () => {
    const p = vperp(vec(1, 0))
    expect(p.y).toBe(1)
    expect(Math.abs(p.x)).toBe(0)
  })

  it('reflects velocity about normal with restitution', () => {
    // Ball moving down (0, 10), floor normal up (0, -1), restitution 1
    const r = reflect(vec(0, 10), vec(0, -1), 1)
    expect(r.x).toBeCloseTo(0)
    expect(r.y).toBeCloseTo(-10)
  })

  it('reflects with partial restitution', () => {
    const r = reflect(vec(0, 10), vec(0, -1), 0.5)
    expect(r.y).toBeCloseTo(-5)
  })

  it('clamps values', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(20, 0, 10)).toBe(10)
  })

  it('lerps', () => {
    expect(lerp(0, 10, 0.5)).toBe(5)
  })
})

describe('closestPointOnSegment', () => {
  it('projects to midpoint', () => {
    const { point, t } = closestPointOnSegment(vec(5, 5), vec(0, 0), vec(10, 0))
    expect(t).toBeCloseTo(0.5)
    expect(point).toEqual(vec(5, 0))
  })

  it('clamps to start', () => {
    const { point, t } = closestPointOnSegment(vec(-5, 5), vec(0, 0), vec(10, 0))
    expect(t).toBe(0)
    expect(point).toEqual(vec(0, 0))
  })

  it('clamps to end', () => {
    const { point, t } = closestPointOnSegment(vec(15, 5), vec(0, 0), vec(10, 0))
    expect(t).toBe(1)
    expect(point).toEqual(vec(10, 0))
  })
})

describe('circleVsSegment', () => {
  const wall: SegmentWall = {
    kind: 'segment',
    a: vec(0, 0),
    b: vec(100, 0),
    normal: vec(0, -1),
    restitution: 0.5,
  }

  it('detects collision above the wall', () => {
    const ball: Ball = { pos: vec(50, -3), vel: vec(0, 0), radius: 5, alive: true }
    const hit = circleVsSegment(ball, wall)
    expect(hit).not.toBeNull()
    expect(hit!.depth).toBeCloseTo(2)
    expect(hit!.normal.y).toBeCloseTo(-1)
  })

  it('does not collide when far away', () => {
    const ball: Ball = { pos: vec(50, -20), vel: vec(0, 0), radius: 5, alive: true }
    const hit = circleVsSegment(ball, wall)
    expect(hit).toBeNull()
  })
})

describe('circleVsCircle', () => {
  const post: CircleWall = {
    kind: 'circle',
    center: vec(50, 50),
    radius: 10,
    restitution: 0.5,
  }

  it('detects overlap', () => {
    const ball: Ball = { pos: vec(55, 50), vel: vec(0, 0), radius: 8, alive: true }
    const hit = circleVsCircle(ball, post)
    expect(hit).not.toBeNull()
    // dist=5, minDist=10+8=18, depth=13
    expect(hit!.depth).toBeCloseTo(13)
  })

  it('does not collide when separated', () => {
    const ball: Ball = { pos: vec(100, 100), vel: vec(0, 0), radius: 8, alive: true }
    const hit = circleVsCircle(ball, post)
    expect(hit).toBeNull()
  })
})

describe('circleVsArc', () => {
  // Arc covers angles [0, PI] — in screen coords (y down), this is the lower half.
  // normalDir=-1 means ball collides from inside (dist < radius).
  const arc: ArcWall = {
    kind: 'arc',
    center: vec(100, 100),
    radius: 50,
    startAngle: 0,
    endAngle: Math.PI,
    normalDir: -1,
    restitution: 0.3,
  }

  it('detects collision within arc span', () => {
    // Ball below center (angle PI/2, in [0,PI]), inside the arc (dist < radius)
    const ball: Ball = { pos: vec(100, 145), vel: vec(0, 0), radius: 8, alive: true }
    const hit = circleVsArc(ball, arc)
    expect(hit).not.toBeNull()
    // dist=45, surfaceDist=|45-50|=5, depth=8-5=3
    expect(hit!.depth).toBeCloseTo(3)
  })

  it('does not collide when angle is outside arc span', () => {
    // Ball above center (angle -PI/2 = 3PI/2, NOT in [0,PI])
    const ball: Ball = { pos: vec(100, 55), vel: vec(0, 0), radius: 8, alive: true }
    const hit = circleVsArc(ball, arc)
    expect(hit).toBeNull()
  })

  it('does not collide when on wrong side (outside the arc)', () => {
    // Ball below center but dist > radius (outside the arc, wrong side for normalDir=-1)
    const ball: Ball = { pos: vec(100, 155), vel: vec(0, 0), radius: 8, alive: true }
    const hit = circleVsArc(ball, arc)
    expect(hit).toBeNull()
  })
})

describe('circleVsFlipper', () => {
  it('detects collision with flipper body', () => {
    const flipper: Flipper = {
      kind: 'flipper',
      pivot: vec(50, 100),
      length: 60,
      angle: 0,
      restAngle: 0,
      activeAngle: -0.5,
      angularVelocity: 0,
      flipSpeed: 20,
      returnSpeed: 8,
      restitution: 0.3,
      active: false,
      radius: 7,
      side: 'left',
    }
    // Ball just above the flipper shaft
    const ball: Ball = { pos: vec(80, 95), vel: vec(0, 0), radius: 9, alive: true }
    const hit = circleVsFlipper(ball, flipper)
    expect(hit).not.toBeNull()
    expect(hit!.surfaceVel.x).toBeCloseTo(0)
    expect(hit!.surfaceVel.y).toBeCloseTo(0)
  })

  it('computes surface velocity when rotating', () => {
    const flipper: Flipper = {
      kind: 'flipper',
      pivot: vec(50, 100),
      length: 60,
      angle: 0,
      restAngle: 0,
      activeAngle: -0.5,
      angularVelocity: -20, // rotating counter-clockwise (upward)
      flipSpeed: 20,
      returnSpeed: 8,
      restitution: 0.3,
      active: true,
      radius: 7,
      side: 'left',
    }
    const tip = flipperTip(flipper)
    const ball: Ball = { pos: vec(tip.x, tip.y - 5), vel: vec(0, 0), radius: 9, alive: true }
    const hit = circleVsFlipper(ball, flipper)
    expect(hit).not.toBeNull()
    // Surface velocity at tip with omega=-20, r=(60,0): v = (-omega*ry, omega*rx) = (0, -1200)
    expect(hit!.surfaceVel.y).toBeLessThan(0)
  })
})

describe('stepWorld', () => {
  it('applies gravity to a falling ball', () => {
    const world = createWorld(vec(0, 1000), 0)
    const ball: Ball = { pos: vec(50, 50), vel: vec(0, 0), radius: 10, alive: true }
    world.balls = [ball]
    world.colliders = []
    stepWorld(world, 0.1)
    // After 0.1s of gravity: vy = g*t = 100, pos y += ~5 (approx due to sub-stepping)
    expect(ball.vel.y).toBeGreaterThan(50)
    expect(ball.pos.y).toBeGreaterThan(50)
  })

  it('bounces a ball off a floor', () => {
    const world = createWorld(vec(0, 0), 0)
    const floor: SegmentWall = {
      kind: 'segment',
      a: vec(0, 100),
      b: vec(200, 100),
      normal: vec(0, -1),
      restitution: 1.0,
    }
    world.colliders = [floor]
    const ball: Ball = { pos: vec(100, 90), vel: vec(0, 20), radius: 10, alive: true }
    world.balls = [ball]
    stepWorld(world, 0.016)
    // Ball should have bounced — velocity reversed
    expect(ball.vel.y).toBeLessThan(0)
  })

  it('respects ball alive flag', () => {
    const world = createWorld(vec(0, 1000), 0)
    const ball: Ball = { pos: vec(50, 50), vel: vec(0, 0), radius: 10, alive: false }
    world.balls = [ball]
    stepWorld(world, 0.1)
    expect(ball.pos.y).toBe(50) // no movement
    expect(ball.vel.y).toBe(0)
  })
})
