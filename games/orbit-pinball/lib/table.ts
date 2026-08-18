/**
 * Pinball table layout definition.
 *
 * The table is a vertical playfield, 320 x 608 pixels (matching the
 * existing canvas dimensions that the e2e test expects).
 * Origin (0,0) is top-left. Gravity pulls downward (+y).
 *
 * Table elements:
 *  - Outer walls (left, right, top curves)
 *  - Plunger lane (right side channel)
 *  - Two flippers at the bottom
 *  - Two slingshots above the flippers
 *  - Three pop bumpers in the upper area
 *  - Drop targets (bank of 4)
 *  - Rollover lanes (top)
 *  - Spinner
 *  - Drain at the bottom center
 */

import type {
  Vec2,
  Collider,
  SegmentWall,
  CircleWall,
  ArcWall,
  Flipper,
  Slingshot,
} from './physics'
import {
  vec,
  vnorm,
  segmentsFromPoints,
} from './physics'

export const TABLE_WIDTH = 320
export const TABLE_HEIGHT = 608

// Restitution constants
const WALL_BOUNCE = 0.3
const BUMPER_BOUNCE = 0.85
const SLING_BOUNCE = 0.5
const FLIPPER_BOUNCE = 0.35
const POST_BOUNCE = 0.4

// Flipper config
const FLIPPER_LENGTH = 58
const FLIPPER_RADIUS = 7
const FLIPPER_SPEED = 28 // rad/s — fast snap

// ---------------------------------------------------------------------------
// Table geometry helpers
// ---------------------------------------------------------------------------

/** Create a flipper. Angles are in radians, measured clockwise from +x axis. */
function makeFlipper(
  side: 'left' | 'right',
  pivotX: number,
  pivotY: number,
): Flipper {
  // Left flipper rests pointing down-right (~25° below horizontal)
  // Right flipper rests pointing down-left (~155°)
  const restAngle = side === 'left' ? Math.PI * 0.14 : Math.PI - Math.PI * 0.14
  // Active angle is rotated upward
  const activeAngle = side === 'left' ? -Math.PI * 0.18 : Math.PI + Math.PI * 0.18
  return {
    kind: 'flipper',
    pivot: vec(pivotX, pivotY),
    length: FLIPPER_LENGTH,
    angle: restAngle,
    restAngle,
    activeAngle,
    angularVelocity: 0,
    flipSpeed: FLIPPER_SPEED,
    returnSpeed: FLIPPER_SPEED * 0.4,
    restitution: FLIPPER_BOUNCE,
    active: false,
    radius: FLIPPER_RADIUS,
    side,
  }
}

// ---------------------------------------------------------------------------
// Build all colliders
// ---------------------------------------------------------------------------

