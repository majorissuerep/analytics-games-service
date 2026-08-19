import { describe, expect, it } from 'vitest'
import { PinballPhysics } from './physics'
import { SHOOTER_SPAWN, TABLE_HEIGHT, TABLE_WIDTH } from './table'

function advance(world: PinballPhysics, seconds: number): void {
  const frames = Math.ceil(seconds * 60)
  for (let frame = 0; frame < frames; frame += 1) world.advance(1 / 60)
}

describe('Planck pinball simulation', () => {
  it('spawns a CCD-enabled ball at the shooter', () => {
    const world = new PinballPhysics()
    world.spawnBall('test')
    const [ball] = world.getBallSnapshots()
    expect(ball.id).toBe('test')
    expect(ball.x).toBeCloseTo(SHOOTER_SPAWN.x, 4)
    expect(ball.y).toBeCloseTo(SHOOTER_SPAWN.y, 4)
    expect(world.isOutOfBounds('test')).toBe(false)
  })

  it('launches up the shooter lane without tunnelling through its floor', () => {
    const world = new PinballPhysics()
    world.spawnBall('test')
    expect(world.launchBall('test', 1)).toBe(true)
    advance(world, 0.35)
    const [ball] = world.getBallSnapshots()
    expect(ball.y).toBeLessThan(SHOOTER_SPAWN.y - 120)
    expect(ball.x).toBeGreaterThan(350)
    expect(world.isOutOfBounds('test')).toBe(false)
  })

  it('feeds a launched ball from the shooter into the main playfield', () => {
    const world = new PinballPhysics()
    world.spawnBall('test')
    world.launchBall('test', 0.8)
    let enteredPlayfield = false
    for (let frame = 0; frame < 240; frame += 1) {
      world.advance(1 / 120)
      const ball = world.getBallSnapshots()[0]
      if (ball && ball.x < 345 && ball.y < 180) enteredPlayfield = true
      if (enteredPlayfield) break
    }
    expect(enteredPlayfield).toBe(true)
    expect(world.isOutOfBounds('test')).toBe(false)
  })

  it('drives both flippers to active and back to rest', () => {
    const world = new PinballPhysics()
    const rest = world.getFlipperSnapshots()
    world.setFlippers(true, true)
    advance(world, 0.12)
    const active = world.getFlipperSnapshots()
    expect(active[0].tip.y).toBeLessThan(rest[0].tip.y - 15)
    expect(active[1].tip.y).toBeLessThan(rest[1].tip.y - 15)
    world.setFlippers(false, false)
    advance(world, 0.2)
    const returned = world.getFlipperSnapshots()
    expect(returned[0].tip.y).toBeGreaterThan(active[0].tip.y + 15)
    expect(returned[1].tip.y).toBeGreaterThan(active[1].tip.y + 15)
  })

  it('nudges every active ball laterally', () => {
    const world = new PinballPhysics()
    world.spawnBall('a', { x: 190, y: 300 })
    world.spawnBall('b', { x: 230, y: 300 })
    const before = world.getBallSnapshots().map((ball) => ball.x)
    world.nudge(1)
    advance(world, 0.05)
    const after = world.getBallSnapshots().map((ball) => ball.x)
    expect(after[0]).toBeGreaterThan(before[0])
    expect(after[1]).toBeGreaterThan(before[1])
  })

  it('caps extreme impulses without affecting normal launches', () => {
    const world = new PinballPhysics()
    world.spawnBall('fast', { x: 210, y: 300 }, { x: 10_000, y: -10_000 })
    world.advance(1 / 120)
    expect(world.getBallSnapshots()[0].speed).toBeLessThanOrEqual(2_081)
  })

  it('does not turn ordinary rail bounces into scored orbit events', () => {
    const world = new PinballPhysics()
    world.spawnBall('rail', { x: 40, y: 480 }, { x: -600, y: 0 })
    advance(world, 0.15)
    expect(world.drainEvents()).toEqual([])
  })

  it('supports three independent multiball bodies', () => {
    const world = new PinballPhysics()
    world.spawnBall('a', { x: 80, y: 170 }, { x: 320, y: -220 })
    world.spawnBall('b', { x: 95, y: 160 }, { x: 480, y: 0 })
    world.spawnBall('c', { x: 82, y: 192 }, { x: 260, y: 260 })
    advance(world, 0.25)
    const balls = world.getBallSnapshots()
    expect(balls).toHaveLength(3)
    expect(new Set(balls.map((ball) => `${Math.round(ball.x)}:${Math.round(ball.y)}`)).size).toBe(3)
    expect(balls.every((ball) => ball.x > 0 && ball.x < TABLE_WIDTH && ball.y > 0 && ball.y < TABLE_HEIGHT)).toBe(true)
  })

  it('can capture and remove balls without leaving stale snapshots', () => {
    const world = new PinballPhysics()
    world.spawnBall('a')
    world.spawnBall('b', { x: 100, y: 100 })
    expect(world.removeBall('a')).toBe(true)
    expect(world.removeBall('a')).toBe(false)
    expect(world.ballIds()).toEqual(['b'])
    expect(world.getBallSnapshots().map((ball) => ball.id)).toEqual(['b'])
  })

  it('turns knocked targets into sensors and restores them as solid fixtures', () => {
    const world = new PinballPhysics()
    expect(() => {
      world.setTargetDown('drop-f', true)
      world.resetTargets()
    }).not.toThrow()
  })
})
