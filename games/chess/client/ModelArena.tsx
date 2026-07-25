'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { ModelMatchState } from '@/lib/chess-models/model-match'
import { StockfishBrowserEngine } from './stockfish'

type ModelOption = { revisionId: string; displayName: string }
type MatchRecord = {
  id: string
  white_model_name: string
  black_model_name: string
  white_revision_id: string
  black_revision_id: string
  state: ModelMatchState
  status: string
  result: string
  created_at: string
}

const BUILTIN = 'builtin-stockfish-18'

export function ModelArena({ models }: { models: ModelOption[] }) {
  const [whiteRevisionId, setWhiteRevisionId] = useState(BUILTIN)
  const [blackRevisionId, setBlackRevisionId] = useState(BUILTIN)
  const [match, setMatch] = useState<MatchRecord | null>(null)
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [controlToken, setControlToken] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState('')
  const [replayPly, setReplayPly] = useState(0)
  const [replayPlaying, setReplayPlaying] = useState(false)
  const engineRef = useRef<StockfishBrowserEngine | null>(null)

  const refreshArchive = async () => {
    const response = await fetch('/api/chess-model-matches')
    const body = await response.json() as { matches?: MatchRecord[] }
    setMatches(body.matches ?? [])
  }

  useEffect(() => {
    fetch('/api/chess-model-matches').then(response => response.json()).then((body: { matches?: MatchRecord[] }) => setMatches(body.matches ?? [])).catch(() => undefined)
  }, [])
  useEffect(() => () => engineRef.current?.destroy(), [])

  const replayFen = useMemo(() => {
    if (!match) return new Chess().fen()
    if (replayPly <= 0) return new Chess().fen()
    return match.state.moves[Math.min(replayPly, match.state.moves.length) - 1]?.fen ?? match.state.fen
  }, [match, replayPly])

  useEffect(() => {
    if (!replayPlaying || !match) return
    if (replayPly >= match.state.moves.length) return
    const timer = window.setTimeout(() => setReplayPly(value => Math.min(match.state.moves.length, value + 1)), 800)
    return () => window.clearTimeout(timer)
  }, [match, replayPlaying, replayPly])

  useEffect(() => {
    if (!match || !controlToken || match.state.status !== 'active') return
    let cancelled = false
    const play = async () => {
      setThinking(true)
      setError('')
      const started = performance.now()
      try {
        const chess = new Chess(match.state.fen)
        const revisionId = chess.turn() === 'w' ? match.white_revision_id : match.black_revision_id
        let uci: string
        if (revisionId === BUILTIN) {
          engineRef.current ??= new StockfishBrowserEngine()
          const move = await engineRef.current.findBestMoveTimed(match.state.fen, 2800)
          uci = `${move.from}${move.to}${move.promotion ?? ''}`
        } else {
          const legalMoves = chess.moves({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion ?? ''}`)
          const response = await fetch(`/api/chess-models/${encodeURIComponent(revisionId)}/move`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ fen: match.state.fen, legalMoves, moveTimeMs: 2800 }),
          })
          const body = await response.json() as { move?: string; error?: string }
          if (!response.ok || !body.move) throw new Error(body.error || 'Model inference failed')
          uci = body.move
        }
        if (cancelled) return
        const response = await fetch(`/api/chess-model-matches/${match.id}/moves`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${controlToken}` },
          body: JSON.stringify({ uci, durationMs: Math.min(3000, Math.round(performance.now() - started)), expectedPly: match.state.moves.length }),
        })
        const body = await response.json() as { match?: MatchRecord; error?: string }
        if (!response.ok || !body.match) throw new Error(body.error || 'Could not save move')
        setMatch(body.match)
        setReplayPly(body.match.state.moves.length)
        if (body.match.state.status === 'completed') void refreshArchive()
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Model match failed')
      } finally {
        if (!cancelled) setThinking(false)
      }
    }
    void play()
    return () => { cancelled = true }
  }, [controlToken, match])

  async function createMatch() {
    setError('')
    const response = await fetch('/api/chess-model-matches', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ whiteRevisionId, blackRevisionId }),
    })
    const body = await response.json() as { match?: { id: string; controlToken: string; state: ModelMatchState; whiteModelName: string; blackModelName: string }; error?: string }
    if (!response.ok || !body.match) return setError(body.error || 'Could not create match')
    const next: MatchRecord = { id: body.match.id, state: body.match.state, white_model_name: body.match.whiteModelName, black_model_name: body.match.blackModelName, white_revision_id: whiteRevisionId, black_revision_id: blackRevisionId, status: body.match.state.status, result: '', created_at: new Date().toISOString() }
    localStorage.setItem(`chess-model-match:${next.id}`, body.match.controlToken)
    setControlToken(body.match.controlToken)
    setMatch(next)
    setReplayPly(0)
    void refreshArchive()
  }

  async function togglePause() {
    if (!match || !controlToken) return
    const paused = match.state.status !== 'paused'
    const response = await fetch(`/api/chess-model-matches/${match.id}/pause`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${controlToken}` }, body: JSON.stringify({ paused }),
    })
    const body = await response.json() as { match?: MatchRecord; error?: string }
    if (!response.ok || !body.match) return setError(body.error || 'Could not update match')
    setThinking(false)
    setMatch(body.match)
  }

  function openReplay(item: MatchRecord) {
    setMatch(item)
    setControlToken(localStorage.getItem(`chess-model-match:${item.id}`) ?? '')
    setReplayPly(item.state.moves.length)
    setReplayPlaying(false)
  }

  return <section className="chess-arena" aria-label="Model arena">
    <h2>Model arena</h2><p>Two approved models play with a strict three-second turn budget. Every position is saved for replay.</p>
    <div className="chess-model-grid">
      <label>White model<select aria-label="White model" value={whiteRevisionId} onChange={event => setWhiteRevisionId(event.target.value)}>{models.map(model => <option key={model.revisionId} value={model.revisionId}>{model.displayName}</option>)}</select></label>
      <label>Black model<select aria-label="Black model" value={blackRevisionId} onChange={event => setBlackRevisionId(event.target.value)}>{models.map(model => <option key={model.revisionId} value={model.revisionId}>{model.displayName}</option>)}</select></label>
    </div>
    <button className="chess-primary" onClick={() => void createMatch()}>Start model match</button>
    {error && <p className="chess-notice" role="alert">{error}</p>}
    {match && <div className="chess-arena-live">
      <div><Chessboard options={{ id: 'model-arena-board', position: replayFen, allowDragging: false, animationDurationInMs: 180, lightSquareStyle: { backgroundColor: '#e8d7b7' }, darkSquareStyle: { backgroundColor: '#66866f' } }} /></div>
      <aside><h3>{match.white_model_name} vs {match.black_model_name}</h3><p>{match.state.status}{thinking ? ' · thinking' : ''} · {match.state.moves.length} plies · 3s/turn</p>
        {controlToken && match.state.status !== 'completed' && <button onClick={() => void togglePause()}>{match.state.status === 'paused' ? 'Resume match' : 'Pause match'}</button>}
        <div className="chess-replay-controls"><button onClick={() => setReplayPly(0)}>⏮</button><button onClick={() => setReplayPly(value => Math.max(0, value - 1))}>◀</button><button onClick={() => setReplayPlaying(value => !value)}>{replayPlaying ? 'Pause replay' : 'Play replay'}</button><button onClick={() => setReplayPly(value => Math.min(match.state.moves.length, value + 1))}>▶</button><button onClick={() => setReplayPly(match.state.moves.length)}>⏭</button></div>
        <p>Replay position {replayPly}/{match.state.moves.length}</p><div className="chess-arena-moves">{match.state.moves.map(move => <button key={move.ply} onClick={() => setReplayPly(move.ply)}>{move.ply}. {move.san}</button>)}</div>
      </aside>
    </div>}
    <div className="chess-match-archive"><h3>Saved matches</h3>{matches.length ? matches.map(item => <button key={item.id} onClick={() => openReplay(item)}><b>{item.white_model_name} vs {item.black_model_name}</b><span>{item.status} · {item.state.moves.length} plies {item.result}</span></button>) : <p>No saved matches yet.</p>}</div>
  </section>
}
