import { describe, expect, it } from 'vitest'

import type { AppConfigContext } from './createAppConfigContext'
import { createInitialAppRuntimeState } from './createInitialAppRuntimeState'

const createConfig = (
  overrides: Partial<AppConfigContext> = {},
): AppConfigContext => ({
  initialAppMode: 'game',
  requestedEngine: '',
  physicsEngine: { name: 'test-engine', step: (() => undefined) as never },
  requestedScenarioId: 'tutorial',
  userSettings: { debugModeEnabled: false },
  controls: {
    timeWarps: [1, 10, 100, 500],
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
    timeWarps: [1, 10, 100, 500],
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

    expect(runtime.resetScenario.scenarioId).toBe('menu-background')
    expect(runtime.scenarioSession.scenarioId).toBe('menu-background')
    expect(runtime.activeScenarioTitle).toBe('Menu background')
    expect(runtime.spacecraftLabelIntroUntil).toBe(Number.POSITIVE_INFINITY)
    expect(runtime.timeWarpIndex).toBe(3)
  })

  it('boots the requested scenario in game mode', () => {
    const runtime = createInitialAppRuntimeState(
      createConfig({
        initialAppMode: 'game',
        requestedScenarioId: 'tutorial',
      }),
    )

    expect(runtime.resetScenario.scenarioId).toBe('tutorial')
    expect(runtime.scenarioSession.scenarioId).toBe('tutorial')
    expect(runtime.activeScenarioTitle).toBe('Tutorial: Escape Earth')
  })
})
