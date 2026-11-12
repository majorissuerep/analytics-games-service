import { spawnSync } from 'node:child_process'
const command = ['node_modules/playwright/cli.js', 'test', '--config=experience-evidence/candidate6/flake-policy/playwright.config.ts']
const result = spawnSync(process.execPath, command, { env: { ...process.env, CI: 'true' }, encoding: 'utf8' })
process.stdout.write(result.stdout ?? '')
process.stderr.write(result.stderr ?? '')
const rejected = result.status === 1 && /1 flaky/.test(result.stdout)
console.log(JSON.stringify({ expected: 'A passing retry still fails CI', actualExit: result.status, rejected }))
process.exitCode = rejected ? 0 : 1
