'use client'

import { useRouter } from 'next/navigation'
import type { GameManifest } from '@/lib/engine/types'
import { GameFrame } from './GameFrame'
import './desktop.css'

export function StandaloneGameFrame({ game }: { game: GameManifest }) {
  const router = useRouter()
  return (
    <main className="standalone-game-shell">
      <div className="window desktop-window">
        <div className="title-bar">
          <div className="title-bar-text">🎮 {game.title}</div>
          <div className="title-bar-controls">
            <button aria-label="Close" onClick={() => router.push('/')} />
          </div>
        </div>
        <div className="desktop-window-body">
          <GameFrame game={game} launchContext="standalone" onExit={() => router.push('/')} />
        </div>
      </div>
    </main>
  )
}
