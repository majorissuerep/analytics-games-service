import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import security from 'eslint-plugin-security'

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  security.configs.recommended,
  {
    rules: {
      // Dynamic lookup is normal for game registries and state projections.
      'security/detect-object-injection': 'off',
    },
  },
  globalIgnores([
    '.cache/**',
    '.next/**',
    '.turbo/**',
    'coverage/**',
    'node_modules/**',
    'public/vendor/**',
    'public/models/**',
    'vendor/**',
    'next-env.d.ts',
  ]),
])
