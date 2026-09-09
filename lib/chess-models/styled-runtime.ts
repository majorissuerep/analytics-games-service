import {
  BUILTIN_STYLED_OPENING,
  type StyledRepertoireId,
} from './styled'

export type StyledMoveRequest = {
  fen: string
  history: readonly string[]
  repertoireId: StyledRepertoireId
  legalMoves: readonly string[]
  moveTimeMs: number
}

type StyledInferenceResponse = {
  selected_move?: unknown
  mode?: unknown
  repertoire_id?: unknown
}

export function parseStyledMove(body: unknown, legalMoves: readonly string[]) {
  if (!body || typeof body !== 'object') throw new Error('Styled model returned an invalid response')
  const selectedMove = (body as StyledInferenceResponse).selected_move
  if (typeof selectedMove !== 'string' || !legalMoves.includes(selectedMove)) {
    throw new Error('Styled model returned an illegal or malformed move')
  }
  return selectedMove
}

function configuredStyledInferenceUrl() {
  const configured = process.env.STYLED_CHESS_INFERENCE_URL?.trim()
  if (!configured) return undefined
  const base = new URL(configured)
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    throw new Error('Tuned Opening inference URL must use HTTP or HTTPS')
  }
  return new URL('/predict', base)
}

export async function requestStyledMove(input: StyledMoveRequest) {
  const endpoint = configuredStyledInferenceUrl()
  if (!endpoint) {
    const { predictStyledMove } = await import('./styled-node-runtime')
    const result = await predictStyledMove(input)
    return { move: result.move, revisionId: BUILTIN_STYLED_OPENING, repertoireId: result.repertoireId }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fen: input.fen,
      history: input.history,
      repertoire_id: input.repertoireId,
      top_k: 5,
      move_time_ms: input.moveTimeMs,
    }),
    signal: AbortSignal.timeout(Math.min(input.moveTimeMs + 750, 5750)),
  })
  const body = await response.json().catch(() => null) as StyledInferenceResponse | null
  if (!response.ok) throw new Error(`Styled model returned HTTP ${response.status}`)
  const move = parseStyledMove(body, input.legalMoves)
  return { move, revisionId: BUILTIN_STYLED_OPENING, repertoireId: input.repertoireId }
}
