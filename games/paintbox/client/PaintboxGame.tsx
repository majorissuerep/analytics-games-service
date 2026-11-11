'use client'

import { useAppReady } from '@/lib/engine/client/use-app-ready'

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import Link from 'next/link'
import { LoadingState } from '@/components/ui/LoadingState'
import { emitGameSessionCompleted } from '@/lib/analytics/game-events'
import './paintbox.css'

const COLORS = ['#111111', '#ffffff', '#d72b2b', '#ff8a1f', '#ffd629', '#2aa13b', '#168cc9', '#2444b8', '#7735a8', '#ed77a8']

function canvasPoint(canvas: HTMLCanvasElement, event: ReactPointerEvent<HTMLCanvasElement>) {
  const bounds = canvas.getBoundingClientRect()
  return {
    x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
    y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
  }
}

export function PaintboxGame() {
  useAppReady()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const history = useRef<ImageData[]>([])
  const future = useRef<ImageData[]>([])
  const [color, setColor] = useState('#111111')
  const [size, setSize] = useState(8)
  const [eraser, setEraser] = useState(false)
  const [status, setStatus] = useState('Ready')
  const [saving, setSaving] = useState(false)
  const [hasUndo, setHasUndo] = useState(false)
  const [hasRedo, setHasRedo] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  const remember = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    history.current = [...history.current.slice(-9), context.getImageData(0, 0, canvas.width, canvas.height)]
    setHasUndo(true)
    future.current = []
    setHasRedo(false)
  }

  const beginStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || drawing.current || event.button !== 0) return
    remember()
    drawing.current = true
    canvas.setPointerCapture(event.pointerId)
    const point = canvasPoint(canvas, event)
    context.beginPath()
    context.moveTo(point.x, point.y)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = size
    context.strokeStyle = eraser ? '#ffffff' : color
    context.lineTo(point.x + 0.01, point.y + 0.01)
    context.stroke()
    setStatus(eraser ? 'Erasing' : 'Drawing')
  }

  const continueStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!drawing.current || !canvas || !context) return
    const point = canvasPoint(canvas, event)
    context.lineTo(point.x, point.y)
    context.stroke()
  }

  const endStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    drawing.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setStatus('Ready')
  }

  const clear = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    remember()
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    setStatus('Canvas cleared')
  }

  const undo = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    const previous = history.current.pop()
    if (!canvas || !context || !previous) return
    future.current.push(context.getImageData(0, 0, canvas.width, canvas.height))
    setHasRedo(true)
    context.putImageData(previous, 0, 0)
    setHasUndo(history.current.length > 0)
    setStatus('Undid last action')
  }

  const redo = () => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    const next = future.current.pop()
    if (!canvas || !context || !next) return
    history.current.push(context.getImageData(0, 0, canvas.width, canvas.height))
    context.putImageData(next, 0, 0)
    setHasUndo(true)
    setHasRedo(future.current.length > 0)
    setStatus('Redid last action')
  }

  const keyboard = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.target instanceof HTMLInputElement) return
    const key = event.key.toLowerCase()
    if ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y')) {
      event.preventDefault()
      if (event.shiftKey || key === 'y') redo()
      else undo()
    } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      if (key === 'b') setEraser(false)
      if (key === 'e') setEraser(true)
    }
  }

  const save = () => {
    const canvas = canvasRef.current
    if (!canvas || saving) return
    setSaving(true)
    canvas.toBlob(blob => {
      setSaving(false)
      if (!blob) { setStatus('PNG export failed. Please try Save PNG again.'); return }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = 'paintbox-drawing.png'
      link.href = url
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus('Saved PNG')
      emitGameSessionCompleted('drawing_saved')
    }, 'image/png')
  }

  return (
    <main className="app-surface paintbox-app" onKeyDown={keyboard}>
      <header className="paintbox-titlebar">
        <Link href="/" aria-label="Back to desktop"><span className="paintbox-mark" aria-hidden="true">✎</span><strong>Paintbox</strong></Link>
        <span className="paintbox-studio-label">A little room to make something.</span>
      </header>
      <nav className="paintbox-menu" aria-label="Paintbox menu">
        <span className="paintbox-document"><strong>Untitled</strong><small>960 × 560 · PNG</small></span>
        <div className="paintbox-history">
          <button onClick={undo} disabled={!hasUndo} title="Undo (Ctrl/⌘ Z)">Undo</button>
          <button onClick={redo} disabled={!hasRedo} title="Redo (Ctrl/⌘ Shift Z)">Redo</button>
        </div>
        <button onClick={clear} title="Clear the canvas; Undo restores it">New</button>
        <button className="ui-primary paintbox-save" onClick={save} disabled={saving}>Save PNG</button>
      </nav>
      {saving && <LoadingState scope="inline" label="Preparing your PNG download" detail="You can keep drawing while the image is exported." />}
      <section className="paintbox-workspace">
        <aside className="paintbox-tools" aria-label="Drawing tools">
          <span className="paintbox-section-label">Your tools</span>
          <div className="paintbox-tool-pair">
            <button className={!eraser ? 'selected' : ''} onClick={() => setEraser(false)} aria-pressed={!eraser} title="Brush (B)"><span aria-hidden="true">✎</span><small>Brush</small></button>
            <button className={eraser ? 'selected' : ''} onClick={() => setEraser(true)} aria-pressed={eraser} title="Eraser (E)"><span aria-hidden="true">▰</span><small>Eraser</small></button>
          </div>
          <label className="paintbox-size"><span>Size <output>{size} px</output></span><input aria-label="Brush size" type="range" min="2" max="40" value={size} onChange={(event) => setSize(Number(event.target.value))} /></label>
          <div className="paintbox-brush-preview" aria-hidden="true"><i style={{ width: size, height: size, background: eraser ? '#ffffff' : color }} /><span>{eraser ? 'Eraser' : 'Round brush'}</span></div>
          <div className="paintbox-pigments">
            <span className="paintbox-section-label">Pigments</span>
            <div className="paintbox-palette" aria-label="Color palette">
              {COLORS.map((swatch) => (
                <button key={swatch} style={{ background: swatch }} className={color === swatch && !eraser ? 'selected' : ''} onClick={() => { setColor(swatch); setEraser(false) }} aria-label={`Use color ${swatch}`} aria-pressed={color === swatch && !eraser} />
              ))}
            </div>
          </div>
          <p className="paintbox-shortcuts">B Brush · E Eraser<br />Ctrl / ⌘ Z Undo</p>
        </aside>
        <div className="paintbox-canvas-scroll">
          <div className="paintbox-paper-label"><span>DRAWING 01</span><span>WHITE PAPER</span></div>
          <canvas ref={canvasRef} width={960} height={560} aria-label="Drawing canvas" aria-describedby="paintbox-canvas-help" tabIndex={0} onPointerDown={beginStroke} onPointerMove={continueStroke} onPointerUp={endStroke} onPointerCancel={endStroke} />
          <p id="paintbox-canvas-help" className="paintbox-canvas-help">Make your mark. Draw with a mouse, finger or pen.</p>
        </div>
      </section>
      <footer className="paintbox-footer">
        <span className="paintbox-current-color" style={{ background: eraser ? '#ffffff' : color }} aria-label="Current color" />
        <span>{eraser ? 'Eraser' : 'Brush'} <span className="paintbox-footer-size">· {size} px</span></span>
        <output aria-live="polite">{status}</output>
      </footer>
    </main>
  )
}
