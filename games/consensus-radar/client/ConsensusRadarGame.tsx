'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import type { LeaderboardRow } from '@/lib/engine/types'
import { useGameRoom } from '@/lib/engine/client/use-game-room'
import { emitGameSessionCompleted } from '@/lib/analytics/game-events'
import {
  getOrCreatePlayerId,
  getPlayerName,
  setPlayerName as savePlayerName,
} from '@/lib/cookies'
import {
  type ConsensusAction,
  type ConsensusGameView,
  type Lang,
  scoreFor,
  toConsensusRoomView,
} from '../model'
import type { Scale } from '../scales'

// ─── Constants ───────────────────────────────────────────────────────────────
const TEAM_COLORS = ['#00f5a0', '#ffc53d', '#ff4f6b', '#4da6ff']

const T: Record<Lang, Record<string, string>> = {
  uk: {
    tagline:         'калібруй чуйку команди',
    nameTitle:       'Як тебе звати?',
    namePlaceholder: "Твоє ім'я…",
    nameBtn:         'Далі',
    joinTitle:       'Приєднатись або створити',
    createRoom:      'Створити кімнату',
    joinRoom:        'Приєднатись',
    roomPlaceholder: 'Код кімнати (6 символів)',
    orSeparator:     'або',
    lobbyTitle:      'Зал очікування',
    lobbyWaiting:    'Очікуємо гравців…',
    playersIn:       'У кімнаті',
    teamLabel:       'Команда',
    assignTeam:      'Обрати команду',
    hostLabel:       'Хост',
    assignCluegiver: 'Ведучий команди',
    becomeCluegiver: 'Стати ведучим',
    cluegiverSet:    'Ведучий призначений',
    needCluegiver:   'Кожна команда повинна мати ведучого',
    startBtn:        'Почати гру',
    waitForHost:     'Чекаємо поки ведучий розпочне…',
    configTeams:     'Команди',
    configRounds:    'Раундів на команду',
    addTeam:         '+ Команда',
    removeTeam:      '− Команда',
    cluegiverPhase:  'Ведучий думає…',
    cluegiverYou:    'Ти ведучий цього раунду!',
    secretTarget:    'Таємна позиція:',
    secretPill:      'тільки для тебе',
    clueLabel:       'Твоя підказка',
    cluePlaceholder: 'одна асоціація, не число',
    clueHint:        "Запам'ятай позицію. Дай підказку, яка веде туди без слів-напрямків.",
    clueBtn:         'Відправити підказку',
    guessingPhase:   'Команда відгадує',
    clueWas:         'Підказка:',
    dragHint:        'Перетягни маркер',
    lockBtn:         'Зафіксувати',
    lockedWaiting:   'Відповідь зафіксована. Чекаємо на інших…',
    resultPhase:     'Результат',
    targetWas:       'Ціль:',
    guessWas:        'відповідь',
    off:             'відхилення',
    supermark:       'SUPERSHOT!',
    bullseye:        'В яблучко!',
    close:           'Близько!',
    far:             'Далеко…',
    opposite:        'Не той бік!',
    points:          'б',
    nextTurnBtn:     'Наступний хід',
    finalTitle:      'Гру завершено',
    finalScores:     'Фінальний рахунок',
    winnerPrefix:    'Переможець:',
    tie:             'Нічия!',
    againBtn:        'Нова гра',
    leaderboardBtn:  'Рекорди',
    submitScore:     'Записати рекорд',
    submitDone:      'Рекорд збережено!',
    roomCode:        'Код кімнати',
    copyCode:        'Копіювати',
    copied:          'Скопійовано!',
    turn:            'Хід',
    of:              'з',
    lbTitle:         'Таблиця рекордів',
    lbEmpty:         'Ще немає записів — станьте першими!',
    unassigned:      'Без команди',
    you:             '(ти)',
    rounds:          'раундів',
    pt:              'б',
    waitGuesses:     'гравців відповіли',
    configTimer:     'Таймер на відповідь',
    timerOff:        'Вимк',
    timerExpired:    'Час вийшов!',
  },
  en: {
    tagline:         "calibrate your team's instincts",
    nameTitle:       "What's your name?",
    namePlaceholder: 'Your name…',
    nameBtn:         'Continue',
    joinTitle:       'Join or create',
    createRoom:      'Create room',
    joinRoom:        'Join',
    roomPlaceholder: 'Room code (6 chars)',
    orSeparator:     'or',
    lobbyTitle:      'Lobby',
    lobbyWaiting:    'Waiting for players…',
    playersIn:       'Players in room',
    teamLabel:       'Team',
    assignTeam:      'Pick a team',
    hostLabel:       'Host',
    assignCluegiver: 'Team clue-giver',
    becomeCluegiver: 'Be clue-giver',
    cluegiverSet:    'Clue-giver assigned',
    needCluegiver:   'Each team needs exactly one clue-giver',
    startBtn:        'Start game',
    waitForHost:     'Waiting for the host to start…',
    configTeams:     'Teams',
    configRounds:    'Rounds per team',
    addTeam:         '+ Team',
    removeTeam:      '− Team',
    cluegiverPhase:  'Clue-giver is thinking…',
    cluegiverYou:    "You're the clue-giver this round!",
    secretTarget:    'Secret position:',
    secretPill:      'only you see this',
    clueLabel:       'Your clue',
    cluePlaceholder: 'one word or phrase — no numbers',
    clueHint:        'Memorise the position. Give a clue that points there without directions.',
    clueBtn:         'Send clue',
    guessingPhase:   'Team is guessing',
    clueWas:         'Clue:',
    dragHint:        'Drag the marker',
    lockBtn:         'Lock in',
    lockedWaiting:   'Answer locked. Waiting for others…',
    resultPhase:     'Result',
    targetWas:       'Target:',
    guessWas:        'placed',
    off:             'off',
    supermark:       'SUPERSHOT!',
    bullseye:        'Bullseye!',
    close:           'So close!',
    far:             'Way off…',
    opposite:        'Wrong side!',
    points:          'pts',
    nextTurnBtn:     'Next turn',
    finalTitle:      'Game over',
    finalScores:     'Final scores',
    winnerPrefix:    'Winner:',
    tie:             "It's a tie!",
    againBtn:        'New game',
    leaderboardBtn:  'Leaderboard',
    submitScore:     'Submit score',
    submitDone:      'Score saved!',
    roomCode:        'Room code',
    copyCode:        'Copy',
    copied:          'Copied!',
    turn:            'Turn',
    of:              'of',
    lbTitle:         'Leaderboard',
    lbEmpty:         'No scores yet — be the first!',
    unassigned:      'No team',
    you:             '(you)',
    rounds:          'rounds',
    pt:              'pt',
    waitGuesses:     'players answered',
    configTimer:     'Guess timer',
    timerOff:        'Off',
    timerExpired:    "Time's up!",
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(x: number) { return Math.max(0, Math.min(100, x)) }

// ─── Component ───────────────────────────────────────────────────────────────
export function ConsensusRadarGame() {
  const [lang, setLangState]       = useState<Lang>('uk')
  const [screen, setScreen]        = useState<'name' | 'join' | 'lobby' | 'game'>('name')
  const [playerId, setPlayerId]    = useState('')
  const [playerName, setPlayerNameState] = useState('')
  const [nameInput, setNameInput]  = useState('')

  const [joinInput, setJoinInput]  = useState('')
  const [joinError, setJoinError]  = useState('')
  const roomClient = useGameRoom<ConsensusGameView>({
    gameId: 'consensus-radar',
    playerId,
  })
  const roomState = roomClient.room
    ? toConsensusRoomView(roomClient.room.game, roomClient.room.players, roomClient.room.hostId)
    : null
  const roomCode = roomClient.room?.code ?? ''
  const isHost = roomClient.room?.hostId === playerId

  // Local game UI
  const [guess, setGuess]          = useState(50)
  const [clueInput, setClueInput]  = useState('')
  const [copied, setCopied]        = useState(false)
  const [toast, setToast]          = useState<string | null>(null)

  // Leaderboard
  const [showLb, setShowLb]        = useState(false)
  const [lbRows, setLbRows]        = useState<LeaderboardRow[]>([])
  const [lbLoading, setLbLoading]  = useState(false)
  const [scoreSubmitted, setScoreSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Lobby config (host only)
  const [teamNames, setTeamNames]  = useState<string[]>(['', ''])
  const [numTeams, setNumTeams]    = useState(2)
  const [roundsPerTeam, setRoundsPerTeam] = useState(3)
  const [timerSecs, setTimerSecs]  = useState(0) // 0 = off

  // Timer countdown (local, derived from round.timerStart)
  const [timeLeft, setTimeLeft]    = useState<number | null>(null)

  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  const t = useCallback((k: string) => T[lang][k] ?? k, [lang])

  // ─── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const id   = getOrCreatePlayerId()
    const name = getPlayerName()
    setPlayerId(id)
    if (name) { setPlayerNameState(name); setNameInput(name) }
  }, [])

  useEffect(() => {
    if (!roomState) return
    setScreen(roomState.phase === 'lobby' ? 'lobby' : 'game')
  }, [roomState?.phase])

  useEffect(() => {
    if (roomState?.phase === 'final') emitGameSessionCompleted('completed')
  }, [roomState?.phase])

  useEffect(() => {
    if (!roomState || roomState.phase !== 'lobby') return
    setTeamNames(roomState.teams)
    setNumTeams(roomState.teams.length)
    setRoundsPerTeam(roomState.roundsPerTeam)
    setTimerSecs(roomState.timerSecs)
  }, [roomClient.room?.revision, roomState?.phase])

  // ─── Timer countdown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    const round = roomState?.round
    if (!round?.timerStart || roomState?.phase !== 'guessing') {
      setTimeLeft(null)
      return
    }
    const totalMs = (roomState.timerSecs ?? 0) * 1000
    if (totalMs <= 0) { setTimeLeft(null); return }

    function tick() {
      const elapsed = Date.now() - (round!.timerStart as number)
      const left = Math.max(0, Math.ceil((totalMs - elapsed) / 1000))
      setTimeLeft(left)
      if (left <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        // Host auto-reveals result when time is up
        if (isHost) void showResult()
      }
    }
    tick()
    timerRef.current = setInterval(tick, 250)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isHost, roomState?.phase, roomState?.round?.timerStart])

  // ─── Gauge drag ────────────────────────────────────────────────────────────
  const gaugeRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  function getGaugeValue(e: MouseEvent | TouchEvent) {
    if (!gaugeRef.current) return 50
    const rect = gaugeRef.current.getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX
    return pct(Math.round(((x - rect.left) / rect.width) * 100))
  }
  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return
      if ('touches' in e) e.preventDefault()
      setGuess(getGaugeValue(e))
    }
    const onUp = () => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchend', onUp)
    }
  }, [])
  function startDrag(e: React.MouseEvent | React.TouchEvent) {
    dragging.current = true
    setGuess(getGaugeValue(e.nativeEvent as MouseEvent | TouchEvent))
  }

  // ─── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2800) }

  async function runAction(action: ConsensusAction) {
    try {
      return await roomClient.dispatch(action)
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error))
      return null
    }
  }

  // ─── Flow: name ────────────────────────────────────────────────────────────
  function submitName() {
    const n = nameInput.trim() || (lang === 'uk' ? 'Гравець' : 'Player')
    savePlayerName(n)
    setPlayerNameState(n)
    setScreen('join')
  }

  // ─── Flow: create room ─────────────────────────────────────────────────────
  async function createRoom() {
    try {
      await roomClient.create({ id: playerId, name: playerName })
      setTeamNames(['', ''])
      setNumTeams(2)
      setRoundsPerTeam(3)
      setTimerSecs(0)
      setScreen('lobby')
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error))
    }
  }

  // ─── Flow: join room ───────────────────────────────────────────────────────
  async function joinRoom() {
    const code = joinInput.trim().toUpperCase()
    if (code.length !== 6) { setJoinError(lang === 'uk' ? 'Код має бути 6 символів' : 'Code must be 6 characters'); return }
    setJoinError('')
    try {
      const joined = await roomClient.join(code, { id: playerId, name: playerName })
      setScreen(joined.game.phase === 'lobby' ? 'lobby' : 'game')
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : (lang === 'uk' ? 'Помилка з\'єднання' : 'Connection error'))
    }
  }

  // ─── Lobby: team assignment ────────────────────────────────────────────────
  async function assignTeam(teamIdx: number) {
    await runAction({ type: 'consensus.team.assign', teamIndex: teamIdx })
  }

  // ─── Lobby: volunteer as cluegiver for your team ───────────────────────────
  async function assignCluegiver(teamIdx: number) {
    await runAction({ type: 'consensus.cluegiver.assign', teamIndex: teamIdx })
  }

  // ─── Lobby: host config ────────────────────────────────────────────────────
  async function updateLobbyConfig(newTeamNames: string[], newNumTeams: number, newRounds: number, newTimer?: number) {
    if (!roomState || !isHost) return
    await runAction({
      type: 'consensus.lobby.configure',
      teamNames: newTeamNames.slice(0, newNumTeams),
      numTeams: newNumTeams,
      roundsPerTeam: newRounds,
      timerSecs: newTimer ?? timerSecs,
    })
  }

  // ─── Host: start game ──────────────────────────────────────────────────────
  async function startGame() {
    if (!roomState || !isHost) return
    // Validate: every team must have exactly one designated cluegiver
    const cgs = roomState.cluegivers ?? {}
    for (let i = 0; i < numTeams; i++) {
      if (!cgs[i]) {
        showToast(t('needCluegiver'))
        return
      }
    }
    const finalTeams = teamNames.slice(0, numTeams).map((n, i) =>
      n.trim() || `${T[lang].teamLabel} ${i + 1}`
    )
    const started = await runAction({
      type: 'consensus.game.start',
      teamNames: finalTeams,
      numTeams,
      roundsPerTeam,
      timerSecs,
    })
    if (started) setScreen('game')
  }

  // ─── Cluegiver: submit clue ────────────────────────────────────────────────
  async function submitClue() {
    if (!roomState?.round || !clueInput.trim()) return
    const submitted = await runAction({ type: 'consensus.clue.submit', clue: clueInput.trim() })
    if (submitted) setClueInput('')
  }

  // ─── Guesser: lock answer ──────────────────────────────────────────────────
  async function lockGuess() {
    await runAction({ type: 'consensus.guess.lock', guess })
  }

  // ─── Host: advance to result ───────────────────────────────────────────────
  async function showResult() {
    if (!roomState?.round || !isHost) return
    await runAction({ type: 'consensus.round.reveal' })
  }

  // ─── Host: next turn ────────────────────────────────────────────────────────
  async function nextTurn() {
    if (!roomState || !isHost) return
    await runAction({ type: 'consensus.round.next' })
  }

  // ─── Host: reset game ───────────────────────────────────────────────────────
  async function resetGame() {
    if (!roomState || !isHost) return
    const reset = await runAction({ type: 'consensus.game.reset' })
    if (reset) {
      setScoreSubmitted(false)
      setScreen('lobby')
    }
  }

  // ─── Leaderboard ───────────────────────────────────────────────────────────
  async function openLeaderboard() {
    setShowLb(true); setLbLoading(true)
    try {
      const res = await fetch('/api/games/consensus-radar/leaderboard')
      setLbRows((await res.json()).rows || [])
    } catch { setLbRows([]) }
    setLbLoading(false)
  }

  async function submitScore() {
    if (!roomState || scoreSubmitted || submitting) return
    setSubmitting(true)
    try {
      const res = await roomClient.authorizedFetch('/api/games/consensus-radar/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          playerId,
        }),
      })
      if (res.ok) { setScoreSubmitted(true); showToast(t('submitDone')) }
    } catch { /* ignore */ }
    setSubmitting(false)
  }

  // ─── Copy ──────────────────────────────────────────────────────────────────
  function copyCode() {
    navigator.clipboard.writeText(roomCode).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2200)
  }

  // ─── Sub-components ────────────────────────────────────────────────────────
  function Ticks() {
    return (
      <div className="ticks" aria-hidden>
        {Array.from({ length: 11 }, (_, i) => (
          <div key={i} className={`tick${i === 5 ? ' mid' : ''}`} style={{ left: `${i * 10}%` }} />
        ))}
      </div>
    )
  }

  function TargetBand({ target }: { target: number }) {
    const z5 = 4, z3 = 12
    const l3 = pct(target - z3), w3 = pct(Math.min(100, target + z3) - Math.max(0, target - z3))
    const l5 = pct(target - z5), w5 = pct(Math.min(100, target + z5) - Math.max(0, target - z5))
    return (
      <div className="target-band band-reveal">
        <div className="zone-3" style={{ left: `${l3}%`, width: `${w3}%` }} />
        <div className="zone-5" style={{ left: `${l5}%`, width: `${w5}%` }} />
        <div className="zone-ln" style={{ left: `${target}%` }} />
      </div>
    )
  }

  function Poles({ scale }: { scale: Scale }) {
    return (
      <div className="poles">
        <div className="pole left">{scale.l[lang]}</div>
        <div className="pole right">{scale.r[lang]}</div>
      </div>
    )
  }

  function RoomCodePill() {
    return (
      <div className="room-code-box" style={{ marginBottom: 0 }}>
        <div>
          <div className="room-code-label">{t('roomCode')}</div>
          <div className="room-code-val">{roomCode}</div>
        </div>
        <button className={`copy-btn${copied ? ' copied' : ''}`} onClick={copyCode}>
          {copied ? t('copied') : t('copyCode')}
        </button>
      </div>
    )
  }

  function TimerRing({ secs, total }: { secs: number | null; total: number }) {
    if (secs === null || total <= 0) return null
    const r = 22
    const circ = 2 * Math.PI * r
    const frac = Math.max(0, secs / total)
    const urgent = secs <= 10
    const color  = urgent ? 'var(--hot)' : secs <= Math.floor(total * 0.4) ? 'var(--warm)' : 'var(--sweep)'
    return (
      <div className="timer-ring-wrap" aria-live="polite" aria-label={`${secs}s`}>
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
          <circle cx="28" cy="28" r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
          <circle
            cx="28" cy="28" r={r} fill="none"
            stroke={color} strokeWidth="3"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - frac)}
            strokeLinecap="round"
            transform="rotate(-90 28 28)"
            style={{ transition: 'stroke-dashoffset .22s linear, stroke .4s' }}
          />
        </svg>
        <div className="timer-num" style={{ color, fontWeight: 700, fontSize: urgent ? 18 : 16 }}>
          {secs >= 60 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : secs}
        </div>
      </div>
    )
  }

  function ScoreBar({ activeIdx }: { activeIdx?: number }) {
    if (!roomState) return null
    return (
      <div className="scorebar">
        {roomState.teams.map((name, i) => (
          <div key={i} className={`score-card${i === activeIdx ? ' active' : ''}`}>
            <div className="s-name">
              <span className="swatch" style={{ background: TEAM_COLORS[i] }} />
              {name || `${t('teamLabel')} ${i + 1}`}
            </div>
            <div className="s-num">{roomState.scores[i] ?? 0}</div>
          </div>
        ))}
      </div>
    )
  }

  function ProgressBar() {
    if (!roomState) return null
    const total = roomState.roundsPerTeam * roomState.teams.length
    const done  = roomState.turnPtr
    const pctDone = Math.round((done / total) * 100)
    return (
      <div className="progress-wrap">
        <div className="progress-label">
          <span>{t('turn')} {done + 1} {t('of')} {total}</span>
          <span>{pctDone}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pctDone}%` }} />
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN: Name
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'name') {
    return (
      <div className="wrap screen-enter">
        <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} />
        <div className="card">
          <div className="name-screen">
            <div className="logo-big" aria-hidden />
            <h2>{t('nameTitle')}</h2>
            <p className="muted" style={{ fontSize: 14, maxWidth: 340, marginTop: 6, marginBottom: 24 }}>
              {lang === 'uk' ? "Це ім'я побачать інші гравці." : 'Other players will see this name.'}
            </p>
            <div style={{ width: '100%', maxWidth: 380 }}>
              <input
                type="text" autoFocus
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder={t('namePlaceholder')}
                onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitName() }}
                maxLength={40}
              />
              <button className="btn" style={{ marginTop: 12 }} onClick={submitName}>
                {t('nameBtn')} →
              </button>
            </div>
          </div>
        </div>
        {showLb && <LeaderboardModal rows={lbRows} loading={lbLoading} t={t} onClose={() => setShowLb(false)} />}
        {toast && <div className="toast">{toast}</div>}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN: Join / Create
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'join') {
    return (
      <div className="wrap screen-enter">
        <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} playerName={playerName} />
        <div className="card">
          <div className="eyebrow">{t('joinTitle')}</div>
          <h2 style={{ marginBottom: 20 }}>{lang === 'uk' ? `Привіт, ${playerName}` : `Hi, ${playerName}`}</h2>

          <button className="btn" onClick={createRoom} disabled={roomClient.pending}>{t('createRoom')}</button>

          <div className="or-sep">
            <span>{t('orSeparator')}</span>
          </div>

          <div className="field">
            <input
              type="text"
              value={joinInput}
              onChange={e => setJoinInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder={t('roomPlaceholder')}
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) joinRoom() }}
              maxLength={6}
              style={{ letterSpacing: '.12em', fontSize: 20, fontWeight: 700, textAlign: 'center' }}
            />
            {joinError && <p style={{ color: 'var(--hot)', fontSize: 13, marginTop: 6 }}>{joinError}</p>}
          </div>
          <button className="btn ghost" onClick={joinRoom} disabled={roomClient.pending}>{t('joinRoom')}</button>
        </div>
        {showLb && <LeaderboardModal rows={lbRows} loading={lbLoading} t={t} onClose={() => setShowLb(false)} />}
        {toast && <div className="toast">{toast}</div>}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN: Lobby
  // ��───────────────────────────────────────────────────────────────────────���
  if (screen === 'lobby' && roomState) {
    const myPlayer = roomState.players.find(p => p.id === playerId)
    return (
      <div className="wrap screen-enter">
        <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} playerName={playerName} />
        <div className="card">
          <div className="eyebrow">{t('lobbyTitle')}</div>
          <RoomCodePill />

          {/* Players list */}
          <div className="field" style={{ marginTop: 18 }}>
            <label className="lbl">{t('playersIn')} ({roomState.players.length})</label>
            <div className="player-list">
              {roomState.players.map(p => {
                const tm = p.team >= 0 && p.team < (isHost ? numTeams : roomState.teams.length) ? p.team : -1
                const isCgForTeam = tm >= 0 && (roomState.cluegivers ?? {})[tm] === p.id
                const isMe = p.id === playerId
                return (
                  <div key={p.id} className={`player-row${isMe ? ' me' : ''}`}>
                    <span className="player-name">
                      {p.name}
                      {isMe && <span className="you-tag">{t('you')}</span>}
                      {p.id === roomState.hostId && <span className="host-tag">{t('hostLabel')}</span>}
                      {isCgForTeam && (
                        <span className="cg-tag" style={{ background: `${TEAM_COLORS[tm]}22`, borderColor: TEAM_COLORS[tm], color: TEAM_COLORS[tm] }}>
                          {lang === 'uk' ? 'ведучий' : 'clue-giver'}
                        </span>
                      )}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Team picker — only own row */}
                      {isMe && (
                        <div className="team-picker">
                          {Array.from({ length: isHost ? numTeams : roomState.teams.length }, (_, i) => (
                            <button
                              key={i}
                              className={`team-dot-btn${myPlayer?.team === i ? ' active' : ''}`}
                              style={{ '--tc': TEAM_COLORS[i] } as React.CSSProperties}
                              onClick={() => assignTeam(i)}
                              title={`${t('teamLabel')} ${i + 1}`}
                            />
                          ))}
                        </div>
                      )}
                      {/* "Be clue-giver" button — own row, already on a team */}
                      {isMe && tm >= 0 && !isCgForTeam && (
                        <button
                          className="btn ghost small cg-btn"
                          onClick={() => assignCluegiver(tm)}
                          title={t('becomeCluegiver')}
                        >
                          {lang === 'uk' ? 'Ведучий' : 'Clue-giver'}
                        </button>
                      )}
                      {/* Other players: show team badge */}
                      {!isMe && tm >= 0 && (
                        <span className="pill" style={{ borderColor: TEAM_COLORS[tm], color: TEAM_COLORS[tm], fontSize: 11 }}>
                          {roomState.teams[tm] || `${t('teamLabel')} ${tm + 1}`}
                        </span>
                      )}
                      {!isMe && tm < 0 && (
                        <span className="muted" style={{ fontSize: 11 }}>{t('unassigned')}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Validation notice */}
          {(() => {
            const cgs = roomState.cluegivers ?? {}
            const nTeams = isHost ? numTeams : roomState.teams.length
            const missing = Array.from({ length: nTeams }, (_, i) => i).filter(i => !cgs[i])
            if (missing.length === 0) return null
            return (
              <div className="validation-notice">
                {t('needCluegiver')}:&nbsp;
                {missing.map(i => (
                  <span key={i} className="pill" style={{ borderColor: TEAM_COLORS[i], color: TEAM_COLORS[i], fontSize: 11 }}>
                    {(isHost ? teamNames[i] : roomState.teams[i]) || `${t('teamLabel')} ${i + 1}`}
                  </span>
                ))}
              </div>
            )
          })()}

          {/* Host config */}
          {isHost && (
            <div className="host-config">
              <div className="field">
                <label className="lbl">{t('configTeams')}</label>
                <div className="teams">
                  {Array.from({ length: numTeams }, (_, i) => (
                    <div key={i} className="teamchip">
                      <span className="dot" style={{ background: TEAM_COLORS[i] }} />
                      <input
                        type="text"
                        value={teamNames[i] || ''}
                        placeholder={`${T[lang].teamLabel} ${i + 1}`}
                        onChange={e => {
                          const n = [...teamNames]; n[i] = e.target.value
                          setTeamNames(n)
                        }}
                        onBlur={() => updateLobbyConfig(teamNames, numTeams, roundsPerTeam)}
                        maxLength={24}
                      />
                    </div>
                  ))}
                </div>
                <div className="btn-row" style={{ marginTop: 8 }}>
                  <button className="btn ghost small" disabled={numTeams <= 2}
                    onClick={() => { const n = numTeams - 1; setNumTeams(n); updateLobbyConfig(teamNames, n, roundsPerTeam) }}>
                    {t('removeTeam')}
                  </button>
                  <button className="btn ghost small" disabled={numTeams >= 4}
                    onClick={() => { const n = numTeams + 1; setNumTeams(n); if (!teamNames[n - 1]) { const t2 = [...teamNames]; t2[n - 1] = ''; setTeamNames(t2) }; updateLobbyConfig(teamNames, n, roundsPerTeam) }}>
                    {t('addTeam')}
                  </button>
                </div>
              </div>
              <div className="field">
                <label className="lbl">{t('configRounds')}</label>
                <div className="round-pick">
                  {[2, 3, 4, 5].map(n => (
                    <button key={n} className={`btn${roundsPerTeam === n ? '' : ' ghost'}`}
                      onClick={() => { setRoundsPerTeam(n); updateLobbyConfig(teamNames, numTeams, n) }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label className="lbl">{t('configTimer')}</label>
                <div className="round-pick">
                  {([0, 30, 60, 120, 300] as const).map(s => (
                    <button key={s} className={`btn${timerSecs === s ? '' : ' ghost'}`}
                      onClick={() => { setTimerSecs(s); updateLobbyConfig(teamNames, numTeams, roundsPerTeam, s) }}>
                      {s === 0 ? t('timerOff') : s < 60 ? `${s}s` : `${s / 60}m`}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn" style={{ marginTop: 8 }} onClick={startGame}>{t('startBtn')}</button>
            </div>
          )}

          {!isHost && (
            <p className="hint" style={{ marginTop: 16, textAlign: 'center' }}>{t('waitForHost')}</p>
          )}
        </div>
        <div className="footer-note">Consensus Radar · {new Date().getFullYear()}</div>
        {showLb && <LeaderboardModal rows={lbRows} loading={lbLoading} t={t} onClose={() => setShowLb(false)} />}
        {toast && <div className="toast">{toast}</div>}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCREEN: Game (all phases)
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'game' && roomState) {
    const rs     = roomState
    const round  = rs.round
    const isCluegiver = round?.cluegiver === playerId
    const isMyTeamTurn = round ? rs.players.find(p => p.id === playerId)?.team === round.teamIdx : false
    const teamColor = round ? TEAM_COLORS[round.teamIdx] : 'var(--sweep)'
    const teamName  = round ? (rs.teams[round.teamIdx] || `${t('teamLabel')} ${round.teamIdx + 1}`) : ''

    // ── Phase: cluegiver ───────────────────────────────────────────────────
    if (rs.phase === 'cluegiver' && round) {
      if (isCluegiver) {
        // This player IS the cluegiver
        return (
          <div className="wrap screen-enter">
            <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} playerName={playerName} />
            <div className="card">
              <ProgressBar />
              <div className="stage-meta">
                <span className="pill" style={{ borderColor: teamColor, color: teamColor }}>
                  <span className="swatch" style={{ background: teamColor }} />{teamName}
                </span>
                <span className="pill secret-pill">{t('secretPill')}</span>
              </div>
              <div className="eyebrow" style={{ color: 'var(--warm)' }}>{t('cluegiverYou')}</div>

              <Poles scale={round.scale} />
              <div className="scalewrap">
                <div className="gauge">
                  <div className="gauge-fill" />
                  <Ticks />
                  <TargetBand target={round.target ?? 50} />
                </div>
              </div>
              <div className="target-readout center">
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t('secretTarget')}</div>
                <div className="big score-bounce">{round.target ?? '—'}</div>
              </div>
              <div className="field" style={{ marginTop: 20 }}>
                <label className="lbl">{t('clueLabel')}</label>
                <input type="text" value={clueInput}
                  onChange={e => setClueInput(e.target.value)}
                  placeholder={t('cluePlaceholder')}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitClue() }}
                  maxLength={100} autoFocus />
              </div>
              <button className="btn warn" onClick={submitClue} disabled={!clueInput.trim()}>{t('clueBtn')}</button>
              <p className="hint" style={{ marginTop: 10 }}>{t('clueHint')}</p>
            </div>
            {toast && <div className="toast">{toast}</div>}
          </div>
        )
      }
      // Others wait
      return (
        <div className="wrap screen-enter">
          <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} playerName={playerName} />
          <div className="card center">
            <ProgressBar />
            <ScoreBar activeIdx={round.teamIdx} />
            <div style={{ marginTop: 24, marginBottom: 8 }}>
              <div className="eyebrow">{t('cluegiverPhase')}</div>
              <div className="team-turn-badge" style={{ background: teamColor }}>
                {teamName}
              </div>
              <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
                {rs.players.find(p => p.id === round.cluegiver)?.name ?? '—'}
                {lang === 'uk' ? ' думає над підказкою…' : ' is thinking of a clue…'}
              </p>
              <div className="waiting-dots"><span /><span /><span /></div>
            </div>
          </div>
          {toast && <div className="toast">{toast}</div>}
        </div>
      )
    }

    // ── Phase: guessing ────────────────────────────────────────────────────
    if (rs.phase === 'guessing' && round) {
      const myLocked    = round.locked[playerId]
      const teamPlayers = rs.players.filter(p => p.team === round.teamIdx && p.id !== round.cluegiver)
      const lockedCount = teamPlayers.filter(p => round.locked[p.id]).length
      const allLocked   = teamPlayers.length > 0 && lockedCount === teamPlayers.length

      // Non-team players just watch
      if (!isMyTeamTurn) {
        return (
          <div className="wrap screen-enter">
            <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} playerName={playerName} />
            <div className="card center">
              <ProgressBar />
              <ScoreBar activeIdx={round.teamIdx} />
              <div style={{ marginTop: 20 }}>
                <div className="eyebrow">{t('guessingPhase')}</div>
                <div className="team-turn-badge" style={{ background: teamColor }}>{teamName}</div>
                <div className={`cluebox solid`} style={{ marginTop: 16 }}>
                  {round.clue ? `"${round.clue}"` : '…'}
                </div>
                <Poles scale={round.scale} />
                <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
                  {lockedCount}/{teamPlayers.length} {t('waitGuesses')}
                </p>
                {isHost && (
                  <button
                    className={`btn${allLocked ? '' : ' ghost'}`}
                    style={{ marginTop: 20 }}
                    onClick={showResult}
                  >
                    {allLocked
                      ? (lang === 'uk' ? 'Показати результат' : 'Show result')
                      : (lang === 'uk' ? 'Показати результат зараз' : 'Show result now')}
                  </button>
                )}
              </div>
            </div>
            {toast && <div className="toast">{toast}</div>}
          </div>
        )
      }

      // Cluegiver of THIS team watches too
      if (isCluegiver) {
        return (
          <div className="wrap screen-enter">
            <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} playerName={playerName} />
            <div className="card center">
              <ProgressBar />
              <div className="stage-meta">
                <span className="pill" style={{ borderColor: teamColor, color: teamColor }}>
                  <span className="swatch" style={{ background: teamColor }} />{teamName}
                </span>
                <span className="pill secret-pill">{t('secretPill')}</span>
                {rs.timerSecs > 0 && <TimerRing secs={timeLeft} total={rs.timerSecs} />}
              </div>
              <div className={`cluebox solid`} style={{ marginTop: 12 }}>
                {round.clue ? `"${round.clue}"` : ''}
              </div>
              <Poles scale={round.scale} />
              <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
                {lockedCount}/{teamPlayers.length} {t('waitGuesses')}
              </p>
              {isHost && allLocked && (
                <button className="btn" style={{ marginTop: 20 }} onClick={showResult}>
                  {lang === 'uk' ? 'Показати результат' : 'Show result'}
                </button>
              )}
              {isHost && !allLocked && (
                <button className="btn ghost" style={{ marginTop: 20 }} onClick={showResult}>
                  {lang === 'uk' ? 'Показати результат зараз' : 'Show result now'}
                </button>
              )}
            </div>
            {toast && <div className="toast">{toast}</div>}
          </div>
        )
      }

      // Active guesser
      return (
        <div className="wrap screen-enter">
          <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} playerName={playerName} />
          <div className="card">
            <ProgressBar />
            <div className="stage-meta">
              <span className="pill" style={{ borderColor: teamColor, color: teamColor }}>
                <span className="swatch" style={{ background: teamColor }} />{teamName}
              </span>
              <span className="pill green">{lang === 'uk' ? 'твоя відповідь' : 'your turn'}</span>
              {rs.timerSecs > 0 && <TimerRing secs={timeLeft} total={rs.timerSecs} />}
            </div>
            {timeLeft === 0 && !myLocked && (
              <div className="timer-expired">{t('timerExpired')}</div>
            )}
            <div className="cluebox solid">
              {round.clue ? `"${round.clue}"` : (lang === 'uk' ? '(підказка усна)' : '(clue spoken)')}
            </div>
            <Poles scale={round.scale} />
            {myLocked ? (
              <div className="locked-state">
                <div className="locked-icon">✓</div>
                <p>{t('lockedWaiting')}</p>
                <p className="muted" style={{ fontSize: 13 }}>{lockedCount}/{teamPlayers.length} {t('waitGuesses')}</p>
              </div>
            ) : (
              <div className="scalewrap">
                <div
                  className="gauge interactive"
                  ref={gaugeRef}
                  onMouseDown={startDrag}
                  onTouchStart={startDrag}
                  role="slider"
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={guess}
                  aria-label={lang === 'uk' ? 'Маркер позиції' : 'Position marker'}
                >
                  <div className="gauge-fill" />
                  <Ticks />
                  <div className="marker marker-drop" style={{ left: `${guess}%` }}>
                    <div className="knob" />
                  </div>
                </div>
                <div className="readout">
                  <span>{t('dragHint')}</span>
                  <span><b>{guess}</b> / 100</span>
                </div>
                <button className="btn" style={{ marginTop: 12 }} onClick={lockGuess}>{t('lockBtn')}</button>
              </div>
            )}
          </div>
          {toast && <div className="toast">{toast}</div>}
        </div>
      )
    }

    // ── Phase: result ──────────────────────────────────────────────────────
    if (rs.phase === 'result' && round) {
      const avgGuess  = round.guesses.__avg ?? 50
      const target    = round.target ?? 50
      const res       = scoreFor(avgGuess, target)
      const off       = Math.abs(avgGuess - target)
      const isSupermark = res.key === 'supermark'
      const verdictColor = isSupermark ? '#ffd166' : res.pts === 5 ? 'var(--sweep)' : res.pts === 3 ? 'var(--warm)' : res.pts < 0 ? 'var(--hot)' : 'var(--ink-dim)'
      const deltaBg    = isSupermark ? 'linear-gradient(135deg,#ffd166,#ff9a3c)' : res.pts > 0 ? (res.pts === 5 ? 'var(--sweep)' : 'var(--warm)') : res.pts < 0 ? 'var(--hot)' : 'var(--panel-3)'
      const deltaColor = isSupermark ? '#1a0a00' : res.pts > 0 ? '#001a0f' : res.pts < 0 ? '#fff' : 'var(--ink)'
      const total      = rs.roundsPerTeam * rs.teams.length
      const isLast     = rs.turnPtr >= total - 1

      return (
        <div className="wrap screen-enter">
          <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} playerName={playerName} />
          <div className="card">
            <ProgressBar />
            <div className="stage-meta">
              <span className="pill" style={{ borderColor: teamColor, color: teamColor }}>
                <span className="swatch" style={{ background: teamColor }} />{teamName}
              </span>
              <span className={`delta-pill score-bounce${isSupermark ? ' supermark-pill' : ''}`} style={{ background: deltaBg, color: deltaColor }}>
                {isSupermark ? '★ ' : ''}{res.pts > 0 ? '+' : ''}{res.pts} {t('points')}
              </span>
            </div>

            <Poles scale={round.scale} />
            <div className="scalewrap">
              <div className="gauge">
                <div className="gauge-fill" />
                <Ticks />
                <TargetBand target={target} />
                <div className="marker team-marker" style={{ left: `${avgGuess}%`, '--cold': teamColor } as React.CSSProperties}>
                  <div className="knob" />
                </div>
              </div>
            </div>

            <div className="cluebox solid" style={{ fontSize: 15 }}>
              {round.clue ? `${t('clueWas')} "${round.clue}"` : (lang === 'uk' ? '(підказка усна)' : '(spoken clue)')}
            </div>

            <div className="verdict-wrap">
              <div className={`verdict-label score-bounce${isSupermark ? ' supermark-verdict' : ''}`} style={{ color: verdictColor }}>
                {isSupermark && <span className="supermark-star" aria-hidden>★</span>}
                {t(res.key)}
                {isSupermark && <span className="supermark-star" aria-hidden>★</span>}
              </div>
              <div className="verdict-detail">
                {t('targetWas')} <b>{target}</b> · {t('guessWas')} <b>{avgGuess}</b> · {off} {t('off')}
              </div>
            </div>

            {/* Per-player guesses */}
            <div className="guess-breakdown">
              {rs.players.filter(p => p.team === round.teamIdx && p.id !== round.cluegiver).map(p => (
                <div key={p.id} className="guess-row">
                  <span>{p.name}{p.id === playerId ? ` ${t('you')}` : ''}</span>
                  <span style={{ fontWeight: 700 }}>{round.guesses[p.id] ?? '—'}</span>
                </div>
              ))}
            </div>

            <ScoreBar activeIdx={round.teamIdx} />

            {isHost && (
              <button className="btn" style={{ marginTop: 16 }} onClick={nextTurn}>
                {isLast ? t('finalTitle') : t('nextTurnBtn')}
              </button>
            )}
            {!isHost && (
              <p className="hint" style={{ marginTop: 16, textAlign: 'center' }}>{t('waitForHost')}</p>
            )}
          </div>
          {toast && <div className="toast">{toast}</div>}
        </div>
      )
    }

    // ── Phase: final ───────────────────────────────────────────────────────
    if (rs.phase === 'final') {
      const sorted  = rs.teams.map((name, i) => ({ name: name || `${t('teamLabel')} ${i + 1}`, score: rs.scores[i] ?? 0, color: TEAM_COLORS[i] }))
        .sort((a, b) => b.score - a.score)
      const top     = sorted[0].score
      const winners = sorted.filter(tm => tm.score === top)

      return (
        <div className="wrap screen-enter">
          <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} playerName={playerName} />
          <div className="card center">
            <div className="eyebrow">{t('finalTitle')}</div>
            <h2>{t('finalScores')}</h2>
            <div className="final-scores">
              {sorted.map((team, i) => (
                <div key={i} className={`table-row${i === 0 ? ' gold-row' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="rank">{i + 1}.</span>
                    <span className="swatch" style={{ background: team.color, width: 12, height: 12, borderRadius: '50%' }} />
                    <span style={{ fontWeight: 600 }}>{team.name}</span>
                  </div>
                  <b style={{ fontSize: 22 }}>{team.score}</b>
                </div>
              ))}
            </div>
            <div className={`big winner score-bounce${winners.length === 1 ? ' winner-glow' : ''}`} style={{ margin: '16px 0 6px' }}>
              {winners.length > 1 ? t('tie') : winners[0].name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 24 }}>
              {rs.roundsPerTeam * rs.teams.length} {t('rounds')} · {top} {t('points')}
            </div>
            <div className="btn-row">
              {isHost && <button className="btn ghost" onClick={resetGame}>{t('againBtn')}</button>}
              <button
                className={`btn${scoreSubmitted ? ' ghost' : ''}`}
                onClick={scoreSubmitted ? undefined : submitScore}
                disabled={submitting || scoreSubmitted}
              >
                {submitting ? <span className="spinner" /> : scoreSubmitted ? `✓ ${t('submitDone')}` : t('submitScore')}
              </button>
            </div>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={openLeaderboard}>{t('leaderboardBtn')}</button>
          </div>
          <div className="footer-note">Consensus Radar · {new Date().getFullYear()}</div>
          {showLb && <LeaderboardModal rows={lbRows} loading={lbLoading} t={t} onClose={() => setShowLb(false)} />}
          {toast && <div className="toast">{toast}</div>}
        </div>
      )
    }

    return null
  }

  return null
}

