import { loadAndValidateContent } from './content-lib.mjs'

try {
  const content = await loadAndValidateContent()
  console.log(`Content valid: ${content.bodies.size} bodies, ${content.systems.size} system, ${content.evaluations.size} evaluation`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
