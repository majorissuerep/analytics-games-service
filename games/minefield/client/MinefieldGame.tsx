'use client'

import { useAppReady } from '@/lib/engine/client/use-app-ready'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { requestWindowSize } from '@/lib/engine/client/request-window-size'
import { LoadingState } from '@/components/ui/LoadingState'
import { emitGameSessionCompleted } from '@/lib/analytics/game-events'
import { chordMinefieldCell, createMinefield, neighbors, revealMinefieldCell, scanMinefieldEcho, toggleMinefieldFlag, type MinefieldBoard } from '../model'
import { analyzeMinefield, toVisibleMinefield, type MinefieldAnalysis } from '../solver'
import './minefield.css'

const DIFFICULTIES = {
  beginner: { label: 'Beginner', width: 9, height: 9, mines: 10, layers: 1 },
  intermediate: { label: 'Intermediate', width: 16, height: 16, mines: 40, layers: 1 },
  expert: { label: 'Expert', width: 30, height: 16, mines: 99, layers: 1 },
  extremeElite: { label: 'Extreme Elite', width: 8, height: 8, mines: 28, layers: 2 },
} as const
type Difficulty = keyof typeof DIFFICULTIES
function freshBoard(difficulty: Difficulty) {
  const c = DIFFICULTIES[difficulty]
  return createMinefield(c.width, c.height, c.mines, c.layers)
}
function coordinate(board: MinefieldBoard, index: number) {
  return `${board.layers === 2 ? `Layer ${Math.floor(index / (board.width * board.height)) + 1}, ` : ''}row ${Math.floor(index / board.width) % board.height + 1}, column ${index % board.width + 1}`
}
function cellLabel(board: MinefieldBoard, index: number) {
  const cell = board.cells[index], at = coordinate(board, index)
  if (cell.flagged) return `Flagged cell, ${at}`
  if (!cell.revealed) return `Covered cell, ${at}`
  if (cell.mine) return `Mine, ${at}`
  return board.layers === 2 ? `Local ${cell.adjacent}, echo ${cell.echoRevealed ? cell.crossAdjacent : 'unknown'}, ${at}` : `${cell.adjacent || 'Empty'}, ${at}`
}

