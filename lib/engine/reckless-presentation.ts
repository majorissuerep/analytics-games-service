import { Chess } from 'chess.js'
import type { RecklessAnalysis, RecklessAnalysisLine } from './reckless'

export interface PresentedLine {
  multipv: number
  /** Legal UCI move, e.g. `e7e8q`. */
  uci: string
  /** SAN of the move in the analysed position, e.g. `exd8=Q+`. */
  san: string
  scoreCp: number | null
  mateIn: number | null
  bounded: boolean
  depth: number
  /** Centipawns of balance given up versus the engine's best line; null when not comparable. */
  deltaCp: number | null
  /** Human score label from the mover's perspective, e.g. `+0.42` or `#3`. */
  scoreLabel: string
  /** SAN principal variation (truncated at the first illegal/hallucinated move). */
  pvSan: string[]
  pvComplete: boolean
}

export interface PresentedAnalysis {
  /** Best-line score in centipawns from White's perspective (null for mate scores). */
  balanceCp: number | null
  /** Balance label, e.g. `White +0.42`, `Black mates in 3`. */
  balanceLabel: string
  lines: PresentedLine[]
}

export function formatCp(cp: number): string {
  const pawns = cp / 100
  return `${pawns > 0 ? '+' : pawns < 0 ? '−' : ''}${Math.abs(pawns).toFixed(2)}`
}

export function formatScore(line: RecklessAnalysisLine): string {
  if (line.mateIn !== null) return `#${line.mateIn > 0 ? '' : '−'}${Math.abs(line.mateIn)}`
  return formatCp(line.scoreCp ?? 0)
}

const HEAT_STOPS: Array<{ at: number; rgb: [number, number, number] }> = [
  { at: 0, rgb: [46, 158, 79] },
  { at: 0.45, rgb: [226, 194, 60] },
  { at: 0.75, rgb: [224, 118, 44] },
  { at: 1, rgb: [198, 56, 46] },
]

/**
 * Board heat color for a candidate ranked `rank` of `total` (0-based):
 * green for the engine's best line, through yellow/orange, to red for the
 * weakest listed candidate. `alpha` below 1 returns an `rgba()` string for
 * translucent fills.
 */
export function heatColor(rank: number, total: number, alpha = 1): string {
  const clampedTotal = Math.max(total, 1)
  const t = clampedTotal <= 1 ? 0 : Math.min(Math.max(rank / (clampedTotal - 1), 0), 1)
  let upper = 1
  for (let i = 0; i < HEAT_STOPS.length; i += 1) {
    if (HEAT_STOPS[i].at >= t) { upper = i; break }
  }
  const lower = Math.max(upper - 1, 0)
  const span = HEAT_STOPS[upper].at - HEAT_STOPS[lower].at || 1
  const f = (t - HEAT_STOPS[lower].at) / span
  const mix = (a: number, b: number) => Math.round(a + (b - a) * f)
  const [r, g, b] = [0, 1, 2].map((channel) => mix(HEAT_STOPS[lower].rgb[channel], HEAT_STOPS[upper].rgb[channel]))
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Apply one UCI move to a FEN, returning the next FEN or null when illegal. */
export function applyUci(fen: string, uci: string): string | null {
  try {
    const chess = new Chess(fen)
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as 'q' | 'r' | 'b' | 'n' | undefined })
    return chess.fen()
  } catch {
    return null
  }
}

/**
 * Turn raw engine MultiPV lines into a UI-ready, legality-checked analysis:
 * SAN names, balance deltas versus the best line, and SAN principal
 * variations. Illegal engine moves are dropped; a PV stops at its first
 * illegal move and reports `pvComplete: false`.
 */
export function presentAnalysis(
  fen: string,
  turn: 'w' | 'b',
  analysis: RecklessAnalysis,
  legalMoves: ReadonlySet<string>,
): PresentedAnalysis {
  const legal = analysis.lines.filter((line) => legalMoves.has(line.uci))
  const best = legal[0]
  const lines = legal.map((line) => {
    const comparable = best !== undefined && line.scoreCp !== null && best.scoreCp !== null
    const pvSan: string[] = []
    let cursor = fen
    let complete = true
    for (const uci of line.pv) {
      const probe = new Chess(cursor)
      let san: string
      try {
        san = probe.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as 'q' | 'r' | 'b' | 'n' | undefined }).san
      } catch {
        complete = false
        break
      }
      pvSan.push(san)
      cursor = probe.fen()
    }
    return {
      multipv: line.multipv,
      uci: line.uci,
      san: toSan(fen, line.uci),
      scoreCp: line.scoreCp,
      mateIn: line.mateIn,
      bounded: line.bounded,
      depth: line.depth,
      deltaCp: comparable && line !== best ? best.scoreCp! - line.scoreCp! : line === best ? 0 : null,
      scoreLabel: formatScore(line),
      pvSan,
      pvComplete: complete,
    }
  })
  const balanceCp = best && best.scoreCp !== null ? (turn === 'w' ? best.scoreCp : -best.scoreCp) : null
  const balanceSide = balanceCp === null || balanceCp === 0 ? 'Balanced' : balanceCp > 0 ? 'White' : 'Black'
  const balanceLabel = !best
    ? 'No evaluation'
    : best.mateIn !== null
      ? `${turn === 'w' ? 'White' : 'Black'} mates in ${Math.abs(best.mateIn)}`
      : `${balanceSide}${balanceCp === 0 ? '' : ` ${formatCp(Math.abs(balanceCp!))}`}`
  return { balanceCp, balanceLabel, lines }
}

function toSan(fen: string, uci: string): string {
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] as 'q' | 'r' | 'b' | 'n' | undefined }).san
  } catch {
    return uci
  }
}
