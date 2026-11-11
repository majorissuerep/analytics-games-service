// Planning model only: no room service, game rules, or camera implementation.
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export const assumptions = Object.freeze({
  participants: 20, // Includes the host; no extra spectators.
  camera: { width: 640, height: 360, fps: 15, kbps: 350 },
  thumbnail: { width: 320, height: 180, fps: 10, kbps: 80 },
  microphoneKbps: 24,
  transportOverhead: 1.15,
  provisionHeadroom: 1.25,
  sessionMinutes: 60,
  commandsPerMinute: 12,
  snapshotBytes: 8192,
  reconciliationSeconds: 30,
})
export function capacity(input = assumptions) {
  const n = input.participants, remote = n - 1
  const multiplier = input.transportOverhead
  const ingressKbps = n * (input.camera.kbps + input.thumbnail.kbps + input.microphoneKbps) * multiplier
  const scenario = (name, high, low) => {
    const downstreamKbps = (high * input.camera.kbps + low * input.thumbnail.kbps + remote * input.microphoneKbps) * multiplier
    const egressMbps = n * downstreamKbps / 1000
    return { name, remoteVideoTiles: high + low, clientDownloadMbps: downstreamKbps / 1000, sfuEgressMbps: egressMbps,
      provisionedEgressMbps: egressMbps * input.provisionHeadroom, egressGBPerSession: egressMbps * input.sessionMinutes * 60 / 8000 }
  }
  const snapshotRequestsPerMinute = n * (input.commandsPerMinute + 60 / input.reconciliationSeconds)
  return {
    kind: 'calculated planning envelope, not a production benchmark', assumptions: input,
    clientUploadMbps: ingressKbps / n / 1000, sfuIngressMbps: ingressKbps / 1000,
    participantMinutes: n * input.sessionMinutes,
    peerMesh: { connections: n * remote / 2, uploadMbpsPerPlayer: remote * (input.camera.kbps + input.microphoneKbps) * multiplier / 1000 },
    scenarios: [scenario('desktop: 1 speaker + 18 thumbnails', 1, remote - 1), scenario('mobile: 1 speaker + 5 thumbnails', 1, Math.min(5, remote - 1)), scenario('all remote videos at 360p: stress ceiling', remote, 0), scenario('audio only', 0, 0)],
    state: { snapshotRequestsPerMinute, commandRequestsPerMinute: input.commandsPerMinute,
      requestRatePerSecond: (snapshotRequestsPerMinute + input.commandsPerMinute) / 60,
      snapshotPayloadMbps: snapshotRequestsPerMinute * input.snapshotBytes * 8 / 60 / 1e6 },
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = JSON.stringify(capacity(), null, 2) + '\n'
  // Fixed repository output URL, never supplied by a user.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (process.argv[2] === '--write') await writeFile(new URL('../docs/measurements/mafia-capacity.json', import.meta.url), output)
  else process.stdout.write(output)
}