export function MinefieldGame() {
  useAppReady()
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const [board, setBoard] = useState(() => freshBoard('beginner'))
  const [elapsed, setElapsed] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [generationAttempt, setGenerationAttempt] = useState(0)
  const [cellSize, setCellSize] = useState(24)
  const [panning, setPanning] = useState(false)
  const [activeLayer, setActiveLayer] = useState(0)
  const [inspectedCell, setInspectedCell] = useState(0)
  const [focusedCell, setFocusedCell] = useState(0)
  const [analysis, setAnalysis] = useState<MinefieldAnalysis | null>(null)
  const [proofOpen, setProofOpen] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const explainRef = useRef<HTMLButtonElement>(null)
  const proofCloseRef = useRef<HTMLButtonElement>(null)
  const holdRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; x: number; y: number; suppress: boolean } | null>(null)
  const openingRef = useRef(0)
  const workerRef = useRef<Worker | null>(null)
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generationEpoch = useRef(0)
  const elite = board.layers === 2
  const minimumCell = elite ? 32 : 24
  const layerSize = board.width * board.height
  useEffect(() => () => {
    workerRef.current?.terminate()
    if (watchdogRef.current) clearTimeout(watchdogRef.current)
    if (holdRef.current?.timer) clearTimeout(holdRef.current.timer)
  }, [])
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(() => {
      const fit = Math.floor(Math.min((stage.clientWidth - 10) / board.width, (stage.clientHeight - 10) / board.height))
      setCellSize(Math.max(minimumCell, fit))
      setPanning(fit < minimumCell)
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [board.width, board.height, minimumCell])
  useEffect(() => {
    if (!board.armed || board.status !== 'playing') return
    const timer = window.setInterval(() => setElapsed(current => Math.min(999, current + 1)), 1000)
    return () => window.clearInterval(timer)
  }, [board.armed, board.status])
  useEffect(() => { if (board.status === 'won' || board.status === 'lost') emitGameSessionCompleted(board.status) }, [board.status])
  useEffect(() => { if (proofOpen) proofCloseRef.current?.focus() }, [proofOpen])
  const cancelHold = (suppress = false) => {
    if (!holdRef.current) return
    if (holdRef.current.timer) clearTimeout(holdRef.current.timer)
    holdRef.current.timer = null
    holdRef.current.suppress ||= suppress
  }
  const changeLayer = (layer: number) => {
    cancelHold(true)
    setActiveLayer(layer)
    setFocusedCell(layer * layerSize + focusedCell % layerSize)
  }
  const clearWorker = () => {
    workerRef.current?.terminate()
    workerRef.current = null
    if (watchdogRef.current) clearTimeout(watchdogRef.current)
    watchdogRef.current = null
  }
  const reset = (next = difficulty) => {
    cancelHold(true)
    generationEpoch.current += 1
    clearWorker()
    setGenerating(false); setGenerationError(''); setElapsed(0); setFocusedCell(0)
    setActiveLayer(0); setInspectedCell(0); setAnalysis(null); setProofOpen(false)
    setBoard(freshBoard(next))
  }
  const reveal = (index: number, chord = false) => {
    if (board.status !== 'playing' || generating) return
    setInspectedCell(index)
    setAnalysis(null)
    if (board.cells[index].flagged) return
    if (!board.armed) {
      const epoch = ++generationEpoch.current
      setGenerating(true); setGenerationAttempt(0); setGenerationError('')
      openingRef.current = index
      let worker: Worker
      try { worker = new Worker(new URL('./generator.worker.ts', import.meta.url)) }
      catch { setGenerating(false); setGenerationError('Board verification could not start. Try again.'); return }
      workerRef.current = worker
      const fail = (message: string) => {
        if (epoch !== generationEpoch.current) return
        generationEpoch.current += 1
        clearWorker(); setGenerating(false); setGenerationError(message)
      }
      watchdogRef.current = setTimeout(() => fail('Verification exceeded its time limit. Retry or choose a new opening.'), 10000)
      worker.onmessage = (event: MessageEvent<{ board?: MinefieldBoard; error?: string; attempt?: number }>) => {
        if (epoch !== generationEpoch.current) return
        if (event.data.attempt !== undefined) { setGenerationAttempt(event.data.attempt); return }
        if (!event.data.board) { fail(event.data.error || 'Generation failed. Try again.'); return }
        const generated = event.data.board
        generationEpoch.current += 1
        setBoard(current => revealMinefieldCell({ ...generated, cells: generated.cells.map((cell, i) => ({ ...cell, flagged: current.cells[i]?.flagged ?? false })) }, index))
        setGenerating(false); clearWorker()
      }
      worker.onerror = () => fail('Board generation failed. Please try again.')
      worker.postMessage({ width: board.width, height: board.height, mines: board.mineCount, opening: index, layers: board.layers })
      return
    }
    setBoard(current => current.cells[index].revealed ? (!elite || chord ? chordMinefieldCell(current, index) : current) : revealMinefieldCell(current, index))
  }
  const scan = () => {
    if (generating) return
    setBoard(current => scanMinefieldEcho(current, inspectedCell))
    setAnalysis(null)
  }
  const explain = () => { setAnalysis(analyzeMinefield(toVisibleMinefield(board))); setProofOpen(true) }
  const closeProof = (focusIndex?: number) => {
    setProofOpen(false)
    if (focusIndex === undefined) explainRef.current?.focus()
    else requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`.minefield-cell[data-index="${focusIndex}"]`)?.focus())
  }
  const flags = board.cells.filter(cell => cell.flagged).length
  const opened = board.cells.filter(cell => cell.revealed && !cell.mine).length
  const scans = board.cells.filter(cell => cell.echoRevealed).length
  const progress = Math.round(100 * opened / (board.cells.length - board.mineCount))
  const source = board.cells[inspectedCell]
  const sourceOpen = source?.revealed && !source.mine
  const echoTargets = elite && sourceOpen ? neighbors(board, inspectedCell, 'cross') : []
  const localTargets = elite && sourceOpen ? neighbors(board, inspectedCell) : []
  const hintTarget = analysis?.safe[0] ?? analysis?.mines.find(index => !board.cells[index].flagged)
  const hintStep = analysis?.steps.find(step => step.safe.includes(hintTarget ?? -1) || step.mines.includes(hintTarget ?? -1))
  const proofSteps = hintStep && analysis ? analysis.steps.slice(0, analysis.steps.indexOf(hintStep) + 1) : []
  const describeSource = (source: { kind: 'local' | 'echo' | 'total'; index?: number }) => source.kind === 'total'
    ? `global total ${board.mineCount}`
    : `${source.kind === 'echo' ? 'echo' : 'local clue'} ${source.kind === 'echo' ? board.cells[source.index!].crossAdjacent : board.cells[source.index!].adjacent} at ${coordinate(board, source.index!)}`
  const hintText = hintTarget !== undefined
    ? `${coordinate(board, hintTarget)} is ${analysis?.safe.includes(hintTarget) ? 'safe' : 'a mine'}.${analysis?.safe.includes(hintTarget) && board.cells[hintTarget].flagged ? ' Remove its flag before opening.' : ''}`
    : analysis?.scan !== undefined ? `Information request: scan ${coordinate(board, analysis.scan)}. Its echo may add a useful constraint; this is not a safe-cell claim.`
    : analysis?.kind === 'contradiction' ? 'These visible clues conflict. Start a new game or retry verification.'
    : 'No move found by these deduction rules. This does not prove the position needs a guess.'

  return (
    <main className={`app-surface minefield-app${elite ? ' minefield-elite' : ''}`}>
      <header className="minefield-header ui-glass">
        <Link className="minefield-title" href="/" aria-label="Back to desktop">Minefield</Link>
        <label>Level <select aria-label="Level" value={difficulty} onChange={event => {
          const next = event.target.value as Difficulty
          setDifficulty(next); reset(next)
          const size = next === 'expert' ? [1120, 760] : next === 'intermediate' ? [720, 660] : next === 'extremeElite' ? [720, 760] : [480, 600]
          requestWindowSize(size[0], size[1])
        }}>{Object.entries(DIFFICULTIES).map(([id, config]) => <option key={id} value={id}>{config.label}</option>)}</select></label>
        <button className="ui-primary" onClick={() => reset()} aria-label="New game">New game</button>
      </header>
      <section className="minefield-machine" aria-label="Minefield game" style={{ '--field-width': `${board.width * cellSize}px`, '--field-height': `${board.height * cellSize}px` } as CSSProperties}>
        <div className="minefield-scoreboard">
          <div><small>Mines left</small><output aria-label="Mines remaining">{String(Math.max(0, board.mineCount - flags)).padStart(3, '0')}</output></div>
          <span className="minefield-dimensions">{elite ? '2 × 8 × 8' : `${board.width} × ${board.height}`}<small>{board.mineCount} mines{elite ? ` · ${scans} scans` : ''}</small></span>
          <div><small>Seconds</small><output aria-label="Elapsed seconds">{String(elapsed).padStart(3, '0')}</output></div>
        </div>
        {elite && <>
          <div className="minefield-layers" role="tablist" aria-label="Minefield layers">
            {[0, 1].map(layer => <button key={layer} role="tab" tabIndex={activeLayer === layer ? 0 : -1} aria-label={`Layer ${layer + 1}`} aria-selected={activeLayer === layer} onClick={() => changeLayer(layer)} onKeyDown={event => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault()
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - layer
                changeLayer(next)
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
              }
            }}>
              Layer {layer + 1}<span aria-hidden="true">{board.cells.slice(layer * layerSize, (layer + 1) * layerSize).filter(cell => cell.revealed && !cell.mine).length} opened</span>
            </button>)}
          </div>
          <div className="minefield-inspector" data-source-index={inspectedCell}>
            <div><strong>L{Math.floor(inspectedCell / layerSize) + 1} R{Math.floor(inspectedCell / board.width) % board.height + 1} C{inspectedCell % board.width + 1}</strong>
              <span>{sourceOpen ? `Local ${source.adjacent} · Echo ${source.echoRevealed ? source.crossAdjacent : '?'}` : 'Reveal a safe cell to scan'}</span></div>
            <button onClick={scan} disabled={!sourceOpen || source.echoRevealed || generating || board.status !== 'playing'}>{source.echoRevealed ? 'Echo scanned' : 'Scan echo'}</button>
          </div>
        </>}
        {generating && <LoadingState label="Verifying a deduction-only board" detail={generationAttempt ? `Checking candidate ${generationAttempt}. Only a fully solvable board will open.` : 'Starting board verification'} onCancel={() => reset()} />}
        <div className="minefield-stage" ref={stageRef}>
          <div className="minefield-board-scroll" data-scroll-owner="minefield-board" data-panning={panning} tabIndex={0} aria-label="Scrollable minefield">
            <div className="minefield-grid" aria-busy={generating} style={{ gridTemplateColumns: `repeat(${board.width}, var(--cell-size))`, '--cell-size': `${cellSize}px` } as CSSProperties} onContextMenu={event => event.preventDefault()}>
              {board.cells.slice(activeLayer * layerSize, (activeLayer + 1) * layerSize).map((cell, relative) => {
                const index = activeLayer * layerSize + relative
                return <button key={index} tabIndex={index === focusedCell ? 0 : -1} onFocus={() => setFocusedCell(index)}
                  className={`minefield-cell${cell.mine && cell.revealed ? ' mine' : ''}${cell.revealed ? ' revealed' : ''}${cell.flagged ? ' flagged' : ''}${elite && index === inspectedCell ? ' inspected' : ''}${echoTargets.includes(index) ? ' echo-target' : ''}${localTargets.includes(index) ? ' clue-target' : ''}${hintTarget === index ? ' hint-target' : ''}`}
                  data-index={index} data-adjacent={cell.revealed && !cell.mine ? cell.adjacent : undefined} data-echo={cell.revealed && cell.echoRevealed && !cell.mine ? cell.crossAdjacent : undefined} data-echo-target={echoTargets.includes(index) ? 'true' : undefined}
                  disabled={generating} aria-label={cellLabel(board, index)}
                  onKeyDown={event => {
                    if (event.key.toLowerCase() === 'f') { event.preventDefault(); setBoard(current => toggleMinefieldFlag(current, index)); setAnalysis(null) }
                    if (elite && event.key.toLowerCase() === 'e') { event.preventDefault(); setInspectedCell(index); setBoard(current => scanMinefieldEcho(current, index)); setAnalysis(null) }
                    if (elite && event.key.toLowerCase() === 'c') { event.preventDefault(); reveal(index, true) }
                    const offset = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: board.width, ArrowUp: -board.width } as Record<string, number>)[event.key]
                    if (offset !== undefined) {
                      event.preventDefault()
                      const row = Math.floor(relative / board.width), column = relative % board.width
                      const next = event.key === 'ArrowLeft' ? row * board.width + Math.max(0, column - 1) : event.key === 'ArrowRight' ? row * board.width + Math.min(board.width - 1, column + 1) : Math.max(0, Math.min(board.height - 1, row + (offset > 0 ? 1 : -1))) * board.width + column
                      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('.minefield-cell')[next]?.focus()
                    }
                  }}
                  onPointerDown={event => {
                    if (event.pointerType === 'mouse') {
                      // A real mouse gesture starts a new action. Compatibility
                      // mouse events after a touch do not emit a mouse pointerdown;
                      // their click still meets the touch hold's suppression below.
                      cancelHold()
                      holdRef.current = null
                      return
                    }
                    cancelHold()
                    const hold = { timer: null as ReturnType<typeof setTimeout> | null, x: event.clientX, y: event.clientY, suppress: false }
                    hold.timer = setTimeout(() => { hold.suppress = true; hold.timer = null; if (!generating) { setBoard(current => toggleMinefieldFlag(current, index)); setAnalysis(null) } }, 450)
                    holdRef.current = hold
                  }}
                  onPointerMove={event => { const hold = holdRef.current; if (hold && Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > 8) cancelHold(true) }}
                  onPointerUp={() => cancelHold()} onPointerCancel={() => cancelHold(true)}
                  onClick={event => { const suppressed = holdRef.current?.suppress; holdRef.current = null; if (!suppressed) reveal(index, event.shiftKey) }}
                  onContextMenu={event => { event.preventDefault(); if (holdRef.current?.suppress) return; setBoard(current => toggleMinefieldFlag(current, index)); setAnalysis(null) }}>
                  {cell.flagged ? '⚑' : cell.revealed ? cell.mine ? '✹' : elite ? <><span className="minefield-local">{cell.adjacent}</span><span className="minefield-echo">↕{cell.echoRevealed ? cell.crossAdjacent : '?'}</span></> : cell.adjacent || '' : ''}
                </button>
              })}
            </div>
          </div>
        </div>
        <div className="minefield-progress"><label htmlFor="minefield-cleared">{progress}% cleared</label><progress id="minefield-cleared" max={100} value={progress} aria-label="Safe field cleared" /><span>{flags} flagged</span></div>
        <p className="minefield-mode-help">{elite ? 'Local: 8 nearby · Echo: other 3×3 · E: scan.' : 'Open: click or Enter · Flag: right-click, F, or hold.'}</p>
        <div className="minefield-feedback">
          <p className="minefield-status" role="status">{generating ? 'Preparing a verified board…' : generationError || (board.status === 'won' ? `Cleared in ${elapsed} seconds!${elite ? ` ${scans} echo scans.` : ''}` : board.status === 'lost' ? 'Mine triggered. Try again.' : elite ? 'Flag: F / hold · Clear local: C.' : 'Arrows move · matching flags + clue click clears neighbors.')}</p>
          <button ref={explainRef} onClick={explain} disabled={!board.armed || generating || board.status !== 'playing'}>Explain move</button>
        </div>
        {generationError && <button className="minefield-retry" onClick={() => reveal(openingRef.current)}>Retry verification</button>}
        <p className="minefield-pan-help">{panning ? 'Pan the board · arrows move focus.' : ''}</p>
      </section>
      {proofOpen && <div className="minefield-proof-backdrop" onKeyDown={event => {
        if (event.key === 'Escape') closeProof()
        if (event.key === 'Tab') { const items = event.currentTarget.querySelectorAll<HTMLElement>('button, summary'); const first = items[0], last = items[items.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() } }
      }}>
        <section className="minefield-proof minefield-explanation ui-glass" data-target-index={hintTarget} data-kind={analysis?.kind} role="dialog" aria-modal="true" aria-labelledby="minefield-proof-title">
          <header><strong id="minefield-proof-title">Visible-clue deduction</strong><button ref={proofCloseRef} onClick={() => closeProof()}>Close</button></header>
          <div className="minefield-proof-body" data-scroll-owner="minefield-proof">
            <p className="minefield-proof-result">{hintText}</p>
            {hintStep && <><p>{hintStep.explanation}</p><p>Uses {hintStep.sources.map(describeSource).join('; ')}.</p>
              <details className="minefield-proof-steps"><summary>Proof steps ({proofSteps.length})</summary><p>Regions below contain only cells still unknown at that step. Earlier proven mines are subtracted from clue values; earlier proven safe cells are removed. Flags are ignored.</p><ol>{proofSteps.map((step, i) => <li key={i}>
                <strong>Step {i + 1}: {step.rule === 'subset' ? 'subset subtraction' : step.rule === 'global' ? 'mine budget' : 'clue region'}</strong>
                <p>Visible premises: {step.sources.map(describeSource).join('; ')}.</p>
                {step.constraints.map((constraint, j) => <p key={j}>Region {String.fromCharCode(65 + j)}: {constraint.mines} {constraint.mines === 1 ? 'mine' : 'mines'} in {'{'}{constraint.cells.map(index => coordinate(board, index)).join('; ')}{'}'}.</p>)}
                <p>{step.explanation} Proven {step.safe.length ? 'safe' : 'mines'}: {(step.safe.length ? step.safe : step.mines).map(index => coordinate(board, index)).join('; ')}.</p>
              </li>)}</ol></details>
            </>}
            {hintTarget !== undefined && <button onClick={() => { setActiveLayer(Math.floor(hintTarget / layerSize)); setFocusedCell(hintTarget); setInspectedCell(hintTarget); closeProof(hintTarget) }}>Show this cell</button>}
            {hintTarget !== undefined && analysis?.safe.includes(hintTarget) && board.cells[hintTarget].flagged && <button onClick={() => { setBoard(current => revealMinefieldCell(current.cells[hintTarget].flagged ? toggleMinefieldFlag(current, hintTarget) : current, hintTarget)); setAnalysis(null); closeProof() }}>Unflag and open</button>}
            {analysis?.scan !== undefined && hintTarget === undefined && <button onClick={() => { const index = analysis.scan!; setActiveLayer(Math.floor(index / layerSize)); setFocusedCell(index); setInspectedCell(index); closeProof(index) }}>Inspect scan location</button>}
            <details><summary>Rules and verification</summary><p>Every layout is fixed after the first opening. Generation accepts only boards completed by local clues, the total mine count and subset subtraction. Flags are your notes and are never used as proof. Right-click, F or a touch hold toggles a flag.</p>{elite && <p>Each local clue counts the eight neighboring cells in its own layer. E or Scan echo on a revealed safe cell learns the mine count in the aligned 3×3 area of the other layer. Scans are unlimited and counted, with no required minimum. A question mark means unknown. A scan reveals information, never a cell. Clicking a revealed Elite cell only selects it; C or Shift-click clears its local neighbors when flags match.</p>}<p>The opening and its same-layer neighbors are safe. Incorrect flags or opening an unproven cell can still lose. This solver is sound but incomplete; a stalled analysis does not prove guessing is required.</p></details>
          </div>
        </section>
      </div>}
    </main>
  )
}
