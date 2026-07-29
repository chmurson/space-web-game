import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearRecentDebugScenarioSnapshotsForTests,
  createDebugScenarioSnapshotEntryName,
  createDebugScenarioSnapshotFilename,
  createScenarioFromSnapshot,
  createSnapshotFromState,
  downloadDebugScenarioSnapshot,
  getRecentDebugScenarioSnapshotLinks,
  getRecentDebugScenarioSnapshots,
  insertExportedDebugScenarioSnapshot,
  insertImportedDebugScenarioSnapshot,
  loadRecentDebugScenarioSnapshot,
  markRecentDebugScenarioSnapshotExported,
  parseDebugScenarioSnapshotJson,
  readDebugScenarioSnapshot,
  serializeDebugScenarioSnapshot,
  validateDebugScenarioSnapshot,
  writeDebugScenarioSnapshot,
} from '@/debugScenarioSnapshot'
import {
  createRuntimeScenarioCheckpoint,
  createRuntimeScenarioSession,
} from '@/scenario/scenarioSession'
import { idleControls } from '@/simulation/state'

const snapshotBase = {
  version: 3 as const,
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
  vi.useRealTimers()
  vi.stubGlobal('window', {
    localStorage: createStorage(),
  })
  clearRecentDebugScenarioSnapshotsForTests()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('portable debug scenario snapshots', () => {
  it('accepts the current snapshot version', () => {
    expect(validateDebugScenarioSnapshot(snapshotBase)).toEqual({
      ok: true,
      snapshot: snapshotBase,
    })
    expect(
      parseDebugScenarioSnapshotJson(JSON.stringify(snapshotBase)),
    ).toEqual({
      ok: true,
      snapshot: snapshotBase,
    })
  })

  it.each([1, 2] as const)('rejects legacy snapshot version %s', (version) => {
    const legacySnapshot = { ...snapshotBase, version }

    expect(validateDebugScenarioSnapshot(legacySnapshot)).toEqual({
      ok: false,
      error: 'unsupported-version',
      message: `Debug snapshot version ${version} is not supported.`,
    })
    expect(
      parseDebugScenarioSnapshotJson(JSON.stringify(legacySnapshot)),
    ).toEqual({
      ok: false,
      error: 'unsupported-version',
      message: `Debug snapshot version ${version} is not supported.`,
    })
  })

  it('distinguishes invalid JSON, unsupported versions, and malformed data', () => {
    expect(parseDebugScenarioSnapshotJson('{ nope')).toEqual({
      ok: false,
      error: 'invalid-json',
      message: 'Snapshot file is not valid JSON.',
    })
    expect(
      parseDebugScenarioSnapshotJson(
        JSON.stringify({ ...snapshotBase, version: 99 }),
      ),
    ).toEqual({
      ok: false,
      error: 'unsupported-version',
      message: 'Debug snapshot version 99 is not supported.',
    })
    expect(
      parseDebugScenarioSnapshotJson(
        JSON.stringify({ ...snapshotBase, spacecraft: null }),
      ),
    ).toEqual({
      ok: false,
      error: 'malformed-snapshot',
      message: 'Snapshot data must include a valid spacecraft.',
    })
  })

  it.each([
    [
      'assistTargetIndex',
      { assistTargetIndex: 1.5 },
      'Snapshot data must include a valid assistTargetIndex when present.',
    ],
    [
      'assistTargetSelectionMode',
      { assistTargetSelectionMode: 'automatic' },
      'Snapshot data must include a valid assistTargetSelectionMode when present.',
    ],
    [
      'cameraFollow',
      { cameraFollow: 'earth' },
      'Snapshot data must include a valid cameraFollow when present.',
    ],
    [
      'cameraPanOffset',
      { cameraPanOffset: { x: 1 } },
      'Snapshot data must include a valid cameraPanOffset when present.',
    ],
    [
      'cameraView',
      { cameraView: 'centered' },
      'Snapshot data must include a valid cameraView when present.',
    ],
    [
      'viewportSize',
      { viewportSize: 'wide' },
      'Snapshot data must include a finite viewportSize when present.',
    ],
    [
      'coastPredictionHorizonHours',
      { coastPredictionHorizonHours: Number.NaN },
      'Snapshot data must include finite coastPredictionHorizonHours when present.',
    ],
    [
      'runtimeScenario',
      { runtimeScenario: 3 },
      'Snapshot data must include a valid runtimeScenario when present.',
    ],
    [
      'userInfoPins',
      { userInfoPins: [{ kind: 'body' }] },
      'Snapshot data must include valid userInfoPins when present.',
    ],
  ])('rejects malformed optional %s data', (_field, override, message) => {
    expect(
      validateDebugScenarioSnapshot({ ...snapshotBase, ...override }),
    ).toEqual({
      ok: false,
      error: 'malformed-snapshot',
      message,
    })
  })

  it.each([
    'checkpoint',
    'completed',
    'promptUi',
    'scenarioId',
    'state',
  ])('rejects a runtime scenario missing required %s data', (field) => {
    const runtimeScenario: Record<string, unknown> = {
      ...createRuntimeScenarioSession('tutorial', {
        phase: 'escape-earth',
      }),
    }
    delete runtimeScenario[field]

    expect(
      validateDebugScenarioSnapshot({
        ...snapshotBase,
        runtimeScenario,
      }),
    ).toEqual({
      ok: false,
      error: 'malformed-snapshot',
      message:
        'Snapshot data must include a valid runtimeScenario when present.',
    })
  })

  it.each([
    {
      ...createRuntimeScenarioSession('tutorial'),
      promptUi: { activePromptId: 1, replayPromptId: null },
    },
    {
      ...createRuntimeScenarioSession('tutorial'),
      state: { phase: undefined },
    },
    {
      ...createRuntimeScenarioSession('tutorial'),
      state: new Date('2026-07-28T00:00:00.000Z'),
    },
    {
      ...createRuntimeScenarioSession('tutorial'),
      checkpoint: {},
    },
  ])('rejects malformed nested runtime scenario data', (runtimeScenario) => {
    expect(
      validateDebugScenarioSnapshot({
        ...snapshotBase,
        runtimeScenario,
      }),
    ).toEqual({
      ok: false,
      error: 'malformed-snapshot',
      message:
        'Snapshot data must include a valid runtimeScenario when present.',
    })
  })

  it('rejects cyclic runtime scenario state without throwing', () => {
    const state: Record<string, unknown> = {}
    state.self = state

    expect(
      validateDebugScenarioSnapshot({
        ...snapshotBase,
        runtimeScenario: {
          ...createRuntimeScenarioSession('tutorial'),
          state,
        },
      }),
    ).toEqual({
      ok: false,
      error: 'malformed-snapshot',
      message:
        'Snapshot data must include a valid runtimeScenario when present.',
    })
  })

  it('accepts a complete runtime scenario checkpoint', () => {
    const runtimeScenario = createRuntimeScenarioSession('tutorial', {
      phase: 'escape-earth',
    })
    runtimeScenario.checkpoint = createRuntimeScenarioCheckpoint({
      assistMode: 'off',
      assistTargetIndex: 0,
      coastPredictionHorizonHours: 12,
      targetHeading: null,
      targetHeadingTurn: null,
      viewportSize: snapshotBase.viewportSize,
      world: {
        elapsed: snapshotBase.elapsed,
        bodies: snapshotBase.bodies,
        controls: idleControls(),
        spacecraft: snapshotBase.spacecraft,
      },
    })
    const snapshot = { ...snapshotBase, runtimeScenario }

    expect(validateDebugScenarioSnapshot(snapshot)).toEqual({
      ok: true,
      snapshot,
    })
  })

  it('serializes only the canonical snapshot payload', () => {
    const snapshotWithTransportMetadata = {
      ...snapshotBase,
      importedAt: '2026-07-27T10:30:00.000Z',
      lastExportedAt: '2026-07-27T10:31:00.000Z',
    }
    const serialized = serializeDebugScenarioSnapshot(
      snapshotWithTransportMetadata,
    )

    expect(JSON.parse(serialized)).toEqual(snapshotBase)
    expect(serialized).not.toContain('importedAt')
    expect(serialized).not.toContain('lastExportedAt')
  })

  it('creates sanitized filenames with the game, scenario, and saved time', () => {
    const snapshot = {
      ...snapshotBase,
      version: 3 as const,
      runtimeScenario: createRuntimeScenarioSession(
        '../Tutorial: Réach / Moon',
      ),
    }

    expect(createDebugScenarioSnapshotFilename(snapshot)).toBe(
      'space-web-game-Tutorial-Reach-Moon-2026-04-10T10-00-00-000Z.json',
    )
    expect(createDebugScenarioSnapshotFilename(snapshotBase)).toBe(
      'space-web-game-2026-04-10T10-00-00-000Z.json',
    )
  })

  it('initiates a browser download and releases its temporary resources', async () => {
    const click = vi.fn()
    const remove = vi.fn()
    const downloadLink = {
      click,
      download: '',
      hidden: false,
      href: '',
      remove,
    }
    const append = vi.fn()
    const createElement = vi.fn(() => downloadLink)
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:debug-snapshot')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('document', {
      body: { append },
      createElement,
    })
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    })

    downloadDebugScenarioSnapshot(snapshotBase)

    expect(createElement).toHaveBeenCalledWith('a')
    expect(append).toHaveBeenCalledWith(downloadLink)
    expect(downloadLink).toMatchObject({
      download: 'space-web-game-2026-04-10T10-00-00-000Z.json',
      hidden: true,
      href: 'blob:debug-snapshot',
    })
    expect(click).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:debug-snapshot')

    const blob = createObjectURL.mock.calls[0]?.[0]
    expect(blob).toBeInstanceOf(Blob)
    expect(blob?.type).toBe('application/json')
    await expect(blob?.text()).resolves.toBe(
      serializeDebugScenarioSnapshot(snapshotBase),
    )
  })
})

