'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Color, type Square } from 'chess.js'
import { Chessboard, type PieceDropHandlerArgs, type SquareHandlerArgs } from 'react-chessboard'
import { getOrCreatePlayerId, getPlayerName, setPlayerName } from '@/lib/cookies'
import { useGameRoom } from '@/lib/engine/client/use-game-room'
import type { ChessColorChoice, ChessGameView } from '../model'
import {
  STOCKFISH_LEVELS,
  StockfishBrowserEngine,
  stockfishLevel,
  type StockfishLevelId,
} from './stockfish'
import { ModelSubmissionPanel } from './ModelSubmissionPanel'
import './chess.css'

type Mode = 'setup' | 'bot' | 'local' | 'online'
type SetupMode = 'bot' | 'online' | 'local'
type OnlineAction = 'create' | 'join'
type PendingPromotion = { from: Square; to: Square } | null
type ModelOption = { revisionId: string; displayName: string; runtimeId: string }

function resultFor(chess: Chess) {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate'
  if (chess.isStalemate()) return 'Draw by stalemate'
  if (chess.isThreefoldRepetition()) return 'Draw by repetition'
  if (chess.isInsufficientMaterial()) return 'Draw by insufficient material'
  if (chess.isDraw()) return 'Draw'
  return ''
}

