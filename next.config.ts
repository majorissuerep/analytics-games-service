import type { NextConfig } from 'next'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

function gitIdentity(ref: string) {
  try { return execFileSync('git', ['rev-parse', ref], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
  catch { return '' }
}

// Inlined by Next at build time. A running old bundle cannot acquire a new
// source identity just because the checkout or runtime environment changed.
const nativeAssetHashes = Object.fromEntries(['js', 'wasm', 'data'].map(extension => {
  const path = `public/vendor/space-cadet/SpaceCadetPinball.${extension}`
  // Fixed, repository-owned filenames; no request or user input enters the path.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  try { return [path, createHash('sha256').update(readFileSync(path)).digest('hex')] }
  catch { return [path, 'unavailable'] }
}))

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_EXPERIENCE_COMMIT: process.env.VERCEL_GIT_COMMIT_SHA || gitIdentity('HEAD'),
    NEXT_PUBLIC_EXPERIENCE_TREE: gitIdentity('HEAD^{tree}'),
    NEXT_PUBLIC_EXPERIENCE_NATIVE: JSON.stringify(nativeAssetHashes),
  },
  outputFileTracingIncludes: {
    '/api/chess-models/[revisionId]/move': ['./public/models/**/*', './public/vendor/stockfish/**/*', './scripts/chess/*.mjs', './vendor/native/reckless/**'],
    '/api/chess/analyse': ['./vendor/native/reckless/**', './public/vendor/stockfish/**/*', './scripts/chess/*.mjs'],
  },
  async headers() {
    return [{
      source: '/games/chess',
      headers: [
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
      ],
    }, {
      source: '/vendor/stockfish/(.*)',
      headers: [
        { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
      ],
    }]
  },
  // The vendored hermes-agent submodule is Python/tooling — never compile or watch it.
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules/**', '**/.git/**', '**/vendor/**'],
    }
    return config
  },
  turbopack: {},
}

export default nextConfig
