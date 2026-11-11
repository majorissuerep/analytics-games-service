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
  { at: -300, rgb: [181, 60, 52] },
  { at: -100, rgb: [177, 119, 58] },
  { at: 0, rgb: [112, 123, 132] },
  { at: 100, rgb: [78, 142, 100] },
  { at: 300, rgb: [34, 132, 77] },
]

/** Fixed absolute centipawn scale, always from the mover's perspective.
 * Rank and candidate count never affect color. Mate scores saturate the scale.
 */
export function heatColor(scoreCp: number | null, mateIn: number | null = null, alpha = 1): string {
  const score = mateIn !== null ? (mateIn > 0 ? 300 : -300) : scoreCp ?? 0
  const t = Math.max(-300, Math.min(300, score))
  let upper = HEAT_STOPS.findIndex(stop => stop.at >= t)
  if (upper < 0) upper = HEAT_STOPS.length - 1
  const lower = Math.max(upper - 1, 0)
  const span = HEAT_STOPS[upper].at - HEAT_STOPS[lower].at || 1
  const f = (t - HEAT_STOPS[lower].at) / span
  const mix = (a: number, b: number) => Math.round(a + (b - a) * f)
  const [r, g, b] = [0, 1, 2].map(channel => mix(HEAT_STOPS[lower].rgb[channel], HEAT_STOPS[upper].rgb[channel]))
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Mate outranks any finite score; prefer faster wins and slower losses. */
function scoreValue(line: RecklessAnalysisLine) {
  return line.mateIn === null ? line.scoreCp ?? 0 : line.mateIn > 0 ? 100000 - line.mateIn : -100000 - line.mateIn
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
  const seen = new Set<string>()
  const legal = analysis.lines.filter(line => legalMoves.has(line.uci))
    .sort((a, b) => Number(a.bounded) - Number(b.bounded) || scoreValue(b) - scoreValue(a) || b.depth - a.depth || a.uci.localeCompare(b.uci))
    .filter(line => { if (seen.has(line.uci)) return false; seen.add(line.uci); return true })
  const best = legal[0]
  const lines = legal.map((line, index) => {
    const comparable = best !== undefined && !line.bounded && !best.bounded && line.scoreCp !== null && best.scoreCp !== null
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
      multipv: index + 1,
      uci: line.uci,
      san: toSan(fen, line.uci),
      scoreCp: line.scoreCp,
      mateIn: line.mateIn,
      bounded: line.bounded,
      depth: line.depth,
      deltaCp: comparable && line !== best ? best.scoreCp! - line.scoreCp! : line === best ? 0 : null,
      scoreLabel: `${line.bounded ? '≈' : ''}${formatScore(line)}`,
      pvSan,
      pvComplete: complete,
    }
  })
  const balanceCp = best && best.scoreCp !== null ? (turn === 'w' ? best.scoreCp : -best.scoreCp) : null
  const balanceSide = balanceCp === null || balanceCp === 0 ? 'Balanced' : balanceCp > 0 ? 'White' : 'Black'
  const balanceLabel = !best
    ? 'No evaluation'
    : best.mateIn !== null
      ? `${(best.mateIn > 0 ? turn === 'w' : turn !== 'w') ? 'White' : 'Black'} mates in ${Math.abs(best.mateIn)}`
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
