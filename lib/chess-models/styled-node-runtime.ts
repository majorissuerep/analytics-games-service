import { readFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import * as ort from 'onnxruntime-web'
import type { StyledMoveRequest } from './styled-runtime'

const HISTORY_K = 20
const MODEL_DIR = join(process.cwd(), 'public', 'models')
const REPERTOIRE_TO_INDEX: Record<string, number> = {
  white_italian: 0,
  white_queen_gambit: 1,
  black_caro_kann: 2,
  black_slav: 3,
}
const PIECE_TO_OFFSET: Record<PieceSymbol, number> = {
  p: 0,
  n: 1,
  b: 2,
  r: 3,
  q: 4,
  k: 5,
}

type Vocabulary = {
  policy: Record<string, number>
  history: Record<string, number>
}

type OpeningBook = Record<string, Record<string, string[]>>

type RuntimeResources = {
  session: ort.InferenceSession
  vocabulary: Vocabulary
  openingBook: OpeningBook
}

let resourcesPromise: Promise<RuntimeResources> | undefined

function configuredPath(environmentName: string, defaultName: string) {
  const configured = process.env[environmentName]?.trim()
  if (!configured) return join(MODEL_DIR, defaultName)
  return isAbsolute(configured) ? configured : resolve(configured)
}

async function loadResources(): Promise<RuntimeResources> {
  const [model, policyText, historyText, bookText] = await Promise.all([
    // Artifact paths are operator-configurable by design.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    readFile(configuredPath('STYLED_CHESS_ONNX_PATH', 'styled-opening.onnx')),
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    readFile(configuredPath('STYLED_CHESS_POLICY_VOCAB_PATH', 'styled-policy-vocab.json'), 'utf8'),
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    readFile(configuredPath('STYLED_CHESS_HISTORY_VOCAB_PATH', 'styled-history-vocab.json'), 'utf8'),
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    readFile(configuredPath('STYLED_CHESS_BOOK_PATH', 'styled-opening-book.json'), 'utf8'),
  ])

  ort.env.wasm.numThreads = 1
  ort.env.wasm.wasmPaths = {
    mjs: pathToFileURL(configuredPath('STYLED_CHESS_WASM_MODULE_PATH', 'ort-wasm-simd-threaded.mjs')).href,
    wasm: pathToFileURL(configuredPath('STYLED_CHESS_WASM_PATH', 'ort-wasm-simd-threaded.wasm')).href,
  }
  const session = await ort.InferenceSession.create(model, {
    executionProviders: ['wasm'],
    executionMode: 'sequential',
    graphOptimizationLevel: 'all',
    intraOpNumThreads: 1,
  })
  return {
    session,
    vocabulary: {
      policy: JSON.parse(policyText) as Record<string, number>,
      history: JSON.parse(historyText) as Record<string, number>,
    },
    openingBook: JSON.parse(bookText) as OpeningBook,
  }
}

async function resources() {
  resourcesPromise ??= loadResources()
  return resourcesPromise
}

function mirrorSquare(square: string) {
  return `${square[0]}${9 - Number(square[1])}`
}

function mirrorMove(move: string) {
  return `${mirrorSquare(move.slice(0, 2))}${mirrorSquare(move.slice(2, 4))}${move.slice(4)}`
}

function parseFen(fen: string) {
  const fields = fen.trim().split(/\s+/)
  if (fields.length !== 6 || (fields[1] !== 'w' && fields[1] !== 'b')) {
    throw new Error('Invalid FEN')
  }
  const ranks = fields[0].split('/')
  if (ranks.length !== 8) throw new Error('Invalid FEN board')

  const board = new Float32Array(18 * 64)
  const turn = fields[1] as Color
  for (let rankIndex = 0; rankIndex < ranks.length; rankIndex += 1) {
    let file = 0
    for (const symbol of ranks[rankIndex]) {
      if (/^[1-8]$/.test(symbol)) {
        file += Number(symbol)
        continue
      }
      const piece = symbol.toLowerCase() as PieceSymbol
      const offset = PIECE_TO_OFFSET[piece]
      if (offset === undefined || file > 7) throw new Error('Invalid FEN piece placement')
      const pieceColor: Color = symbol === symbol.toUpperCase() ? 'w' : 'b'
      const canonicalRankIndex = turn === 'w' ? rankIndex : 7 - rankIndex
      const channel = (pieceColor === turn ? 0 : 6) + offset
      board[channel * 64 + canonicalRankIndex * 8 + file] = 1
      file += 1
    }
    if (file !== 8) throw new Error('Invalid FEN rank width')
  }

  const castling = fields[2]
  const castlingFlags = turn === 'w'
    ? ['K', 'Q', 'k', 'q']
    : ['k', 'q', 'K', 'Q']
  for (const [index, flag] of castlingFlags.entries()) {
    if (castling.includes(flag)) {
      board[(12 + index) * 64] = 1
      board.fill(1, (12 + index) * 64, (13 + index) * 64)
    }
  }

  if (fields[3] !== '-') {
    if (!/^[a-h][1-8]$/.test(fields[3])) throw new Error('Invalid FEN en-passant square')
    const file = fields[3].charCodeAt(0) - 97
    const rank = Number(fields[3][1]) - 1
    const canonicalRankIndex = turn === 'w' ? 7 - rank : rank
    board[16 * 64 + canonicalRankIndex * 8 + file] = 1
  }
  if (turn === 'w') board.fill(1, 17 * 64, 18 * 64)
  return { board, turn }
}

function canonicalHistory(history: readonly string[]) {
  const chess = new Chess()
  return history.map((move) => {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) {
      throw new Error(`Invalid history move: ${move}`)
    }
    const turn = chess.turn()
    const promotion = move.length === 5 ? move[4] as 'q' | 'r' | 'b' | 'n' : undefined
    chess.move({
      from: move.slice(0, 2) as Square,
      to: move.slice(2, 4) as Square,
      ...(promotion ? { promotion } : {}),
    })
    return turn === 'b' ? mirrorMove(move) : move
  })
}

