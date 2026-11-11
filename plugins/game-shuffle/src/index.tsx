'use client'

import type { DesktopPluginDefinition, DesktopPluginProps } from '@analytics-games/plugin-sdk'

function chooseGame(games: DesktopPluginProps['context']['games']) {
  const scores = crypto.getRandomValues(new Uint32Array(games.length))
  let selected = 0
  for (let index = 1; index < games.length; index += 1) {
    if (scores[index] > scores[selected]) selected = index
  }
  return games[selected]
}

function GameShuffle({ context }: DesktopPluginProps) {
  return (
    <button
      type="button"
      className="plugin-quick-launch"
      disabled={context.games.length === 0}
      onClick={() => {
        const game = chooseGame(context.games)
        if (game) context.openGame(game.id)
      }}
    >
      <span aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" focusable="false">
          <rect x="4" y="4" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="2" />
          <circle cx="9" cy="9" r="1.6" fill="currentColor" />
          <circle cx="19" cy="9" r="1.6" fill="currentColor" />
          <circle cx="14" cy="14" r="1.6" fill="currentColor" />
          <circle cx="9" cy="19" r="1.6" fill="currentColor" />
          <circle cx="19" cy="19" r="1.6" fill="currentColor" />
        </svg>
      </span>
      <div>
        <strong>Surprise me</strong>
        <small>{context.games.length === 0 ? 'No playable games available' : 'Play a random available game'}</small>
      </div>
    </button>
  )
}

export const gameShufflePlugin: DesktopPluginDefinition = {
  manifest: {
    id: 'game-shuffle',
    version: 1,
    title: 'Game Shuffle',
    description: 'Launch a random available game from the Start menu.',
    slot: 'start-menu',
    defaultEnabled: true,
  },
  Component: GameShuffle,
}