export function buildTableColliders(): Collider[] {
  const colliders: Collider[] = []

  // === Outer left wall (with upper curve) ===
  // Goes from bottom-left up, then curves to the right at the top
  const leftWallPoints: Vec2[] = [
    vec(8, 580),      // bottom of left wall
    vec(8, 280),      // straight left wall
    vec(8, 220),      // start of curve
    vec(20, 160),     // curve
    vec(45, 110),     // more curve
    vec(80, 80),      // top-left curve
    vec(130, 62),     // top-middle left
    vec(190, 62),     // top-middle right (before plunger separator)
  ]
  // Normal should point right (into playfield)
  colliders.push(...segmentsFromPoints(leftWallPoints, WALL_BOUNCE, vec(1, 0)))

  // === Plunger lane separator wall (vertical, right side) ===
  // Separates the plunger channel from the main playfield
  const plungerSeparator: Vec2[] = [
    vec(232, 62),     // top of separator (gap for ball to enter playfield)
    vec(232, 500),    // bottom of separator
  ]
  colliders.push(...segmentsFromPoints(plungerSeparator, WALL_BOUNCE, vec(-1, 0)))

  // === Outer right wall (plunger lane right side) ===
  const rightWallPoints: Vec2[] = [
    vec(312, 580),    // bottom of right wall
    vec(312, 62),     // top of right wall
  ]
  colliders.push(...segmentsFromPoints(rightWallPoints, WALL_BOUNCE, vec(-1, 0)))

  // === Top wall (connecting top of left curve to top of plunger lane) ===
  // The top has a gap between x=190 and x=232 where the ball enters from the plunger
  colliders.push(...segmentsFromPoints([vec(190, 62), vec(232, 62)], WALL_BOUNCE, vec(0, 1)))

  // === Bottom-left wall leading to left flipper ===
  const leftBottomWall: Vec2[] = [
    vec(8, 580),
    vec(8, 530),
    vec(30, 525),     // slight inward angle
  ]
  colliders.push(...segmentsFromPoints(leftBottomWall, WALL_BOUNCE, vec(1, 0)))

  // === Bottom-right wall leading to right flipper ===
  const rightBottomWall: Vec2[] = [
    vec(312, 580),
    vec(312, 530),
    vec(290, 525),    // slight inward angle
  ]
  colliders.push(...segmentsFromPoints(rightBottomWall, WALL_BOUNCE, vec(-1, 0)))

  // === Drain walls (V-shape below flippers) ===
  // Left drain wall
  colliders.push(...segmentsFromPoints(
    [vec(30, 525), vec(115, 595)],
    WALL_BOUNCE,
    vec(1, -0.2),
  ))
  // Right drain wall
  colliders.push(...segmentsFromPoints(
    [vec(290, 525), vec(205, 595)],
    WALL_BOUNCE,
    vec(-1, -0.2),
  ))

  // === Flippers ===
  const leftFlipper = makeFlipper('left', 78, 545)
  const rightFlipper = makeFlipper('right', 242, 545)
  colliders.push(leftFlipper, rightFlipper)

  // === Slingshots (triangular bumpers above flippers) ===
  // Left slingshot
  const leftSling: Slingshot = {
    kind: 'slingshot',
    vertices: [
      vec(30, 525),   // bottom-left (shared with drain wall corner)
      vec(30, 470),   // top-left
      vec(80, 500),   // right point (toward center)
    ],
    faceNormal: vnorm(vec(0.5, -0.3)),
    restitution: SLING_BOUNCE,
    kick: 300,
  }
  colliders.push(leftSling)

  // Right slingshot
  const rightSling: Slingshot = {
    kind: 'slingshot',
    vertices: [
      vec(290, 525),  // bottom-right
      vec(290, 470),  // top-right
      vec(240, 500),  // left point (toward center)
    ],
    faceNormal: vnorm(vec(-0.5, -0.3)),
    restitution: SLING_BOUNCE,
    kick: 300,
  }
  colliders.push(rightSling)

  // === Pop bumpers (3 round bumpers in upper area) ===
  const bumper1: CircleWall = {
    kind: 'circle',
    center: vec(100, 190),
    radius: 14,
    restitution: BUMPER_BOUNCE,
    bumper: true,
  }
  const bumper2: CircleWall = {
    kind: 'circle',
    center: vec(160, 160),
    radius: 14,
    restitution: BUMPER_BOUNCE,
    bumper: true,
  }
  const bumper3: CircleWall = {
    kind: 'circle',
    center: vec(200, 210),
    radius: 14,
    restitution: BUMPER_BOUNCE,
    bumper: true,
  }
  colliders.push(bumper1, bumper2, bumper3)

  // === Posts / pegs (small circle walls that redirect the ball) ===
  const post1: CircleWall = {
    kind: 'circle',
    center: vec(55, 300),
    radius: 6,
    restitution: POST_BOUNCE,
  }
  const post2: CircleWall = {
    kind: 'circle',
    center: vec(200, 320),
    radius: 6,
    restitution: POST_BOUNCE,
  }
  const post3: CircleWall = {
    kind: 'circle',
    center: vec(120, 360),
    radius: 5,
    restitution: POST_BOUNCE,
  }
  colliders.push(post1, post2, post3)

  // === Upper guide arcs ===
  // Left inner arc (curves the ball from the top toward the bumpers)
  const leftArc: ArcWall = {
    kind: 'arc',
    center: vec(55, 200),
    radius: 50,
    startAngle: Math.PI * 0.5,     // 90°
    endAngle: Math.PI * 1.5,       // 270°
    normalDir: -1,                  // inward
    restitution: WALL_BOUNCE,
  }
  colliders.push(leftArc)

  // Right inner arc
  const rightArc: ArcWall = {
    kind: 'arc',
    center: vec(200, 200),
    radius: 45,
    startAngle: -Math.PI * 0.5,    // -90°
    endAngle: Math.PI * 0.5,       // 90°
    normalDir: -1,                  // inward
    restitution: WALL_BOUNCE,
  }
  colliders.push(rightArc)

  // === Plunger lane bottom ===
  // A wall at the bottom of the plunger lane that the ball rests on
  colliders.push(...segmentsFromPoints(
    [vec(232, 595), vec(312, 595)],
    WALL_BOUNCE,
    vec(0, -1),
  ))

  // === One-way gate at top of plunger lane ===
  // We model this as a thin wall that the ball passes over when going up
  // but can't come back through. For simplicity, we leave a gap and let
  // the curved top wall guide the ball.
  // The gap between x=190 and x=232 at y=62 serves this purpose.

  return colliders
}

