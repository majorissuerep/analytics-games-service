/**
 * Original 2D pinball physics engine — written from scratch for this platform.
 *
 * No external physics library is used. The engine implements:
 *  - A lightweight Vector2 type with the math we need.
 *  - Circle-vs-segment, circle-vs-circle, circle-vs-arc, and
 *    circle-vs-rotating-flipper collision detection with impulse-based
 *    response and configurable restitution.
 *  - Gravity, sub-stepped integration for tunneling prevention.
 *  - A small set of collider "shapes" that compose a pinball table.
 *
 * Everything here is original code. The collision formulas are standard
 * analytic geometry (point-to-segment distance, reflection about a normal)
 * reimplemented from first principles.
 */

// ---------------------------------------------------------------------------
// Vector math
// ---------------------------------------------------------------------------

export interface Vec2 {
  x: number
  y: number
}

export const vec = (x: number, y: number): Vec2 => ({ x, y })

export const vadd = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const vsub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const vscale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s })
export const vlen = (a: Vec2): number => Math.hypot(a.x, a.y)
export const vlenSq = (a: Vec2): number => a.x * a.x + a.y * a.y
export const vdist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)
export const vdistSq = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}
export const vnorm = (a: Vec2): Vec2 => {
  const l = vlen(a)
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l }
}
export const vdot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y
export const vperp = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x })
export const vlerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})
export const vangle = (a: Vec2): number => Math.atan2(a.y, a.x)
export const vfromAngle = (angle: number, len = 1): Vec2 => ({ x: Math.cos(angle) * len, y: Math.sin(angle) * len })

/** Reflect velocity `v` about surface normal `n` with restitution `e`. */
export const reflect = (v: Vec2, n: Vec2, e: number): Vec2 => {
  const d = vdot(v, n)
  return { x: v.x - (1 + e) * d * n.x, y: v.y - (1 + e) * d * n.y }
}

/** Clamp a value to [lo, hi]. */
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** Linear interpolation. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

// ---------------------------------------------------------------------------
// Collider shapes
// ---------------------------------------------------------------------------

/** A static line-segment wall. */
export interface SegmentWall {
  kind: 'segment'
  a: Vec2
  b: Vec2
  /** Normal pointing into the playable area. */
  normal: Vec2
  restitution: number
}

/** A static circular bumper (also used for posts / pegs). */
export interface CircleWall {
  kind: 'circle'
  center: Vec2
  radius: number
  restitution: number
  /** If true, this is a scoring bumper, not just a wall. */
  bumper?: boolean
}

/** An arc wall — part of a circle, used for curved guide rails. */
export interface ArcWall {
  kind: 'arc'
  center: Vec2
  radius: number
  /** Start angle in radians. */
  startAngle: number
  /** End angle in radians. */
  endAngle: number
  /** Normal direction: 1 = outward, -1 = inward. */
  normalDir: 1 | -1
  restitution: number
}

/** A rotating flipper. */
export interface Flipper {
  kind: 'flipper'
  /** Pivot point (fixed). */
  pivot: Vec2
  /** Length of the flipper. */
  length: number
  /** Current angle in radians (0 = pointing right, measured clockwise). */
  angle: number
  /** Rest angle when at rest. */
  restAngle: number
  /** Active angle when flipped up. */
  activeAngle: number
  /** Angular velocity (rad/s). */
  angularVelocity: number
  /** Angular speed when activating (rad/s). */
  flipSpeed: number
  /** Angular speed when returning (rad/s). */
  returnSpeed: number
  /** Restitution. */
  restitution: number
  /** Whether the flipper is currently being activated. */
  active: boolean
  /** Collision radius (thickness). */
  radius: number
  side: 'left' | 'right'
}

/** A slingshot — a triangular bumper that kicks the ball. */
export interface Slingshot {
  kind: 'slingshot'
  /** Three vertices of the triangle. */
  vertices: [Vec2, Vec2, Vec2]
  /** Normal of the active face (pointing into playfield). */
  faceNormal: Vec2
  /** Restitution (typically high, 0.8-1.0). */
  restitution: number
  /** Kick impulse magnitude. */
  kick: number
}

export type Collider = SegmentWall | CircleWall | ArcWall | Flipper | Slingshot

// ---------------------------------------------------------------------------
// Ball
// ---------------------------------------------------------------------------

export interface Ball {
  pos: Vec2
  vel: Vec2
  radius: number
  /** Set to false when the ball drains. */
  alive: boolean
}

// ---------------------------------------------------------------------------
// Collision helpers
// ---------------------------------------------------------------------------

/**
 * Closest point on segment [a,b] to point p.
 * Returns the point and the parameter t in [0,1].
 */
