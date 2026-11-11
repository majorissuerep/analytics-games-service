import { generateSolvableMinefield } from '../solver'

self.onmessage = (event: MessageEvent<{ width: number; height: number; mines: number; opening: number }>) => {
  try {
    const { width, height, mines, opening } = event.data
    let lastUpdate = 0
    const board = generateSolvableMinefield(width, height, mines, opening, 3000, attempt => {
      if (attempt === 1 || performance.now() - lastUpdate > 150) {
        self.postMessage({ attempt }); lastUpdate = performance.now()
      }
    })
    self.postMessage({ board })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Board generation failed' })
  }
}
