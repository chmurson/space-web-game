import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getRecentDebugScenarioSnapshots,
  readDebugScenarioSnapshot,
  writeDebugScenarioSnapshot,
} from '@/debugScenarioSnapshot'
import { EARTH_VIEWPORT_SIZE } from '@/domain/viewportPresets'
import {
  createRequestedRuntimeScenario,
  createRuntimeScenarioState,
  createRuntimeScenarioStateFromId,
  type RuntimeScenarioOptions,
} from '@/scenario/runtimeScenario'

const options: RuntimeScenarioOptions = {
  defaultCoastPredictionHorizonHours: 1,
  defaultViewportSize: 200,
  maxCoastPredictionHorizonHours: 48,
  maxViewportSize: 800,
  minCoastPredictionHorizonHours: 0.5,
  minViewportSize: EARTH_VIEWPORT_SIZE,
}

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createRuntimeScenarioState', () => {
  it('clamps horizon and viewport to configured bounds', () => {
    const runtimeScenario = createRuntimeScenarioState(
      {
        id: 'test',
        name: 'Test',
        description: 'Test scenario',
        elapsed: 123,
        coastPredictionHorizonHours: 100,
        viewportSize: 10,
        bodies: [],
        spacecraft: {
          position: { x: 1, y: 2 },
          velocity: { x: 3, y: 4 },
          heading: 0.2,
          fuel: 10,
          fuelUsed: 1,
          dryMass: 2,
          fuelMass: 3,
          fuelCapacity: 4,
        },
      },
      options,
    )

    expect(runtimeScenario.coastPredictionHorizonHours).toBe(48)
    expect(runtimeScenario.cameraFollow).toBe('spacecraft')
    expect(runtimeScenario.cameraPanOffset).toEqual({ x: 0, y: 0 })
    expect(runtimeScenario.scenarioSession).toEqual({
      checkpoint: null,
      completed: false,
      promptUi: {
        activePromptId: null,
        replayPromptId: null,
      },
      scenarioId: 'test',
      state: null,
    })
    expect(runtimeScenario.viewportSize).toBe(EARTH_VIEWPORT_SIZE)
    expect(runtimeScenario.state.elapsed).toBe(123)
    expect(runtimeScenario.state.controls).toEqual({
      main: 0,
      reverse: 0,
      strafe: 0,
      turn: 0,
    })
  })

  it('falls back to default horizon and viewport when the scenario does not define them', () => {
    const runtimeScenario = createRuntimeScenarioState(
      {
        id: 'test',
        name: 'Test',
        description: 'Test scenario',
        bodies: [],
        spacecraft: {
          position: { x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
          heading: 0,
          fuel: 0,
          fuelUsed: 0,
          dryMass: 1,
          fuelMass: 0,
          fuelCapacity: 0,
        },
      },
      options,
    )

    expect(runtimeScenario.coastPredictionHorizonHours).toBe(1)
    expect(runtimeScenario.viewportSize).toBe(200)
    expect(runtimeScenario.state.elapsed).toBe(0)
  })

  it('uses scenario-defined starting Follow and pan offset when present', () => {
    const runtimeScenario = createRuntimeScenarioState(
      {
        id: 'test',
        name: 'Test',
        description: 'Test scenario',
        cameraFollow: 'target',
        cameraPanOffset: { x: 12, y: 24 },
        bodies: [],
        spacecraft: {
          position: { x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
          heading: 0,
          fuel: 0,
          fuelUsed: 0,
          dryMass: 1,
          fuelMass: 0,
          fuelCapacity: 0,
        },
      },
      options,
    )

    expect(runtimeScenario.cameraFollow).toBe('target')
    expect(runtimeScenario.cameraPanOffset).toEqual({ x: 12, y: 24 })
  })

  it('creates a Reach the Moon runtime scenario on the Earth-Moon world', () => {
    const scenario = createRequestedRuntimeScenario('reach-moon')

    expect(scenario.id).toBe('reach-moon')
    expect(scenario.name).toBe('Reach the Moon')
    expect(scenario.bodies.map((body) => body.id)).toEqual(['earth', 'moon'])
    expect(scenario.spacecraft.fuel).toBe(1)
    expect(scenario.spacecraft.fuelCapacity).toBe(32_000)

    const runtimeScenario = createRuntimeScenarioStateFromId(
      'reach-moon',
      options,
    )

    expect(runtimeScenario.scenarioSession.scenarioId).toBe('reach-moon')
    expect(runtimeScenario.scenarioSession.state).toEqual({
      phase: 'reach-moon',
    })
  })

  it('keeps finite fuel opt-in scoped to Reach the Moon', () => {
    expect(
      createRequestedRuntimeScenario('earth-moon').spacecraft.fuelCapacity,
    ).toBe(0)
    expect(
      createRequestedRuntimeScenario('tutorial').spacecraft.fuelCapacity,
    ).toBe(0)
    expect(
      createRequestedRuntimeScenario('reach-moon').spacecraft.fuelCapacity,
    ).toBeGreaterThan(0)
  })

  it('loads the last or an exact recent debug snapshot from a scenario URL id', () => {
    const createSnapshot = (savedAt: string, elapsed: number) => ({
      version: 1 as const,
      savedAt,
      elapsed,
      bodies: [],
      spacecraft: {
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        heading: 0,
        fuel: 0,
        fuelUsed: 0,
        dryMass: 1,
        fuelMass: 0,
        fuelCapacity: 0,
      },
    })
    writeDebugScenarioSnapshot(
      createSnapshot('2026-07-19T10:00:00.000Z', 1),
      'First',
    )
    writeDebugScenarioSnapshot(
      createSnapshot('2026-07-19T10:00:01.000Z', 2),
      'Second',
    )

    expect(createRequestedRuntimeScenario('last-debug-snapshot').elapsed).toBe(
      2,
    )
    expect(createRequestedRuntimeScenario('debug-snapshot').elapsed).toBe(2)

    const firstSnapshotId = getRecentDebugScenarioSnapshots()[1].id
    expect(createRequestedRuntimeScenario(firstSnapshotId).elapsed).toBe(1)
    expect(readDebugScenarioSnapshot()?.elapsed).toBe(1)
  })

  it('preserves provided scenario session metadata', () => {
    const runtimeScenario = createRuntimeScenarioState(
      {
        id: 'debug-snapshot',
        name: 'Debug snapshot',
        description: 'Debug snapshot',
        scenarioSession: {
          checkpoint: null,
          completed: false,
          promptUi: {
            activePromptId: null,
            replayPromptId: null,
          },
          scenarioId: 'tutorial',
          state: { phase: 'return-earth' },
        },
        bodies: [],
        spacecraft: {
          position: { x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
          heading: 0,
          fuel: 0,
          fuelUsed: 0,
          dryMass: 1,
          fuelMass: 0,
          fuelCapacity: 0,
        },
      },
      options,
    )

    expect(runtimeScenario.scenarioSession).toEqual({
      checkpoint: null,
      completed: false,
      promptUi: {
        activePromptId: null,
        replayPromptId: null,
      },
      scenarioId: 'tutorial',
      state: { phase: 'return-earth' },
    })
  })

  it('preserves scenario-defined assist target selection state', () => {
    const runtimeScenario = createRuntimeScenarioState(
      {
        id: 'debug-snapshot',
        name: 'Debug snapshot',
        description: 'Debug snapshot',
        assistTargetIndex: 5,
        assistTargetSelectionMode: 'manual',
        bodies: [
          {
            id: 'earth',
            name: 'Earth',
            mass: 1,
            radius: 1,
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            color: '#2f80ed',
          },
          {
            id: 'moon',
            name: 'Moon',
            mass: 1,
            radius: 1,
            position: { x: 1, y: 1 },
            velocity: { x: 0, y: 0 },
            color: '#9aa0a6',
          },
          {
            id: 'mars',
            name: 'Mars',
            mass: 1,
            radius: 1,
            position: { x: 2, y: 2 },
            velocity: { x: 0, y: 0 },
            color: '#c1440e',
          },
        ],
        spacecraft: {
          position: { x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
          heading: 0,
          fuel: 0,
          fuelUsed: 0,
          dryMass: 1,
          fuelMass: 0,
          fuelCapacity: 0,
        },
      },
      options,
    )

    expect(runtimeScenario.assistTargetIndex).toBe(2)
    expect(runtimeScenario.assistTargetSelectionMode).toBe('manual')
  })
})
