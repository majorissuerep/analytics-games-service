import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/chess-models/[revisionId]/move': ['./public/models/**/*'],
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
