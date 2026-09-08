/** Original Neon Forge table geometry and semantic playfield map. */

export interface Point { x: number; y: number }
export interface Rail { id: string; points: readonly Point[]; width?: number }
export interface CircleElement { id: string; x: number; y: number; radius: number }
export interface SlingElement { id: string; points: readonly [Point, Point, Point]; kick: Point }
export interface TargetElement { id: string; x: number; y: number; width: number; height: number; angle?: number; label: string }
export interface SensorElement {
  id: string
  kind: SensorKind
  x: number
  y: number
  width: number
  height: number
  angle?: number
  label?: string
}
export type SensorKind = 'drain' | 'rollover' | 'orbit' | 'spinner' | 'ramp' | 'scoop' | 'lock' | 'inlane' | 'outlane' | 'jackpot'

export const TABLE_WIDTH = 420
export const TABLE_HEIGHT = 720
export const BALL_RADIUS = 8

export const PLAYFIELD_RAILS: readonly Rail[] = [
  { id: 'left-shell', points: [{ x: 22, y: 682 }, { x: 22, y: 112 }, { x: 30, y: 78 }, { x: 52, y: 48 }, { x: 90, y: 28 }, { x: 142, y: 18 }, { x: 318, y: 18 }] },
  { id: 'shooter-crown', points: [{ x: 318, y: 18 }, { x: 332, y: 23 }, { x: 350, y: 35 }, { x: 374, y: 58 }, { x: 405, y: 100 }] },
  { id: 'shooter-outer', points: [{ x: 405, y: 100 }, { x: 405, y: 690 }, { x: 350, y: 690 }] },
  { id: 'shooter-divider', points: [{ x: 350, y: 690 }, { x: 350, y: 126 }] },
  { id: 'left-lower', points: [{ x: 22, y: 510 }, { x: 22, y: 617 }, { x: 52, y: 651 }, { x: 105, y: 697 }] },
  { id: 'right-lower', points: [{ x: 350, y: 505 }, { x: 350, y: 617 }, { x: 330, y: 649 }, { x: 303, y: 697 }] },
  { id: 'left-inlane', points: [{ x: 52, y: 522 }, { x: 76, y: 554 }, { x: 88, y: 611 }] },
  { id: 'right-inlane', points: [{ x: 330, y: 522 }, { x: 306, y: 554 }, { x: 294, y: 611 }] },
  { id: 'left-orbit-guide', points: [{ x: 45, y: 334 }, { x: 50, y: 255 }, { x: 74, y: 182 }, { x: 101, y: 137 }] },
  { id: 'right-orbit-guide', points: [{ x: 326, y: 322 }, { x: 318, y: 261 }, { x: 300, y: 144 }] },
  { id: 'ramp-left', points: [{ x: 167, y: 491 }, { x: 178, y: 430 }, { x: 197, y: 373 }, { x: 226, y: 332 }] },
  { id: 'ramp-right', points: [{ x: 226, y: 497 }, { x: 232, y: 427 }, { x: 247, y: 367 }, { x: 270, y: 334 }] },
]

export const BUMPERS: readonly CircleElement[] = [
  { id: 'bumper-a', x: 135, y: 228, radius: 20 },
  { id: 'bumper-b', x: 211, y: 183, radius: 20 },
  { id: 'bumper-c', x: 282, y: 238, radius: 20 },
]

export const POSTS: readonly CircleElement[] = [
  { id: 'post-left-scoop', x: 74, y: 393, radius: 7 },
  { id: 'post-right-scoop', x: 122, y: 395, radius: 7 },
  { id: 'post-ramp-left', x: 161, y: 505, radius: 6 },
  { id: 'post-ramp-right', x: 232, y: 508, radius: 6 },
  { id: 'post-left-return', x: 73, y: 518, radius: 6 },
  { id: 'post-right-return', x: 310, y: 518, radius: 6 },
]

export const SLINGSHOTS: readonly SlingElement[] = [
  { id: 'sling-left', points: [{ x: 77, y: 535 }, { x: 92, y: 607 }, { x: 151, y: 566 }], kick: { x: 1.2, y: -1.8 } },
  { id: 'sling-right', points: [{ x: 305, y: 535 }, { x: 290, y: 607 }, { x: 231, y: 566 }], kick: { x: -1.2, y: -1.8 } },
]

export const DROP_TARGETS: readonly TargetElement[] = [
  { id: 'drop-f', x: 94, y: 347, width: 34, height: 10, angle: -0.12, label: 'F' },
  { id: 'drop-o', x: 129, y: 341, width: 34, height: 10, angle: -0.12, label: 'O' },
  { id: 'drop-r', x: 164, y: 335, width: 34, height: 10, angle: -0.12, label: 'R' },
  { id: 'drop-g', x: 199, y: 329, width: 34, height: 10, angle: -0.12, label: 'G' },
  { id: 'drop-e', x: 234, y: 323, width: 34, height: 10, angle: -0.12, label: 'E' },
]

export const SENSORS: readonly SensorElement[] = [
  { id: 'drain', kind: 'drain', x: 204, y: 714, width: 200, height: 16 },
  { id: 'rollover-1', kind: 'rollover', x: 115, y: 72, width: 24, height: 14, label: 'N' },
  { id: 'rollover-2', kind: 'rollover', x: 171, y: 57, width: 24, height: 14, label: 'E' },
  { id: 'rollover-3', kind: 'rollover', x: 227, y: 57, width: 24, height: 14, label: 'O' },
  { id: 'rollover-4', kind: 'rollover', x: 283, y: 72, width: 24, height: 14, label: 'N' },
  { id: 'left-orbit', kind: 'orbit', x: 52, y: 294, width: 24, height: 55, label: 'ORBIT' },
  { id: 'right-orbit', kind: 'orbit', x: 320, y: 292, width: 24, height: 55, label: 'ORBIT' },
  { id: 'spinner', kind: 'spinner', x: 306, y: 366, width: 30, height: 22, label: 'SPIN' },
  { id: 'reactor-ramp', kind: 'ramp', x: 202, y: 474, width: 62, height: 25, angle: -0.08, label: 'RAMP' },
  { id: 'reactor-core', kind: 'jackpot', x: 245, y: 350, width: 36, height: 28, angle: -0.2, label: 'CORE' },
  { id: 'scoop', kind: 'scoop', x: 98, y: 408, width: 36, height: 32, label: 'MODE' },
  { id: 'lock', kind: 'lock', x: 84, y: 155, width: 30, height: 48, angle: 0.32, label: 'LOCK' },
  { id: 'left-inlane', kind: 'inlane', x: 73, y: 572, width: 24, height: 50 },
  { id: 'right-inlane', kind: 'inlane', x: 309, y: 572, width: 24, height: 50 },
  { id: 'left-outlane', kind: 'outlane', x: 39, y: 624, width: 25, height: 50 },
  { id: 'right-outlane', kind: 'outlane', x: 343, y: 624, width: 20, height: 50 },
]

export const FLIPPERS = {
  left: { pivot: { x: 123, y: 642 }, length: 70, radius: 9, restAngle: 0.34, activeDelta: -0.92 },
  right: { pivot: { x: 285, y: 642 }, length: 70, radius: 9, restAngle: Math.PI - 0.34, activeDelta: 0.92 },
} as const

export const SHOOTER_SPAWN: Point = { x: 378, y: 659 }
export const BALL_SAVE_MS = 9_000

export function targetIds(): string[] { return DROP_TARGETS.map((target) => target.id) }
export function rolloverIds(): string[] { return SENSORS.filter((sensor) => sensor.kind === 'rollover').map((sensor) => sensor.id) }
