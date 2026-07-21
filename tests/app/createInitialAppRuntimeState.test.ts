import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { AppConfigContext } from '@/app/createAppConfigContext'
import { createInitialAppRuntimeState } from '@/app/createInitialAppRuntimeState'
import { requestedTimeWarps } from '../fixtures/requestedTimeWarps'

const debugSnapshotStorageKey = 'space-web-game.debugScenarioSnapshot.v1'

const createWindowWithStorage = (storedSnapshot?: unknown) => {
  const values = new Map<string, string>()
  if (storedSnapshot !== undefined) {
    values.set(debugSnapshotStorageKey, JSON.stringify(storedSnapshot))
  }

  return {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value)
      },
    },
  }
}

const createConfig = (
  overrides: Partial<AppConfigContext> = {},
): AppConfigContext => ({
  initialAppMode: 'game',
  requestedEngine: '',
  physicsEngine: { name: 'test-engine', step: (() => undefined) as never },
  requestedScenarioId: 'tutorial',
  featureFlags: {
    noHorizonLimit: false,
  },
  userSettings: {
    desktopEdgePanEnabled: false,
    desktopEdgePanSpeed: 'normal',
    debugModeEnabled: false,
    mobileManeuverStartByDrag: true,
    orbitPointDisplay: {
      altitudeVisible: true,
      centerDistanceVisible: false,
      labelsVisible: true,
      markersVisible: true,
      pointNameVisible: true,
    },
    touchBurnControlSide: 'right',
    touchTargetControlSide: 'left',
    touchTrajectoryControlSide: 'left',
    touchWarpControlSide: 'right',
  },
  controls: {
    timeWarps: requestedTimeWarps,
    autopilotRotationRate: 1,
  },
  assistTarget: {
    autoSelectNearestSurface: false,
    switchRangeMultiplier: 1,
  },
  trajectory: {
    defaultCoastPredictionHorizonHours: 4,
    minCoastPredictionHorizonHours: 1,
    maxCoastPredictionHorizonHours: 48,
    predictionSampling: {
      maxIntegrationStepSeconds: 10,
      refreshInterval: 0.25,
      stepOptionsSeconds: [10, 60, 300],
      targetMaxSteps: 100,
    },
    maxPredictionLoopRevolutions: 2,
    rendering: {
      dashPixels: 1,
      gapPixels: 1,
      replaceLineGeometryOnUpdate: false,
      endMarkerRadius: 1,
      endMarkerMinScreenRadius: 1,
    },
  },
  camera: {
    distance: 1,
    elevation: 1,
    defaultViewport: 520,
    minViewport: 104,
    maxViewport: 1200,
    spacecraftModelZoomThreshold: 2,
  },
  runtimeScenarioOptions: {
    defaultCoastPredictionHorizonHours: 4,
    defaultViewportSize: 520,
    maxCoastPredictionHorizonHours: 48,
    maxViewportSize: 1200,
    minCoastPredictionHorizonHours: 1,
    minViewportSize: 104,
  },
  globalScenarioDirectiveLimits: {
    defaultViewportSize: 520,
    maxCoastPredictionHorizonHours: 48,
    maxViewportSize: 1200,
    minViewportSize: 104,
    timeWarps: requestedTimeWarps,
  },
  ...overrides,
})

describe('createInitialAppRuntimeState', () => {
  const originalWindow = globalThis.window

  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindowWithStorage(),
    })
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  })

  it('boots the menu background scenario in menu mode', () => {
    const config = createConfig({
      initialAppMode: 'menu',
      requestedScenarioId: 'tutorial',
    })
    const runtime = createInitialAppRuntimeState(config)

    expect(runtime.scenario.session.scenarioId).toBe('menu-background')
    expect(runtime.scenario.metadata.title).toBe('Menu background')
    expect(runtime.scenario.orbitPointDisplay).toEqual({
      markersVisible: false,
    })
    expect(runtime.ui.spacecraftLabelIntroUntil).toBe(Number.POSITIVE_INFINITY)
    expect(config.controls.timeWarps[runtime.simulation.timeWarpIndex]).toBe(
      240,
    )
  })

  it('boots the menu at the nearest configured warp at or below the menu target', () => {
    const runtime = createInitialAppRuntimeState(
      createConfig({
        initialAppMode: 'menu',
        requestedScenarioId: 'tutorial',
        controls: {
          autopilotRotationRate: 1,
          timeWarps: [1, 10, 60, 600],
        },
      }),
    )

    expect(runtime.simulation.timeWarpIndex).toBe(2)
  })

  it('boots the requested scenario in game mode', () => {
    const runtime = createInitialAppRuntimeState(
      createConfig({
        initialAppMode: 'game',
        requestedScenarioId: 'tutorial',
      }),
    )

    expect(runtime.scenario.session.scenarioId).toBe('tutorial')
    expect(runtime.scenario.metadata.title).toBe('Tutorial: Escape Earth')
    expect(runtime.scenario.orbitPointDisplay).toBeUndefined()
    expect(runtime.info.userPins).toEqual([])
    expect(runtime.ui.camera.mode).toBe('centered')
    expect(runtime.ui.camera.panOffset).toEqual(
      runtime.simulation.state.spacecraft.position,
    )
  })

  it('starts manual target selection when auto target selection is disabled', () => {
    const runtime = createInitialAppRuntimeState(
      createConfig({
        assistTarget: {
          autoSelectNearestSurface: false,
          switchRangeMultiplier: 1,
        },
      }),
    )

    expect(runtime.simulation.assistTargetSelectionMode).toBe('manual')
  })

  it('starts automatic target selection when auto target selection is enabled', () => {
    const runtime = createInitialAppRuntimeState(
      createConfig({
        assistTarget: {
          autoSelectNearestSurface: true,
          switchRangeMultiplier: 1,
        },
      }),
    )

    expect(runtime.simulation.assistTargetSelectionMode).toBe('auto')
  })

  it('restores debug snapshot target selection and player Info pins on startup', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: createWindowWithStorage({
        version: 3,
        savedAt: '2026-06-27T10:00:00.000Z',
        assistTargetIndex: 2,
        assistTargetSelectionMode: 'manual',
        userInfoPins: [
          { bodyId: 'earth', kind: 'body' },
          { apsis: 'apoapsis', kind: 'apsis' },
        ],
        elapsed: 42,
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
      }),
    })

    const runtime = createInitialAppRuntimeState(
      createConfig({
        assistTarget: {
          autoSelectNearestSurface: true,
          switchRangeMultiplier: 1,
        },
        requestedScenarioId: 'last-debug-snapshot',
      }),
    )

    expect(runtime.simulation.assistTargetIndex).toBe(2)
    expect(runtime.simulation.assistTargetSelectionMode).toBe('manual')
    expect(runtime.info.userPins).toEqual([
      { bodyId: 'earth', kind: 'body' },
      { apsis: 'apoapsis', kind: 'apsis' },
    ])
  })
})
