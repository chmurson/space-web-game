import { describe, expect, it } from 'vitest'

import type { AppConfigContext } from '@/app/createAppConfigContext'
import { createInitialAppRuntimeState } from '@/app/createInitialAppRuntimeState'

const createConfig = (
  overrides: Partial<AppConfigContext> = {},
): AppConfigContext => ({
  initialAppMode: 'game',
  requestedEngine: '',
  physicsEngine: { name: 'test-engine', step: (() => undefined) as never },
  requestedScenarioId: 'tutorial',
  userSettings: {
    debugModeEnabled: false,
    touchBurnControlSide: 'right',
    touchTargetControlSide: 'left',
    touchTrajectoryControlSide: 'left',
    touchWarpControlSide: 'right',
  },
  controls: {
    timeWarps: [1, 10, 30, 60, 300, 1800, 3600, 7200, 18000],
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
    timeWarps: [1, 10, 30, 60, 300, 1800, 3600, 7200, 18000],
  },
  ...overrides,
})

describe('createInitialAppRuntimeState', () => {
  it('boots the menu background scenario in menu mode', () => {
    const runtime = createInitialAppRuntimeState(
      createConfig({
        initialAppMode: 'menu',
        requestedScenarioId: 'tutorial',
      }),
    )

    expect(runtime.scenario.session.scenarioId).toBe('menu-background')
    expect(runtime.scenario.metadata.title).toBe('Menu background')
    expect(runtime.ui.spacecraftLabelIntroUntil).toBe(Number.POSITIVE_INFINITY)
    expect(runtime.simulation.timeWarpIndex).toBe(4)
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
})
