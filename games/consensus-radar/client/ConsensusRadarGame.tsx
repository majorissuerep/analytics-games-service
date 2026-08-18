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
  betIsCorrect,
  GOAL_OPTIONS,
  MAX_TEAMS,
  MIN_TEAMS,
  TEAM_COLORS,
  type BetSide,
  type Category,
  type ConsensusAction,
  type ConsensusGameView,
  type Lang,
  type Scale,
  toConsensusRoomView,
} from '../model'

// ─── Strings ───────────────────────────────────────────────────────────────
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
    lobbyTitle:      'Лобі',
    shareHint:       'Продиктуй код або кинь посилання — всі заходять зі своїх телефонів.',
    playersIn:       'Гравці у кімнаті',
    teamLabel:       'Команда',
    pickTeam:        'Твоя команда',
    hostLabel:       'хост',
    startBtn:        'Почати гру',
    needTwoTeams:    'Потрібно щонайменше по одному гравцю у двох командах.',
    soloTeamWarn:    'Команди з одним гравцем не зможуть відгадувати: той, хто дає clue, не ставить маркер.',
    waitForHost:     'Чекаємо, поки хост почне гру…',
    configTeams:     'Команди',
    addTeam:         '+ Команда',
    removeTeam:      '− Команда',
    catLabel:        'Категорії шкал',
    catGeneral:      'Загальні та смішні',
    catAnalytics:    'Для аналітиків',
    goalLabel:       'Грати до (очок)',
    endless:         'Без ліміту',
    betsLabel:       'Ставки для інших команд (+1 за вгаданий бік)',
    betsOn:          'Увімк',
    betsOff:         'Вимк',
    round:           'Раунд',
    firstTo:         'до {goal} очок',
    endlessMode:     'без ліміту',
    cluePhase:       'Ведучий думає…',
    cluegiverYou:    'Ти даєш clue цього раунду!',
    secretTarget:    'Таємна позиція:',
    secretPill:      'тільки для тебе',
    clueLabel:       'Твій clue',
    cluePlaceholder: 'одна асоціація, не число',
    clueHint:        "Дай clue, що наведе команду на цю точку. Цифри заборонені!",
    clueBtn:         'Надіслати clue',
    noNumbers:       'Без цифр у clue — у цьому вся гра!',
    thinksClue:      'придумує clue…',
    guessPhase:      'Команда відгадує',
    clueWas:         'Clue:',
    guessTitle:      'Де ця точка?',
    guessSub:        'Постав свій маркер. Позиція команди — середнє всіх маркерів.',
    dragHint:        'Перетягни маркер',
    lockBtn:         'Зафіксувати',
    changeBtn:       'Змінити маркер',
    lockedAt:        'Маркер зафіксовано: {value}',
    lockedWaiting:   'Відповідь зафіксована. Чекаємо на інших…',
    lockedCount:     'Зафіксували: {done} з {total}',
    betTitle:        'Твоя ставка',
    betSub:          'З якого боку від таємної точки стане їхній маркер?',
    betLeft:         '◀ Лівіше',
    betRight:        'Правіше ▶',
    betPlaced:       'Ставка зроблена: {side}',
    sideLeft:        'лівіше',
    sideRight:       'правіше',
    betCount:        'Поставили: {done} з {total}',
    revealNow:       'Відкрити зараз',
    noGuessers:      'У цій команді нікому відгадувати — хост або ведучий може відкрити раунд і йти далі.',
    revealTitle:     'Розкриття',
    targetWas:       'Точка:',
    markerWas:       'маркер',
    off:             'відхилення',
    bullseye:        'В яблучко! Ідеальна калібровка 🎯',
    close:           'Близько! Гарне відчуття одне одного.',
    far:             'Мимо — нуль за цей раунд.',
    opposite:        'Зовсім протилежний бік. −2.',
    individualGuesses: 'Хто куди ставив',
    betResults:      'Ставки',
    betWon:          'вгадав бік',
    betLost:         'мимо',
    nextBtn:         'Наступний раунд',
    waitNext:        'Чекаємо наступний раунд…',
    endGame:         'Завершити гру',
    finalTitle:      'Гру завершено',
    finalScores:     'Фінальний рахунок',
    winnerPrefix:    'Перемогла команда',
    tie:             'Нічия!',
    playAgain:       'Зіграти ще',
    leaderboardBtn:  'Рекорди',
    submitScore:     'Записати рекорд',
    submitDone:      'Рекорд збережено!',
    roomCode:        'Код кімнати',
    copyCode:        'Копіювати',
    copied:          'Скопійовано!',
    lbTitle:         'Таблиця рекордів',
    lbEmpty:         'Ще немає записів — станьте першими!',
    unassigned:      'Без команди',
    you:             '(ти)',
    rounds:          'раундів',
    points:          'очок',
    watchingTeam:    'відгадує',
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
    shareHint:       'Read out the code or share the link — everyone joins from their own phone.',
    playersIn:       'Players in room',
    teamLabel:       'Team',
    pickTeam:        'Your team',
    hostLabel:       'host',
    startBtn:        'Start game',
    needTwoTeams:    'At least two teams need one player each.',
    soloTeamWarn:    "Teams with a single player can't guess: the clue-giver doesn't place a marker.",
    waitForHost:     'Waiting for the host to start the game…',
    configTeams:     'Teams',
    addTeam:         '+ Team',
    removeTeam:      '− Team',
    catLabel:        'Scale categories',
    catGeneral:      'General & fun',
    catAnalytics:    'Analytics team',
    goalLabel:       'Play to (points)',
    endless:         'Endless',
    betsLabel:       'Side bets for other teams (+1 for the right side)',
    betsOn:          'On',
    betsOff:         'Off',
    round:           'Round',
    firstTo:         'first to {goal}',
    endlessMode:     'endless',
    cluePhase:       'Clue-giver is thinking…',
    cluegiverYou:    "You're the clue-giver this round!",
    secretTarget:    'Secret position:',
    secretPill:      'only you see this',
    clueLabel:       'Your clue',
    cluePlaceholder: 'one word or phrase — no numbers',
    clueHint:        'Give a clue that points your team to this spot. No digits allowed!',
    clueBtn:         'Send clue',
    noNumbers:       "No numbers in the clue — that's the whole game!",
    thinksClue:      'is thinking of a clue…',
    guessPhase:      'Team is guessing',
    clueWas:         'Clue:',
    guessTitle:      "Where's the spot?",
    guessSub:        "Place your own marker. The team's position is the average of all markers.",
    dragHint:        'Drag the marker',
    lockBtn:         'Lock in',
    changeBtn:       'Change my marker',
    lockedAt:        'Marker locked at {value}',
    lockedWaiting:   'Answer locked. Waiting for others…',
    lockedCount:     'Locked in: {done} of {total}',
    betTitle:        'Your side bet',
    betSub:          'Which side of the secret spot will their marker land on?',
    betLeft:         '◀ To the left',
    betRight:        'To the right ▶',
    betPlaced:       'Bet placed: {side}',
    sideLeft:        'left',
    sideRight:       'right',
    betCount:        'Bets in: {done} of {total}',
    revealNow:       'Reveal now',
    noGuessers:      'Nobody on this team can guess — the host or clue-giver can reveal and move on.',
    revealTitle:     'The reveal',
    targetWas:       'Spot:',
    markerWas:       'marker',
    off:             'off',
    bullseye:        'Bullseye! Perfect calibration 🎯',
    close:           'Close! Nicely tuned in.',
    far:             'Missed it — zero this round.',
    opposite:        'Totally opposite side. −2.',
    individualGuesses: 'Who placed what',
    betResults:      'Side bets',
    betWon:          'called it',
    betLost:         'missed',
    nextBtn:         'Next round',
    waitNext:        'Waiting for the next round…',
    endGame:         'End the game',
    finalTitle:      'Game over',
    finalScores:     'Final scores',
    winnerPrefix:    'Team',
    tie:             "It's a tie!",
    playAgain:       'Play again',
    leaderboardBtn:  'Leaderboard',
    submitScore:     'Submit score',
    submitDone:      'Score saved!',
    roomCode:        'Room code',
    copyCode:        'Copy',
    copied:          'Copied!',
    lbTitle:         'Leaderboard',
    lbEmpty:         'No scores yet — be the first!',
    unassigned:      'No team',
    you:             '(you)',
    rounds:          'rounds',
    points:          'pts',
    watchingTeam:    'is guessing',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(x: number) { return Math.max(0, Math.min(100, x)) }