// ---------------------------------------------------------------------------
// Drop targets
// ---------------------------------------------------------------------------

export interface DropTarget {
  id: string
  pos: Vec2
  width: number
  height: number
  knockedDown: boolean
  points: number
}

export function createDropTargets(): DropTarget[] {
  const bankX = 60
  const bankY = 280
  const targetW = 30
  const targetH = 10
  const gap = 4
  return [
    { id: 'drop1', pos: vec(bankX, bankY), width: targetW, height: targetH, knockedDown: false, points: 100 },
    { id: 'drop2', pos: vec(bankX + targetW + gap, bankY), width: targetW, height: targetH, knockedDown: false, points: 100 },
    { id: 'drop3', pos: vec(bankX + (targetW + gap) * 2, bankY), width: targetW, height: targetH, knockedDown: false, points: 100 },
    { id: 'drop4', pos: vec(bankX + (targetW + gap) * 3, bankY), width: targetW, height: targetH, knockedDown: false, points: 100 },
  ]
}

/** Convert a drop target into segment colliders (only if not knocked down). */
export function dropTargetColliders(target: DropTarget): SegmentWall[] {
  if (target.knockedDown) return []
  const { pos, width, height } = target
  // Top face is the active collision surface
  const top: SegmentWall = {
    kind: 'segment',
    a: vec(pos.x, pos.y),
    b: vec(pos.x + width, pos.y),
    normal: vec(0, -1),
    restitution: 0.2,
  }
  // Left side
  const left: SegmentWall = {
    kind: 'segment',
    a: vec(pos.x, pos.y),
    b: vec(pos.x, pos.y + height),
    normal: vec(-1, 0),
    restitution: 0.2,
  }
  // Right side
  const right: SegmentWall = {
    kind: 'segment',
    a: vec(pos.x + width, pos.y),
    b: vec(pos.x + width, pos.y + height),
    normal: vec(1, 0),
    restitution: 0.2,
  }
  return [top, left, right]
}

// ---------------------------------------------------------------------------
// Rollover lanes (scoring zones the ball passes over, not physical colliders)
// ---------------------------------------------------------------------------

export interface RolloverLane {
  id: string
  /** Center position. */
  pos: Vec2
  radius: number
  lit: boolean
  points: number
}

export function createRolloverLanes(): RolloverLane[] {
  return [
    { id: 'lane1', pos: vec(50, 120), radius: 12, lit: false, points: 50 },
    { id: 'lane2', pos: vec(110, 95), radius: 12, lit: false, points: 50 },
    { id: 'lane3', pos: vec(160, 80), radius: 12, lit: false, points: 50 },
  ]
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

export interface Spinner {
  pos: Vec2
  /** Current rotation in radians. */
  rotation: number
  /** Spinning speed (rad/s). */
  speed: number
  points: number
  /** Total times spun this game. */
  count: number
}

export function createSpinner(): Spinner {
  return {
    pos: vec(160, 340),
    rotation: 0,
    speed: 0,
    points: 25,
    count: 0,
  }
}

// ---------------------------------------------------------------------------
// Score zones (areas that give points when ball enters)
// ---------------------------------------------------------------------------

export interface ScoreZone {
  id: string
  pos: Vec2
  width: number
  height: number
  points: number
  /** Cooldown in ms to prevent rapid re-triggering. */
  cooldownMs: number
  lastTriggered: number
}

export function createScoreZones(): ScoreZone[] {
  return [
    { id: 'top_loop', pos: vec(130, 70), width: 60, height: 20, points: 75, cooldownMs: 800, lastTriggered: 0 },
    { id: 'left_orbit', pos: vec(20, 250), width: 25, height: 40, points: 50, cooldownMs: 800, lastTriggered: 0 },
    { id: 'right_orbit', pos: vec(210, 250), width: 25, height: 40, points: 50, cooldownMs: 800, lastTriggered: 0 },
  ]
}

// ---------------------------------------------------------------------------
// Ball spawn
// ---------------------------------------------------------------------------

export function ballSpawnPos(): Vec2 {
  // In the plunger lane, near the bottom
  return vec(297, 570)
}

// ---------------------------------------------------------------------------
// Flipper access
// ---------------------------------------------------------------------------

export function getFlippers(colliders: readonly Collider[]): Flipper[] {
  return colliders.filter((c): c is Flipper => c.kind === 'flipper')
}

// ---------------------------------------------------------------------------
// Drain detection
// ---------------------------------------------------------------------------

/** Returns true if the ball has fallen below the drain line. */
export function isBallDrained(ball: { pos: Vec2 }): boolean {
  return ball.pos.y > TABLE_HEIGHT + 20
}