export function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; t: number } {
  const ab = vsub(b, a)
  const abLenSq = vlenSq(ab)
  if (abLenSq < 1e-9) return { point: a, t: 0 }
  const t = clamp(vdot(vsub(p, a), ab) / abLenSq, 0, 1)
  return { point: vlerp(a, b, t), t }
}

/**
 * Check if a circle (ball) penetrates a line segment.
 * Returns the penetration depth, contact normal, and contact point if colliding.
 */
export function circleVsSegment(
  ball: Ball,
  wall: SegmentWall,
): { depth: number; normal: Vec2; contact: Vec2 } | null {
  const { point } = closestPointOnSegment(ball.pos, wall.a, wall.b)
  const diff = vsub(ball.pos, point)
  const distSq = vlenSq(diff)
  if (distSq >= ball.radius * ball.radius) return null
  const dist = Math.sqrt(distSq)
  // Normal from wall surface toward ball center
  let normal: Vec2
  if (dist < 1e-6) {
    normal = wall.normal
  } else {
    normal = { x: diff.x / dist, y: diff.y / dist }
    // Ensure normal aligns with the wall's defined normal direction
    if (vdot(normal, wall.normal) < 0) {
      normal = { x: -normal.x, y: -normal.y }
    }
  }
  const depth = ball.radius - dist
  return { depth, normal, contact: point }
}

/**
 * Circle vs circle collision (ball vs bumper/post).
 */
export function circleVsCircle(
  ball: Ball,
  wall: CircleWall,
): { depth: number; normal: Vec2; contact: Vec2 } | null {
  const diff = vsub(ball.pos, wall.center)
  const distSq = vlenSq(diff)
  const minDist = ball.radius + wall.radius
  if (distSq >= minDist * minDist) return null
  const dist = Math.sqrt(distSq)
  let normal: Vec2
  if (dist < 1e-6) {
    normal = { x: 0, y: -1 }
  } else {
    normal = { x: diff.x / dist, y: diff.y / dist }
  }
  return { depth: minDist - dist, normal, contact: vadd(wall.center, vscale(normal, wall.radius)) }
}

/**
 * Check if an angle is within an arc's range [startAngle, endAngle].
 * Handles arcs that wrap around -PI/PI.
 */
function angleInRange(angle: number, start: number, end: number): boolean {
  // Normalize to [0, 2PI)
  const TWO_PI = Math.PI * 2
  let a = angle
  while (a < 0) a += TWO_PI
  while (a >= TWO_PI) a -= TWO_PI
  let s = start
  let e = end
  while (s < 0) s += TWO_PI
  while (s >= TWO_PI) s -= TWO_PI
  while (e < 0) e += TWO_PI
  while (e >= TWO_PI) e -= TWO_PI
  if (s <= e) return a >= s && a <= e
  return a >= s || a <= e
}

/**
 * Circle vs arc collision.
 * The arc is a curve at `radius` from center, spanning [startAngle, endAngle].
 * normalDir=1 means the wall faces outward (ball collides from outside, dist > radius).
 * normalDir=-1 means the wall faces inward (ball collides from inside, dist < radius).
 */
export function circleVsArc(
  ball: Ball,
  wall: ArcWall,
): { depth: number; normal: Vec2; contact: Vec2 } | null {
  const diff = vsub(ball.pos, wall.center)
  const dist = vlen(diff)
  if (dist < 1e-6) return null

  const angle = Math.atan2(diff.y, diff.x)
  if (!angleInRange(angle, wall.startAngle, wall.endAngle)) return null

  // Ball must be on the correct side of the arc
  if (wall.normalDir === 1 && dist < wall.radius) return null
  if (wall.normalDir === -1 && dist > wall.radius) return null

  // Surface distance = how far the ball center is from the arc curve
  const surfaceDist = Math.abs(dist - wall.radius)
  if (surfaceDist >= ball.radius) return null

  const radialDir: Vec2 = { x: diff.x / dist, y: diff.y / dist }
  // Normal points from arc surface toward ball
  const normal: Vec2 = dist > wall.radius
    ? radialDir
    : { x: -radialDir.x, y: -radialDir.y }

  const contact = vadd(wall.center, vscale(radialDir, wall.radius))
  return { depth: ball.radius - surfaceDist, normal, contact }
}

/**
 * Get flipper tip position at current angle.
 */
export function flipperTip(f: Flipper): Vec2 {
  return {
    x: f.pivot.x + Math.cos(f.angle) * f.length,
    y: f.pivot.y + Math.sin(f.angle) * f.length,
  }
}

