import Link from 'next/link'
import type { GameManifest } from '@/lib/engine/types'
import { GameIcon } from './GameIcon'
import './coming-soon.css'

export function ComingSoonGame({ game }: { game: GameManifest }) {
  return <main className="app-surface coming-soon-game">
    <div className="ui-glass coming-soon-card">
      <GameIcon icon={game.icon} size={88} />
      <span className="ui-badge">Coming soon</span>
      <h1>{game.title}</h1>
      <p>{game.description}</p>
      <div className="coming-soon-facts"><span className="ui-badge" data-tone="violet">Up to {game.maxPlayers} people</span><span className="ui-badge" data-tone="teal">Private rooms planned</span><span className="ui-badge">Camera optional</span></div>
      <ol>{game.instructions.map(item => <li key={item.title}><strong>{item.title}</strong><span>{item.detail.replace('Planned: ', '')}</span></li>)}</ol>
      <p className="coming-soon-note">In planning. Gameplay, rooms, and video are not available yet.</p>
      <Link href="/">Back to desktop</Link>
    </div>
  </main>
}
