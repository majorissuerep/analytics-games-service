'use client'

import Link from 'next/link'
import type { GameManifest } from '@/lib/engine/types'
import './welcome-app.css'

const invitations: Record<string, { mark: string; caption: string }> = {
  chess: { mark: '♞', caption: 'Find your next move.' },
  minefield: { mark: '⚑', caption: 'A little logic. A clean sweep.' },
  paintbox: { mark: '✎', caption: 'Make something your own.' },
  'orbit-pinball': { mark: '→', caption: 'One more ball. One more try.' },
}

export function WelcomeApp({ games, openGame }: { games: GameManifest[]; openGame(game: GameManifest): void }) {
  const launchable = games.filter(game => game.status !== 'coming-soon').slice(0, 3)
  return (
    <div className="app-surface system-panel welcome-panel">
      <header className="welcome-heading">
        <span className="welcome-monogram" aria-hidden="true">ag<span>✦</span></span>
        <p className="welcome-kicker">ANALYTICS GAMES <span>/ YOUR DESKTOP</span></p>
      </header>
      <div className="welcome-intro">
        <h1>A good place to play.</h1>
        <p>Pick a game and settle in.</p>
      </div>
      <section className="welcome-shelf" aria-labelledby="welcome-shelf-title">
        <div className="welcome-shelf-heading"><h2 id="welcome-shelf-title">Start something</h2><span>Ready when you are</span></div>
        <div className="welcome-actions">
          {launchable.map((game, index) => <button className="welcome-launch" key={game.id} onClick={() => openGame(game)} aria-label={`Open ${game.title}`}>
            <span className="welcome-game-mark" aria-hidden="true">{invitations[game.id]?.mark ?? '◇'}</span>
            <span className="welcome-launch-copy"><strong>{game.title}</strong><span>{invitations[game.id]?.caption ?? game.eyebrow}</span></span>
            <span className="welcome-launch-end" aria-hidden="true"><span>0{index + 1}</span><span>→</span></span>
          </button>)}
          {launchable.length === 0 && <p className="welcome-empty">No games are ready yet. Check the desktop for updates.</p>}
        </div>
      </section>
      <footer className="welcome-footer">
        <p>More to explore? <span>Double-click any game on the desktop.</span></p>
        <nav aria-label="Resources"><Link href="/develop">Developer guide →</Link><Link href="/design-system">Design system →</Link></nav>
      </footer>
    </div>
  )
}
