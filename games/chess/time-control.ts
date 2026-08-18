/**
 * Time controls for online (player vs player) chess.
 *
 * Controls follow the widely-used online taxonomy. Categories are derived from
 * the sum of base time plus increment-per-move×60, matching FIDE's conventions,
 * while the Bullet label follows Lichess/Chess.com practice (< 3 minutes):
 *   - Bullet   ~ sum < 3 min
 *   - Blitz    ~ sum ≤ 10 min
 *   - Rapid    ~ 10 min < sum < 60 min
 *   - Long     ~ sum ≥ 60 min
 *
 * Only standard timing controls are offered (base + optional increment). A
 * player whose clock expires loses on time unless the opposing side has
 * insufficient material to mate.
 */

export interface ChessTime {
  id: string
  label: string
  /** Category name for grouping / UI chips. */
  category: 'Bullet' | 'Blitz' | 'Rapid' | 'Long'
  /** Starting clock per player, in seconds. */
  baseSeconds: number
  /** Increment added per move, in seconds. */
  incrementSeconds: number
}

export const CHESS_TIME_CONTROLS: readonly ChessTime[] = [
  { id: 'bullet-1', label: '1+0', category: 'Bullet', baseSeconds: 60, incrementSeconds: 0 },
  { id: 'bullet-2', label: '2+1', category: 'Bullet', baseSeconds: 120, incrementSeconds: 1 },
  { id: 'blitz-3', label: '3+0', category: 'Blitz', baseSeconds: 180, incrementSeconds: 0 },
  { id: 'blitz-5', label: '5+0', category: 'Blitz', baseSeconds: 300, incrementSeconds: 0 },
  { id: 'rapid-10', label: '10+0', category: 'Rapid', baseSeconds: 600, incrementSeconds: 0 },
  { id: 'rapid-15-10', label: '15+10', category: 'Rapid', baseSeconds: 900, incrementSeconds: 10 },
  { id: 'long-30', label: '30+0', category: 'Long', baseSeconds: 1800, incrementSeconds: 0 },
  { id: 'long-60-30', label: '60+30', category: 'Long', baseSeconds: 3600, incrementSeconds: 30 },
]

export const DEFAULT_CHESS_TIME_ID = 'blitz-5'

export function chessTimeControl(id: string | null | undefined): ChessTime {
  return CHESS_TIME_CONTROLS.find((control) => control.id === id) ?? CHESS_TIME_CONTROLS[3]
}

/** Short human label for the sidebar, e.g. "Blitz · 5+0". */
export function chessTimeLabel(id: string | null | undefined): string {
  const control = chessTimeControl(id)
  return `${control.category} · ${control.label}`
}

/** Format a remaining-clock value (ms) as "M:SS" or "H:MM:SS". */
export function formatClock(ms: number): string {
  const clamped = Math.max(0, Math.round(ms / 1000))
  if (clamped >= 3600) {
    const hours = Math.floor(clamped / 3600)
    const minutes = Math.floor((clamped % 3600) / 60)
    const seconds = clamped % 60
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  const minutes = Math.floor(clamped / 60)
  const seconds = clamped % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
