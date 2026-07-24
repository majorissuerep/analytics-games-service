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
      className="plugin-quick-launch"
      disabled={context.games.length === 0}
      onClick={() => {
        const game = chooseGame(context.games)
        if (game) context.openGame(game.id)
      }}
    >
      <span aria-hidden>🎲</span>
      <div><strong>Surprise me</strong><small>Open a random installed game</small></div>
    </button>
  )
}

export const gameShufflePlugin: DesktopPluginDefinition = {
  manifest: {
    id: 'game-shuffle',
    version: 1,
    title: 'Game Shuffle',
    description: 'Adds a random installed-game launcher to the Start menu.',
    slot: 'start-menu',
    defaultEnabled: true,
  },
  Component: GameShuffle,
}