// ─── Topbar ────────────────────────────────────────────────────────────────
function Topbar({ lang, toggleLang, t, onLeaderboard, playerName }: {
  lang: Lang; toggleLang: () => void; t: (k: string) => string
  onLeaderboard: () => void; playerName?: string
}) {
  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="Back to Analytics Games">
        <div className="logo" aria-hidden />
        <div>
          <h1>Consensus Radar</h1>
          <div className="brand-sub">{t('tagline')}</div>
        </div>
      </Link>
      <div className="topbar-actions">
        {playerName && <span className="pill player-pill" style={{ fontSize: 11 }}>{playerName}</span>}
        <button className="icon-btn" onClick={onLeaderboard} aria-label="Leaderboard">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <rect x="0" y="6" width="4" height="8" rx="1" fill="currentColor" opacity=".5" />
            <rect x="5" y="3" width="4" height="11" rx="1" fill="currentColor" opacity=".75" />
            <rect x="10" y="0" width="4" height="14" rx="1" fill="currentColor" />
          </svg>
          {t('leaderboardBtn')}
        </button>
        <div className="lang-toggle" role="group" aria-label="Language">
          <button className={lang === 'uk' ? 'on' : ''} onClick={() => lang !== 'uk' && toggleLang()}>УКР</button>
          <button className={lang === 'en' ? 'on' : ''} onClick={() => lang !== 'en' && toggleLang()}>EN</button>
        </div>
      </div>
    </header>
  )
}

// ─── LeaderboardModal ──────────────────────────────────────────────────────
function LeaderboardModal({ rows, loading, t, onClose }: {
  rows: LeaderboardRow[]; loading: boolean; t: (k: string) => string; onClose: () => void
}) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal aria-label={t('lbTitle')}>
        <div className="modal-header">
          <h2 style={{ fontSize: 20 }}>{t('lbTitle')}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}><span className="spinner" /></div>
        ) : rows.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: '28px 0', fontSize: 14 }}>{t('lbEmpty')}</p>
        ) : rows.map((row, i) => {
          const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''
          return (
            <div key={row.id} className="lb-row">
              <span className={`lb-rank${rankClass ? ` ${rankClass}` : ''}`}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div className="lb-name">{row.name}</div>
                <div className="lb-meta">{row.rounds} {t('rounds')}</div>
              </div>
              <div className="lb-score">{row.score}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