function historyTensors(history: readonly string[], vocabulary: Vocabulary) {
  const ids = new BigInt64Array(HISTORY_K)
  const mask = new Uint8Array(HISTORY_K)
  const window = history.slice(-HISTORY_K)
  const start = HISTORY_K - window.length
  for (const [index, move] of window.entries()) {
    ids[start + index] = BigInt(vocabulary.history[move] ?? 0)
    mask[start + index] = 1
  }
  return { ids, mask }
}

function categorical(value: number) {
  return new BigInt64Array([BigInt(value)])
}

function inputFeeds(input: StyledMoveRequest, vocabulary: Vocabulary) {
  const parsedFen = parseFen(input.fen)
  const canonical = canonicalHistory(input.history)
  const history = historyTensors(canonical, vocabulary)
  const repertoireIndex = REPERTOIRE_TO_INDEX[input.repertoireId]
  if (repertoireIndex === undefined) throw new Error('Unknown repertoire')
  return {
    board: new ort.Tensor('float32', parsedFen.board, [1, 18, 8, 8]),
    history_ids: new ort.Tensor('int64', history.ids, [1, HISTORY_K]),
    history_mask: new ort.Tensor('bool', history.mask, [1, HISTORY_K]),
    active_elo: new ort.Tensor('int64', categorical(5), [1]),
    opponent_elo: new ort.Tensor('int64', categorical(5), [1]),
    time_control: new ort.Tensor('int64', categorical(3), [1]),
    clock: new ort.Tensor('float32', new Float32Array([0.5, 0]), [1, 2]),
    repertoire_id: new ort.Tensor('int64', categorical(repertoireIndex), [1]),
  }
}

function bookMove(input: StyledMoveRequest, openingBook: OpeningBook) {
  const candidates = openingBook[input.repertoireId]?.[input.history.join(' ')] ?? []
  return candidates.find((move) => input.legalMoves.includes(move))
}

function policyMove(input: StyledMoveRequest, output: ort.Tensor, turn: Color, vocabulary: Vocabulary) {
  const logits = output.data as ArrayLike<number>
  let selectedMove: string | undefined
  let selectedLogit = -Infinity
  for (const move of input.legalMoves) {
    const canonical = turn === 'b' ? mirrorMove(move) : move
    const index = vocabulary.policy[canonical]
    if (index === undefined) continue
    const logit = Number(logits[index])
    if (logit > selectedLogit) {
      selectedLogit = logit
      selectedMove = move
    }
  }
  if (!selectedMove) throw new Error('Styled model has no legal vocabulary move')
  return selectedMove
}

export async function predictStyledMove(input: StyledMoveRequest) {
  const loaded = await resources()
  const parsedFen = parseFen(input.fen)
  const opening = bookMove(input, loaded.openingBook)
  if (opening) {
    return { move: opening, mode: 'opening_book' as const, repertoireId: input.repertoireId }
  }

  const output = await loaded.session.run(inputFeeds(input, loaded.vocabulary))
  const move = policyMove(input, output.policy_logits, parsedFen.turn, loaded.vocabulary)
  return { move, mode: 'policy' as const, repertoireId: input.repertoireId }
}

export function boardTensorFromFen(fen: string) {
  return parseFen(fen).board
}
