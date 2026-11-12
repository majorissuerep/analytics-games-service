import config from '../../../playwright.config'
export default { ...config, testDir: '.', testMatch: 'intentional-flake.spec.ts', use: {}, webServer: undefined, workers: 1, retries: 1, reporter: 'list', outputDir: './outputs' }
