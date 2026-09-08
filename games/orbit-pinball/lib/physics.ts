import {
  Body,
  Box,
  Circle,
  Edge,
  Fixture,
  Polygon,
  RevoluteJoint,
  Vec2,
  World,
  type Contact,
} from 'planck'
import {
  BALL_RADIUS,
  BUMPERS,
  DROP_TARGETS,
  FLIPPERS,
  PLAYFIELD_RAILS,
  POSTS,
  SENSORS,
  SHOOTER_SPAWN,
  SLINGSHOTS,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  type Point,
  type SensorKind,
} from './table'

const SCALE = 40
const FIXED_STEP = 1 / 120
const MAX_ACCUMULATED = FIXED_STEP * 8
const MAX_BALL_SPEED = 52

export interface BallSnapshot {
  id: string
  x: number
  y: number
  angle: number
  speed: number
  radius: number
}

export interface FlipperSnapshot {
  side: 'left' | 'right'
  pivot: Point
  tip: Point
  radius: number
  active: boolean
}

export type PhysicsEventKind = 'bumper' | 'sling' | 'target' | SensorKind

export interface PhysicsEvent {
  kind: PhysicsEventKind
  elementId: string
  ballId: string
  speed: number
  x: number
  y: number
}

interface BallData { type: 'ball'; id: string }
interface ElementData { type: 'element'; id: string; kind: PhysicsEventKind | 'surface'; x: number; y: number }
type FixtureData = BallData | ElementData

interface FlipperRig {
  side: 'left' | 'right'
  body: Body
  joint: RevoluteJoint
  active: boolean
  pivot: Point
  length: number
  radius: number
}

interface PendingKick {
  body: Body
  impulse: Vec2
}

function meterPoint(point: Point): Vec2 {
  return Vec2(point.x / SCALE, point.y / SCALE)
}

function pixels(value: number): number {
  return value * SCALE
}

function fixtureData(fixture: Fixture): FixtureData | null {
  return (fixture.getUserData() as FixtureData | undefined) ?? null
}

function bodyData(body: Body): BallData | null {
  return (body.getUserData() as BallData | undefined) ?? null
}

/** Planck-backed fixed-step pinball simulation with CCD-enabled balls. */
export class PinballPhysics {
  private readonly world: World
  private readonly ground: Body
  private readonly balls = new Map<string, Body>()
  private readonly targets = new Map<string, Fixture>()
  private readonly flippers: Record<'left' | 'right', FlipperRig>
  private readonly events: PhysicsEvent[] = []
  private readonly pendingKicks: PendingKick[] = []
  private accumulator = 0

  constructor() {
    this.world = new World({
      gravity: Vec2(0, 31),
      allowSleep: false,
      continuousPhysics: true,
      warmStarting: true,
    })
    this.ground = this.world.createBody()
    this.buildStaticTable()
    this.flippers = {
      left: this.createFlipper('left'),
      right: this.createFlipper('right'),
    }
    this.world.on('begin-contact', (contact) => this.onBeginContact(contact))
  }

  private buildStaticTable(): void {
    for (const rail of PLAYFIELD_RAILS) {
      for (let index = 0; index < rail.points.length - 1; index += 1) {
        this.ground.createFixture(Edge(meterPoint(rail.points[index]), meterPoint(rail.points[index + 1])), {
          friction: 0.16,
          restitution: 0.28,
          userData: { type: 'element', id: rail.id, kind: 'surface', x: 0, y: 0 } satisfies ElementData,
        })
      }
    }

    for (const bumper of BUMPERS) {
      const body = this.world.createBody(meterPoint(bumper))
      body.createFixture(Circle(bumper.radius / SCALE), {
        friction: 0.08,
        restitution: 0.72,
        userData: { type: 'element', id: bumper.id, kind: 'bumper', x: bumper.x, y: bumper.y } satisfies ElementData,
      })
    }

    for (const post of POSTS) {
      const body = this.world.createBody(meterPoint(post))
      body.createFixture(Circle(post.radius / SCALE), { friction: 0.22, restitution: 0.36 })
    }

    for (const sling of SLINGSHOTS) {
      const body = this.world.createBody()
      body.createFixture(Polygon(sling.points.map(meterPoint)), {
        friction: 0.1,
        restitution: 0.45,
        userData: {
          type: 'element',
          id: sling.id,
          kind: 'sling',
          x: sling.points[2].x,
          y: sling.points[2].y,
        } satisfies ElementData,
      })
    }

    for (const target of DROP_TARGETS) {
      const body = this.world.createBody({ position: meterPoint(target), angle: target.angle ?? 0 })
      const fixture = body.createFixture(Box(target.width / SCALE / 2, target.height / SCALE / 2), {
        friction: 0.2,
        restitution: 0.18,
        userData: { type: 'element', id: target.id, kind: 'target', x: target.x, y: target.y } satisfies ElementData,
      })
      this.targets.set(target.id, fixture)
    }

    for (const sensor of SENSORS) {
      const body = this.world.createBody({ position: meterPoint(sensor), angle: sensor.angle ?? 0 })
      body.createFixture(Box(sensor.width / SCALE / 2, sensor.height / SCALE / 2), {
        isSensor: true,
        userData: { type: 'element', id: sensor.id, kind: sensor.kind, x: sensor.x, y: sensor.y } satisfies ElementData,
      })
    }
  }

