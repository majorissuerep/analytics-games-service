'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  armMinefield,
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

  useEffect(() => {
    if (!board.armed || board.status !== 'playing') return
    const timer = window.setInterval(() => setElapsed((current) => Math.min(999, current + 1)), 1_000)
    return () => window.clearInterval(timer)
  }, [board.armed, board.status])

  const reset = (nextDifficulty = difficulty) => {
    setElapsed(0)
    setBoard(freshBoard(nextDifficulty))
  }

  const reveal = (index: number) => {
    if (board.status !== 'playing') return
    if (!board.armed) {
      setBoard((current) => revealMinefieldCell(armMinefield(current, index), index))
      return
    }
    setBoard((current) => revealMinefieldCell(current, index))
  }

  const flags = board.cells.filter((cell) => cell.flagged).length
  const face = board.status === 'lost' ? '😵' : board.status === 'won' ? '😎' : '🙂'

  return (
    <main className="minefield-app">
      <header className="minefield-header">
        <Link href="/" aria-label="Back to desktop">💣 <strong>Minefield</strong></Link>
        <label>
          Level
          <select
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

      <section className="minefield-machine" aria-label="Minefield game">
        <div className="minefield-scoreboard">
          <output aria-label="Mines remaining">{String(Math.max(0, board.mineCount - flags)).padStart(3, '0')}</output>
          <button onClick={() => reset()} aria-label="New game">{face}</button>
          <output aria-label="Elapsed seconds">{String(elapsed).padStart(3, '0')}</output>
        </div>
        <div
          className="minefield-grid"
          style={{ gridTemplateColumns: `repeat(${board.width}, minmax(20px, 30px))` }}
          onContextMenu={(event) => event.preventDefault()}
        >
          {board.cells.map((cell, index) => (
            <button
              key={index}
              className={`minefield-cell${cell.revealed ? ' revealed' : ''}${cell.flagged ? ' flagged' : ''}`}
              data-adjacent={cell.adjacent}
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
        <p className="minefield-status" role="status">
          {board.status === 'won' ? `Cleared in ${elapsed} seconds!` : board.status === 'lost' ? 'Mine triggered. Try again.' : 'Left-click to reveal · right-click to flag'}
        </p>
      </section>
    </main>
  )
}
