'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Chess, type Color, type Square } from 'chess.js'
import { Chessboard, type PieceDropHandlerArgs, type PieceHandlerArgs, type SquareHandlerArgs } from 'react-chessboard'
import { getOrCreatePlayerId, getPlayerName, setPlayerName } from '@/lib/cookies'
import { useGameRoom } from '@/lib/engine/client/use-game-room'
import { emitGameSessionCompleted } from '@/lib/analytics/game-events'
import type { ChessColorChoice, ChessGameView } from '../model'
import {
  STOCKFISH_LEVELS,
  StockfishBrowserEngine,
  stockfishEngineIdForRevision,
  stockfishLevel,
  type StockfishLevelId,
  type StockfishEvaluation,
} from './stockfish'
import { EvaluationBar } from './EvaluationBar'
import { ModelSubmissionPanel } from './ModelSubmissionPanel'
import { ModelArena } from './ModelArena'
import {
  BUILTIN_STYLED_OPENING,
  BUILTIN_STYLED_OPENING_MODEL,
  defaultStyledRepertoireForModelColor,
  STYLED_REPERTOIRES,
  styledRepertoiresForModelColor,
  type StyledRepertoireId,
} from '@/lib/chess-models/styled'
import { disposeChessSound, isSoundEnabled, playMoveSound, playUndoSound, setSoundEnabled } from './sound'
import { descriptorFromDiff, kingSquare, outcomeInfo, pinnedSquares, resultFor, type GameOverInfo } from './chess-logic'
import {
  CHESS_TIME_CONTROLS,
  DEFAULT_CHESS_TIME_ID,
  chessTimeLabel,
  formatClock,
} from '../time-control'
import { heatColor, type PresentedLine } from '@/lib/engine/reckless-presentation'
import './chess.css'

