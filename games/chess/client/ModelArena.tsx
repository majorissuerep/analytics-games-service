'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LoadingState } from '@/components/ui/LoadingState'
import { requestEngine } from '@/lib/engine/client/request-engine'
import { fetchWithTimeout } from '@/lib/engine/client/fetch-with-timeout'
import type { EngineProgress } from '@/lib/engine/engine-progress'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { ModelMatchState } from '@/lib/chess-models/model-match'
import { emitGameSessionCompleted } from '@/lib/analytics/game-events'

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
const TURN_BUDGET_OPTIONS = [1000, 2000, 3000, 5000, 10000]

export function ModelArena({ models }: { models: ModelOption[] }) {
  const [arenaSection, setArenaSection] = useState<'configure' | 'replay' | 'archive'>('configure')
  const [whiteRevisionId, setWhiteRevisionId] = useState(BUILTIN)
  const [blackRevisionId, setBlackRevisionId] = useState(BUILTIN)
  const [turnBudgetMs, setTurnBudgetMs] = useState(3000)
  const [match, setMatch] = useState<MatchRecord | null>(null)
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [controlToken, setControlToken] = useState('')
  const [thinking, setThinking] = useState(false)
  const [progress, setProgress] = useState<EngineProgress | null>(null)
  const [controlPending, setControlPending] = useState<'create' | 'pause' | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(true)
  const [archiveError, setArchiveError] = useState('')
  const moveAbortRef = useRef<AbortController | null>(null)
  const archiveAbortRef = useRef<AbortController | null>(null)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState('')
  const [replayPly, setReplayPly] = useState(0)
  const [replayPlaying, setReplayPlaying] = useState(false)

  const refreshArchive = useCallback(async () => {
    archiveAbortRef.current?.abort()
    const controller = new AbortController()
    archiveAbortRef.current = controller
    setArchiveLoading(true)
    setArchiveError('')
    try {
      const response = await fetchWithTimeout('/api/chess-model-matches', { signal: controller.signal })
      if (!response.ok) throw new Error('Saved matches could not be loaded. Please retry.')
      const body = await response.json() as { matches?: MatchRecord[] }
      if (!controller.signal.aborted) setMatches(body.matches ?? [])
    } catch (error) { if (!controller.signal.aborted) setArchiveError(error instanceof Error ? error.message : 'Saved matches unavailable.') }
    finally { if (!controller.signal.aborted) setArchiveLoading(false) }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshArchive(), 0)
    return () => { window.clearTimeout(timer); archiveAbortRef.current?.abort(); moveAbortRef.current?.abort() }
  }, [refreshArchive])

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
    const controller = new AbortController()
    const play = async () => {
      moveAbortRef.current = controller
      setThinking(true)
      setError('')
      const started = performance.now()
      const searchMs = Math.max(200, match.state.turnBudgetMs - 200)
      try {
        const chess = new Chess(match.state.fen)
        const revisionId = chess.turn() === 'w' ? match.white_revision_id : match.black_revision_id
        const legalMoves = chess.moves({ verbose: true }).map(move => `${move.from}${move.to}${move.promotion ?? ''}`)
        const moveBody = await requestEngine<{ move?: string; durationMs?: number; error?: string }>(`/api/chess-models/${encodeURIComponent(revisionId)}/move`, { fen: match.state.fen, legalMoves, history: match.state.moves.map(move => move.uci), moveTimeMs: Math.min(10000, searchMs) }, { signal: controller.signal, onProgress: event => { if (!cancelled) setProgress(event) } })
        if (!moveBody.move || !legalMoves.includes(moveBody.move)) throw new Error(moveBody.error || 'Model inference failed')
        const uci = moveBody.move
        if (cancelled) return
        setProgress({ stage: 'saving', message: 'Saving the move for replay' })
        const response = await fetchWithTimeout(`/api/chess-model-matches/${match.id}/moves`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${controlToken}` },
          body: JSON.stringify({ uci, durationMs: Math.max(0, Math.round(moveBody.durationMs ?? performance.now() - started)), expectedPly: match.state.moves.length }),
          signal: controller.signal,
        })
        const body = await response.json() as { match?: MatchRecord; error?: string }
        if (!response.ok || !body.match) throw new Error(body.error || 'Could not save move')
        if (cancelled) return
        setMatch(body.match)
        setReplayPly(body.match.state.moves.length)
        if (body.match.state.status === 'completed') {
          emitGameSessionCompleted('model_match_completed')
          void refreshArchive()
        }
      } catch (cause) {
        if (!cancelled && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Model match failed')
      } finally {
        if (!cancelled) { setThinking(false); setProgress(null) }
      }
    }
    void play()
    return () => { cancelled = true; controller.abort(); setThinking(false); setProgress(null) }
  }, [controlToken, match, retry, refreshArchive])

  async function createMatch() {
    if (controlPending) return
    moveAbortRef.current?.abort()
    setControlPending('create')
    setError('')
    try {
    const response = await fetchWithTimeout('/api/chess-model-matches', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ whiteRevisionId, blackRevisionId, turnBudgetMs }),
    })
    const body = await response.json() as { match?: { id: string; controlToken: string; state: ModelMatchState; whiteModelName: string; blackModelName: string }; error?: string }
    if (!response.ok || !body.match) return setError(body.error || 'Could not create match')
    const next: MatchRecord = { id: body.match.id, state: body.match.state, white_model_name: body.match.whiteModelName, black_model_name: body.match.blackModelName, white_revision_id: whiteRevisionId, black_revision_id: blackRevisionId, status: body.match.state.status, result: '', created_at: new Date().toISOString() }
    localStorage.setItem(`chess-model-match:${next.id}`, body.match.controlToken)
    setControlToken(body.match.controlToken)
    setMatch(next)
    setReplayPly(0)
    setArenaSection('replay')
    void refreshArchive()
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not create match') }
    finally { setControlPending(null) }
  }

  async function togglePause() {
    if (!match || !controlToken || controlPending) return
    const paused = match.state.status !== 'paused'
    if (paused) moveAbortRef.current?.abort()
    setControlPending('pause')
    try {
    const response = await fetchWithTimeout(`/api/chess-model-matches/${match.id}/pause`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${controlToken}` }, body: JSON.stringify({ paused }),
    })
    const body = await response.json() as { match?: MatchRecord; error?: string }
    if (!response.ok || !body.match) return setError(body.error || 'Could not update match')
    setThinking(false)
    setMatch(body.match)
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not update match') }
    finally { setControlPending(null) }
  }

  function openReplay(item: MatchRecord) {
    setMatch(item)
    setArenaSection('replay')
    setControlToken(localStorage.getItem(`chess-model-match:${item.id}`) ?? '')
    setReplayPly(item.state.moves.length)
    setReplayPlaying(false)
  }

  return <section className="chess-arena" aria-label="Model arena">
    <nav className="chess-utility-tabs" aria-label="Arena sections"><button aria-pressed={arenaSection === 'configure'} onClick={() => setArenaSection('configure')}>New match</button><button disabled={!match} aria-pressed={arenaSection === 'replay'} onClick={() => setArenaSection('replay')}>Replay</button><button aria-pressed={arenaSection === 'archive'} onClick={() => setArenaSection('archive')}>Saved matches</button></nav>
    <div className="chess-arena-config" hidden={arenaSection !== 'configure'} data-scroll-owner="chess-arena-configuration">
    <h2>New model match</h2>
    <div className="chess-model-grid">
      <label>White model<select aria-label="White model" value={whiteRevisionId} onChange={event => setWhiteRevisionId(event.target.value)}>{models.map(model => <option key={model.revisionId} value={model.revisionId}>{model.displayName}</option>)}</select></label>
      <label>Black model<select aria-label="Black model" value={blackRevisionId} onChange={event => setBlackRevisionId(event.target.value)}>{models.map(model => <option key={model.revisionId} value={model.revisionId}>{model.displayName}</option>)}</select></label>
      <label>Turn budget<select aria-label="Turn budget" value={turnBudgetMs} onChange={event => setTurnBudgetMs(Number(event.target.value))}>{TURN_BUDGET_OPTIONS.map(budget => <option key={budget} value={budget}>{budget / 1000} second{budget >= 2000 ? 's' : ''} per move</option>)}</select></label>
    </div>
    <button className="chess-primary" disabled={Boolean(controlPending)} onClick={() => void createMatch()}>{controlPending === 'create' ? 'Creating match…' : 'Start model match'}</button>
    {controlPending && <LoadingState label={controlPending === 'create' ? 'Creating the model match' : 'Updating match controls'} />}
    {error && <p className="chess-notice" role="alert">{error} {match && <button onClick={() => setRetry(value => value + 1)}>Retry move</button>}</p>}
    </div>
    {match && <div className="chess-arena-live" hidden={arenaSection !== 'replay'}>
      <div className="chess-arena-stage"><div><Chessboard options={{ id: 'model-arena-board', position: replayFen, allowDragging: false, animationDurationInMs: 180, lightSquareStyle: { backgroundColor: 'var(--ui-board-light)' }, darkSquareStyle: { backgroundColor: 'var(--ui-board-dark)' } }} /></div></div>
      <aside><h3>{match.white_model_name} vs {match.black_model_name}</h3><p>{match.state.status}{thinking ? ' · thinking' : ''} · {match.state.moves.length} plies · {match.state.turnBudgetMs / 1000}s/turn</p>

        {controlToken && match.state.status !== 'completed' && <button disabled={Boolean(controlPending)} onClick={() => void togglePause()}>{match.state.status === 'paused' ? 'Resume match' : 'Pause match'}</button>}
        <div className="chess-replay-controls"><button aria-label="First position" disabled={replayPly === 0} onClick={() => setReplayPly(0)}>│‹</button><button aria-label="Previous position" disabled={replayPly === 0} onClick={() => setReplayPly(value => Math.max(0, value - 1))}>‹</button><button aria-pressed={replayPlaying} disabled={!match.state.moves.length} onClick={() => { if (!replayPlaying && replayPly >= match.state.moves.length) setReplayPly(0); setReplayPlaying(value => !value) }}>{replayPlaying ? 'Pause replay' : 'Play replay'}</button><button aria-label="Next position" disabled={replayPly === match.state.moves.length} onClick={() => setReplayPly(value => Math.min(match.state.moves.length, value + 1))}>›</button><button aria-label="Latest position" disabled={replayPly === match.state.moves.length} onClick={() => setReplayPly(match.state.moves.length)}>›│</button></div>
        <p>Replay position {replayPly}/{match.state.moves.length}</p><div className="chess-arena-moves" data-scroll-owner="chess-arena-moves">{thinking && <LoadingState key={`${match.id}:${match.state.moves.length}:${retry}`} label={`${new Chess(match.state.fen).turn() === 'w' ? match.white_model_name : match.black_model_name}: ${progress?.message ?? 'Connecting to engine'}`} detail={progress?.detail} />}{error && <p className="chess-notice" role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>Retry move</button></p>}{match.state.moves.map(move => <button key={move.ply} aria-current={replayPly === move.ply ? 'step' : undefined} onClick={() => setReplayPly(move.ply)}>{move.ply}. {move.san}</button>)}</div>
      </aside>
    </div>}
    <div className="chess-match-archive" hidden={arenaSection !== 'archive'} data-scroll-owner="chess-arena-archive"><h3>Saved matches</h3>{archiveLoading && <LoadingState scope="inline" label="Loading saved matches" />}{archiveError && <p role="alert">{archiveError} <button onClick={() => void refreshArchive()}>Retry saved matches</button></p>}{matches.length ? matches.map(item => <button key={item.id} aria-pressed={match?.id === item.id} onClick={() => openReplay(item)}><b>{item.white_model_name} vs {item.black_model_name}</b><span>{item.status} · {item.state.moves.length} plies {item.result}</span></button>) : !archiveLoading && !archiveError && <p>No saved matches yet. Start a model match above to build your replay library.</p>}</div>
  </section>
}
