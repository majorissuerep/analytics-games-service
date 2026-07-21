import { describe, expect, it } from 'vitest'
import { parseExternalGameManifest } from './external-game-schema'

const manifest = {
  id: 'remote-demo',
  version: 1,
  title: 'Remote demo',
  eyebrow: 'External game',
  description: 'Lives in another repository.',
  accent: '#123456',
  accentSoft: 'rgba(1, 2, 3, .2)',
  minPlayers: 1,
  maxPlayers: 10,
  estimatedMinutes: '5 min',
  tags: ['remote'],
  instructions: [],
  status: 'beta',
  integration: {
    kind: 'external',
    launchUrl: 'https://games.example.test/play',
    origin: 'https://games.example.test',
    bridgeVersion: 1,
  },
}

describe('external game manifest', () => {
  it('accepts a strict HTTPS bridge manifest', () => {
    expect(parseExternalGameManifest(manifest)).toMatchObject({ id: 'remote-demo' })
  })

  it('rejects origin mismatches and unknown fields', () => {
    expect(() => parseExternalGameManifest({
      ...manifest,
      integration: { ...manifest.integration, origin: 'https://other.example.test' },
    })).toThrow()
    expect(() => parseExternalGameManifest({ ...manifest, surprise: true })).toThrow()
  })
})