type Mode = 'setup' | 'bot' | 'local' | 'online'
type SetupMode = 'bot' | 'online' | 'local' | 'arena'
type EngineControl = 'auto' | 'pick' | 'free'
type OnlineAction = 'create' | 'join'
type PendingPromotion = { from: Square; to: Square } | null
type ModelOption = { revisionId: string; displayName: string; runtimeId: string }
type EngineMove = { from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' }

const RECKLESS_LOCAL = 'reckless-local'

function completionResult(result: string) {
  const normalized = result.toLowerCase()
  if (normalized.includes('checkmate')) return 'checkmate'
  if (normalized.includes('stalemate')) return 'stalemate'
  if (normalized.includes('repetition')) return 'repetition'
  if (normalized.includes('insufficient')) return 'insufficient_material'
  if (normalized.includes('resign')) return 'resigned'
  if (normalized.includes('on time')) return 'timeout'
  return 'draw'
}

function chosenColor(choice: ChessColorChoice): Color {
  if (choice === 'random') return Math.random() < 0.5 ? 'w' : 'b'
  return choice === 'white' ? 'w' : 'b'
}

function repertoireForModelColor(repertoireId: StyledRepertoireId, color: Color): StyledRepertoireId {
  const selected = STYLED_REPERTOIRES.find((repertoire) => repertoire.id === repertoireId)
  const selectedSide = color === 'w' ? 'white' : 'black'
  return selected?.side === selectedSide ? repertoireId : defaultStyledRepertoireForModelColor(color)
}

const selectedStyle: CSSProperties = { boxShadow: 'inset 0 0 0 4px #f6c344' }
const lastMoveStyle: CSSProperties = { background: 'rgba(246,195,68,.48)' }
const checkStyle: CSSProperties = {
  boxShadow: 'inset 0 0 0 4px rgba(197,47,47,.9)',
  background: 'radial-gradient(circle, rgba(197,47,47,.28) 0 32%, transparent 42%)',
}
const pinStyle: CSSProperties = { boxShadow: 'inset 0 -7px 0 0 rgba(214,102,26,.9)' }
const moveStyle: CSSProperties = { background: 'radial-gradient(circle, rgba(20,90,50,.52) 0 17%, transparent 19%)' }
const captureStyle: CSSProperties = {
  boxShadow: 'inset 0 0 0 4px rgba(197,47,47,.95)',
  background: 'radial-gradient(circle, rgba(20,90,50,.4) 0 11%, transparent 14%)',
}
const illegalStyle: CSSProperties = {
  backgroundColor: 'rgba(214,58,48,.34)',
  boxShadow: 'inset 0 0 0 4px rgba(214,58,48,.85)',
}

export function ChessGame() {
  const [mode, setMode] = useState<Mode>('setup')
  const [setupMode, setSetupMode] = useState<SetupMode>('bot')
  const [onlineAction, setOnlineAction] = useState<OnlineAction>('create')
  const [colorChoice, setColorChoice] = useState<ChessColorChoice>('white')
  const [humanColor, setHumanColor] = useState<Color>('w')
  const [levelId, setLevelId] = useState<StockfishLevelId>('club')
  const [modelRevision, setModelRevision] = useState('builtin-stockfish-18')
  const [modelMoveTimeMs, setModelMoveTimeMs] = useState(500)
  const [engineControl, setEngineControl] = useState<EngineControl>('auto')
  const [rethinkMs, setRethinkMs] = useState(600)
  const [hintLines, setHintLines] = useState(20)
  const [remoteModels, setRemoteModels] = useState<ModelOption[]>([])
  const modelOptions = useMemo(() => [
    { revisionId: 'builtin-stockfish-18', displayName: 'Stockfish 18', runtimeId: 'builtin-stockfish-18' },
    { revisionId: 'builtin-stockfish-19', displayName: 'Stockfish 19', runtimeId: 'builtin-stockfish-19' },
    { revisionId: RECKLESS_LOCAL, displayName: 'Reckless 0.9 (local)', runtimeId: RECKLESS_LOCAL },
    { revisionId: BUILTIN_STYLED_OPENING_MODEL.revisionId, displayName: BUILTIN_STYLED_OPENING_MODEL.displayName, runtimeId: BUILTIN_STYLED_OPENING_MODEL.runtimeId },
    ...remoteModels.filter((model) => model.revisionId !== RECKLESS_LOCAL),
  ], [remoteModels])
  const [suggestions, setSuggestions] = useState<PresentedLine[] | null>(null)
  const [suggestionBalance, setSuggestionBalance] = useState('')
  const [suggestionFen, setSuggestionFen] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [hoverLine, setHoverLine] = useState<PresentedLine | null>(null)
  const [illegalFlash, setIllegalFlash] = useState<Square | null>(null)
  const [localFen, setLocalFen] = useState(() => new Chess().fen())
  const [localPgn, setLocalPgn] = useState('')
  const [localHistory, setLocalHistory] = useState<string[]>([])
  const [styledRepertoireId, setStyledRepertoireId] = useState<StyledRepertoireId>('black_caro_kann')
  const [activeStyledRepertoireId, setActiveStyledRepertoireId] = useState<StyledRepertoireId>('black_caro_kann')
  const [localResult, setLocalResult] = useState('')
  const [selected, setSelected] = useState<Square | null>(null)
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)
  const [promotion, setPromotion] = useState<PendingPromotion>(null)
  const [engineThinking, setEngineThinking] = useState(false)
  const [engineError, setEngineError] = useState('')
  const [evaluation, setEvaluation] = useState<StockfishEvaluation | null>(null)
  const [evaluationError, setEvaluationError] = useState('')
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled())
  const engineRef = useRef<StockfishBrowserEngine | null>(null)
  const evaluationEngineRef = useRef<StockfishBrowserEngine | null>(null)
  const [playerId, setPlayerId] = useState('')
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [timeControlId, setTimeControlId] = useState(DEFAULT_CHESS_TIME_ID)
  const [clockNow, setClockNow] = useState(() => Date.now())
  const roomClient = useGameRoom<ChessGameView>({ gameId: 'chess', playerId, pollMs: 1000 })
  const [undoStack, setUndoStack] = useState<Array<{ fen: string; pgn: string; history: string[] }>>([])
  const analysisEpochRef = useRef(0)
  const illegalTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayerId(getOrCreatePlayerId())
    setName(getPlayerName() || '')
  }, [])

  useEffect(() => {
    fetch('/api/chess-models').then(response => response.json()).then((body: { models?: ModelOption[] }) => {
      if (body.models?.length) setRemoteModels(body.models)
    }).catch(() => undefined)
  }, [])

  useEffect(() => () => {
    engineRef.current?.destroy()
    evaluationEngineRef.current?.destroy()
    disposeChessSound()
    window.clearTimeout(illegalTimerRef.current)
  }, [])

  const online = roomClient.room?.game ?? null
  const styledRepertoireOptions = useMemo(() => {
    if (colorChoice === 'random') return STYLED_REPERTOIRES
    return styledRepertoiresForModelColor(colorChoice === 'black' ? 'w' : 'b')
  }, [colorChoice])

  const effectiveStyledRepertoireId = styledRepertoireOptions.some((repertoire) => repertoire.id === styledRepertoireId)
    ? styledRepertoireId
    : styledRepertoireOptions[0]?.id ?? 'black_caro_kann'

  const fen = mode === 'online' && online ? online.fen : localFen
  const chess = useMemo(() => new Chess(fen), [fen])
  const onlineColor: Color | null = online?.whiteId === playerId ? 'w' : online?.blackId === playerId ? 'b' : null
  const orientation: Color = mode === 'online'
    ? onlineColor ?? (colorChoice === 'black' ? 'b' : 'w')
    : mode === 'bot' ? humanColor : colorChoice === 'black' ? 'b' : 'w'
  const legalMoves = useMemo(
    () => selected ? chess.moves({ square: selected, verbose: true }) : [],
    [chess, selected],
  )
  const legalTargets = useMemo(() => legalMoves.map((move) => move.to), [legalMoves])
  const captureTargets = useMemo(() => new Set(legalMoves.filter((move) => move.captured).map((move) => move.to)), [legalMoves])
  const pinned = useMemo(() => pinnedSquares(chess), [chess])
  const inCheck = chess.inCheck()
  const checkSquare = inCheck ? kingSquare(chess, chess.turn()) : null
  const displayLastMove = mode === 'online' ? online?.lastMove ?? null : lastMove

  // Live clock ticker — re-renders the countdown while an online game is active.
  useEffect(() => {
    if (mode !== 'online' || online?.phase !== 'active') return
    const timer = window.setInterval(() => setClockNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [mode, online?.clockStartedAtMs, online?.phase])

  // Compute each side's live remaining ms. The active side's clock counts down
  // from clockStartedAtMs; the opponent's clock is frozen at its stored value.
  const remainingMs = useMemo(() => {
    if (!online || !online.timeControlId) return { w: 0, b: 0 }
    const side = chess.turn()
    const elapsed = Math.max(0, clockNow - online.clockStartedAtMs)
    const w = side === 'w' ? Math.max(0, online.whiteClockMs - elapsed) : online.whiteClockMs
    const b = side === 'b' ? Math.max(0, online.blackClockMs - elapsed) : online.blackClockMs
    return { w, b }
  }, [chess, clockNow, online])

  // Claim a timeout for the active side whose clock has run out. Re-dispatches
  // on a 3s cooldown until the server confirms the game is finished, so an
  // occasional clock-skew rejection retries instead of leaving the game stuck.
  const lastTimeoutClaimRef = useRef(0)
  useEffect(() => {
    if (mode !== 'online' || online?.phase !== 'active' || !online.timeControlId) return
    const side = chess.turn()
    const elapsed = Math.max(0, clockNow - online.clockStartedAtMs)
    const remaining = side === 'w' ? online.whiteClockMs - elapsed : online.blackClockMs - elapsed
    if (remaining > 0 || clockNow - lastTimeoutClaimRef.current < 3000) return
    lastTimeoutClaimRef.current = clockNow
    void roomClient.dispatch({ type: 'chess.timeout' })
  }, [chess, clockNow, mode, online, roomClient])

  /** Commit a real move onto the local board, keeping an undo snapshot first. */
  const applyMove = useCallback((move: EngineMove, painter = 'q') => {
    const next = new Chess(localFen)
    let applied
    try { applied = next.move({ from: move.from, to: move.to, promotion: move.promotion ?? painter }) } catch { return false }
    const moveUci = `${applied.from}${applied.to}${applied.promotion ?? ''}`
    setUndoStack((stack) => [...stack, { fen: localFen, pgn: localPgn, history: localHistory }])
    setLocalFen(next.fen())
    setLocalPgn(next.pgn())
    setLocalHistory((history) => [...history, moveUci])
    setLocalResult(resultFor(next))
    setLastMove({ from: move.from, to: move.to })
    setSelected(null)
    setPromotion(null)
    return true
  }, [localFen, localHistory, localPgn])

  // Fire the correct sound whenever the effective board position advances by
  // exactly one move. The display last-move is null after a reset/undo, which
  // naturally suppresses the sound on those paths.
  const prevFenRef = useRef(fen)
  useEffect(() => {
    const prev = prevFenRef.current
    prevFenRef.current = fen
    if (prev === fen || !displayLastMove) return
    playMoveSound(descriptorFromDiff(prev, fen))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen])

  useEffect(() => {
    const result = mode === 'online' && online?.phase === 'finished'
      ? online.result
      : localResult
    if (result) emitGameSessionCompleted(completionResult(result))
  }, [localResult, mode, online?.phase, online?.result])

  const finishedResult = mode === 'online' && online?.phase === 'finished' ? online.result : localResult
  const isMultiplayer = mode === 'online'
  const perspective: Color | null = isMultiplayer ? onlineColor : mode === 'bot' ? humanColor : null
  const outcome: GameOverInfo | null = finishedResult ? outcomeInfo(finishedResult, perspective) : null

  // Bot mode, engine control "auto": the configured opponent answers on its
  // turn — Stockfish WASM (18/19), the styled-opening model, or local Reckless.
  // In-flight results are discarded when the position moved on (epoch guard).
  useEffect(() => {
    if (mode !== 'bot' || engineControl !== 'auto' || localResult || chess.turn() === humanColor) return
    const epoch = analysisEpochRef.current
    let cancelled = false
    const run = async () => {
      setEngineThinking(true)
      setEngineError('')
      try {
        let move: EngineMove
        if (modelRevision === RECKLESS_LOCAL) {
          const response = await fetch('/api/chess/analyse', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ fen: localFen, multiPv: 1, moveTimeMs: rethinkMs }),
          })
          const body = await response.json() as { analysis?: { lines: PresentedLine[] }; error?: string }
          if (!response.ok || !body.analysis?.lines.length) throw new Error(body.error || 'Reckless failed to move')
          const best = body.analysis.lines[0]
          move = { from: best.uci.slice(0, 2) as Square, to: best.uci.slice(2, 4) as Square, promotion: best.uci[4] as 'q' | 'r' | 'b' | 'n' | undefined }
        } else {
          const stockfishId = stockfishEngineIdForRevision(modelRevision)
          if (stockfishId) {
            let opponentEngine = engineRef.current
            if (!opponentEngine || opponentEngine.engineId !== stockfishId) {
              opponentEngine?.destroy()
              opponentEngine = new StockfishBrowserEngine({ engineId: stockfishId })
              engineRef.current = opponentEngine
            }
            move = await opponentEngine.findBestMove(localFen, levelId)
          } else {
            const legalMoves = chess.moves({ verbose: true }).map(item => `${item.from}${item.to}${item.promotion ?? ''}`)
            const response = await fetch(`/api/chess-models/${encodeURIComponent(modelRevision)}/move`, {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                fen: localFen,
                legalMoves,
                history: localHistory,
                repertoireId: activeStyledRepertoireId,
                moveTimeMs: modelRevision === BUILTIN_STYLED_OPENING ? 2800 : modelMoveTimeMs,
              }),
            })
            const result = await response.json() as { move?: string; error?: string }
            if (!response.ok || !result.move) throw new Error(result.error || 'Custom model failed to move')
            move = { from: result.move.slice(0, 2) as Square, to: result.move.slice(2, 4) as Square, promotion: result.move[4] as 'q' | 'r' | 'b' | 'n' | undefined }
          }
        }
        if (cancelled || analysisEpochRef.current !== epoch) return
        applyMove(move)
      } catch (error) {
        if (!cancelled && analysisEpochRef.current === epoch) setEngineError(error instanceof Error ? error.message : 'Chess model failed to move.')
      } finally {
        if (!cancelled && analysisEpochRef.current === epoch) setEngineThinking(false)
      }
    }
    void run()
    return () => {
      cancelled = true
      setEngineThinking(false)
    }
  }, [activeStyledRepertoireId, applyMove, chess, engineControl, humanColor, levelId, localFen, localHistory, localResult, mode, modelMoveTimeMs, modelRevision, rethinkMs])

  // Bot mode, "pick" and "free" controls: Reckless analyses the position and
  // the ranked lines are shown as the live hint rail. In pick mode this runs
  // only on the engine side's turn; in free mode it follows whichever side is
  // to move. Stale results are dropped via the epoch guard.
  useEffect(() => {
    if (mode !== 'bot' || engineControl === 'auto' || localResult) return
    if (engineControl === 'pick' && chess.turn() === humanColor) return
    const epoch = analysisEpochRef.current
    let cancelled = false
    const run = async () => {
      setAnalyzing(true)
      setSuggestions(null)
      setHoverLine(null)
      setEngineError('')
      try {
        const response = await fetch('/api/chess/analyse', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fen: localFen, multiPv: hintLines, moveTimeMs: rethinkMs }),
        })
        const body = await response.json() as { analysis?: { balanceLabel: string; lines: PresentedLine[] }; error?: string }
        if (!response.ok || !body.analysis) throw new Error(body.error || 'Reckless analysis failed')
        if (cancelled || analysisEpochRef.current !== epoch) return
        setSuggestions(body.analysis.lines)
        setSuggestionBalance(body.analysis.balanceLabel)
        setSuggestionFen(localFen)
      } catch (error) {
        if (!cancelled && analysisEpochRef.current === epoch) {
          setSuggestions(null)
          setSuggestionFen(null)
          setSuggestionBalance('')
          setEngineError(error instanceof Error ? error.message : 'Reckless analysis failed.')
        }
      } finally {
        if (!cancelled && analysisEpochRef.current === epoch) setAnalyzing(false)
      }
    }
    void run()
    return () => {
      cancelled = true
      setAnalyzing(false)
    }
  }, [chess, engineControl, hintLines, humanColor, localFen, localResult, mode, rethinkMs])

  // Stockfish 19 evaluation bar (origin feature), only meaningful in auto mode.
  useEffect(() => {
    if (mode !== 'bot' || engineControl !== 'auto' || localResult) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEvaluation(null)
      setEvaluationError('')
      return
    }
    let cancelled = false
    const evaluator = evaluationEngineRef.current ?? (evaluationEngineRef.current = new StockfishBrowserEngine({ engineId: 'stockfish-19' }))
    setEvaluation(null)
    setEvaluationError('')
    const timer = window.setTimeout(() => {
      void evaluator.evaluate(localFen).then((nextEvaluation) => {
        if (!cancelled && nextEvaluation) setEvaluation(nextEvaluation)
      }).catch((error: unknown) => {
        if (!cancelled) setEvaluationError(error instanceof Error ? error.message : 'Stockfish 19 evaluation failed.')
      })
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [chess, engineControl, localFen, localResult, mode])

  function clearAnalysisState() {
    analysisEpochRef.current += 1
    setAnalyzing(false)
    setEngineThinking(false)
    setSuggestions(null)
    setSuggestionFen(null)
    setSuggestionBalance('')
    setHoverLine(null)
  }

  function resetToSetup() {
    engineRef.current?.destroy()
    engineRef.current = null
    evaluationEngineRef.current?.destroy()
    evaluationEngineRef.current = null
    roomClient.clear()
    clearAnalysisState()
    setUndoStack([])
    setLocalFen(new Chess().fen())
    setLocalPgn('')
    setLocalHistory([])
    setLocalResult('')
    setIllegalFlash(null)
    setMode('setup')
    setSelected(null)
    setLastMove(null)
    setPromotion(null)
    setNotice('')
    setEngineError('')
    setEvaluation(null)
    setEvaluationError('')
  }

  function startLocal(nextMode: 'bot' | 'local') {
    const nextHumanColor = nextMode === 'bot' ? chosenColor(colorChoice) : colorChoice === 'black' ? 'b' : 'w'
    setHumanColor(nextHumanColor)
    setActiveStyledRepertoireId(repertoireForModelColor(effectiveStyledRepertoireId, nextHumanColor))
    clearAnalysisState()
    setUndoStack([])
    setLocalFen(new Chess().fen())
    setLocalPgn('')
    setLocalHistory([])
    setLocalResult('')
    setIllegalFlash(null)
    setSelected(null)
    setLastMove(null)
    setPromotion(null)
    setEngineError('')
    setEvaluation(null)
    setEvaluationError('')
    setMode(nextMode)
  }

  function flashIllegal(square: Square) {
    setIllegalFlash(square)
    window.clearTimeout(illegalTimerRef.current)
    illegalTimerRef.current = window.setTimeout(() => setIllegalFlash(null), 450)
  }

  /** Play a move chosen from the hint rail (pick mode control, or a quick-move in free mode). */
  function playPickMove(line: PresentedLine) {
    if (mode !== 'bot' || engineControl === 'auto' || localResult || analyzing) return
    if (!suggestions || suggestionFen !== localFen) return
    if (engineControl === 'pick' && chess.turn() === humanColor) return
    const move: EngineMove = { from: line.uci.slice(0, 2) as Square, to: line.uci.slice(2, 4) as Square, promotion: line.uci[4] as 'q' | 'r' | 'b' | 'n' | undefined }
    if (!applyMove(move)) return
    setHoverLine(null)
    setSuggestions(null)
    setSuggestionFen(null)
    setSuggestionBalance('')
  }

  async function commitMove(from: Square, to: Square, piece: 'q' | 'r' | 'b' | 'n' = 'q') {
    if (mode === 'online') {
      if (!online || online.phase !== 'active' || onlineColor !== chess.turn()) return false
      await roomClient.dispatch({ type: 'chess.move', from, to, promotion: piece })
      setSelected(null)
      return true
    }
    if (mode === 'bot') {
      if (localResult) return false
      const humanTurn = chess.turn() === humanColor
      if (engineControl === 'free') {
        // Both sides are human; the rail is only a hint.
        return applyMove({ from, to }, piece)
      }
      if (engineControl === 'pick') {
        if (humanTurn) return applyMove({ from, to }, piece)
        // Engine side: any suggested move may be played directly from the
        // board; anything else is an illegal attempt and flashes red.
        if (!suggestions || suggestionFen !== localFen) { flashIllegal(to); return false }
        const matched = suggestions.find((line) => line.uci === `${from}${to}${piece}`)
        if (!matched) { flashIllegal(to); return false }
        return applyMove({ from: matched.uci.slice(0, 2) as Square, to: matched.uci.slice(2, 4) as Square, promotion: piece })
      }
      if (!humanTurn || engineThinking) return false
      return applyMove({ from, to }, piece)
    }
    return applyMove({ from, to }, piece)
  }

  function requestMove(from: Square, to: Square) {
    const piece = chess.get(from)
    if (piece?.type === 'p' && (to.endsWith('8') || to.endsWith('1'))) {
      setPromotion({ from, to })
      return true
    }
    void commitMove(from, to)
    return true
  }

  function canControl(square: Square) {
    const piece = chess.get(square)
    if (!piece || piece.color !== chess.turn() || localResult) return false
    if (mode === 'local') return true
    if (mode === 'bot') {
      if (engineControl === 'free') return true
      if (engineControl === 'pick') return chess.turn() === humanColor || Boolean(suggestions && suggestionFen === localFen)
      return piece.color === humanColor && !engineThinking
    }
    return mode === 'online' && online?.phase === 'active' && piece.color === onlineColor
  }

  function onSquareClick({ square }: SquareHandlerArgs) {
    const target = square as Square
    // Board-square quick-play exists only in pick mode on the engine side; in
    // free mode a click on a hinted square must still select the piece there.
    if (mode === 'bot' && engineControl === 'pick' && suggestions && suggestionFen === localFen && !analyzing && chess.turn() !== humanColor) {
      const heat = heatBySquare.get(target)
      if (heat) {
        playPickMove(heat.line)
        setSelected(null)
        return
      }
    }
    if (selected && legalTargets.includes(target)) return void requestMove(selected, target)
    setSelected(canControl(target) ? target : null)
  }

  function onDragStart({ square }: PieceHandlerArgs) {
    if (square && canControl(square as Square)) setSelected(square as Square)
  }

  function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs) {
    if (!targetSquare || !canControl(sourceSquare as Square)) {
      if (targetSquare) flashIllegal(targetSquare as Square)
      return false
    }
    const legal = chess.moves({ square: sourceSquare as Square, verbose: true })
      .some((move) => move.to === targetSquare)
    if (!legal) {
      flashIllegal(targetSquare as Square)
      return false
    }
    return requestMove(sourceSquare as Square, targetSquare as Square)
  }

  function undoMove() {
    // In auto mode a full move pair is rolled back; in pick/free every move is
    // an independent human action, so one ply is enough. The restore point is
    // the snapshot taken `required` pushes ago — the position before the move(s)
    // being undone; using the wrong index silently skips an extra ply.
    const required = mode === 'bot' && engineControl === 'auto' ? 2 : 1
    if (mode === 'online' || undoStack.length < required) return
    clearAnalysisState()
    const restore = undoStack[undoStack.length - required] ?? { fen: new Chess().fen(), pgn: '', history: [] as string[] }
    setUndoStack(undoStack.slice(0, undoStack.length - required))
    setLocalFen(restore.fen)
    setLocalPgn(restore.pgn)
    setLocalHistory(restore.history)
    setLocalResult('')
    setLastMove(null)
    setSelected(null)
    setPromotion(null)
    setEngineError('')
    playUndoSound()
  }

  const canUndo = mode !== 'online' && undoStack.length >= (mode === 'bot' && engineControl === 'auto' ? 2 : 1)

  async function createOnline() {
    setNotice('')
    if (!name.trim()) return setNotice('Enter your display name.')
    setPlayerName(name.trim())
    try {
      const room = await roomClient.create({ id: playerId, name: name.trim() }, password)
      setRoomCode(room.code)
      setMode('online')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not create the room.') }
  }

  async function joinOnline() {
    setNotice('')
    if (!name.trim()) return setNotice('Enter your display name.')
    if (roomCode.trim().length !== 6) return setNotice('Enter a six-character room code.')
    setPlayerName(name.trim())
    try {
      await roomClient.join(roomCode.trim().toUpperCase(), { id: playerId, name: name.trim() }, password)
      setMode('online')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not join the room.') }
  }

  const opponentName = modelOptions.find((model) => model.revisionId === modelRevision)?.displayName ?? 'Stockfish 18'
  const hintsFresh = Boolean(suggestions && suggestionFen === localFen)
  const hintsVisible = mode === 'bot' && engineControl !== 'auto' && hintsFresh && !analyzing

  const status = isMultiplayer && online
    ? online.phase === 'lobby' ? `Waiting for opponent · ${roomClient.room?.players.length ?? 0}/2` : online.result || `${chess.turn() === 'w' ? 'White' : 'Black'} to move`
    : mode === 'bot' && engineControl === 'pick'
      ? localResult || (analyzing ? 'Reckless is thinking…' : chess.turn() === humanColor ? `${humanColor === 'w' ? 'White' : 'Black'} (you) to move` : `Pick a move for ${chess.turn() === 'w' ? 'White' : 'Black'}`)
      : localResult || (engineThinking ? `${opponentName} is thinking…` : `${chess.turn() === 'w' ? 'White' : 'Black'} to move${chess.inCheck() ? ' · Check' : ''}`)
  const level = stockfishLevel(levelId)

  // Heat map: candidate destination squares tinted green (engine best) through
  // red (weakest listed), matching the rail rows and the scale legend. Cheap
  // (≤20 entries) so it is derived on each render instead of memoized.
  const heatBySquare = new Map<Square, { color: string; colorFill: string; rank: number; line: PresentedLine }>()
  if (hintsVisible && suggestions) {
    suggestions.forEach((line, index) => {
      const target = line.uci.slice(2, 4) as Square
      if (!heatBySquare.has(target)) heatBySquare.set(target, {
        color: heatColor(index, suggestions.length),
        colorFill: heatColor(index, suggestions.length, 0.32),
        rank: index,
        line,
      })
    })
  }

  const suggestionIndexOf = (line: PresentedLine) => {
    const index = suggestions?.indexOf(line) ?? 0
    return index < 0 ? 0 : index
  }

  const squareStyles: Record<string, CSSProperties> = Object.fromEntries([
    ...[...heatBySquare.entries()].map(([square, heat]) => [square, {
      backgroundColor: heat.colorFill,
      boxShadow: `inset 0 0 0 4px ${heat.color}`,
    }] as const),
    ...(hoverLine ? [[hoverLine.uci.slice(0, 2) as Square, { boxShadow: `inset 0 0 0 6px ${heatColor(suggestionIndexOf(hoverLine), Math.max(suggestions?.length ?? 1, 1))}` } as CSSProperties]] : []),
    ...(displayLastMove ? [[displayLastMove.from, lastMoveStyle], [displayLastMove.to, lastMoveStyle]] : []),
    ...(checkSquare ? [[checkSquare, checkStyle]] : []),
    ...[...pinned].map((square) => [square, pinStyle] as const),
    ...legalTargets.map((square) => [square, captureTargets.has(square) ? captureStyle : moveStyle] as const),
    ...(illegalFlash ? [[illegalFlash, illegalStyle]] : []),
    ...(selected ? [[selected, selectedStyle]] : []),
  ]) as Record<string, CSSProperties>

  const hoverArrow = hoverLine
    ? [{ startSquare: hoverLine.uci.slice(0, 2), endSquare: hoverLine.uci.slice(2, 4), color: heatColor(suggestionIndexOf(hoverLine), Math.max(suggestions?.length ?? 1, 1)) }]
    : []

  return (
    <main className="chess-app">
      <header className="chess-toolbar">
        <div><span className="chess-mark">♞</span><strong>Chess</strong><span className="chess-engine-name">{mode === 'bot' && (engineControl === 'auto' ? opponentName : engineControl === 'pick' ? 'Reckless 0.9 · your pick' : 'Reckless 0.9 · hints')}</span></div>
        <div>
          <button
            type="button"
            className="chess-sound-toggle"
            aria-pressed={soundOn}
            aria-label={soundOn ? 'Mute sounds' : 'Unmute sounds'}
            title={soundOn ? 'Mute sounds' : 'Unmute sounds'}
            onClick={() => { const next = !soundOn; setSoundOn(next); setSoundEnabled(next) }}
          >{soundOn ? '🔊' : '🔇'}</button>
          {mode !== 'setup' && <button onClick={resetToSetup}>New game</button>}
        </div>
      </header>

      {mode === 'setup' ? (
        <section className="chess-setup" aria-label="Chess setup">
          <div className="chess-intro"><span>♞</span><div><p className="chess-kicker">CLASSIC BOARD GAME</p><h1>Play chess your way</h1><p>Stockfish opponents, local Reckless, both-sides play, pass-and-play, or a protected online room.</p></div></div>
          <nav className="chess-mode-tabs" aria-label="Game mode">
            <button className={setupMode === 'bot' ? 'active' : ''} onClick={() => setSetupMode('bot')}><b>♟</b><span>Computer<small>Versus, pick, or free</small></span></button>
            <button className={setupMode === 'online' ? 'active' : ''} onClick={() => setSetupMode('online')}><b>♜</b><span>Online<small>Private room</small></span></button>
            <button className={setupMode === 'local' ? 'active' : ''} onClick={() => setSetupMode('local')}><b>♚</b><span>Local<small>Same device</small></span></button>
            <button className={setupMode === 'arena' ? 'active' : ''} onClick={() => setSetupMode('arena')}><b>⚔</b><span>Model arena<small>3s turns + replay</small></span></button>
          </nav>

          {setupMode === 'arena' ? <ModelArena models={modelOptions} /> : <div className="chess-setup-panel">
            <div className="chess-choice-row"><span>Play as</span><div className="chess-segmented">{(['white', 'random', 'black'] as const).map((color) => <button key={color} className={colorChoice === color ? 'selected' : ''} onClick={() => setColorChoice(color)}>{color === 'white' ? '○ White' : color === 'black' ? '● Black' : '◐ Random'}</button>)}</div></div>

            {setupMode === 'bot' && <>
              <div className="chess-field">
                <span className="chess-control-label">Engine control</span>
                <div className="chess-segmented">
                  <button className={engineControl === 'auto' ? 'selected' : ''} onClick={() => setEngineControl('auto')}>Opponent plays</button>
                  <button className={engineControl === 'pick' ? 'selected' : ''} onClick={() => setEngineControl('pick')}>I pick opponent moves</button>
                  <button className={engineControl === 'free' ? 'selected' : ''} onClick={() => setEngineControl('free')}>Free both sides</button>
                </div>
                <small>{engineControl === 'auto' ? 'The chosen opponent answers on its turn.' : engineControl === 'pick' ? 'Reckless ranks every position; you play the opponent side by choosing from its top moves.' : 'Move both sides freely — the ranked Reckless list is a live hint, not a limit.'}</small>
              </div>
              {engineControl === 'auto' && <>
                <div className="chess-field"><label htmlFor="opponent-model">Opponent model</label><select id="opponent-model" value={modelRevision} onChange={(event) => setModelRevision(event.target.value)}>{modelOptions.map((model) => <option key={model.revisionId} value={model.revisionId}>{model.displayName}</option>)}</select><small>Stockfish runs in your browser; Reckless 0.9 runs on the local server.</small></div>
                {modelRevision !== RECKLESS_LOCAL && <div className="chess-field"><label htmlFor="model-move-time">Custom model move time</label><select id="model-move-time" value={modelMoveTimeMs} onChange={(event) => setModelMoveTimeMs(Number(event.target.value))}>{[250, 500, 1000, 2000, 3000].map((ms) => <option key={ms} value={ms}>{ms >= 1000 ? `${ms / 1000} second per move` : `${ms} ms per move`}</option>)}</select><small>How long a custom model may think on each of its turns.</small></div>}
                {stockfishEngineIdForRevision(modelRevision) && <div className="chess-field"><label htmlFor="stockfish-level">Stockfish difficulty</label><select id="stockfish-level" value={levelId} onChange={(event) => setLevelId(event.target.value as StockfishLevelId)}>{STOCKFISH_LEVELS.map((item) => <option key={item.id} value={item.id}>{item.label} · Skill {item.skill}/20</option>)}</select><small>{level.description}. {opponentName} WASM, {level.moveTimeMs} ms search per move.</small></div>}
                {modelRevision === BUILTIN_STYLED_OPENING && <div className="chess-field"><label htmlFor="styled-repertoire">Opening repertoire</label><select id="styled-repertoire" value={effectiveStyledRepertoireId} onChange={(event) => setStyledRepertoireId(event.target.value as StyledRepertoireId)}>{styledRepertoireOptions.map((repertoire) => <option key={repertoire.id} value={repertoire.id}>{repertoire.label}</option>)}</select><small>Choose the tuned model&apos;s explicit selector. White repertoires are used when the model plays White; Black repertoires when it plays Black.</small></div>}
              </>}
              {engineControl !== 'auto' && <>
                <div className="chess-field"><label htmlFor="rethink-ms">Reckless think time</label><select id="rethink-ms" value={rethinkMs} onChange={(event) => setRethinkMs(Number(event.target.value))}>{[200, 400, 600, 1000, 2000, 3000].map((ms) => <option key={ms} value={ms}>{ms >= 1000 ? `${ms / 1000} second per move` : `${ms} ms per move`}</option>)}</select><small>How long Reckless searches before presenting its lines. Short times keep the hints instant.</small></div>
                {engineControl === 'pick' && <div className="chess-field"><label htmlFor="hint-lines">Candidate moves</label><select id="hint-lines" value={hintLines} onChange={(event) => setHintLines(Number(event.target.value))}>{[5, 10, 15, 20].map((count) => <option key={count} value={count}>{count} lines</option>)}</select><small>How many ranked candidates Reckless shows for the engine side.</small></div>}
              </>}
              <button className="chess-primary" onClick={() => startLocal('bot')}>{engineControl === 'auto' ? `Play ${opponentName}` : engineControl === 'pick' ? 'Play both sides · pick engine moves' : 'Play both sides · free moves'}</button>
            </>}

            {setupMode === 'local' && <><p className="chess-explainer">Take turns on this device. The board stays oriented to your selected side and all legal chess rules apply. You can undo any number of moves.</p><button className="chess-primary" onClick={() => startLocal('local')}>Start pass-and-play</button></>}

            {setupMode === 'online' && <>
              <div className="chess-online-tabs"><button className={onlineAction === 'create' ? 'active' : ''} onClick={() => setOnlineAction('create')}>Create room</button><button className={onlineAction === 'join' ? 'active' : ''} onClick={() => setOnlineAction('join')}>Join room</button></div>
              <div className="chess-field"><label htmlFor="chess-name">Display name</label><input id="chess-name" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="nickname" /></div>
              {onlineAction === 'join' && <div className="chess-field"><label htmlFor="chess-code">Room code</label><input id="chess-code" className="code-input" value={roomCode} maxLength={6} onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))} placeholder="ABC234" autoComplete="off" /></div>}
              {onlineAction === 'create' && (
                <div className="chess-field">
                  <span className="chess-control-label">Time control</span>
                  <div className="chess-time-grid">
                    {CHESS_TIME_CONTROLS.map((control) => (
                      <button key={control.id} type="button" className={timeControlId === control.id ? 'selected' : ''} onClick={() => setTimeControlId(control.id)} title={control.incrementSeconds ? `Base ${control.baseSeconds}s + ${control.incrementSeconds}s per move` : `${control.baseSeconds}s total`}>
                        <b>{control.category}</b>
                        <span>{control.label}</span>
                      </button>
                    ))}
                  </div>
                  <small>Clock starts when the match begins. If your time runs out before you move, you lose on time.</small>
                </div>
              )}
              <div className="chess-field"><label htmlFor="chess-password">Room password <span>optional</span></label><input id="chess-password" value={password} maxLength={100} onChange={(event) => setPassword(event.target.value)} type="password" placeholder={onlineAction === 'create' ? 'Protect this room' : 'Enter room password'} /></div>
              <button className="chess-primary" onClick={() => void (onlineAction === 'create' ? createOnline() : joinOnline())} disabled={roomClient.pending || !playerId}>{roomClient.pending ? 'Connecting…' : onlineAction === 'create' ? 'Create private room' : 'Join room'}</button>
            </>}
            {(notice || roomClient.error) && <p className="chess-notice" role="alert">{notice || roomClient.error?.message}</p>}
          </div>}
          <ModelSubmissionPanel />
          <footer className="chess-attribution">Rules: chess.js · Engines: Stockfish 18/19 WASM + Reckless 0.9 · Board: react-chessboard</footer>
        </section>
      ) : (
        <section className="chess-game-layout">
          <div className="chess-board-wrap" aria-label="Chess board" onMouseOver={(event) => {
            if (!hintsVisible) return
            const squareId = (event.target as HTMLElement).closest('[id^="analytics-chess-board-square-"]')?.id ?? ''
            const match = /-square-([a-h][1-8])$/.exec(squareId)
            const heat = match ? heatBySquare.get(match[1] as Square) : undefined
            setHoverLine(heat ? heat.line : null)
          }} onMouseLeave={() => setHoverLine(null)}>
            {hintsVisible && hoverLine && suggestions && <div className="chess-hover-card">
              <b>{hoverLine.san} <span style={{ color: heatColor(suggestionIndexOf(hoverLine), suggestions.length) }}>●</span></b>
              <small>{hoverLine.scoreLabel}{hoverLine.deltaCp ? ` · −${(hoverLine.deltaCp / 100).toFixed(2)} vs best` : ' · engine pick'} · depth {hoverLine.depth}</small>
              <small>{hoverLine.pvSan.slice(0, 10).join(' ')}</small>
            </div>}
            <Chessboard options={{
              id: 'analytics-chess-board',
              position: fen,
              boardOrientation: orientation === 'w' ? 'white' : 'black',
              onSquareClick,
              onPieceDrop,
              onPieceDrag: onDragStart,
              canDragPiece: ({ square }) => Boolean(square && canControl(square as Square)),
              squareStyles,
              arrows: hoverArrow,
              lightSquareStyle: { backgroundColor: '#e8d7b7' },
              darkSquareStyle: { backgroundColor: '#66866f' },
              boardStyle: { borderRadius: 4, boxShadow: '0 10px 28px rgba(17,31,24,.28)' },
              animationDurationInMs: 180,
            }} />
          </div>
          <aside className="chess-sidebar">
            <div className="chess-status"><span className={`turn-dot ${chess.turn() === 'w' ? 'white' : 'black'}`} /><div><small>{mode === 'bot' ? engineControl === 'auto' ? `You are ${humanColor === 'w' ? 'White' : 'Black'}` : engineControl === 'pick' ? 'Both sides · engine side manual' : 'Both sides · free moves' : mode === 'local' ? 'Pass and play' : onlineColor ? `You are ${onlineColor === 'w' ? 'White' : 'Black'}` : 'Online game'}</small><h2>{status}</h2></div></div>
            {mode === 'bot' && <div className="chess-opponent"><span>{engineControl === 'auto' ? '♞' : engineControl === 'pick' ? '☝' : '⚔'}</span><div><b>{engineControl === 'auto' ? opponentName : 'Reckless 0.9'}</b><small>{engineControl === 'auto' ? stockfishEngineIdForRevision(modelRevision) ? `${level.label} · Skill ${level.skill}/20` : modelRevision === RECKLESS_LOCAL ? `Local engine · ${rethinkMs >= 1000 ? `${rethinkMs / 1000}s` : `${rethinkMs}ms`} think` : 'Custom model' : engineControl === 'pick' ? `Pick from ${hintLines} ranked moves` : `Live hints · ${hintLines} lines · ${rethinkMs >= 1000 ? `${rethinkMs / 1000}s` : `${rethinkMs}ms`}`}</small></div></div>}
            {mode === 'bot' && engineControl === 'auto' && stockfishEngineIdForRevision(modelRevision) && <EvaluationBar evaluation={evaluation} error={evaluationError || undefined} />}
            {mode === 'bot' && engineControl !== 'auto' && analyzing && <div className="chess-suggestions">Reckless is evaluating…</div>}
            {hintsVisible && suggestions && <div className="chess-suggestions" role="group" aria-label="Engine move suggestions">
              <div className="chess-suggestion-balance"><span>Balance</span><b>{suggestionBalance}</b></div>
              <div className="chess-scale" aria-hidden="true"><div className="chess-scale-gradient" /><div className="chess-scale-labels"><span>best</span><span>weak</span></div></div>
              <div className="chess-suggestion-list">
                {suggestions.map((line, index) => <button key={`${line.uci}-${index}`} className={`chess-suggestion${hoverLine === line ? ' hovered' : ''}`} style={{ borderLeftColor: heatColor(index, suggestions.length) }} onClick={() => playPickMove(line)} onMouseEnter={() => setHoverLine(line)} onMouseLeave={() => setHoverLine((current) => (current === line ? null : current))}>
                  <span className="chess-suggestion-rank" style={{ background: heatColor(index, suggestions.length) }}>{index + 1}</span>
                  <b className="chess-suggestion-move">{line.san}</b>
                  <span className="chess-suggestion-score">{line.scoreLabel}</span>
                  <span className={`chess-suggestion-delta ${line.deltaCp ? line.deltaCp > 30 ? 'bad' : line.deltaCp > 10 ? 'mild' : 'fine' : 'fine'}`}>{index === 0 ? 'engine pick' : line.deltaCp === null ? '' : `−${(line.deltaCp / 100).toFixed(2)}`}</span>
                  <small className="chess-suggestion-pv">{line.pvSan.slice(0, 8).join(' ')}</small>
                </button>)}
              </div>
              <div className="chess-suggestion-hint">{engineControl === 'pick' ? 'Green board squares are the engine favourites. Hover a square or row to preview, click to play.' : 'Hints only — move any piece however you like. Click a row to play that move instantly.'}</div>
            </div>}
            {engineError && <p className="chess-notice" role="alert">{engineError}</p>}
            {mode === 'online' && roomClient.room && <div className="chess-room-panel"><small>ROOM CODE</small><div><strong>{roomClient.room.code}</strong><button onClick={() => void navigator.clipboard.writeText(roomClient.room?.code ?? '')}>Copy</button></div><p>{roomClient.room.players.map((player) => player.name).join('  vs  ')}</p>{online?.phase === 'lobby' && roomClient.room.hostId === playerId && <button className="chess-primary" disabled={roomClient.room.players.length !== 2 || roomClient.pending} onClick={() => void roomClient.dispatch({ type: 'chess.start', hostColor: colorChoice, timeControlId })}>{roomClient.room.players.length === 2 ? 'Start match' : 'Waiting for opponent…'}</button>}</div>}
            {mode === 'online' && online?.timeControlId && (
              <div className="chess-clocks" aria-label="Game clock">
                <div className={`chess-clock ${chess.turn() === 'w' && online.phase === 'active' ? 'active' : ''}`}><span>White</span><b>{formatClock(remainingMs.w)}</b></div>
                <div className={`chess-clock ${chess.turn() === 'w' && online.phase === 'active' ? 'active' : ''}`}><span>Black</span><b>{formatClock(remainingMs.b)}</b></div>
                <small>{chessTimeLabel(online.timeControlId)}</small>
              </div>
            )}
            <div className="chess-moves"><h3>Move history</h3><div>{mode === 'online' ? online?.pgn || 'Moves will appear here.' : localPgn || 'Moves will appear here.'}</div></div>
            <div className="chess-actions">
              {canUndo && <button className="chess-undo" onClick={undoMove} title="Undo last move">↶ Undo</button>}
              <button onClick={resetToSetup}>Leave game</button>
              {mode === 'online' && online?.phase === 'active' && <button className="danger" onClick={() => void roomClient.dispatch({ type: 'chess.resign' })}>Resign</button>}
            </div>
          </aside>
        </section>
      )}

      {promotion && <div className="promotion-backdrop" role="dialog" aria-modal="true" aria-label="Choose promotion piece"><div className="promotion-card"><h2>Promote pawn</h2><p>Choose a piece.</p><div>{(['q', 'r', 'b', 'n'] as const).map((piece) => <button key={piece} onClick={() => { void commitMove(promotion.from, promotion.to, piece); setPromotion(null) }}>{piece === 'q' ? '♛ Queen' : piece === 'r' ? '♜ Rook' : piece === 'b' ? '♝ Bishop' : '♞ Knight'}</button>)}</div><button onClick={() => setPromotion(null)}>Cancel</button></div></div>}

      {outcome && <GameOverDialog outcome={outcome} isMultiplayer={isMultiplayer} onlinePhase={online?.phase} isHost={roomClient.room?.hostId === playerId} mode={mode} onRematch={() => void roomClient.dispatch({ type: 'chess.rematch' })} onPlayAgain={() => startLocal(mode as 'bot' | 'local')} onNewGame={resetToSetup} />}
    </main>
  )
}