describe('createScenarioFromSnapshot', () => {
  it('round-trips normalized player Info pins in version 3 snapshots', () => {
    const snapshot = createSnapshotFromState(
      {
        elapsed: snapshotBase.elapsed,
        bodies: snapshotBase.bodies,
        spacecraft: snapshotBase.spacecraft,
        controls: idleControls(),
      },
      {
        userInfoPins: [
          { bodyId: 'earth', kind: 'body' },
          { bodyId: 'earth', kind: 'body' },
          { bodyId: 'missing', kind: 'body' },
          { apsis: 'periapsis', kind: 'apsis' },
        ],
      },
    )
    const scenario = createScenarioFromSnapshot(snapshot)

    expect(snapshot).toMatchObject({
      userInfoPins: [
        { bodyId: 'earth', kind: 'body' },
        { apsis: 'periapsis', kind: 'apsis' },
      ],
      version: 3,
    })
    expect(scenario.userInfoPins).toEqual(snapshot.userInfoPins)
  })

  it('prefers explicit horizon hours from the snapshot', () => {
    const scenario = createScenarioFromSnapshot({
      ...snapshotBase,
      coastPredictionHorizonHours: 12,
    })

    expect(scenario.coastPredictionHorizonHours).toBe(12)
    expect(scenario.viewportSize).toBe(320)
    expect(scenario.elapsed).toBe(42)
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

  it('uses a version 3 fallback session when runtime scenario data is absent', () => {
    const scenario = createScenarioFromSnapshot(snapshotBase)

    expect(scenario.scenarioSession?.scenarioId).toBe(
      'debug-snapshot-without-runtime-scenario',
    )
  })

  it('preserves scenario session metadata for current snapshots', () => {
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
    expect((snapshot.runtimeScenario?.state as { phase: string }).phase).toBe(
      'escape-earth',
    )
  })

  it('preserves assist target selection state for current snapshots', () => {
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

  it('preserves Follow and relative pan offset in version 3 snapshots', () => {
    const snapshot = createSnapshotFromState(
      {
        elapsed: snapshotBase.elapsed,
        bodies: snapshotBase.bodies,
        spacecraft: snapshotBase.spacecraft,
        controls: idleControls(),
      },
      {
        cameraFollow: 'target',
        cameraPanOffset: { x: 12, y: -24 },
      },
    )
    const scenario = createScenarioFromSnapshot(snapshot)

    expect(snapshot).toMatchObject({
      cameraFollow: 'target',
      cameraPanOffset: { x: 12, y: -24 },
      version: 3,
    })
    expect(scenario).toMatchObject({
      cameraFollow: 'target',
      cameraPanOffset: { x: 12, y: -24 },
    })
    expect(scenario.cameraPanOffset).not.toBe(
      'cameraPanOffset' in snapshot ? snapshot.cameraPanOffset : undefined,
    )
  })

  it('recenters legacy locked version 3 snapshots', () => {
    const snapshot = {
      ...snapshotBase,
      cameraFollow: 'target' as const,
      cameraPanOffset: { x: 12, y: -24 },
      cameraView: 'locked' as const,
      version: 3 as const,
    }

    expect(createScenarioFromSnapshot(snapshot)).toMatchObject({
      cameraFollow: 'target',
      cameraPanOffset: { x: 0, y: 0 },
    })
  })
})

describe('recent debug scenario snapshots', () => {
  it('rejects legacy versions in active and recent stored snapshots', () => {
    window.localStorage.setItem(
      'space-web-game.debugScenarioSnapshot.v1',
      JSON.stringify({ ...snapshotBase, version: 2 }),
    )
    window.localStorage.setItem(
      'space-web-game.recentDebugScenarioSnapshots.v1',
      JSON.stringify([
        {
          id: 'legacy-recent-entry',
          name: 'Legacy recent entry',
          savedAt: snapshotBase.savedAt,
          snapshot: { ...snapshotBase, version: 1 },
        },
      ]),
    )

    expect(readDebugScenarioSnapshot()).toBeNull()
    expect(getRecentDebugScenarioSnapshots()).toEqual([])
  })

  it('loads stored entries created before transport metadata was added', () => {
    window.localStorage.setItem(
      'space-web-game.recentDebugScenarioSnapshots.v1',
      JSON.stringify([
        {
          id: 'legacy-recent-entry',
          name: 'Legacy recent entry',
          savedAt: snapshotBase.savedAt,
          snapshot: snapshotBase,
        },
      ]),
    )

    const [entry] = getRecentDebugScenarioSnapshots()

    expect(entry).toMatchObject({
      id: 'legacy-recent-entry',
      name: 'Legacy recent entry',
      snapshot: snapshotBase,
    })
    expect(entry).not.toHaveProperty('importedAt')
    expect(entry).not.toHaveProperty('lastExportedAt')
  })

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

  it('inserts imported snapshots newest first with local metadata', () => {
    writeDebugScenarioSnapshot({
      ...snapshotBase,
      savedAt: '2026-01-01T00:00:00.000Z',
      elapsed: 1,
    })
    vi.useFakeTimers()
    vi.setSystemTime('2026-07-27T10:30:00.000Z')

    const importedSnapshot = {
      ...snapshotBase,
      savedAt: '2026-01-01T00:00:01.000Z',
      elapsed: 2,
    }
    const entry = insertImportedDebugScenarioSnapshot(importedSnapshot)

    expect(entry).toMatchObject({
      importedAt: '2026-07-27T10:30:00.000Z',
      snapshot: importedSnapshot,
    })
    expect(entry).not.toHaveProperty('lastExportedAt')
    expect(entry?.snapshot).not.toHaveProperty('importedAt')
    expect(getRecentDebugScenarioSnapshots()[0]).toEqual(entry)
    expect(readDebugScenarioSnapshot()?.elapsed).toBe(1)
    expect(loadRecentDebugScenarioSnapshot(entry?.id ?? '')).toBe(true)
    expect(readDebugScenarioSnapshot()?.elapsed).toBe(2)
    expect(readDebugScenarioSnapshot()).not.toHaveProperty('importedAt')
  })

  it('marks an existing entry exported without changing its identity or order', () => {
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
    const before = getRecentDebugScenarioSnapshots()
    vi.useFakeTimers()
    vi.setSystemTime('2026-07-27T10:31:00.000Z')

    expect(markRecentDebugScenarioSnapshotExported(before[1].id)).toBe(true)

    const after = getRecentDebugScenarioSnapshots()
    expect(after.map(({ id, name }) => ({ id, name }))).toEqual(
      before.map(({ id, name }) => ({ id, name })),
    )
    expect(after[0]).not.toHaveProperty('lastExportedAt')
    expect(after[1]).toMatchObject({
      id: before[1].id,
      lastExportedAt: '2026-07-27T10:31:00.000Z',
      name: before[1].name,
      snapshot: before[1].snapshot,
    })
  })

  it('inserts exported captures newest first and keeps unique IDs within capacity', () => {
    for (let index = 0; index < 10; index += 1) {
      writeDebugScenarioSnapshot({
        ...snapshotBase,
        savedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        elapsed: index,
      })
    }
    vi.useFakeTimers()
    vi.setSystemTime('2026-07-27T10:32:00.000Z')
    const duplicateTimestampSnapshot = {
      ...snapshotBase,
      savedAt: '2026-01-01T00:00:09.000Z',
      elapsed: 10,
    }

    const importedEntry = insertImportedDebugScenarioSnapshot(
      duplicateTimestampSnapshot,
    )
    const exportedEntry = insertExportedDebugScenarioSnapshot({
      ...duplicateTimestampSnapshot,
      elapsed: 11,
    })
    const recentSnapshots = getRecentDebugScenarioSnapshots()

    expect(importedEntry?.id).toBe('debug-snapshot-2026-01-01T00:00:09.000Z-2')
    expect(exportedEntry?.id).toBe('debug-snapshot-2026-01-01T00:00:09.000Z-3')
    expect(recentSnapshots).toHaveLength(10)
    expect(recentSnapshots[0]).toMatchObject({
      id: exportedEntry?.id,
      lastExportedAt: '2026-07-27T10:32:00.000Z',
      snapshot: { elapsed: 11 },
    })
    expect(recentSnapshots[0].snapshot).not.toHaveProperty('lastExportedAt')
    expect(recentSnapshots[1]).toMatchObject({
      id: importedEntry?.id,
      importedAt: '2026-07-27T10:32:00.000Z',
      snapshot: { elapsed: 10 },
    })
    expect(readDebugScenarioSnapshot()?.elapsed).toBe(9)
  })

  it('leaves recent entries intact when metadata mutations fail', () => {
    writeDebugScenarioSnapshot(snapshotBase)
    const before = getRecentDebugScenarioSnapshots()
    const setItem = vi
      .spyOn(window.localStorage, 'setItem')
      .mockImplementation(() => {
        throw new Error('Storage unavailable')
      })

    expect(
      insertImportedDebugScenarioSnapshot({
        ...snapshotBase,
        savedAt: '2026-04-10T10:00:01.000Z',
      }),
    ).toBeNull()
    expect(markRecentDebugScenarioSnapshotExported(before[0].id)).toBe(false)

    setItem.mockRestore()
    expect(getRecentDebugScenarioSnapshots()).toEqual(before)
  })

  it('does not write when export metadata targets a missing entry', () => {
    writeDebugScenarioSnapshot(snapshotBase)
    const setItem = vi.spyOn(window.localStorage, 'setItem')

    expect(markRecentDebugScenarioSnapshotExported('missing')).toBe(false)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('does not overwrite recent entries when storage reads fail', () => {
    writeDebugScenarioSnapshot(snapshotBase)
    const before = getRecentDebugScenarioSnapshots()
    const getItem = vi
      .spyOn(window.localStorage, 'getItem')
      .mockImplementationOnce(() => {
        throw new Error('Storage unavailable')
      })

    expect(
      insertExportedDebugScenarioSnapshot({
        ...snapshotBase,
        savedAt: '2026-04-10T10:00:01.000Z',
      }),
    ).toBeNull()

    getItem.mockRestore()
    expect(getRecentDebugScenarioSnapshots()).toEqual(before)
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

  it('uses a custom trimmed name and falls back to the generated suggestion', () => {
    writeDebugScenarioSnapshot(snapshotBase, '  Lunar approach  ')

    expect(getRecentDebugScenarioSnapshots()[0]?.name).toBe('Lunar approach')

    writeDebugScenarioSnapshot(
      {
        ...snapshotBase,
        savedAt: '2026-04-10T10:00:01.000Z',
        elapsed: 43,
      },
      '   ',
    )

    expect(getRecentDebugScenarioSnapshots()[0]?.name).toBe('Snapshot at 43s')
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

  it('creates exact-entry URLs without copying snapshot payloads', () => {
    writeDebugScenarioSnapshot(snapshotBase, 'Lunar approach')

    const [link] = getRecentDebugScenarioSnapshotLinks(
      'https://space.example/game?devtools=1&scenario=last-debug-snapshot#trail',
    )
    const url = new URL(link.url)

    expect(link).toMatchObject({
      id: 'debug-snapshot-2026-04-10T10:00:00.000Z',
      name: 'Lunar approach',
      savedAt: snapshotBase.savedAt,
    })
    expect(link).not.toHaveProperty('snapshot')
    expect(url.searchParams.get('devtools')).toBe('1')
    expect(url.searchParams.get('scenario')).toBe(link.id)
    expect(url.hash).toBe('#trail')
  })

  it('persists recent snapshots and falls back to the active legacy slot', () => {
    const savedValues: Record<string, string> = {}
    const originalSetItem = window.localStorage.setItem.bind(
      window.localStorage,
    )
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(
      (key, value) => {
        savedValues[key] = value
        originalSetItem(key, value)
      },
    )

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

    expect(recentSnapshots.map((entry) => entry.snapshot.elapsed)).toEqual([
      2, 1,
    ])
    expect(loadRecentDebugScenarioSnapshot(recentSnapshots[1].id)).toBe(true)
    expect(readDebugScenarioSnapshot()?.elapsed).toBe(1)
    expect(Object.keys(savedValues).sort()).toEqual([
      'space-web-game.debugScenarioSnapshot.v1',
      'space-web-game.recentDebugScenarioSnapshots.v1',
    ])
    expect(
      JSON.parse(savedValues['space-web-game.recentDebugScenarioSnapshots.v1']),
    ).toHaveLength(2)

    clearRecentDebugScenarioSnapshotsForTests()
    expect(getRecentDebugScenarioSnapshots()).toMatchObject([
      {
        name: 'Snapshot at 1s',
        snapshot: { elapsed: 1 },
      },
    ])
  })
})
