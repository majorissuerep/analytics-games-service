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
  /** Numeric pawn loss is unavailable across mate and bounded evaluations. */
  quality: 'cp' | 'slower-mate' | 'missed-mate' | 'allows-mate' | 'mated-sooner' | 'unknown'
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

export const MOVE_QUALITY_STOPS: ReadonlyArray<{ lossCp: number; rgb: readonly [number, number, number] }> = [
  { lossCp: 0, rgb: [29, 118, 65] },
  { lossCp: 10, rgb: [70, 125, 64] },
  { lossCp: 25, rgb: [143, 102, 27] },
  { lossCp: 50, rgb: [181, 48, 44] },
]

export const MOVE_QUALITY_GRADIENT = `linear-gradient(90deg, ${MOVE_QUALITY_STOPS.map(stop => `rgb(${stop.rgb.join(', ')}) ${stop.lossCp * 2}%`).join(', ')})`

function rgbColor(rgb: readonly number[], alpha: number) {
  const [r, g, b] = rgb
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.max(0, alpha)})`
}

/** Fixed loss-from-best scale: 0cp green, 10cp still greenish, 50cp+ red.
 * Input is a nonnegative loss, not an absolute position score or rank fraction.
 */
export function moveQualityColor(lossCp: number | null, alpha = 1): string {
  if (lossCp === null || !Number.isFinite(lossCp)) return rgbColor([112, 123, 132], alpha)
  const t = Math.max(0, Math.min(50, lossCp))
  const upper = MOVE_QUALITY_STOPS.findIndex(stop => stop.lossCp >= t)
  const lower = Math.max(upper - 1, 0)
  const span = MOVE_QUALITY_STOPS[upper].lossCp - MOVE_QUALITY_STOPS[lower].lossCp || 1
  const f = (t - MOVE_QUALITY_STOPS[lower].lossCp) / span
  const mix = (a: number, b: number) => Math.round(a + (b - a) * f)
  return rgbColor([0, 1, 2].map(channel => mix(MOVE_QUALITY_STOPS[lower].rgb[channel], MOVE_QUALITY_STOPS[upper].rgb[channel])), alpha)
}

export function lineQualityColor(line: Pick<PresentedLine, 'deltaCp' | 'quality'>, alpha = 1): string {
  if (line.deltaCp !== null) return moveQualityColor(line.deltaCp, alpha)
  if (line.quality === 'slower-mate') return rgbColor(MOVE_QUALITY_STOPS[1].rgb, alpha)
  if (['missed-mate', 'allows-mate', 'mated-sooner'].includes(line.quality)) return rgbColor(MOVE_QUALITY_STOPS[3].rgb, alpha)
  return moveQualityColor(null, alpha)
}

export function formatMoveLoss(line: Pick<PresentedLine, 'deltaCp' | 'quality'>): string {
  if (line.deltaCp !== null) return formatCp(-Math.max(0, line.deltaCp))
  return ({ 'slower-mate': 'slower mate', 'missed-mate': 'misses mate', 'allows-mate': 'allows mate', 'mated-sooner': 'mated sooner', unknown: 'uncertain', cp: 'uncertain' })[line.quality] ?? 'uncertain'
}

function scoreCategory(line: RecklessAnalysisLine) {
  return line.mateIn !== null ? line.mateIn > 0 ? 3 : 1 : 2
}

function compareScores(a: RecklessAnalysisLine, b: RecklessAnalysisLine) {
  return scoreCategory(b) - scoreCategory(a) || (a.mateIn !== null && b.mateIn !== null ? a.mateIn - b.mateIn : (b.scoreCp ?? 0) - (a.scoreCp ?? 0))
}

function compareQuality(best: RecklessAnalysisLine, line: RecklessAnalysisLine): Pick<PresentedLine, 'deltaCp' | 'quality'> {
  if (line === best) return { deltaCp: 0, quality: 'cp' }
  if (best.bounded || line.bounded) return { deltaCp: null, quality: 'unknown' }
  if (best.mateIn === null && line.mateIn === null) return { deltaCp: Math.max(0, best.scoreCp! - line.scoreCp!), quality: 'cp' }
  if (best.mateIn !== null && best.mateIn === line.mateIn) return { deltaCp: 0, quality: 'cp' }
  if (best.mateIn !== null && best.mateIn > 0) return { deltaCp: null, quality: line.mateIn !== null && line.mateIn > 0 ? 'slower-mate' : 'missed-mate' }
  if (line.mateIn !== null && line.mateIn <= 0) return { deltaCp: null, quality: best.mateIn !== null ? 'mated-sooner' : 'allows-mate' }
  return { deltaCp: null, quality: 'unknown' }
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
  const freshest = new Map<string, RecklessAnalysisLine>()
  for (const line of analysis.lines) {
    if (!legalMoves.has(line.uci) || !Number.isFinite(line.mateIn ?? line.scoreCp ?? NaN)) continue
    const previous = freshest.get(line.uci)
    if (!previous || Number(line.bounded) < Number(previous.bounded) || (line.bounded === previous.bounded && line.depth >= previous.depth)) freshest.set(line.uci, line)
  }
  const legal = [...freshest.values()].sort((a, b) => Number(a.bounded) - Number(b.bounded) || compareScores(a, b) || Number(b.uci === analysis.bestMove) - Number(a.uci === analysis.bestMove) || b.depth - a.depth || a.uci.localeCompare(b.uci))
  const best = legal[0]
  const lines = legal.map((line, index) => {
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
      ...compareQuality(best, line),
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
