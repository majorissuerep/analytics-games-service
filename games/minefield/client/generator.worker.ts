import { generateSolvableMinefield } from '../solver'

self.onmessage = (event: MessageEvent<{ width: number; height: number; mines: number; opening: number }>) => {
  try {
    const { width, height, mines, opening } = event.data
    self.postMessage({ board: generateSolvableMinefield(width, height, mines, opening) })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Board generation failed' })
  }
}