function chosenColor(choice: ChessColorChoice): Color {
  if (choice === 'random') return Math.random() < 0.5 ? 'w' : 'b'
  return choice === 'white' ? 'w' : 'b'
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
  const [promotion, setPromotion] = useState<PendingPromotion>(null)
  const [engineThinking, setEngineThinking] = useState(false)
  const [engineError, setEngineError] = useState('')
  const engineRef = useRef<StockfishBrowserEngine | null>(null)
  const [playerId, setPlayerId] = useState('')
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const roomClient = useGameRoom<ChessGameView>({ gameId: 'chess', playerId, pollMs: 1000 })

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

  useEffect(() => () => engineRef.current?.destroy(), [])

  const online = roomClient.room?.game ?? null
  const fen = mode === 'online' && online ? online.fen : localFen
  const chess = useMemo(() => new Chess(fen), [fen])
  const onlineColor: Color | null = online?.whiteId === playerId ? 'w' : online?.blackId === playerId ? 'b' : null
  const orientation: Color = mode === 'online'
    ? onlineColor ?? (colorChoice === 'black' ? 'b' : 'w')
    : mode === 'bot' ? humanColor : colorChoice === 'black' ? 'b' : 'w'
  const legalTargets = useMemo(
    () => selected ? chess.moves({ square: selected, verbose: true }).map((move) => move.to) : [],
    [chess, selected],
  )

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
        const next = new Chess(localFen)
        next.move(move)
        setLocalFen(next.fen())
        setLocalPgn(next.pgn())
        setLocalResult(resultFor(next))
      } catch (error) {
        if (!cancelled) setEngineError(error instanceof Error ? error.message : 'Chess model failed to move.')
      } finally {
        if (!cancelled) setEngineThinking(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [chess, humanColor, levelId, localFen, localResult, mode, modelRevision])

  function resetToSetup() {
    engineRef.current?.destroy()
    engineRef.current = null
    roomClient.clear()
    setMode('setup')
    setSelected(null)
    setPromotion(null)
    setNotice('')
    setEngineError('')
    setEngineThinking(false)
  }

  function startLocal(nextMode: 'bot' | 'local') {
    setHumanColor(nextMode === 'bot' ? chosenColor(colorChoice) : colorChoice === 'black' ? 'b' : 'w')
    setLocalFen(new Chess().fen())
    setLocalPgn('')
    setLocalResult('')
    setSelected(null)
    setPromotion(null)
    setEngineError('')
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
    const next = new Chess(localFen)
    try { next.move({ from, to, promotion: piece }) } catch { return false }
    setLocalFen(next.fen())
    setLocalPgn(next.pgn())
    setLocalResult(resultFor(next))
    setSelected(null)
    return true
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

  function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs) {
    if (!targetSquare || !canControl(sourceSquare as Square)) return false
    const legal = chess.moves({ square: sourceSquare as Square, verbose: true })
      .some((move) => move.to === targetSquare)
    if (!legal) return false
    return requestMove(sourceSquare as Square, targetSquare as Square)
  }

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

  const status = mode === 'online' && online
    ? online.phase === 'lobby' ? `Waiting for opponent · ${roomClient.room?.players.length ?? 0}/2` : online.result || `${chess.turn() === 'w' ? 'White' : 'Black'} to move`
    : localResult || (engineThinking ? 'Stockfish is thinking…' : `${chess.turn() === 'w' ? 'White' : 'Black'} to move${chess.inCheck() ? ' · Check' : ''}`)
  const level = stockfishLevel(levelId)
  const squareStyles = Object.fromEntries([
    ...(selected ? [[selected, { boxShadow: 'inset 0 0 0 4px #f6c344' }]] : []),
    ...legalTargets.map((square) => [square, { background: 'radial-gradient(circle, rgba(20,90,50,.52) 0 17%, transparent 19%)' }]),
    ...(online?.lastMove ? [online.lastMove.from, online.lastMove.to].map((square) => [square, { background: 'rgba(246,195,68,.48)' }]) : []),
  ])

  return (
    <main className="chess-app">
      <header className="chess-toolbar">
        <div><span className="chess-mark">♞</span><strong>Chess</strong><span className="chess-engine-name">Stockfish 18</span></div>
        {mode !== 'setup' && <button onClick={resetToSetup}>New game</button>}
      </header>

      {mode === 'setup' ? (
        <section className="chess-setup" aria-label="Chess setup">
          <div className="chess-intro"><span>♞</span><div><p className="chess-kicker">CLASSIC BOARD GAME</p><h1>Play chess your way</h1><p>Stockfish 18 opponents, local pass-and-play, or a protected online room.</p></div></div>
          <nav className="chess-mode-tabs" aria-label="Game mode">
            <button className={setupMode === 'bot' ? 'active' : ''} onClick={() => setSetupMode('bot')}><b>♟</b><span>Computer<small>Stockfish 18</small></span></button>
            <button className={setupMode === 'online' ? 'active' : ''} onClick={() => setSetupMode('online')}><b>♜</b><span>Online<small>Private room</small></span></button>
            <button className={setupMode === 'local' ? 'active' : ''} onClick={() => setSetupMode('local')}><b>♚</b><span>Local<small>Same device</small></span></button>
          </nav>

          <div className="chess-setup-panel">
            <div className="chess-choice-row"><span>Play as</span><div className="chess-segmented">{(['white', 'random', 'black'] as const).map((color) => <button key={color} className={colorChoice === color ? 'selected' : ''} onClick={() => setColorChoice(color)}>{color === 'white' ? '○ White' : color === 'black' ? '● Black' : '◐ Random'}</button>)}</div></div>

            {setupMode === 'bot' && <>
              <div className="chess-field"><label htmlFor="opponent-model">Opponent model</label><select id="opponent-model" value={modelRevision} onChange={(event) => setModelRevision(event.target.value)}>{modelOptions.map((model) => <option key={model.revisionId} value={model.revisionId}>{model.displayName}</option>)}</select><small>Only scanned, approved, deployed, and healthy models appear here.</small></div>
              <div className="chess-field"><label htmlFor="stockfish-level">Stockfish difficulty</label><select id="stockfish-level" disabled={modelRevision !== 'builtin-stockfish-18'} value={levelId} onChange={(event) => setLevelId(event.target.value as StockfishLevelId)}>{STOCKFISH_LEVELS.map((item) => <option key={item.id} value={item.id}>{item.label} · Skill {item.skill}/20</option>)}</select><small>{modelRevision === 'builtin-stockfish-18' ? `${level.description}. Stockfish 18 WASM, ${level.moveTimeMs} ms search per move.` : 'Custom model strength and move budget are controlled by its approved runtime profile.'}</small></div>
              <button className="chess-primary" onClick={() => startLocal('bot')}>Play {modelOptions.find((model) => model.revisionId === modelRevision)?.displayName ?? 'Chess model'}</button>
            </>}

            {setupMode === 'local' && <><p className="chess-explainer">Take turns on this device. The board stays oriented to your selected side and all legal chess rules apply.</p><button className="chess-primary" onClick={() => startLocal('local')}>Start pass-and-play</button></>}

            {setupMode === 'online' && <>
              <div className="chess-online-tabs"><button className={onlineAction === 'create' ? 'active' : ''} onClick={() => setOnlineAction('create')}>Create room</button><button className={onlineAction === 'join' ? 'active' : ''} onClick={() => setOnlineAction('join')}>Join room</button></div>
              <div className="chess-field"><label htmlFor="chess-name">Display name</label><input id="chess-name" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="nickname" /></div>
              {onlineAction === 'join' && <div className="chess-field"><label htmlFor="chess-code">Room code</label><input id="chess-code" className="code-input" value={roomCode} maxLength={6} onChange={(event) => setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))} placeholder="ABC234" autoComplete="off" /></div>}
              <div className="chess-field"><label htmlFor="chess-password">Room password <span>optional</span></label><input id="chess-password" value={password} maxLength={100} onChange={(event) => setPassword(event.target.value)} type="password" placeholder={onlineAction === 'create' ? 'Protect this room' : 'Enter room password'} /></div>
              <button className="chess-primary" onClick={() => void (onlineAction === 'create' ? createOnline() : joinOnline())} disabled={roomClient.pending || !playerId}>{roomClient.pending ? 'Connecting…' : onlineAction === 'create' ? 'Create private room' : 'Join room'}</button>
            </>}
            {(notice || roomClient.error) && <p className="chess-notice" role="alert">{notice || roomClient.error?.message}</p>}
          </div>
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
            {mode === 'bot' && <div className="chess-opponent"><span>♞</span><div><b>Stockfish 18</b><small>{level.label} · Skill {level.skill}/20</small></div></div>}
            {engineError && <p className="chess-notice" role="alert">{engineError}</p>}
            {mode === 'online' && roomClient.room && <div className="chess-room-panel"><small>ROOM CODE</small><div><strong>{roomClient.room.code}</strong><button onClick={() => void navigator.clipboard.writeText(roomClient.room?.code ?? '')}>Copy</button></div><p>{roomClient.room.players.map((player) => player.name).join('  vs  ')}</p>{online?.phase === 'lobby' && roomClient.room.hostId === playerId && <button className="chess-primary" disabled={roomClient.room.players.length !== 2 || roomClient.pending} onClick={() => void roomClient.dispatch({ type: 'chess.start', hostColor: colorChoice })}>{roomClient.room.players.length === 2 ? 'Start match' : 'Waiting for opponent…'}</button>}</div>}
            <div className="chess-moves"><h3>Move history</h3><div>{mode === 'online' ? online?.pgn || 'Moves will appear here.' : localPgn || 'Moves will appear here.'}</div></div>
            <div className="chess-actions"><button onClick={resetToSetup}>Leave game</button>{mode === 'online' && online?.phase === 'active' && <button className="danger" onClick={() => void roomClient.dispatch({ type: 'chess.resign' })}>Resign</button>}</div>
          </aside>
        </section>
      )}

      {promotion && <div className="promotion-backdrop" role="dialog" aria-modal="true" aria-label="Choose promotion piece"><div className="promotion-card"><h2>Promote pawn</h2><p>Choose a piece.</p><div>{(['q', 'r', 'b', 'n'] as const).map((piece) => <button key={piece} onClick={() => { void commitMove(promotion.from, promotion.to, piece); setPromotion(null) }}>{piece === 'q' ? '♛ Queen' : piece === 'r' ? '♜ Rook' : piece === 'b' ? '♝ Bishop' : '♞ Knight'}</button>)}</div><button onClick={() => setPromotion(null)}>Cancel</button></div></div>}
    </main>
  )
}
