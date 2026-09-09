import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/chess-models/[revisionId]/move': ['./public/models/**/*'],
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
