'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { emitGameSessionCompleted } from '@/lib/analytics/game-events'
import {
  chordMinefieldCell,
  createMinefield,
  revealMinefieldCell,
  toggleMinefieldFlag,
  type MinefieldBoard,
} from '../model'
import './minefield.css'

const DIFFICULTIES = {
  beginner: { label: 'Beginner', width: 9, height: 9, mines: 10 },
  intermediate: { label: 'Intermediate', width: 16, height: 16, mines: 40 },
  expert: { label: 'Expert', width: 30, height: 16, mines: 99 },
} as const

type Difficulty = keyof typeof DIFFICULTIES

function freshBoard(difficulty: Difficulty) {
  const config = DIFFICULTIES[difficulty]
  return createMinefield(config.width, config.height, config.mines)
}

function cellLabel(board: MinefieldBoard, index: number) {
  const cell = board.cells[index]
  const row = Math.floor(index / board.width) + 1
  const column = (index % board.width) + 1
  if (cell.flagged) return `Flagged cell, row ${row}, column ${column}`
  if (!cell.revealed) return `Covered cell, row ${row}, column ${column}`
  if (cell.mine) return `Mine, row ${row}, column ${column}`
  return `${cell.adjacent || 'Empty'}, row ${row}, column ${column}`
}

export function MinefieldGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const [board, setBoard] = useState(() => freshBoard('beginner'))
  const [elapsed, setElapsed] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [cellSize, setCellSize] = useState(30)
  const [focusedCell, setFocusedCell] = useState(0)
  const [flagMode, setFlagMode] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const generationEpoch = useRef(0)
  useEffect(() => () => workerRef.current?.terminate(), [])

  useEffect(() => {
    if (!board.armed || board.status !== 'playing') return
    const timer = window.setInterval(() => setElapsed((current) => Math.min(999, current + 1)), 1_000)
    return () => window.clearInterval(timer)
  }, [board.armed, board.status])

  useEffect(() => {
    if (board.status === 'won' || board.status === 'lost') {
      emitGameSessionCompleted(board.status)
    }
  }, [board.status])

  const reset = (nextDifficulty = difficulty) => {
    generationEpoch.current += 1
    workerRef.current?.terminate()
    workerRef.current = null
    setGenerating(false)
    setGenerationError('')
    setElapsed(0)
    setFocusedCell(0)
    setBoard(freshBoard(nextDifficulty))
  }

  const reveal = (index: number) => {
    if (board.status !== 'playing' || generating) return
    if (flagMode) { setBoard(current => toggleMinefieldFlag(current, index)); return }
    if (board.cells[index].flagged) return
    if (!board.armed) {
      const epoch = ++generationEpoch.current
      setGenerating(true)
      setGenerationError('')
      const worker = new Worker(new URL('./generator.worker.ts', import.meta.url))
      workerRef.current = worker
      const fail = (message: string) => {
        if (epoch !== generationEpoch.current) return
        worker.terminate()
        workerRef.current = null
        setGenerating(false)
        setGenerationError(message)
      }
      worker.onmessage = (event: MessageEvent<{ board?: MinefieldBoard; error?: string }>) => {
        if (epoch !== generationEpoch.current) return
        if (!event.data.board) { fail(event.data.error || 'Generation failed. Try again.'); return }
        const generated = event.data.board
        setBoard(current => revealMinefieldCell({ ...generated, cells: generated.cells.map((cell, i) => ({ ...cell, flagged: current.cells[i]?.flagged ?? false })) }, index))
        setGenerating(false)
        worker.terminate()
        workerRef.current = null
      }
      worker.onerror = () => fail('Board generation failed. Please try again.')
      worker.postMessage({ width: board.width, height: board.height, mines: board.mineCount, opening: index })
      return
    }
    setBoard(current => current.cells[index].revealed ? chordMinefieldCell(current, index) : revealMinefieldCell(current, index))
  }

  const flags = board.cells.filter((cell) => cell.flagged).length
  const progress = Math.round(100 * board.cells.filter(cell => cell.revealed && !cell.mine).length / (board.cells.length - board.mineCount))

  return (
    <main className="minefield-app">
      <header className="minefield-header">
        <Link href="/" aria-label="Back to desktop"><strong>Minefield</strong></Link>
        <label>
          Level
          <select
            aria-label="Level"
            value={difficulty}
            onChange={(event) => {
              const next = event.target.value as Difficulty
              setDifficulty(next)
              reset(next)
            }}
          >
            {Object.entries(DIFFICULTIES).map(([id, config]) => <option key={id} value={id}>{config.label}</option>)}
          </select>
        </label>
      </header>

      <div className="minefield-toolbar">
        <span>Deduction-only boards</span>
        <label>Cell size <select aria-label="Cell size" value={cellSize} onChange={event => setCellSize(Number(event.target.value))}>
          <option value={26}>Compact</option><option value={30}>Standard</option><option value={36}>Large</option><option value={44}>Extra large</option>
        </select></label>
        <button aria-pressed={flagMode} onClick={() => setFlagMode(value => !value)}>Flag mode</button>
      </div>
      <section className="minefield-machine" aria-label="Minefield game">
        <div className="minefield-scoreboard">
          <div><small>Mines left</small><output aria-label="Mines remaining">{String(Math.max(0, board.mineCount - flags)).padStart(3, '0')}</output></div>
          <button onClick={() => reset()} aria-label="New game">New game</button>
          <div><small>Seconds</small><output aria-label="Elapsed seconds">{String(elapsed).padStart(3, '0')}</output></div>
        </div>
        <div className="minefield-board-scroll" tabIndex={0} aria-label="Scrollable minefield">
        <div
          className="minefield-grid"
          aria-busy={generating}
          style={{ gridTemplateColumns: `repeat(${board.width}, var(--cell-size))`, '--cell-size': `${cellSize}px` } as CSSProperties}
          onContextMenu={(event) => event.preventDefault()}
        >
          {board.cells.map((cell, index) => (
            <button
              key={index}
              tabIndex={index === focusedCell ? 0 : -1}
              onFocus={() => setFocusedCell(index)}
              className={`minefield-cell${cell.revealed ? ' revealed' : ''}${cell.flagged ? ' flagged' : ''}`}
              data-adjacent={cell.revealed ? cell.adjacent : undefined}
              disabled={generating}
              onKeyDown={event => {
                if (event.key.toLowerCase() === 'f') { event.preventDefault(); setBoard(current => toggleMinefieldFlag(current, index)) }
                const offset = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: board.width, ArrowUp: -board.width } as Record<string, number>)[event.key]
                if (offset !== undefined) {
                  event.preventDefault()
                  const next = Math.max(0, Math.min(board.cells.length - 1, index + offset))
                  const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('.minefield-cell')
                  buttons?.[next]?.focus()
                }
              }}
              aria-label={cellLabel(board, index)}
              onClick={() => reveal(index)}
              onContextMenu={(event) => {
                event.preventDefault()
                setBoard((current) => toggleMinefieldFlag(current, index))
              }}
            >
              {cell.flagged ? '⚑' : cell.revealed ? cell.mine ? '✹' : cell.adjacent || '' : ''}
            </button>
          ))}
        </div>
        </div>
        <div className="minefield-progress"><span>{progress}% cleared</span><span>{board.width} × {board.height} · {board.mineCount} mines</span></div>
        <p className="minefield-status" role="status">
          {generating ? 'Preparing a verified board…' : generationError || (board.status === 'won' ? `Cleared in ${elapsed} seconds!` : board.status === 'lost' ? 'Mine triggered. Try again.' : 'Click to open · right-click or F to flag · click a completed clue to clear neighbors')}
        </p>
      </section>
    </main>
  )
}
