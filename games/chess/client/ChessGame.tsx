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
  stockfishLevel,
  type StockfishLevelId,
} from './stockfish'
import { ModelSubmissionPanel } from './ModelSubmissionPanel'
import { ModelArena } from './ModelArena'
import { disposeChessSound, isSoundEnabled, playMoveSound, playUndoSound, setSoundEnabled } from './sound'
import { descriptorFromDiff, kingSquare, outcomeInfo, pinnedSquares, resultFor, type GameOverInfo } from './chess-logic'
import {
  CHESS_TIME_CONTROLS,
  DEFAULT_CHESS_TIME_ID,
  chessTimeLabel,
  formatClock,
} from '../time-control'
import './chess.css'

type Mode = 'setup' | 'bot' | 'local' | 'online'
type SetupMode = 'bot' | 'online' | 'local' | 'arena'
type OnlineAction = 'create' | 'join'
type PendingPromotion = { from: Square; to: Square } | null
type ModelOption = { revisionId: string; displayName: string; runtimeId: string }

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

export function ChessGame() {
  const [mode, setMode] = useState<Mode>('setup')
  const [setupMode, setSetupMode] = useState<SetupMode>('bot')
  const [onlineAction, setOnlineAction] = useState<OnlineAction>('create')
  const [colorChoice, setColorChoice] = useState<ChessColorChoice>('white')
  const [humanColor, setHumanColor] = useState<Color>('w')
  const [levelId, setLevelId] = useState<StockfishLevelId>('club')
  const [modelRevision, setModelRevision] = useState('builtin-stockfish-18')
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([{ revisionId: 'builtin-stockfish-18', displayName: 'Stockfish 18', runtimeId: 'builtin-stockfish-18' }])
  const [localFen, setLocalFen] = useState(() => new Chess().fen())
  const [localPgn, setLocalPgn] = useState('')
  const [localResult, setLocalResult] = useState('')
  const [selected, setSelected] = useState<Square | null>(null)
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)
  const [promotion, setPromotion] = useState<PendingPromotion>(null)
  const [engineThinking, setEngineThinking] = useState(false)
  const [engineError, setEngineError] = useState('')
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled())
  const engineRef = useRef<StockfishBrowserEngine | null>(null)
  const [playerId, setPlayerId] = useState('')
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [timeControlId, setTimeControlId] = useState(DEFAULT_CHESS_TIME_ID)
  const [clockNow, setClockNow] = useState(() => Date.now())
  const roomClient = useGameRoom<ChessGameView>({ gameId: 'chess', playerId, pollMs: 1000 })
  const [undoStack, setUndoStack] = useState<Array<{ fen: string; pgn: string }>>([])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayerId(getOrCreatePlayerId())
    setName(getPlayerName() || '')
  }, [])

  useEffect(() => {
    fetch('/api/chess-models').then(response => response.json()).then((body: { models?: ModelOption[] }) => {
      if (body.models?.length) setModelOptions(body.models)
    }).catch(() => undefined)
  }, [])

  useEffect(() => () => {
    engineRef.current?.destroy()
    disposeChessSound()
  }, [])

  const online = roomClient.room?.game ?? null
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
  const applyMove = useCallback((move: { from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' }, painter = 'q') => {
    const next = new Chess(localFen)
    try { next.move({ from: move.from, to: move.to, promotion: move.promotion ?? painter }) } catch { return false }
    setUndoStack((stack) => [...stack, { fen: localFen, pgn: localPgn }])
    setLocalFen(next.fen())
    setLocalPgn(next.pgn())
    setLocalResult(resultFor(next))
    setLastMove({ from: move.from, to: move.to })
    setSelected(null)
    setPromotion(null)
    return true
  }, [localFen, localPgn])

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

  useEffect(() => {
    if (mode !== 'bot' || localResult || chess.turn() === humanColor) return
    let cancelled = false
    const run = async () => {
      setEngineThinking(true)
      setEngineError('')
      try {
        let move: { from: Square; to: Square; promotion?: 'q' | 'r' | 'b' | 'n' }
        if (modelRevision === 'builtin-stockfish-18') {
          engineRef.current ??= new StockfishBrowserEngine()
          move = await engineRef.current.findBestMove(localFen, levelId)
        } else {
          const legalMoves = chess.moves({ verbose: true }).map(item => `${item.from}${item.to}${item.promotion ?? ''}`)
          const response = await fetch(`/api/chess-models/${encodeURIComponent(modelRevision)}/move`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ fen: localFen, legalMoves, moveTimeMs: 500 }),
          })
          const result = await response.json() as { move?: string; error?: string }
          if (!response.ok || !result.move) throw new Error(result.error || 'Custom model failed to move')
          move = { from: result.move.slice(0, 2) as Square, to: result.move.slice(2, 4) as Square, promotion: result.move[4] as 'q' | 'r' | 'b' | 'n' | undefined }
        }
        if (cancelled) return
        applyMove({ from: move.from, to: move.to, promotion: move.promotion })
      } catch (error) {
        if (!cancelled) setEngineError(error instanceof Error ? error.message : 'Chess model failed to move.')
      } finally {
        if (!cancelled) setEngineThinking(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [applyMove, chess, humanColor, levelId, localFen, localResult, mode, modelRevision])

  function resetToSetup() {
    engineRef.current?.destroy()
    engineRef.current = null
    roomClient.clear()
    setUndoStack([])
    setMode('setup')
    setSelected(null)
    setLastMove(null)
    setPromotion(null)
    setNotice('')
    setEngineError('')
    setEngineThinking(false)
  }

  function startLocal(nextMode: 'bot' | 'local') {
    setHumanColor(nextMode === 'bot' ? chosenColor(colorChoice) : colorChoice === 'black' ? 'b' : 'w')
    setUndoStack([])
    setLocalFen(new Chess().fen())
    setLocalPgn('')
    setLocalResult('')
    setSelected(null)
    setLastMove(null)
    setPromotion(null)
    setEngineError('')
    setEngineThinking(false)
    setMode(nextMode)
  }

  async function commitMove(from: Square, to: Square, piece: 'q' | 'r' | 'b' | 'n' = 'q') {
    if (mode === 'online') {
      if (!online || online.phase !== 'active' || onlineColor !== chess.turn()) return false
      await roomClient.dispatch({ type: 'chess.move', from, to, promotion: piece })
      setSelected(null)
      return true
    }
    if (localResult || engineThinking || (mode === 'bot' && chess.turn() !== humanColor)) return false
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
    if (!piece || piece.color !== chess.turn()) return false
    if (mode === 'local') return true
    if (mode === 'bot') return piece.color === humanColor && !engineThinking
    return mode === 'online' && online?.phase === 'active' && piece.color === onlineColor
  }

  function onSquareClick({ square }: SquareHandlerArgs) {
    const target = square as Square
    if (selected && legalTargets.includes(target)) return void requestMove(selected, target)
    setSelected(canControl(target) ? target : null)
  }

  function onDragStart({ square }: PieceHandlerArgs) {
    if (square && canControl(square as Square)) setSelected(square as Square)
  }

  function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs) {
    if (!targetSquare || !canControl(sourceSquare as Square)) return false
    const legal = chess.moves({ square: sourceSquare as Square, verbose: true })
      .some((move) => move.to === targetSquare)
    if (!legal) return false
    return requestMove(sourceSquare as Square, targetSquare as Square)
  }

  function undoMove() {
    const stack = undoStack
    const required = mode === 'bot' ? 2 : 1
    if (mode === 'online' || engineThinking || stack.length < required) return
    const rest = stack.slice(0, stack.length - required)
    const restore = rest.length ? rest[rest.length - 1] : { fen: new Chess().fen(), pgn: '' }
    setUndoStack(rest)
    setLocalFen(restore.fen)
    setLocalPgn(restore.pgn)
    setLocalResult('')
    setSelected(null)
    setLastMove(null)
    setPromotion(null)
    setEngineError('')
    playUndoSound()
  }

  const canUndo = mode !== 'online' && !engineThinking && undoStack.length >= (mode === 'bot' ? 2 : 1)

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

  const isMultiplayer = mode === 'online'
  const finishedResult = isMultiplayer && online?.phase === 'finished' ? online.result : localResult
  const perspective: Color | null = isMultiplayer ? onlineColor : mode === 'bot' ? humanColor : null
  const outcome: GameOverInfo | null = finishedResult ? outcomeInfo(finishedResult, perspective) : null
  const opponentName = modelOptions.find((model) => model.revisionId === modelRevision)?.displayName ?? 'Stockfish 18'

  const status = isMultiplayer && online
    ? online.phase === 'lobby' ? `Waiting for opponent · ${roomClient.room?.players.length ?? 0}/2` : online.result || `${chess.turn() === 'w' ? 'White' : 'Black'} to move`
    : localResult || (engineThinking ? `${opponentName} is thinking…` : `${chess.turn() === 'w' ? 'White' : 'Black'} to move${chess.inCheck() ? ' · Check' : ''}`)
  const level = stockfishLevel(levelId)

  const squareStyles: Record<string, CSSProperties> = Object.fromEntries([
    ...(displayLastMove ? [[displayLastMove.from, lastMoveStyle], [displayLastMove.to, lastMoveStyle]] : []),
    ...(checkSquare ? [[checkSquare, checkStyle]] : []),
    ...[...pinned].map((square) => [square, pinStyle] as const),
    ...legalTargets.map((square) => [square, captureTargets.has(square) ? captureStyle : moveStyle] as const),
    ...(selected ? [[selected, selectedStyle]] : []),
  ]) as Record<string, CSSProperties>

  return (
    <main className="chess-app">
      <header className="chess-toolbar">
        <div><span className="chess-mark">♞</span><strong>Chess</strong><span className="chess-engine-name">{mode === 'bot' ? opponentName : 'Stockfish 18'}</span></div>
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
          <div className="chess-intro"><span>♞</span><div><p className="chess-kicker">CLASSIC BOARD GAME</p><h1>Play chess your way</h1><p>Stockfish 18 opponents, local pass-and-play, or a protected online room.</p></div></div>
          <nav className="chess-mode-tabs" aria-label="Game mode">
            <button className={setupMode === 'bot' ? 'active' : ''} onClick={() => setSetupMode('bot')}><b>♟</b><span>Computer<small>Bot modes support undo</small></span></button>
            <button className={setupMode === 'online' ? 'active' : ''} onClick={() => setSetupMode('online')}><b>♜</b><span>Online<small>Private room</small></span></button>
            <button className={setupMode === 'local' ? 'active' : ''} onClick={() => setSetupMode('local')}><b>♚</b><span>Local<small>Same device</small></span></button>
            <button className={setupMode === 'arena' ? 'active' : ''} onClick={() => setSetupMode('arena')}><b>⚔</b><span>Model arena<small>3s turns + replay</small></span></button>
          </nav>

          {setupMode === 'arena' ? <ModelArena models={modelOptions} /> : <div className="chess-setup-panel">
            <div className="chess-choice-row"><span>Play as</span><div className="chess-segmented">{(['white', 'random', 'black'] as const).map((color) => <button key={color} className={colorChoice === color ? 'selected' : ''} onClick={() => setColorChoice(color)}>{color === 'white' ? '○ White' : color === 'black' ? '● Black' : '◐ Random'}</button>)}</div></div>

            {setupMode === 'bot' && <>
              <div className="chess-field"><label htmlFor="opponent-model">Opponent model</label><select id="opponent-model" value={modelRevision} onChange={(event) => setModelRevision(event.target.value)}>{modelOptions.map((model) => <option key={model.revisionId} value={model.revisionId}>{model.displayName}</option>)}</select><small>Only scanned, approved, deployed, and healthy models appear here.</small></div>
              <div className="chess-field"><label htmlFor="stockfish-level">Stockfish difficulty</label><select id="stockfish-level" disabled={modelRevision !== 'builtin-stockfish-18'} value={levelId} onChange={(event) => setLevelId(event.target.value as StockfishLevelId)}>{STOCKFISH_LEVELS.map((item) => <option key={item.id} value={item.id}>{item.label} · Skill {item.skill}/20</option>)}</select><small>{modelRevision === 'builtin-stockfish-18' ? `${level.description}. Stockfish 18 WASM, ${level.moveTimeMs} ms search per move.` : 'Custom model strength and move budget are controlled by its approved runtime profile.'}</small></div>
              <button className="chess-primary" onClick={() => startLocal('bot')}>Play {opponentName}</button>
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
          <footer className="chess-attribution">Rules: chess.js · Engine: Stockfish 18 lite WASM · Board: react-chessboard</footer>
        </section>
      ) : (
        <section className="chess-game-layout">
          <div className="chess-board-wrap" aria-label="Chess board">
            <Chessboard options={{
              id: 'analytics-chess-board',
              position: fen,
              boardOrientation: orientation === 'w' ? 'white' : 'black',
              onSquareClick,
              onPieceDrop,
              onPieceDrag: onDragStart,
              canDragPiece: ({ square }) => Boolean(square && canControl(square as Square)),
              squareStyles,
              lightSquareStyle: { backgroundColor: '#e8d7b7' },
              darkSquareStyle: { backgroundColor: '#66866f' },
              boardStyle: { borderRadius: 4, boxShadow: '0 10px 28px rgba(17,31,24,.28)' },
              animationDurationInMs: 180,
            }} />
          </div>
          <aside className="chess-sidebar">
            <div className="chess-status"><span className={`turn-dot ${chess.turn() === 'w' ? 'white' : 'black'}`} /><div><small>{mode === 'bot' ? `You are ${humanColor === 'w' ? 'White' : 'Black'}` : mode === 'local' ? 'Pass and play' : onlineColor ? `You are ${onlineColor === 'w' ? 'White' : 'Black'}` : 'Online game'}</small><h2>{status}</h2></div></div>
            {mode === 'bot' && <div className="chess-opponent"><span>♞</span><div><b>{opponentName}</b><small>{modelRevision === 'builtin-stockfish-18' ? `${level.label} · Skill ${level.skill}/20` : 'Custom model'}</small></div></div>}
            {engineError && <p className="chess-notice" role="alert">{engineError}</p>}
            {mode === 'online' && roomClient.room && <div className="chess-room-panel"><small>ROOM CODE</small><div><strong>{roomClient.room.code}</strong><button onClick={() => void navigator.clipboard.writeText(roomClient.room?.code ?? '')}>Copy</button></div><p>{roomClient.room.players.map((player) => player.name).join('  vs  ')}</p>{online?.phase === 'lobby' && roomClient.room.hostId === playerId && <button className="chess-primary" disabled={roomClient.room.players.length !== 2 || roomClient.pending} onClick={() => void roomClient.dispatch({ type: 'chess.start', hostColor: colorChoice, timeControlId })}>{roomClient.room.players.length === 2 ? 'Start match' : 'Waiting for opponent…'}</button>}</div>}
            {mode === 'online' && online?.timeControlId && (
              <div className="chess-clocks" aria-label="Game clock">
                <div className={`chess-clock ${chess.turn() === 'w' && online.phase === 'active' ? 'active' : ''}`}><span>White</span><b>{formatClock(remainingMs.w)}</b></div>
                <div className={`chess-clock ${chess.turn() === 'b' && online.phase === 'active' ? 'active' : ''}`}><span>Black</span><b>{formatClock(remainingMs.b)}</b></div>
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

      {outcome && (
        <div className="chess-end-backdrop" role="dialog" aria-modal="true" aria-label="Game over">
          <div className={`chess-end-card ${outcome.kind}`}>
            <p className="chess-end-kicker">GAME OVER</p>
            <h2>{outcome.headline}</h2>
            <p className="chess-end-reason">{outcome.reason}</p>
            <div className="chess-end-actions">
              {!isMultiplayer && <button className="chess-primary" onClick={() => startLocal(mode as 'bot' | 'local')}>{mode === 'local' ? 'Rematch' : 'Play again'}</button>}
              {isMultiplayer && online?.phase === 'finished' && roomClient.room?.hostId === playerId && (
                <button className="chess-primary" onClick={() => void roomClient.dispatch({ type: 'chess.rematch' })}>Rematch</button>
              )}
              <button onClick={resetToSetup}>New game</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
