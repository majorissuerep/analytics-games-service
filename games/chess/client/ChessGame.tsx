'use client'

import { useEffect, useMemo, useState } from 'react'
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js'
import { getOrCreatePlayerId, getPlayerName, setPlayerName } from '@/lib/cookies'
import { useGameRoom } from '@/lib/engine/client/use-game-room'
import type { ChessColorChoice, ChessGameView } from '../model'
import './chess.css'

const PIECES: Record<Color, Record<PieceSymbol, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
}
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

type Mode = 'menu' | 'bot' | 'local' | 'online'

function resultFor(chess: Chess) {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate'
  if (chess.isStalemate()) return 'Draw by stalemate'
  if (chess.isDraw()) return 'Draw'
  return ''
}

function chooseBotMove(chess: Chess, level: 'easy' | 'medium') {
  const moves = chess.moves({ verbose: true })
  if (level === 'easy') return moves[Math.floor(Math.random() * moves.length)]
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
  const ranked = moves.map((move) => ({ move, score: move.captured ? values[move.captured] : 0 }))
  const best = Math.max(...ranked.map(({ score }) => score))
  const options = ranked.filter(({ score }) => score === best)
  return options[Math.floor(Math.random() * options.length)].move
}

export function ChessGame() {
  const [mode, setMode] = useState<Mode>('menu')
  const [colorChoice, setColorChoice] = useState<ChessColorChoice>('white')
  const [humanColor, setHumanColor] = useState<Color>('w')
  const [level, setLevel] = useState<'easy' | 'medium'>('medium')
  const [localFen, setLocalFen] = useState(() => new Chess().fen())
  const [localPgn, setLocalPgn] = useState('')
  const [localResult, setLocalResult] = useState('')
  const [selected, setSelected] = useState<Square | null>(null)
  const [playerId, setPlayerId] = useState('')
  const [name, setName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const roomClient = useGameRoom<ChessGameView>({ gameId: 'chess', playerId, pollMs: 1000 })

  useEffect(() => {
    // Hydrate browser cookie identity only after client mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayerId(getOrCreatePlayerId())
    setName(getPlayerName() || '')
  }, [])

  const online = roomClient.room?.game ?? null
  const fen = mode === 'online' && online ? online.fen : localFen
  const chess = useMemo(() => new Chess(fen), [fen])
  const onlineColor: Color | null = online?.whiteId === playerId ? 'w' : online?.blackId === playerId ? 'b' : null
  const orientation: Color = mode === 'online' ? onlineColor ?? (colorChoice === 'black' ? 'b' : 'w') : mode === 'bot' ? humanColor : colorChoice === 'black' ? 'b' : 'w'
  const legalTargets = useMemo(() => selected ? chess.moves({ square: selected, verbose: true }).map((move) => move.to) : [], [chess, selected])

  useEffect(() => {
    if (mode !== 'bot' || localResult || chess.turn() === humanColor) return
    const timer = window.setTimeout(() => {
      const next = new Chess(localFen)
      const move = chooseBotMove(next, level)
      if (!move) return
      next.move(move)
      setLocalFen(next.fen())
      setLocalPgn(next.pgn())
      setLocalResult(resultFor(next))
      setSelected(null)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [chess, humanColor, level, localFen, localResult, mode])

  function startLocal(nextMode: 'bot' | 'local') {
    let chosen: Color = colorChoice === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : colorChoice === 'white' ? 'w' : 'b'
    if (nextMode === 'local') chosen = colorChoice === 'black' ? 'b' : 'w'
    setHumanColor(chosen)
    setLocalFen(new Chess().fen())
    setLocalPgn('')
    setLocalResult('')
    setSelected(null)
    setMode(nextMode)
  }

  async function playMove(from: Square, to: Square) {
    if (mode === 'online') {
      if (!online || online.phase !== 'active' || onlineColor !== chess.turn()) return
      await roomClient.dispatch({ type: 'chess.move', from, to, promotion: 'q' })
      setSelected(null)
      return
    }
    if (localResult || (mode === 'bot' && chess.turn() !== humanColor)) return
    const next = new Chess(localFen)
    try { next.move({ from, to, promotion: 'q' }) } catch { return }
    setLocalFen(next.fen())
    setLocalPgn(next.pgn())
    setLocalResult(resultFor(next))
    setSelected(null)
  }

  function clickSquare(square: Square) {
    if (selected && legalTargets.includes(square)) {
      void playMove(selected, square)
      return
    }
    const piece = chess.get(square)
    const canControl = mode === 'local' || (mode === 'bot' && piece?.color === humanColor) || (mode === 'online' && piece?.color === onlineColor)
    setSelected(piece && piece.color === chess.turn() && canControl ? square : null)
  }

  async function createOnline() {
    if (!name.trim()) return setNotice('Enter your name first.')
    setPlayerName(name.trim())
    try {
      const room = await roomClient.create({ id: playerId, name: name.trim() }, password)
      setRoomCode(room.code)
      setMode('online')
      setNotice('Room created. Share the code and password.')
    } catch (error) { setNotice(String(error instanceof Error ? error.message : error)) }
  }

  async function joinOnline() {
    if (!name.trim() || roomCode.trim().length !== 6) return setNotice('Enter your name and six-character room code.')
    setPlayerName(name.trim())
    try {
      await roomClient.join(roomCode.trim().toUpperCase(), { id: playerId, name: name.trim() }, password)
      setMode('online')
      setNotice('Joined room.')
    } catch (error) { setNotice(String(error instanceof Error ? error.message : error)) }
  }

  const ranks = orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8]
  const files = orientation === 'w' ? FILES : [...FILES].reverse()
  const status = mode === 'online' && online
    ? online.phase === 'lobby' ? `Lobby · ${roomClient.room?.players.length ?? 0}/2 players` : online.result || `${chess.turn() === 'w' ? 'White' : 'Black'} to move`
    : localResult || `${chess.turn() === 'w' ? 'White' : 'Black'} to move${chess.inCheck() ? ' · check' : ''}`

  return (
    <main className="chess-app">
      <header className="chess-toolbar">
        <strong>♟ Chess</strong>
        {mode !== 'menu' && <button onClick={() => { roomClient.clear(); setMode('menu'); setSelected(null) }}>New setup</button>}
      </header>

      {mode === 'menu' ? (
        <section className="chess-setup" aria-label="Chess setup">
          <div className="chess-hero"><span>♔</span><div><h1>Classic Chess</h1><p>Legal moves powered by chess.js. Choose how you want to play.</p></div></div>
          <label>Your name<input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="Player name" /></label>
          <fieldset><legend>Your color</legend>{(['white', 'black', 'random'] as const).map((color) => <button key={color} className={colorChoice === color ? 'selected' : ''} onClick={() => setColorChoice(color)}>{color}</button>)}</fieldset>
          <div className="chess-mode-grid">
            <article><h2>Play a bot</h2><p>Solo game with immediate computer replies.</p><select value={level} onChange={(event) => setLevel(event.target.value as 'easy' | 'medium')}><option value="easy">Easy · random</option><option value="medium">Medium · captures first</option></select><button onClick={() => startLocal('bot')}>Start bot game</button></article>
            <article><h2>Pass & play</h2><p>Two players share this device and take turns.</p><button onClick={() => startLocal('local')}>Start local game</button></article>
            <article><h2>Online room</h2><p>Create or join a protected two-player room.</p><input value={password} maxLength={100} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Room password (optional)" /><button onClick={() => void createOnline()} disabled={roomClient.pending}>Create room</button><div className="chess-join"><input value={roomCode} maxLength={6} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="ROOM CODE" /><button onClick={() => void joinOnline()} disabled={roomClient.pending}>Join</button></div></article>
          </div>
          {(notice || roomClient.error) && <p className="chess-notice" role="alert">{notice || roomClient.error?.message}</p>}
        </section>
      ) : (
        <section className="chess-game-layout">
          <div className="chess-board" aria-label="Chess board">
            {ranks.flatMap((rank) => files.map((file) => {
              const square = `${file}${rank}` as Square
              const piece = chess.get(square)
              const light = (FILES.indexOf(file) + rank) % 2 === 1
              return <button key={square} aria-label={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ' empty'}`} className={`chess-square ${light ? 'light' : 'dark'}${selected === square ? ' active' : ''}${legalTargets.includes(square) ? ' legal' : ''}`} onClick={() => clickSquare(square)}><span>{piece ? PIECES[piece.color][piece.type] : ''}</span><small>{file}{rank}</small></button>
            }))}
          </div>
          <aside className="chess-sidebar">
            <h2>{status}</h2>
            {mode === 'online' && roomClient.room && <><div className="chess-room-code"><span>Room code</span><strong>{roomClient.room.code}</strong></div><p>{roomClient.room.players.map((player) => player.name).join(' vs ') || 'Waiting…'}</p>{online?.phase === 'lobby' && roomClient.room.hostId === playerId && <button disabled={roomClient.room.players.length !== 2} onClick={() => void roomClient.dispatch({ type: 'chess.start', hostColor: colorChoice })}>Start online game</button>}</>}
            <p>{mode === 'bot' ? `You play ${humanColor === 'w' ? 'White' : 'Black'} · ${level} bot` : mode === 'local' ? 'Pass-and-play mode' : onlineColor ? `You play ${onlineColor === 'w' ? 'White' : 'Black'}` : 'Spectating'}</p>
            <div className="chess-actions"><button onClick={() => setSelected(null)}>Clear selection</button>{mode === 'online' && online?.phase === 'active' && <button onClick={() => void roomClient.dispatch({ type: 'chess.resign' })}>Resign</button>}</div>
            <div className="chess-moves"><h3>Moves</h3><p>{mode === 'online' ? online?.pgn || 'No moves yet.' : localPgn || 'No moves yet.'}</p></div>
          </aside>
        </section>
      )}
    </main>
  )
}
