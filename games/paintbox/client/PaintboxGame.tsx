'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import Link from 'next/link'
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const history = useRef<ImageData[]>([])
  const [color, setColor] = useState('#111111')
  const [size, setSize] = useState(8)
  const [eraser, setEraser] = useState(false)
  const [status, setStatus] = useState('Ready')
  const [hasUndo, setHasUndo] = useState(false)

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
  }

  const beginStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
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
    context.putImageData(previous, 0, 0)
    setHasUndo(history.current.length > 0)
    setStatus('Undid last action')
  }

  const save = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'paintbox-drawing.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
    setStatus('Saved PNG')
  }

  return (
    <main className="paintbox-app">
      <header className="paintbox-titlebar">
        <Link href="/" aria-label="Back to desktop">🎨 <strong>Paintbox</strong></Link>
        <span>untitled.png</span>
      </header>
      <nav className="paintbox-menu" aria-label="Paintbox menu">
        <button onClick={clear}>New</button>
        <button onClick={undo} disabled={!hasUndo}>Undo</button>
        <button onClick={save}>Save PNG</button>
      </nav>
      <section className="paintbox-workspace">
        <aside className="paintbox-tools" aria-label="Drawing tools">
          <button className={!eraser ? 'selected' : ''} onClick={() => setEraser(false)} aria-pressed={!eraser}>✎<small>Brush</small></button>
          <button className={eraser ? 'selected' : ''} onClick={() => setEraser(true)} aria-pressed={eraser}>▰<small>Eraser</small></button>
          <label>Size<input type="range" min="2" max="40" value={size} onChange={(event) => setSize(Number(event.target.value))} /></label>
        </aside>
        <div className="paintbox-canvas-scroll">
          <canvas
            ref={canvasRef}
            width={960}
            height={560}
            aria-label="Drawing canvas"
            tabIndex={0}
            onPointerDown={beginStroke}
            onPointerMove={continueStroke}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
          />
        </div>
      </section>
      <footer className="paintbox-footer">
        <div className="paintbox-current-color" style={{ background: eraser ? '#ffffff' : color }} aria-label="Current color" />
        <div className="paintbox-palette" aria-label="Color palette">
          {COLORS.map((swatch) => (
            <button
              key={swatch}
              style={{ background: swatch }}
              className={color === swatch && !eraser ? 'selected' : ''}
              onClick={() => { setColor(swatch); setEraser(false) }}
              aria-label={`Use color ${swatch}`}
            />
          ))}
        </div>
        <output aria-live="polite">{status}</output>
      </footer>
    </main>
  )
}
