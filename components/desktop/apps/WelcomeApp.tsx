'use client'

import Link from 'next/link'
import type { GameManifest } from '@/lib/engine/types'
import './welcome-app.css'

const launchActions: Record<string, { mark: string; caption: string }> = {
  chess: { mark: '♞', caption: 'Play the computer or a friend.' },
  minefield: { mark: '⚑', caption: 'Clear a deduction-only minefield.' },
  paintbox: { mark: '✎', caption: 'Draw, undo, and save a PNG.' },
  'orbit-pinball': { mark: '→', caption: 'Launch: Space · Flippers: ← →' },
}

export function WelcomeApp({ games, openGame }: { games: GameManifest[]; openGame(game: GameManifest): void }) {
  const launchable = games.filter(game => game.status !== 'coming-soon').slice(0, 3)
  return (
    <div className="app-surface system-panel welcome-panel">
      <header className="welcome-heading">
        <span className="welcome-monogram" aria-hidden="true">ag<span>✦</span></span>
      </header>
      <div className="welcome-intro">
        <h1>Games</h1>
        <p>Select a game to open it.</p>
      </div>
      <section className="welcome-shelf" aria-labelledby="welcome-shelf-title">
        <div className="welcome-shelf-heading"><h2 id="welcome-shelf-title">Quick launch</h2></div>
        <div className="welcome-actions">
          {launchable.map((game, index) => <button className="welcome-launch" key={game.id} onClick={() => openGame(game)} aria-label={`Open ${game.title}`}>
            <span className="welcome-game-mark" aria-hidden="true">{launchActions[game.id]?.mark ?? '◇'}</span>
            <span className="welcome-launch-copy"><strong>{game.title}</strong><span>{launchActions[game.id]?.caption ?? `Open ${game.title}.`}</span></span>
            <span className="welcome-launch-end" aria-hidden="true"><span>0{index + 1}</span><span>→</span></span>
          </button>)}
          {launchable.length === 0 && <p className="welcome-empty">No games are ready yet. Check the desktop for updates.</p>}
        </div>
      </section>
      <footer className="welcome-footer">
        <p>All games: <span>Double-click a game on the desktop.</span></p>
        <nav aria-label="Resources"><Link href="/develop">Developer guide →</Link><Link href="/design-system">Design system →</Link></nav>
      </footer>
    </div>
  )
}