  private createFlipper(side: 'left' | 'right'): FlipperRig {
    const spec = FLIPPERS[side]
    const body = this.world.createDynamicBody({
      position: meterPoint(spec.pivot),
      angle: spec.restAngle,
      angularDamping: 8,
      allowSleep: false,
    })
    body.createFixture(Box(spec.length / SCALE / 2, spec.radius / SCALE, Vec2(spec.length / SCALE / 2, 0)), {
      density: 4,
      friction: 0.62,
      restitution: 0.12,
    })

    const lowerAngle = side === 'left' ? spec.activeDelta : 0
    const upperAngle = side === 'left' ? 0 : spec.activeDelta
    const joint = this.world.createJoint(new RevoluteJoint({
      enableMotor: true,
      motorSpeed: 0,
      maxMotorTorque: 1200,
      enableLimit: true,
      lowerAngle,
      upperAngle,
    }, this.ground, body, meterPoint(spec.pivot)))
    if (!joint) throw new Error(`Could not create ${side} flipper joint`)

    return { side, body, joint, active: false, pivot: spec.pivot, length: spec.length, radius: spec.radius }
  }

  private onBeginContact(contact: Contact): void {
    const fixtureA = contact.getFixtureA()
    const fixtureB = contact.getFixtureB()
    const dataA = fixtureData(fixtureA)
    const dataB = fixtureData(fixtureB)
    const bodyA = fixtureA.getBody()
    const bodyB = fixtureB.getBody()
    const ballA = bodyData(bodyA)
    const ballB = bodyData(bodyB)

    const ballData = ballA ?? ballB
    const ballBody = ballA ? bodyA : ballB ? bodyB : null
    const element = dataA?.type === 'element' ? dataA : dataB?.type === 'element' ? dataB : null
    if (!ballData || !ballBody || !element || element.kind === 'surface') return

    const velocity = ballBody.getLinearVelocity()
    const speed = pixels(Math.hypot(velocity.x, velocity.y))
    const position = ballBody.getPosition()
    this.events.push({
      kind: element.kind,
      elementId: element.id,
      ballId: ballData.id,
      speed,
      x: pixels(position.x),
      y: pixels(position.y),
    })

    if (element.kind === 'bumper') {
      const delta = Vec2(position.x - element.x / SCALE, position.y - element.y / SCALE)
      const length = Math.max(0.001, Math.hypot(delta.x, delta.y))
      this.pendingKicks.push({ body: ballBody, impulse: Vec2(delta.x / length * 0.34, delta.y / length * 0.34) })
    } else if (element.kind === 'sling') {
      const sling = SLINGSHOTS.find((candidate) => candidate.id === element.id)
      if (sling) this.pendingKicks.push({ body: ballBody, impulse: Vec2(sling.kick.x * 0.18, sling.kick.y * 0.18) })
    }
  }

