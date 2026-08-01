import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