/**
 * The game-over card is deliberately delayed so the final position stays
 * visible for a moment before the dialog covers the board. The timer lives
 * here so the parent never sets state synchronously inside an effect.
 */
function GameOverDialog({ outcome, isMultiplayer, onlinePhase, isHost, mode, onRematch, onPlayAgain, onNewGame }: {
  outcome: GameOverInfo
  isMultiplayer: boolean
  onlinePhase?: 'lobby' | 'active' | 'finished'
  isHost: boolean
  mode: Mode
  onRematch(): void
  onPlayAgain(): void
  onNewGame(): void
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 1200)
    return () => window.clearTimeout(timer)
  }, [])
  if (!visible) return null
  return (
    <div className="chess-end-backdrop" role="dialog" aria-modal="true" aria-label="Game over">
      <div className={`chess-end-card ${outcome.kind}`}>
        <p className="chess-end-kicker">GAME OVER</p>
        <h2>{outcome.headline}</h2>
        <p className="chess-end-reason">{outcome.reason}</p>
        <div className="chess-end-actions">
          {!isMultiplayer && <button className="chess-primary" onClick={onPlayAgain}>{mode === 'local' ? 'Rematch' : 'Play again'}</button>}
          {isMultiplayer && onlinePhase === 'finished' && isHost && <button className="chess-primary" onClick={onRematch}>Rematch</button>}
          <button onClick={onNewGame}>New game</button>
        </div>
      </div>
    </div>
  )
}