  advance(elapsedSeconds: number): void {
    this.accumulator = Math.min(this.accumulator + Math.max(0, elapsedSeconds), MAX_ACCUMULATED)
    while (this.accumulator >= FIXED_STEP) {
      this.driveFlipper(this.flippers.left)
      this.driveFlipper(this.flippers.right)
      this.world.step(FIXED_STEP, 10, 6)
      while (this.pendingKicks.length > 0) {
        const kick = this.pendingKicks.shift()
        if (kick && bodyData(kick.body)) kick.body.applyLinearImpulse(kick.impulse, kick.body.getWorldCenter(), true)
      }
      for (const body of this.balls.values()) {
        const velocity = body.getLinearVelocity()
        const speed = Math.hypot(velocity.x, velocity.y)
        if (speed > MAX_BALL_SPEED) body.setLinearVelocity(Vec2(velocity.x * MAX_BALL_SPEED / speed, velocity.y * MAX_BALL_SPEED / speed))
      }
      this.accumulator -= FIXED_STEP
    }
  }

  private driveFlipper(rig: FlipperRig): void {
    const speed = rig.side === 'left'
      ? (rig.active ? -25 : 18)
      : (rig.active ? 25 : -18)
    rig.joint.setMotorSpeed(speed)
    rig.joint.setMaxMotorTorque(rig.active ? 1500 : 950)
  }

  setFlippers(left: boolean, right: boolean): void {
    this.flippers.left.active = left
    this.flippers.right.active = right
  }

  spawnBall(id: string, at: Point = SHOOTER_SPAWN, velocity?: Point): void {
    if (this.balls.has(id)) return
    const body = this.world.createDynamicBody({
      position: meterPoint(at),
      bullet: true,
      allowSleep: false,
      linearDamping: 0.04,
      angularDamping: 0.08,
      userData: { type: 'ball', id } satisfies BallData,
    })
    body.createFixture(Circle(BALL_RADIUS / SCALE), {
      density: 1.15,
      friction: 0.24,
      restitution: 0.34,
      userData: { type: 'ball', id } satisfies BallData,
    })
    if (velocity) body.setLinearVelocity(Vec2(velocity.x / SCALE, velocity.y / SCALE))
    this.balls.set(id, body)
  }

  launchBall(id: string, power: number): boolean {
    const body = this.balls.get(id)
    if (!body) return false
    const launch = 29 + Math.max(0, Math.min(1, power)) * 14
    body.setLinearVelocity(Vec2(-0.25, -launch))
    body.setAwake(true)
    return true
  }

  removeBall(id: string): boolean {
    const body = this.balls.get(id)
    if (!body) return false
    this.balls.delete(id)
    this.world.destroyBody(body)
    return true
  }

  clearBalls(): void {
    for (const id of [...this.balls.keys()]) this.removeBall(id)
  }

  nudge(direction: -1 | 1): void {
    for (const body of this.balls.values()) {
      body.applyLinearImpulse(Vec2(direction * 0.12, -0.025), body.getWorldCenter(), true)
    }
  }

  setTargetDown(id: string, down: boolean): void {
    this.targets.get(id)?.setSensor(down)
  }

  resetTargets(): void {
    for (const fixture of this.targets.values()) fixture.setSensor(false)
  }

  drainEvents(): PhysicsEvent[] {
    return this.events.splice(0)
  }

  getBallSnapshots(): BallSnapshot[] {
    return [...this.balls.entries()].map(([id, body]) => {
      const position = body.getPosition()
      const velocity = body.getLinearVelocity()
      return {
        id,
        x: pixels(position.x),
        y: pixels(position.y),
        angle: body.getAngle(),
        speed: pixels(Math.hypot(velocity.x, velocity.y)),
        radius: BALL_RADIUS,
      }
    })
  }

  getFlipperSnapshots(): FlipperSnapshot[] {
    return [this.flippers.left, this.flippers.right].map((rig) => {
      const angle = rig.body.getAngle()
      return {
        side: rig.side,
        pivot: rig.pivot,
        tip: {
          x: rig.pivot.x + Math.cos(angle) * rig.length,
          y: rig.pivot.y + Math.sin(angle) * rig.length,
        },
        radius: rig.radius,
        active: rig.active,
      }
    })
  }

  ballIds(): string[] {
    return [...this.balls.keys()]
  }

  isOutOfBounds(id: string): boolean {
    const body = this.balls.get(id)
    if (!body) return false
    const position = body.getPosition()
    return pixels(position.y) > TABLE_HEIGHT + 80 || pixels(position.x) < -80 || pixels(position.x) > TABLE_WIDTH + 80
  }
}
