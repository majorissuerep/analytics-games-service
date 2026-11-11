'use client'

import Link from 'next/link'
import type { GameManifest } from '@/lib/engine/types'
import { GameIcon } from './GameIcon'
import './coming-soon.css'

export function ComingSoonGame({ game, onExit }: { game: GameManifest; onExit?: () => void }) {
  return <main className="app-surface coming-soon-game">
    <article className="ui-card coming-soon-card" aria-labelledby="coming-soon-title">
      <div className="ui-glass coming-soon-status">
        <span className="ui-badge">Coming soon</span>
        <span>A private table, in the making</span>
      </div>
      <header className="coming-soon-heading">
        <GameIcon icon={game.icon} size={72} />
        <div><p className="coming-soon-eyebrow">An evening of social deduction</p><h1 id="coming-soon-title">{game.title}</h1></div>
      </header>
      <p className="coming-soon-description">{game.description}</p>
      <div className="coming-soon-body">
        <section className="coming-soon-invitation" aria-label="Planned table">
          <div className="coming-soon-table" aria-hidden="true">
            <span className="coming-soon-place coming-soon-place-one" />
            <span className="coming-soon-place coming-soon-place-two" />
            <span className="coming-soon-place coming-soon-place-three" />
            <span className="coming-soon-place coming-soon-place-four" />
            <span className="coming-soon-table-center">Trust your instincts.</span>
          </div>
          <p className="coming-soon-capacity"><strong>{game.maxPlayers}</strong><span>people at one table<br /><b>including the host</b></span></p>
          <div className="coming-soon-facts"><span>Private rooms planned</span><span>Camera optional</span></div>
        </section>
        <section className="coming-soon-plan" aria-labelledby="coming-soon-plan-title">
          <h2 id="coming-soon-plan-title">The evening we’re planning</h2>
          <ol>{game.instructions.map(item => <li key={item.title}><strong>{item.title}</strong><span>{item.detail.replace('Planned: ', '')}</span></li>)}</ol>
        </section>
      </div>
      <footer className="coming-soon-footer">
        <p className="coming-soon-note"><strong>Still at the planning table.</strong> Gameplay, rooms, and video are not available yet.</p>
        {onExit ? <button className="coming-soon-back" onClick={onExit}>Back to desktop</button> : <Link className="coming-soon-back" href="/">Back to desktop</Link>}
      </footer>
    </article>
  </main>
}
