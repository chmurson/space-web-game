import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearRecentDebugScenarioSnapshotsForTests,
  createDebugScenarioSnapshotEntryName,
  createScenarioFromSnapshot,
  createSnapshotFromState,
  getRecentDebugScenarioSnapshots,
  loadRecentDebugScenarioSnapshot,
  readDebugScenarioSnapshot,
  writeDebugScenarioSnapshot,
} from '@/debugScenarioSnapshot'
import { createRuntimeScenarioSession } from '@/scenario/scenarioSession'
import { idleControls } from '@/simulation/state'

const snapshotBase = {
  version: 1 as const,
  savedAt: '2026-04-10T10:00:00.000Z',
  elapsed: 42,
  viewportSize: 320,
  bodies: [
    {
      id: 'earth',
      name: 'Earth',
      mass: 5.97e24,
      radius: 6_371_000,
      position: { x: 1, y: 2 },
      velocity: { x: 3, y: 4 },
      color: '#4f86f7',
    },
  ],
  spacecraft: {
    position: { x: 5, y: 6 },
    velocity: { x: 7, y: 8 },
    heading: 0.1,
    fuel: 9,
    fuelUsed: 10,
    dryMass: 11,
    fuelMass: 12,
    fuelCapacity: 13,
  },
}

const createStorage = () => {
  const values = new Map<string, string>()

  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('window', {
    localStorage: createStorage(),
  })
  clearRecentDebugScenarioSnapshotsForTests()
})

describe('createScenarioFromSnapshot', () => {
  it('prefers explicit horizon hours from the snapshot', () => {
    const scenario = createScenarioFromSnapshot({
      ...snapshotBase,
      coastPredictionHorizonHours: 12,
      coastPredictionHorizonMultiplier: 3,
    })

    expect(scenario.coastPredictionHorizonHours).toBe(12)
    expect(scenario.viewportSize).toBe(320)
    expect(scenario.elapsed).toBe(42)
  })

  it('falls back to legacy horizon multiplier snapshots', () => {
    const scenario = createScenarioFromSnapshot({
      ...snapshotBase,
      coastPredictionHorizonMultiplier: 3,
    })

    expect(scenario.coastPredictionHorizonHours).toBe(12)
  })

  it('clones bodies and spacecraft so snapshot data stays immutable', () => {
    const scenario = createScenarioFromSnapshot({
      ...snapshotBase,
      coastPredictionHorizonHours: 12,
    })

    expect(scenario.bodies).not.toBe(snapshotBase.bodies)
    expect(scenario.bodies[0]).not.toBe(snapshotBase.bodies[0])
    expect(scenario.spacecraft).not.toBe(snapshotBase.spacecraft)

    scenario.bodies[0].position.x = 999
    scenario.spacecraft.position.y = 999

    expect(snapshotBase.bodies[0].position.x).toBe(1)
    expect(snapshotBase.spacecraft.position.y).toBe(6)
  })

  it('preserves scenario session metadata for version 2 snapshots', () => {
    const snapshot = createSnapshotFromState(
      {
        elapsed: snapshotBase.elapsed,
        bodies: snapshotBase.bodies,
        spacecraft: snapshotBase.spacecraft,
        controls: idleControls(),
      },
      {
        coastPredictionHorizonHours: 12,
        scenarioSession: {
          ...createRuntimeScenarioSession('tutorial'),
          completed: false,
          state: { phase: 'escape-earth' },
        },
        viewportSize: 320,
      },
    )
    const scenario = createScenarioFromSnapshot(snapshot)

    expect(scenario.scenarioSession).toEqual({
      checkpoint: null,
      completed: false,
      promptUi: {
        activePromptId: null,
        replayPromptId: null,
      },
      scenarioId: 'tutorial',
      state: { phase: 'escape-earth' },
    })

    if (!scenario.scenarioSession) {
      throw new Error('Expected scenario session.')
    }

    ;(scenario.scenarioSession.state as { phase: string }).phase = 'changed'
    expect(
      'runtimeScenario' in snapshot &&
        (snapshot.runtimeScenario?.state as { phase: string }).phase,
    ).toBe('escape-earth')
  })

  it('preserves assist target selection state for version 2 snapshots', () => {
    const snapshot = createSnapshotFromState(
      {
        elapsed: snapshotBase.elapsed,
        bodies: snapshotBase.bodies,
        spacecraft: snapshotBase.spacecraft,
        controls: idleControls(),
      },
      {
        assistTargetIndex: 1,
        assistTargetSelectionMode: 'manual',
      },
    )
    const scenario = createScenarioFromSnapshot(snapshot)

    expect(snapshot).toMatchObject({
      assistTargetIndex: 1,
      assistTargetSelectionMode: 'manual',
    })
    expect(scenario.assistTargetIndex).toBe(1)
    expect(scenario.assistTargetSelectionMode).toBe('manual')
  })
})

describe('recent debug scenario snapshots', () => {
  it('keeps recent snapshots newest first and capped at 10 entries', () => {
    for (let index = 0; index < 11; index += 1) {
      writeDebugScenarioSnapshot({
        ...snapshotBase,
        savedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        elapsed: index,
      })
    }

    const recentSnapshots = getRecentDebugScenarioSnapshots()

    expect(recentSnapshots).toHaveLength(10)
    expect(recentSnapshots.map((entry) => entry.snapshot.elapsed)).toEqual([
      10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
    ])
  })

  it('generates basic labels from scenario phase and elapsed time', () => {
    const snapshot = createSnapshotFromState(
      {
        elapsed: 3661,
        bodies: snapshotBase.bodies,
        spacecraft: snapshotBase.spacecraft,
        controls: idleControls(),
      },
      {
        scenarioSession: {
          ...createRuntimeScenarioSession('tutorial'),
          state: { phase: 'reach-moon' },
        },
      },
    )

    expect(createDebugScenarioSnapshotEntryName(snapshot)).toBe(
      'tutorial reach-moon at 1h 1m',
    )
  })

  it('loads a selected recent snapshot through the active snapshot slot', () => {
    writeDebugScenarioSnapshot({
      ...snapshotBase,
      savedAt: '2026-01-01T00:00:00.000Z',
      elapsed: 1,
    })
    writeDebugScenarioSnapshot({
      ...snapshotBase,
      savedAt: '2026-01-01T00:00:01.000Z',
      elapsed: 2,
    })
    const recentSnapshots = getRecentDebugScenarioSnapshots()

    expect(loadRecentDebugScenarioSnapshot(recentSnapshots[1].id)).toBe(true)
    expect(readDebugScenarioSnapshot()?.elapsed).toBe(1)
    expect(loadRecentDebugScenarioSnapshot('missing')).toBe(false)
  })
})