/**
 * Circle vs rotating flipper collision.
 * The flipper is a capsule (segment with radius). We also account for
 * the tangential velocity at the contact point to give the ball a kick.
 */
export function circleVsFlipper(
  ball: Ball,
  f: Flipper,
): { depth: number; normal: Vec2; contact: Vec2; surfaceVel: Vec2 } | null {
  const tip = flipperTip(f)
  const { point } = closestPointOnSegment(ball.pos, f.pivot, tip)
  const diff = vsub(ball.pos, point)
  const distSq = vlenSq(diff)
  const minDist = ball.radius + f.radius
  if (distSq >= minDist * minDist) return null

  const dist = Math.sqrt(distSq)
  let normal: Vec2
  if (dist < 1e-6) {
    // Ball is right on the flipper — push perpendicular
    normal = vperp(vnorm(vsub(tip, f.pivot)))
  } else {
    normal = { x: diff.x / dist, y: diff.y / dist }
  }

  // Tangential velocity at contact point due to rotation
  // v = omega × r, in 2D: v = omega * (-ry, rx)
  const r = vsub(point, f.pivot)
  const surfaceVel: Vec2 = {
    x: -f.angularVelocity * r.y,
    y: f.angularVelocity * r.x,
  }

  return { depth: minDist - dist, normal, contact: point, surfaceVel }
}

/**
 * Circle vs slingshot (triangle) collision.
 * Tests against each edge of the triangle.
 */
