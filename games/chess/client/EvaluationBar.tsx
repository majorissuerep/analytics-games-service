import type { StockfishEvaluation } from './stockfish'

export function evaluationWhitePercent(evaluation: StockfishEvaluation | null) {
  if (!evaluation) return 50
  if (evaluation.mate !== null) return evaluation.mate > 0 ? 100 : 0
  const probability = 1 / (1 + Math.exp(-evaluation.scoreCp / 350))
  return Math.round(probability * 1000) / 10
}

export function formatEvaluation(evaluation: StockfishEvaluation | null) {
  if (!evaluation) return '—'
  if (evaluation.mate !== null) return `M${evaluation.mate >= 0 ? '+' : ''}${evaluation.mate}`
  const pawns = evaluation.scoreCp / 100
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`
}

export function EvaluationBar({ evaluation, error }: { evaluation: StockfishEvaluation | null; error?: string }) {
  const whitePercent = evaluationWhitePercent(evaluation)
  const score = formatEvaluation(evaluation)
  const detail = evaluation?.depth ? `Depth ${evaluation.depth}` : error || 'Evaluating…'
  const scoreLabel = evaluation ? `White ${score}` : 'Evaluation pending'

  return (
    <section className="chess-evaluation" aria-label="Stockfish 19 evaluation">
      <div
        className="chess-evaluation-track"
        role="meter"
        aria-label="White evaluation share"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(whitePercent)}
        aria-valuetext={scoreLabel}
      >
        <div className="chess-evaluation-white" style={{ height: `${whitePercent}%` }} />
        <span className="chess-evaluation-side chess-evaluation-white-label">White</span>
        <strong className="chess-evaluation-score">{score}</strong>
        <span className="chess-evaluation-side chess-evaluation-black-label">Black</span>
      </div>
      <div className="chess-evaluation-meta">
        <b>Stockfish 19</b>
        <small>{detail}</small>
      </div>
    </section>
  )
}