function fmt(template: string, vars: Record<string, string | number>): string {
  let out = template
  for (const [key, value] of Object.entries(vars)) out = out.replaceAll(`{${key}}`, String(value))
  return out
}

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
  const [editing, setEditing]      = useState(false)
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
  const [teamNames, setTeamNames]  = useState<string[]>(['Team 1', 'Team 2'])
  const [numTeams, setNumTeams]    = useState(MIN_TEAMS)
  const [categories, setCategories] = useState<Category[]>(['general', 'analytics'])
  const [goal, setGoal]            = useState<number>(20)
  const [betsEnabled, setBetsEnabled] = useState(true)

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
    if (roomState?.phase === 'finished') emitGameSessionCompleted('completed')
  }, [roomState?.phase])

  // Sync host config from room state while in lobby
  useEffect(() => {
    if (!roomState || roomState.phase !== 'lobby') return
    setTeamNames(roomState.teams.map((team) => team.name))
    setNumTeams(roomState.teams.length)
    setCategories(roomState.categories)
    setGoal(roomState.goal)
    setBetsEnabled(roomState.betsEnabled)
  }, [roomClient.room?.revision, roomState?.phase])

  // Reset the local marker editor whenever a fresh round begins
  useEffect(() => {
    setEditing(false)
    setGuess(50)
    setClueInput('')
  }, [roomState?.round?.roundNo])

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

  // ─── Flow: create / join room ──────────────────────────────────────────────
  async function createRoom() {
    try {
      await roomClient.create({ id: playerId, name: playerName })
      setScoreSubmitted(false)
      setScreen('lobby')
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error))
    }
  }

  async function joinRoom() {
    const code = joinInput.trim().toUpperCase()
    if (code.length !== 6) { setJoinError(lang === 'uk' ? 'Код має бути 6 символів' : 'Code must be 6 characters'); return }
    setJoinError('')
    try {
      const joined = await roomClient.join(code, { id: playerId, name: playerName })
      setScoreSubmitted(false)
      setScreen(joined.game.phase === 'lobby' ? 'lobby' : 'game')
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : (lang === 'uk' ? 'Помилка з\'єднання' : 'Connection error'))
    }
  }

  // ─── Lobby actions ─────────────────────────────────────────────────────────
  async function assignTeam(teamIdx: number) {
    await runAction({ type: 'consensus.team.assign', teamIndex: teamIdx })
  }

  async function saveConfig(patch: {
    teamNames?: string[]
    numTeams?: number
    categories?: string[]
    goal?: number
    betsEnabled?: boolean
  }) {
    if (!roomState || !isHost) return
    await runAction({ type: 'consensus.lobby.configure', ...patch })
  }

  function pushTeamNames(next: string[], nextNumTeams = numTeams) {
    setTeamNames(next)
    void saveConfig({ teamNames: next.slice(0, nextNumTeams), numTeams: nextNumTeams })
  }

  function toggleCategory(category: Category) {
    const next = categories.includes(category)
      ? categories.filter((item) => item !== category)
      : [...categories, category]
    if (next.length === 0) return
    setCategories(next)
    void saveConfig({ categories: next })
  }

  function pickGoal(next: number) {
    setGoal(next)
    void saveConfig({ goal: next })
  }

  function toggleBets() {
    const next = !betsEnabled
    setBetsEnabled(next)
    void saveConfig({ betsEnabled: next })
  }

  async function startGame() {
    if (!roomState || !isHost) return
    const staffed = new Set(Object.values(roomState.playerTeams).filter((team) => team >= 0))
    if (staffed.size < 2) {
      showToast(t('needTwoTeams'))
      return
    }
    const started = await runAction({
      type: 'consensus.game.start',
      teamNames: teamNames.slice(0, numTeams),
      numTeams,
      categories,
      goal,
      betsEnabled,
    })
    if (started) setScreen('game')
  }

  // ─── Round actions ─────────────────────────────────────────────────────────
  async function submitClue() {
    const clue = clueInput.trim()
    if (!roomState?.round || !clue) return
    if (/\d/.test(clue)) { showToast(t('noNumbers')); return }
    const submitted = await runAction({ type: 'consensus.clue.submit', clue })
    if (submitted) setClueInput('')
  }

  async function submitGuess() {
    const submitted = await runAction({ type: 'consensus.guess.submit', value: guess })
    if (submitted) setEditing(false)
  }

  async function submitBet(side: BetSide) {
    await runAction({ type: 'consensus.bet.submit', side })
  }

  async function forceReveal() {
    await runAction({ type: 'consensus.round.reveal' })
  }

  async function nextRound() {
    await runAction({ type: 'consensus.round.next' })
  }

  async function endGame() {
    await runAction({ type: 'consensus.game.end' })
  }

  async function resetGame() {
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
        body: JSON.stringify({ roomCode, playerId }),
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
    const bull = 5, close = 12
    const l3 = pct(target - close), w3 = pct(Math.min(100, target + close) - Math.max(0, target - close))
    const l5 = pct(target - bull), w5 = pct(Math.min(100, target + bull) - Math.max(0, target - bull))
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

  function ScoreBar({ activeIdx }: { activeIdx?: number }) {
    if (!roomState) return null
    return (
      <div className="scorebar">
        {roomState.teams.map((team, i) => (
          <div key={i} className={`score-card${i === activeIdx ? ' active' : ''}`}>
            <div className="s-name">
              <span className="swatch" style={{ background: TEAM_COLORS[i] }} />
              {team.name}
            </div>
            <div className="s-num">{team.score}</div>
          </div>
        ))}
      </div>
    )
  }

  function RoundMeta() {
    if (!roomState || roomState.phase === 'lobby') return null
    return (
      <div className="progress-wrap">
        <div className="progress-label">
          <span>{t('round')} {roomState.roundNo}</span>
          <span className="muted" style={{ fontSize: 12 }}>
            {roomState.goal > 0 ? fmt(t('firstTo'), { goal: roomState.goal }) : t('endlessMode')}
          </span>
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
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'lobby' && roomState) {
    const myPlayer = roomState.players.find(p => p.id === playerId)
    const soloTeams = roomState.teams
      .map((_, i) => i)
      .filter(i => roomState.players.filter(p => p.team === i).length === 1)

    return (
      <div className="wrap screen-enter">
        <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} playerName={playerName} />
        <div className="card">
          <div className="eyebrow">{t('lobbyTitle')}</div>
          <RoomCodePill />
          <p className="hint" style={{ marginTop: 10 }}>{t('shareHint')}</p>

          {/* Players list */}
          <div className="field" style={{ marginTop: 14 }}>
            <label className="lbl">{t('playersIn')} ({roomState.players.length})</label>
            <div className="player-list">
              {roomState.players.map(p => {
                const tm = p.team >= 0 && p.team < roomState.teams.length ? p.team : -1
                const isMe = p.id === playerId
                return (
                  <div key={p.id} className={`player-row${isMe ? ' me' : ''}`}>
                    <span className="player-name">
                      {p.name}
                      {isMe && <span className="you-tag">{t('you')}</span>}
                      {p.id === roomState.hostId && <span className="host-tag">{t('hostLabel')}</span>}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isMe && (
                        <div className="team-picker">
                          {roomState.teams.map((team, i) => (
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
                      {!isMe && tm >= 0 && (
                        <span className="pill" style={{ borderColor: TEAM_COLORS[tm], color: TEAM_COLORS[tm], fontSize: 11 }}>
                          {roomState.teams[tm].name}
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

          {soloTeams.length > 0 && (
            <div className="validation-notice">{t('soloTeamWarn')}</div>
          )}

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
                        value={teamNames[i] ?? ''}
                        placeholder={`${t('teamLabel')} ${i + 1}`}
                        onChange={e => {
                          const next = [...teamNames]; next[i] = e.target.value
                          setTeamNames(next)
                        }}
                        onBlur={() => pushTeamNames(teamNames)}
                        maxLength={24}
                      />
                    </div>
                  ))}
                </div>
                <div className="btn-row" style={{ marginTop: 8 }}>
                  <button className="btn ghost small" disabled={numTeams <= MIN_TEAMS}
                    onClick={() => { const n = numTeams - 1; setNumTeams(n); pushTeamNames(teamNames, n) }}>
                    {t('removeTeam')}
                  </button>
                  <button className="btn ghost small" disabled={numTeams >= MAX_TEAMS}
                    onClick={() => { const n = numTeams + 1; setNumTeams(n); pushTeamNames(teamNames, n) }}>
                    {t('addTeam')}
                  </button>
                </div>
              </div>

              <div className="field">
                <label className="lbl">{t('catLabel')}</label>
                <div className="round-pick">
                  <button className={`btn${categories.includes('general') ? '' : ' ghost'}`} onClick={() => toggleCategory('general')}>
                    {t('catGeneral')}
                  </button>
                  <button className={`btn${categories.includes('analytics') ? '' : ' ghost'}`} onClick={() => toggleCategory('analytics')}>
                    {t('catAnalytics')}
                  </button>
                </div>
              </div>

              <div className="field">
                <label className="lbl">{t('goalLabel')}</label>
                <div className="round-pick">
                  {GOAL_OPTIONS.map(option => (
                    <button key={option} className={`btn${goal === option ? '' : ' ghost'}`} onClick={() => pickGoal(option)}>
                      {option === 0 ? t('endless') : option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="lbl">{t('betsLabel')}</label>
                <div className="round-pick">
                  <button className={`btn${betsEnabled ? '' : ' ghost'}`} onClick={toggleBets}>
                    {betsEnabled ? t('betsOn') : t('betsOff')}
                  </button>
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
    const myPlayer = rs.players.find(p => p.id === playerId)
    const isCluegiver = round?.cluegiver === playerId
    const myTeam = myPlayer?.team ?? -1
    const isMyTeamTurn = round ? myTeam === round.teamIdx : false
    const teamColor = round ? TEAM_COLORS[round.teamIdx] : 'var(--sweep)'
    const teamName  = round ? rs.teams[round.teamIdx]?.name ?? '' : ''
    const canDrive  = isHost || isCluegiver // reveal / next-round privileges

    // ── Phase: clue ────────────────────────────────────────────────────────
    if (rs.phase === 'clue' && round) {
      if (isCluegiver) {
        return (
          <div className="wrap screen-enter">
            <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} playerName={playerName} />
            <div className="card">
              <RoundMeta />
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
                  maxLength={120} autoFocus />
              </div>
              <button className="btn warn" onClick={submitClue} disabled={!clueInput.trim()}>{t('clueBtn')}</button>
              <p className="hint" style={{ marginTop: 10 }}>{t('clueHint')}</p>
            </div>
            {toast && <div className="toast">{toast}</div>}
          </div>
        )
      }
      // Everyone else waits for the clue
      return (
        <div className="wrap screen-enter">
          <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} playerName={playerName} />
          <div className="card center">
            <RoundMeta />
            <ScoreBar activeIdx={round.teamIdx} />
            <div style={{ marginTop: 24, marginBottom: 8 }}>
              <div className="eyebrow">{t('cluePhase')}</div>
              <div className="team-turn-badge" style={{ background: teamColor }}>
                {teamName}
              </div>
              <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
                {rs.players.find(p => p.id === round.cluegiver)?.name ?? '—'} {t('thinksClue')}
              </p>
              <div className="waiting-dots"><span /><span /><span /></div>
            </div>
          </div>
          {toast && <div className="toast">{toast}</div>}
        </div>
      )
    }

    // ── Phase: guess ───────────────────────────────────────────────────────
    if (rs.phase === 'guess' && round) {
      const guessers   = rs.players.filter(p => p.team === round.teamIdx && p.id !== round.cluegiver)
      const bettors    = rs.players.filter(p => p.team >= 0 && p.team !== round.teamIdx)
      const bettedCount = bettors.filter(p => p.id in round.bets).length
      const myGuessIn  = round.guessed.includes(playerId)
      const myBetIn    = playerId in round.bets
      const canGuess   = isMyTeamTurn && !isCluegiver
      const canBet     = rs.betsEnabled && myTeam >= 0 && !isMyTeamTurn

      const guessCounter = (
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          {fmt(t('lockedCount'), { done: round.guessed.length, total: guessers.length })}
          {rs.betsEnabled && bettors.length > 0 && (
            <> · {fmt(t('betCount'), { done: bettedCount, total: bettors.length })}</>
          )}
        </p>
      )

      const revealButton = canDrive && (
        <button className="btn ghost" style={{ marginTop: 16 }} onClick={forceReveal}>
          {t('revealNow')}
        </button>
      )

      // Active-team guesser view
      if (canGuess) {
        const showEditor = editing || !myGuessIn
        return (
          <div className="wrap screen-enter">
            <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} playerName={playerName} />
            <div className="card">
              <RoundMeta />
              <div className="stage-meta">
                <span className="pill" style={{ borderColor: teamColor, color: teamColor }}>
                  <span className="swatch" style={{ background: teamColor }} />{teamName}
                </span>
                <span className="pill green">{t('guessTitle')}</span>
              </div>
              <div className="cluebox solid">
                {round.clue ? `"${round.clue}"` : '…'}
              </div>
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>{t('guessSub')}</p>
              <Poles scale={round.scale} />
              {showEditor ? (
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
                  <button className="btn" style={{ marginTop: 12 }} onClick={submitGuess}>{t('lockBtn')}</button>
                </div>
              ) : (
                <div className="locked-state">
                  <div className="locked-icon">✓</div>
                  <p>{fmt(t('lockedAt'), { value: round.guesses[playerId] ?? guess })}</p>
                  <p className="muted" style={{ fontSize: 13 }}>{t('lockedWaiting')}</p>
                  <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => setEditing(true)}>
                    {t('changeBtn')}
                  </button>
                </div>
              )}
              {guessCounter}
            </div>
            {toast && <div className="toast">{toast}</div>}
          </div>
        )
      }

      // Everyone else: clue-giver, betting rivals, spectators
      return (
        <div className="wrap screen-enter">
          <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} playerName={playerName} />
          <div className="card center">
            <RoundMeta />
            <ScoreBar activeIdx={round.teamIdx} />
            <div style={{ marginTop: 20 }}>
              <div className="eyebrow">{t('guessPhase')}</div>
              <div className="team-turn-badge" style={{ background: teamColor }}>{teamName}</div>
              <div className="cluebox solid" style={{ marginTop: 16 }}>
                {round.clue ? `"${round.clue}"` : '…'}
              </div>
              <Poles scale={round.scale} />
              {guessCounter}

              {guessers.length === 0 && (
                <div className="validation-notice" style={{ marginTop: 12 }}>{t('noGuessers')}</div>
              )}

              {canBet && (
                <div className="bet-panel" style={{ marginTop: 16 }}>
                  <div className="eyebrow">{t('betTitle')}</div>
                  <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>{t('betSub')}</p>
                  {myBetIn ? (
                    <p className="pill green" style={{ display: 'inline-block' }}>
                      {round.bets[playerId]
                        ? fmt(t('betPlaced'), { side: t(round.bets[playerId] === 'left' ? 'sideLeft' : 'sideRight') })
                        : t('betPlaced').replace('{side}', '✓')}
                    </p>
                  ) : (
                    <div className="btn-row" style={{ justifyContent: 'center' }}>
                      <button className="btn ghost" onClick={() => submitBet('left')}>{t('betLeft')}</button>
                      <button className="btn ghost" onClick={() => submitBet('right')}>{t('betRight')}</button>
                    </div>
                  )}
                </div>
              )}

              {revealButton}
            </div>
          </div>
          {toast && <div className="toast">{toast}</div>}
        </div>
      )
    }

    // ── Phase: reveal ──────────────────────────────────────────────────────
    if ((rs.phase === 'reveal' || rs.phase === 'finished') && round) {
      const target   = round.target ?? 50
      const marker   = round.marker ?? 50
      const pts      = round.points ?? 0
      const distance = round.distance ?? Math.round(Math.abs(target - marker) * 10) / 10
      const verdictKey = pts >= 5 ? 'bullseye' : pts >= 3 ? 'close' : pts <= -2 ? 'opposite' : 'far'
      const verdictColor = pts >= 5 ? 'var(--sweep)' : pts >= 3 ? 'var(--warm)' : pts < 0 ? 'var(--hot)' : 'var(--ink-dim)'
      const deltaBg    = pts >= 5 ? 'var(--sweep)' : pts >= 3 ? 'var(--warm)' : pts < 0 ? 'var(--hot)' : 'var(--panel-3)'
      const deltaColor = pts > 0 ? '#001a0f' : pts < 0 ? '#fff' : 'var(--ink)'

      const guessRows = Object.entries(round.guesses)
        .map(([pid, value]) => ({
          pid,
          value,
          distance: Math.round(Math.abs(target - value) * 10) / 10,
          name: rs.players.find(p => p.id === pid)?.name ?? pid,
        }))
        .sort((a, b) => a.distance - b.distance)

      const betRows = Object.entries(round.bets)
        .filter(([, side]) => side !== null)
        .map(([pid, side]) => ({
          pid,
          side: side as BetSide,
          correct: betIsCorrect(target, marker, side as BetSide),
          name: rs.players.find(p => p.id === pid)?.name ?? pid,
          team: rs.players.find(p => p.id === pid)?.team ?? -1,
        }))

      const nextAdvance = canDrive && rs.phase === 'reveal' && (
        <button className="btn" style={{ marginTop: 16 }} onClick={nextRound}>{t('nextBtn')}</button>
      )

      const revealBody = (
        <div className="card">
          <RoundMeta />
          <div className="eyebrow">{t('revealTitle')}</div>
          <div className="stage-meta">
            <span className="pill" style={{ borderColor: teamColor, color: teamColor }}>
              <span className="swatch" style={{ background: teamColor }} />{teamName}
            </span>
            <span className="delta-pill score-bounce" style={{ background: deltaBg, color: deltaColor }}>
              {pts > 0 ? '+' : ''}{pts} {t('points')}
            </span>
          </div>

          <Poles scale={round.scale} />
          <div className="scalewrap">
            <div className="gauge">
              <div className="gauge-fill" />
              <Ticks />
              <TargetBand target={target} />
              <div className="marker team-marker" style={{ left: `${marker}%`, '--cold': teamColor } as React.CSSProperties}>
                <div className="knob" />
              </div>
            </div>
          </div>

          <div className="cluebox solid" style={{ fontSize: 15 }}>
            {round.clue ? `${t('clueWas')} "${round.clue}"` : ''}
          </div>

          <div className="verdict-wrap">
            <div className="verdict-label score-bounce" style={{ color: verdictColor }}>
              {t(verdictKey)}
            </div>
            <div className="verdict-detail">
              {t('targetWas')} <b>{target}</b> · {t('markerWas')} <b>{marker}</b> · {distance} {t('off')}
            </div>
          </div>

          {guessRows.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginTop: 14 }}>{t('individualGuesses')}</div>
              <div className="guess-breakdown">
                {guessRows.map(row => (
                  <div key={row.pid} className="guess-row">
                    <span>{row.name}{row.pid === playerId ? ` ${t('you')}` : ''}</span>
                    <span style={{ fontWeight: 700 }}>{row.value} <span className="muted" style={{ fontWeight: 400 }}>({row.distance})</span></span>
                  </div>
                ))}
              </div>
            </>
          )}

          {betRows.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginTop: 14 }}>{t('betResults')}</div>
              <div className="guess-breakdown">
                {betRows.map(row => (
                  <div key={row.pid} className="guess-row">
                    <span>
                      <span className="swatch" style={{ background: TEAM_COLORS[row.team] ?? 'var(--line)' }} />
                      {row.name}{row.pid === playerId ? ` ${t('you')}` : ''}
                    </span>
                    <span style={{ fontWeight: 700, color: row.correct ? 'var(--sweep)' : 'var(--hot)' }}>
                      {t(row.side === 'left' ? 'sideLeft' : 'sideRight')} · {row.correct ? t('betWon') : t('betLost')}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <ScoreBar activeIdx={round.teamIdx} />
          {nextAdvance}
          {!canDrive && rs.phase === 'reveal' && (
            <p className="hint" style={{ marginTop: 16, textAlign: 'center' }}>{t('waitNext')}</p>
          )}
          {isHost && rs.phase === 'reveal' && (
            <button className="btn ghost small" style={{ marginTop: 10 }} onClick={endGame}>{t('endGame')}</button>
          )}
        </div>
      )

      if (rs.phase === 'reveal') {
        return (
          <div className="wrap screen-enter">
            <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} playerName={playerName} />
            {revealBody}
            {toast && <div className="toast">{toast}</div>}
          </div>
        )
      }
    }

    // ── Phase: finished ────────────────────────────────────────────────────
    if (rs.phase === 'finished') {
      const sorted  = rs.teams.map((team, i) => ({ ...team, color: TEAM_COLORS[i], idx: i }))
        .sort((a, b) => b.score - a.score)
      const top     = sorted[0]?.score ?? 0
      const winners = sorted.filter(team => team.score === top)

      return (
        <div className="wrap screen-enter">
          <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} playerName={playerName} />
          <div className="card center">
            <div className="eyebrow">{t('finalTitle')}</div>
            <h2>{t('finalScores')}</h2>
            <div className="final-scores">
              {sorted.map((team, i) => (
                <div key={team.idx} className={`table-row${i === 0 ? ' gold-row' : ''}`}>
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
              {winners.length > 1 ? t('tie') : `${t('winnerPrefix')} «${winners[0].name}»!`}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 24 }}>
              {rs.roundNo} {t('rounds')} · {top} {t('points')}
            </div>
            <div className="btn-row">
              {isHost && <button className="btn ghost" onClick={resetGame}>{t('playAgain')}</button>}
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

    // ── Playing but between rounds (clue/guess with no round yet) ──────────
    return (
      <div className="wrap screen-enter">
        <Topbar lang={lang} toggleLang={() => setLangState(l => l === 'uk' ? 'en' : 'uk')} t={t} onLeaderboard={openLeaderboard} playerName={playerName} />
        <div className="card center">
          <RoundMeta />
          <ScoreBar />
          <div className="waiting-dots" style={{ marginTop: 24 }}><span /><span /><span /></div>
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>
    )
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