export function circleVsSlingshot(
  ball: Ball,
  s: Slingshot,
): { depth: number; normal: Vec2; contact: Vec2; edgeIndex: number } | null {
  let best: { depth: number; normal: Vec2; contact: Vec2; edgeIndex: number } | null = null
  for (let i = 0; i < 3; i++) {
    const a = s.vertices[i]
    const b = s.vertices[(i + 1) % 3]
    const { point } = closestPointOnSegment(ball.pos, a, b)
    const diff = vsub(ball.pos, point)
    const distSq = vlenSq(diff)
    if (distSq >= ball.radius * ball.radius) continue
    const dist = Math.sqrt(distSq)
    const normal = dist < 1e-6 ? s.faceNormal : { x: diff.x / dist, y: diff.y / dist }
    const depth = ball.radius - dist
    if (!best || depth > best.depth) {
      best = { depth, normal, contact: point, edgeIndex: i }
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Physics world
// ---------------------------------------------------------------------------

export interface PhysicsWorld {
  gravity: Vec2
  /** Linear damping per second (air resistance / rolling friction). */
  damping: number
  colliders: Collider[]
  balls: Ball[]
}

export function createWorld(gravity: Vec2, damping = 0.0): PhysicsWorld {
  return { gravity, damping, colliders: [], balls: [] }
}

/** Collision result returned to the game layer for scoring. */
export interface CollisionEvent {
  collider: Collider
  ball: Ball
  contact: Vec2
  normal: Vec2
}

/**
 * Step the physics world forward by `dt` seconds.
 * Uses sub-stepping for stability. Returns collision events for scoring.
 */
export function stepWorld(world: PhysicsWorld, dt: number, onCollision?: (e: CollisionEvent) => void): void {
  const subSteps = 6
  const subDt = dt / subSteps

  for (let step = 0; step < subSteps; step++) {
    // Update flippers
    for (const c of world.colliders) {
      if (c.kind !== 'flipper') continue
      updateFlipper(c, subDt)
    }

    // Integrate balls
    for (const ball of world.balls) {
      if (!ball.alive) continue
      integrateBall(ball, world, subDt)
    }

    // Collide balls vs everything
    for (const ball of world.balls) {
      if (!ball.alive) continue
      collideBall(ball, world, onCollision)
    }
  }
}

function updateFlipper(f: Flipper, dt: number): void {
  const target = f.active ? f.activeAngle : f.restAngle
  const speed = f.active ? f.flipSpeed : f.returnSpeed
  const diff = target - f.angle
  if (Math.abs(diff) < 1e-4) {
    f.angularVelocity = 0
    f.angle = target
    return
  }
  const omega = Math.sign(diff) * speed
  f.angularVelocity = omega
  const delta = omega * dt
  if (Math.abs(delta) >= Math.abs(diff)) {
    f.angle = target
    f.angularVelocity = 0
  } else {
    f.angle += delta
  }
}

function integrateBall(ball: Ball, world: PhysicsWorld, dt: number): void {
  // Apply gravity
  ball.vel.x += world.gravity.x * dt
  ball.vel.y += world.gravity.y * dt

  // Apply damping
  const dampFactor = Math.max(0, 1 - world.damping * dt)
  ball.vel.x *= dampFactor
  ball.vel.y *= dampFactor

  // Cap velocity to prevent tunneling
  const maxSpeed = 1800
  const speed = vlen(ball.vel)
  if (speed > maxSpeed) {
    ball.vel.x = (ball.vel.x / speed) * maxSpeed
    ball.vel.y = (ball.vel.y / speed) * maxSpeed
  }

  // Integrate position
  ball.pos.x += ball.vel.x * dt
  ball.pos.y += ball.vel.y * dt
}

function collideBall(ball: Ball, world: PhysicsWorld, onCollision?: (e: CollisionEvent) => void): void {
  for (const c of world.colliders) {
    switch (c.kind) {
      case 'segment': {
        const hit = circleVsSegment(ball, c)
        if (hit) {
          resolveCollision(ball, hit.normal, hit.depth, c.restitution)
          onCollision?.({ collider: c, ball, contact: hit.contact, normal: hit.normal })
        }
        break
      }
      case 'circle': {
        const hit = circleVsCircle(ball, c)
        if (hit) {
          resolveCollision(ball, hit.normal, hit.depth, c.restitution)
          onCollision?.({ collider: c, ball, contact: hit.contact, normal: hit.normal })
        }
        break
      }
      case 'arc': {
        const hit = circleVsArc(ball, c)
        if (hit) {
          resolveCollision(ball, hit.normal, hit.depth, c.restitution)
          onCollision?.({ collider: c, ball, contact: hit.contact, normal: hit.normal })
        }
        break
      }
      case 'flipper': {
        const hit = circleVsFlipper(ball, c)
        if (hit) {
          resolveFlipperCollision(ball, hit.normal, hit.depth, c.restitution, hit.surfaceVel)
          onCollision?.({ collider: c, ball, contact: hit.contact, normal: hit.normal })
        }
        break
      }
      case 'slingshot': {
        const hit = circleVsSlingshot(ball, c)
        if (hit) {
          resolveSlingshotCollision(ball, hit.normal, hit.depth, c)
          onCollision?.({ collider: c, ball, contact: hit.contact, normal: hit.normal })
        }
        break
      }
    }
  }
}

/** Position correction + velocity reflection. */
function resolveCollision(ball: Ball, normal: Vec2, depth: number, restitution: number): void {
  // Push ball out of penetration
  ball.pos.x += normal.x * depth
  ball.pos.y += normal.y * depth

  // Reflect velocity about normal
  const vn = vdot(ball.vel, normal)
  if (vn < 0) {
    ball.vel.x -= (1 + restitution) * vn * normal.x
    ball.vel.y -= (1 + restitution) * vn * normal.y
  }
}

/** Flipper collision adds surface velocity to the reflection. */
function resolveFlipperCollision(
  ball: Ball,
  normal: Vec2,
  depth: number,
  restitution: number,
  surfaceVel: Vec2,
): void {
  ball.pos.x += normal.x * depth
  ball.pos.y += normal.y * depth

  // Relative velocity (ball relative to flipper surface)
  const relVel = vsub(ball.vel, surfaceVel)
  const vn = vdot(relVel, normal)
  if (vn < 0) {
    // Reflect relative velocity, then add back surface velocity
    const reflected: Vec2 = {
      x: relVel.x - (1 + restitution) * vn * normal.x,
      y: relVel.y - (1 + restitution) * vn * normal.y,
    }
    ball.vel = vadd(reflected, surfaceVel)
  }
}

/** Slingshot adds an extra kick impulse along the face normal. */
function resolveSlingshotCollision(ball: Ball, normal: Vec2, depth: number, s: Slingshot): void {
  ball.pos.x += normal.x * depth
  ball.pos.y += normal.y * depth

  const vn = vdot(ball.vel, normal)
  if (vn < 0) {
    ball.vel.x -= (1 + s.restitution) * vn * normal.x
    ball.vel.y -= (1 + s.restitution) * vn * normal.y
  }
  // Extra kick
  ball.vel.x += normal.x * s.kick
  ball.vel.y += normal.y * s.kick
}

// ---------------------------------------------------------------------------
// Utility: build a chain of segments from a list of points
// ---------------------------------------------------------------------------

export function segmentsFromPoints(
  points: Vec2[],
  restitution: number,
  normalHint?: Vec2,
): SegmentWall[] {
  const walls: SegmentWall[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const dir = vnorm(vsub(b, a))
    let normal = vperp(dir)
    if (normalHint && vdot(normal, normalHint) < 0) {
      normal = { x: -normal.x, y: -normal.y }
    }
    walls.push({ kind: 'segment', a, b, normal, restitution })
  }
  return walls
}
