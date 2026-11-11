import { describe, expect, it } from 'vitest'
import { assumptions, capacity } from '../../scripts/mafia-capacity.mjs'

describe('20-person Mafia planning envelope', () => {
  it('excludes self subscriptions, includes both upload layers, and budgets every microphone', () => {
    const plan = capacity()
    expect(assumptions.participants).toBe(20)
    expect(plan.clientUploadMbps).toBeCloseTo(0.5221)
    expect(plan.sfuIngressMbps).toBeCloseTo(10.442)
    expect(plan.scenarios[0].remoteVideoTiles).toBe(19)
    expect(plan.scenarios[0].sfuEgressMbps).toBeCloseTo(51.658)
    expect(plan.scenarios[0].egressGBPerSession).toBeCloseTo(23.2461)
    expect(plan.scenarios[1].remoteVideoTiles).toBe(6)
    expect(plan.scenarios[3].sfuEgressMbps).toBeCloseTo(10.488)
    expect(plan.participantMinutes).toBe(1200)
    expect(plan.peerMesh.connections).toBe(190)
  })
  it('increases the provisioned envelope and includes snapshot reconciliation', () => {
    const plan = capacity()
    for (const scenario of plan.scenarios) expect(scenario.provisionedEgressMbps).toBeGreaterThan(scenario.sfuEgressMbps)
    expect(plan.state.snapshotRequestsPerMinute).toBe(280)
    expect(plan.state.requestRatePerSecond).toBeCloseTo(4.8666667)
    expect(plan.scenarios[2].sfuEgressMbps).toBeGreaterThan(plan.scenarios[0].sfuEgressMbps)
  })
})
