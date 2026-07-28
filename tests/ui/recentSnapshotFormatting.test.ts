import { describe, expect, it } from 'vitest'

import type {
  DebugScenarioSnapshot,
  DebugScenarioSnapshotEntry,
} from '@/debugScenarioSnapshot'
import { getRecentSnapshotDetails } from '@/ui/components/recentSnapshotFormatting'

const legacySnapshot: DebugScenarioSnapshot = {
  version: 1,
  savedAt: '2026-07-27T12:34:00',
  elapsed: 15 * 60,
  bodies: [],
  spacecraft: {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    heading: 0,
    fuel: 1,
    fuelUsed: 0,
    dryMass: 10_000,
    fuelMass: 8_000,
    fuelCapacity: 8_000,
  },
}

const currentRuntimeScenario = {
  checkpoint: null,
  completed: false,
  promptUi: {
    activePromptId: null,
    replayPromptId: null,
  },
  scenarioId: 'reach-moon',
  state: { phase: 'reach-moon' },
} as const

const currentSnapshot: DebugScenarioSnapshot = {
  ...legacySnapshot,
  version: 3,
  elapsed: 90 * 60,
  runtimeScenario: currentRuntimeScenario,
}

const createEntry = (
  snapshot: DebugScenarioSnapshot,
  overrides: Partial<DebugScenarioSnapshotEntry> = {},
): DebugScenarioSnapshotEntry => ({
  id: 'snapshot-entry',
  name: 'Snapshot entry',
  savedAt: snapshot.savedAt,
  snapshot,
  ...overrides,
})

describe('recent snapshot details', () => {
  it('formats current game time, timestamp, and friendly scenario context', () => {
    expect(getRecentSnapshotDetails(createEntry(currentSnapshot))).toEqual([
      { label: 'Game time', value: '01h30m' },
      { label: 'Scenario', value: 'Reach the Moon (reach-moon)' },
      { label: 'Created', value: 'Jul 27, 2026, 12:34 PM' },
    ])
  })

  it('uses a useful fallback for legacy and unknown scenarios', () => {
    expect(getRecentSnapshotDetails(createEntry(legacySnapshot))).toEqual([
      { label: 'Game time', value: '15m' },
      { label: 'Scenario', value: 'Legacy snapshot (version 1)' },
      { label: 'Created', value: 'Jul 27, 2026, 12:34 PM' },
    ])
    expect(
      getRecentSnapshotDetails(
        createEntry({
          ...currentSnapshot,
          elapsed: Number.NaN,
          savedAt: 'not-a-timestamp',
          runtimeScenario: {
            ...currentRuntimeScenario,
            scenarioId: 'future-scenario',
          },
        }),
      ),
    ).toEqual([
      { label: 'Game time', value: 'Unknown' },
      { label: 'Scenario', value: 'Scenario ID: future-scenario' },
      { label: 'Created', value: 'Unknown' },
    ])
  })

  it('identifies current snapshots with blank or missing scenario IDs', () => {
    const blankScenarioDetails = getRecentSnapshotDetails(
      createEntry({
        ...currentSnapshot,
        runtimeScenario: {
          ...currentRuntimeScenario,
          scenarioId: '   ',
        },
      }),
    )
    const missingScenarioDetails = getRecentSnapshotDetails(
      createEntry({
        ...currentSnapshot,
        runtimeScenario: {
          ...currentRuntimeScenario,
          scenarioId: undefined as unknown as string,
        },
      }),
    )

    expect(blankScenarioDetails[1]).toEqual({
      label: 'Scenario',
      value: 'Scenario ID unavailable (version 3)',
    })
    expect(missingScenarioDetails[1]).toEqual({
      label: 'Scenario',
      value: 'Scenario ID unavailable (version 3)',
    })
  })

  it('includes optional import and export rows only when metadata exists', () => {
    expect(
      getRecentSnapshotDetails(
        createEntry(legacySnapshot, {
          savedAt: '2020-01-01T00:00:00.000Z',
        }),
      ),
    ).toEqual([
      { label: 'Game time', value: '15m' },
      { label: 'Scenario', value: 'Legacy snapshot (version 1)' },
      { label: 'Created', value: 'Jul 27, 2026, 12:34 PM' },
    ])

    expect(
      getRecentSnapshotDetails(
        createEntry(currentSnapshot, {
          importedAt: '2026-07-27T13:00:00',
          lastExportedAt: '2026-07-27T14:00:00',
        }),
      ),
    ).toEqual([
      { label: 'Game time', value: '01h30m' },
      { label: 'Scenario', value: 'Reach the Moon (reach-moon)' },
      { label: 'Created', value: 'Jul 27, 2026, 12:34 PM' },
      { label: 'Imported', value: 'Jul 27, 2026, 1:00 PM' },
      { label: 'Last exported', value: 'Jul 27, 2026, 2:00 PM' },
    ])
  })
})
