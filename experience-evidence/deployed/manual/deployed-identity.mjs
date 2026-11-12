import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
export const expectedCommit='b63e82a0af6d5648f85c431b178914e90163dbdc'
export const expectedTree='5ce1fa38c0a107c0b5173f436d5cfebac7abfafb'
const resolvedTree=execFileSync('git',['rev-parse',`${expectedCommit}^{tree}`],{encoding:'utf8'}).trim()
assert.equal(resolvedTree,expectedTree)
const nativeAssets={
 'public/vendor/space-cadet/SpaceCadetPinball.js':'ddff8bf22ebd7c4888cd1cbbbe011c9563cff144f7a0051362f4c5fb5f0ef117',
 'public/vendor/space-cadet/SpaceCadetPinball.wasm':'48ba94b1de0eb0e97b5db2681da93badf8e8178628465a9f1149ae0f9e2f7ef1',
 'public/vendor/space-cadet/SpaceCadetPinball.data':'199c5fdcefd62b1965053bf47b0848e08d97830e0fe9e6ba595f8d7006d8782c',
}
export function assertDeployedIdentity(identity){
 assert.equal(identity.commit,expectedCommit)
 assert.ok(identity.tree===null||identity.tree===expectedTree)
 assert.equal(identity.tree??resolvedTree,expectedTree)
 assert.deepEqual(identity.nativeAssets,nativeAssets)
 // Keep the exact server identity in metadata; null is resolved only for verification.
}
