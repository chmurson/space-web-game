import { describe, expect, it } from 'vitest'

import type {
  DebugScenarioSnapshot,
  DebugScenarioSnapshotEntry,
} from '@/debugScenarioSnapshot'
import {
  formatRecentSnapshotGameTime,
  formatRecentSnapshotScenario,
  formatRecentSnapshotTimestamp,
  getRecentSnapshotDetails,
} from '@/ui/components/recentSnapshotFormatting'

const legacySnapshot: DebugScenarioSnapshot = {
  version: 1,
  savedAt: '2026-07-27T12:00:00.000Z',
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
    expect(formatRecentSnapshotGameTime(currentSnapshot.elapsed)).toBe('01h30m')
    expect(formatRecentSnapshotTimestamp('2026-07-27T12:34:00')).toBe(
      'Jul 27, 2026, 12:34 PM',
    )
    expect(formatRecentSnapshotScenario(currentSnapshot)).toBe(
      'Reach the Moon (reach-moon)',
    )
  })

  it('uses a useful fallback for legacy and unknown scenarios', () => {
    expect(formatRecentSnapshotScenario(legacySnapshot)).toBe(
      'Legacy snapshot (version 1)',
    )
    expect(
      formatRecentSnapshotScenario({
        ...currentSnapshot,
        runtimeScenario: {
          ...currentRuntimeScenario,
          scenarioId: 'future-scenario',
        },
      }),
    ).toBe('Scenario ID: future-scenario')
    expect(formatRecentSnapshotGameTime(Number.NaN)).toBe('Unknown')
    expect(formatRecentSnapshotTimestamp('not-a-timestamp')).toBe('Unknown')
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
      {
        label: 'Created',
        value: formatRecentSnapshotTimestamp(legacySnapshot.savedAt),
      },
    ])

    expect(
      getRecentSnapshotDetails(
        createEntry(currentSnapshot, {
          importedAt: '2026-07-27T13:00:00.000Z',
          lastExportedAt: '2026-07-27T14:00:00.000Z',
        }),
      ),
    ).toEqual([
      { label: 'Game time', value: '01h30m' },
      { label: 'Scenario', value: 'Reach the Moon (reach-moon)' },
      {
        label: 'Created',
        value: formatRecentSnapshotTimestamp(currentSnapshot.savedAt),
      },
      {
        label: 'Imported',
        value: formatRecentSnapshotTimestamp('2026-07-27T13:00:00.000Z'),
      },
      {
        label: 'Last exported',
        value: formatRecentSnapshotTimestamp('2026-07-27T14:00:00.000Z'),
      },
    ])
  })
})
