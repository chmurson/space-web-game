import { describe, expect, it } from 'vitest'

import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import { createRuntimeScenarioSession } from '@/scenario/scenarioSession'
import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import { createGameQueries } from '@/runtime/gameQueries'

const createBody = (
  overrides: Partial<
    AppRuntimeState['simulation']['state']['bodies'][number]
  > = {},
) => ({
  id: 'body',
  name: 'Body',
  mass: 1,
  radius: 1,
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  color: '#fff',
  ...overrides,
})

const createRuntime = (
  bodies: AppRuntimeState['simulation']['state']['bodies'],
  coastPredictionHorizonHours: number,
): AppRuntimeState => ({
  simulation: {
    assistMode: 'off',
    assistTargetIndex: 0,
    coastPredictionHorizonHours,
    crashedBodyName: null,
    state: {
      elapsed: 0,
      bodies,
      controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
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
    targetHeading: null,
    timeWarpIndex: 0,
    viewportSize: 100,
  },
  scenario: {
    directives: createDefaultScenarioDirectives(),
    metadata: {
      description: 'Test scenario description',
      title: 'Test scenario',
    },
    session: createRuntimeScenarioSession('test'),
  },
  ui: {
    spacecraftLabelIntroUntil: 0,
    targetHeadingSelectionEpoch: 0,
    touchThrustControl: {
      engaged: false,
      interactive: false,
      visible: false,
    },
    uiEffectEpoch: 0,
  },
  debug: {
    debugModeEnabled: false,
    debugNoGravityEnabled: false,
    debugSnapshotStatus: '',
    fpsIndicatorEnabled: false,
    performanceDebugEnabled: false,
  },
})

const createPredictedTrajectoryEnd = (x: number, y: number) => ({ x, y })
const createPredictedTrajectoryPoints = (...points: Array<[number, number]>) =>
  points.map(([x, y]) => ({ x, y }))

describe('createGameQueries', () => {
  it('selects the nearest body to the predicted trajectory midpoint when auto-selection is enabled', () => {
    const runtime = createRuntime(
      [
        createBody({
          id: 'earth',
          name: 'Earth',
          position: { x: 10_000_000, y: 0 },
        }),
        createBody({
          id: 'moon',
          name: 'Moon',
          position: { x: 4_000_000, y: 0 },
        }),
      ],
      2,
    )
    const queries = createGameQueries({
      autoSelectNearestSurface: true,
      autoSelectConfig: {
        switchRangeMultiplier: 2,
      },
      autopilotRotationRate: 0.1,
      getPredictedTrajectoryEnd: () =>
        createPredictedTrajectoryEnd(8_000_000, 0),
      getPredictedTrajectoryPoints: () =>
        createPredictedTrajectoryPoints([0, 0], [4_000_000, 0], [8_000_000, 0]),
      maxPredictionLoopRevolutions: 2,
      predictionSampling: {
        refreshInterval: 0.25,
        stepOptionsSeconds: [10, 60, 300],
        targetMaxSteps: 100,
      },
      runtime,
    })

    expect(queries.getAssistTarget().id).toBe('moon')
  })

  it('keeps the current auto target when another body is closer but not dominant enough', () => {
    const runtime = createRuntime(
      [
        createBody({ id: 'earth', name: 'Earth', position: { x: 100, y: 0 } }),
        createBody({ id: 'moon', name: 'Moon', position: { x: 260, y: 0 } }),
      ],
      2,
    )
    runtime.simulation.assistTargetIndex = 0

    const queries = createGameQueries({
      autoSelectNearestSurface: true,
      autoSelectConfig: {
        switchRangeMultiplier: 2,
      },
      autopilotRotationRate: 0.1,
      getPredictedTrajectoryEnd: () =>
        runtime.simulation.state.spacecraft.position.x >= 140
          ? createPredictedTrajectoryEnd(320, 0)
          : createPredictedTrajectoryEnd(40, 0),
      getPredictedTrajectoryPoints: () =>
        runtime.simulation.state.spacecraft.position.x >= 140
          ? createPredictedTrajectoryPoints([160, 0], [240, 60], [320, 0])
          : createPredictedTrajectoryPoints([0, 0], [20, 40], [40, 0]),
      maxPredictionLoopRevolutions: 2,
      predictionSampling: {
        refreshInterval: 0.25,
        stepOptionsSeconds: [10, 60, 300],
        targetMaxSteps: 100,
      },
      runtime,
    })

    expect(queries.getAssistTarget().id).toBe('earth')

    runtime.simulation.state.spacecraft.position = { x: 120, y: 0 }

    expect(queries.getAssistTarget().id).toBe('earth')

    runtime.simulation.state.spacecraft.position = { x: 160, y: 0 }

    expect(queries.getAssistTarget().id).toBe('moon')
  })

  it('wraps the selected assist target index when auto-discovery is disabled', () => {
    const runtime = createRuntime(
      [
        createBody({ id: 'earth', name: 'Earth' }),
        createBody({ id: 'moon', name: 'Moon' }),
        createBody({ id: 'mars', name: 'Mars' }),
      ],
      2,
    )
    runtime.simulation.assistTargetIndex = -1

    const queries = createGameQueries({
      autoSelectNearestSurface: false,
      autoSelectConfig: {
        switchRangeMultiplier: 2,
      },
      autopilotRotationRate: 0.1,
      getPredictedTrajectoryEnd: () => null,
      getPredictedTrajectoryPoints: () => [],
      maxPredictionLoopRevolutions: 2,
      predictionSampling: {
        refreshInterval: 0.25,
        stepOptionsSeconds: [10, 60, 300],
        targetMaxSteps: 100,
      },
      runtime,
    })

    expect(queries.getAssistTarget().id).toBe('mars')
  })

  it('derives prediction horizon seconds and step size from runtime horizon hours', () => {
    const runtime = createRuntime(
      [createBody({ id: 'earth', name: 'Earth' })],
      6,
    )
    const queries = createGameQueries({
      autoSelectNearestSurface: false,
      autoSelectConfig: {
        switchRangeMultiplier: 2,
      },
      autopilotRotationRate: 0.1,
      getPredictedTrajectoryEnd: () => null,
      getPredictedTrajectoryPoints: () => [],
      maxPredictionLoopRevolutions: 3,
      predictionSampling: {
        refreshInterval: 0.5,
        stepOptionsSeconds: [10, 60, 300, 1800],
        targetMaxSteps: 100,
      },
      runtime,
    })

    expect(queries.getCoastPredictionHorizonSeconds()).toBe(21_600)
    expect(queries.getPredictionConfig()).toEqual({
      horizonSeconds: 21_600,
      maxLoopRevolutions: 3,
      refreshInterval: 0.5,
      stepSeconds: 300,
    })
  })

  it('honors a scenario-forced assist target when present', () => {
    const runtime = createRuntime(
      [
        createBody({ id: 'earth', name: 'Earth' }),
        createBody({ id: 'moon', name: 'Moon' }),
      ],
      2,
    )
    runtime.simulation.assistTargetIndex = 0
    runtime.scenario.directives.forcedAssistTargetId = 'moon'

    const queries = createGameQueries({
      autoSelectNearestSurface: false,
      autoSelectConfig: {
        switchRangeMultiplier: 2,
      },
      autopilotRotationRate: 0.1,
      getPredictedTrajectoryEnd: () => null,
      getPredictedTrajectoryPoints: () => [],
      maxPredictionLoopRevolutions: 2,
      predictionSampling: {
        refreshInterval: 0.25,
        stepOptionsSeconds: [10, 60, 300],
        targetMaxSteps: 100,
      },
      runtime,
    })

    expect(queries.getAssistTarget().id).toBe('moon')
  })
})
