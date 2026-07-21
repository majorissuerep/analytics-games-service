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
  {
    files: ['games/consensus-radar/client/ConsensusRadarGame.tsx'],
    rules: {
      // Reference game predates React Compiler rules. Keep behavior stable while
      // new platform and plugin code receives the stricter default checks.
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    '.turbo/**',
    'coverage/**',
    'node_modules/**',
    'next-env.d.ts',
  ]),
])
