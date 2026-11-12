import config from '../../playwright.config'
export default { ...config, testDir: '../../tests/e2e', use: { ...config.use, proxy: { server: process.env.HTTPS_PROXY || process.env.HTTP_PROXY! } } }
