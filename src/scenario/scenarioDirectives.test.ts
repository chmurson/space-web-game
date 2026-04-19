import { describe, expect, it } from 'vitest'

import {
  EARTH_MOON_VIEWPORT_SIZE,
  EARTH_VIEWPORT_SIZE,
} from '../domain/viewportPresets'
import type { AppRuntimeState } from '../runtime/appRuntimeState'
import {
  applyScenarioRuntimeTransition,
  applyRuntimeScenarioDirectiveConstraints,
  getConstrainedTimeWarpIndex,
  resolveRuntimeScenarioDirectives,
  updateRuntimeScenario,
} from './scenarioDirectives'
import { createDefaultScenarioDirectives } from './scenarioDirectiveTypes'
import { getRuntimeScenarioDefinition } from './scenarioRegistry'
import { createRuntimeScenarioSession } from './scenarioSession'

const globalScenarioDirectiveLimits = {
  maxCoastPredictionHorizonHours: 48,
  defaultViewportSize: 520,
  maxViewportSize: 800,
  minViewportSize: EARTH_VIEWPORT_SIZE,
  timeWarps: [1, 10, 50, 100, 500, 2000],
}

const createRuntime = (): AppRuntimeState => ({
  simulation: {
    assistMode: 'off',
    assistTargetIndex: 0,
    coastPredictionHorizonHours: 24,
    crashedBodyName: null,
    state: {
      elapsed: 0,
      bodies: [],
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
    timeWarpIndex: 3,
    viewportSize: 900,
  },
  scenario: {
    activeDescription: 'Tutorial description',
    activeTitle: 'Tutorial',
    directives: createDefaultScenarioDirectives(),
    session: createRuntimeScenarioSession('tutorial', {
      forcedAssistTargetId: 'moon',
      hiddenBodyIds: ['moon'],
    }),
  },
  ui: {
    spacecraftLabelIntroUntil: 0,
    targetHeadingSelectionEpoch: 0,
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

describe('scenarioDirectives', () => {
  it('resolves generic forced target and hidden body directives from scenario state', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession('custom', {
      forcedAssistTargetId: 'moon',
      hiddenBodyIds: ['moon'],
    })

    const directives = resolveRuntimeScenarioDirectives(runtime, {
      maxCoastPredictionHorizonHours: 48,
      defaultViewportSize: 520,
      maxViewportSize: 800,
      minViewportSize: EARTH_VIEWPORT_SIZE,
      timeWarps: [1, 10, 100, 1000],
    })

    expect(directives.forcedAssistTargetId).toBe('moon')
    expect(directives.hiddenBodyIds).toEqual(['moon'])
  })

  it('merges earth-moon directive overrides with generic scenario state directives', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession('earth-moon', {
      forcedAssistTargetId: 'moon',
      hiddenBodyIds: ['earth'],
    })

    const directives = resolveRuntimeScenarioDirectives(runtime, {
      maxCoastPredictionHorizonHours: 48,
      defaultViewportSize: 520,
      maxViewportSize: 800,
      minViewportSize: EARTH_VIEWPORT_SIZE,
      timeWarps: [1, 10, 100, 1000],
    })

    expect(directives.forcedAssistTargetId).toBe('moon')
    expect(directives.hiddenBodyIds).toEqual(['earth'])
    expect(directives.maxViewportSize).toBe(EARTH_MOON_VIEWPORT_SIZE)
  })

  it('constrains runtime state to directive caps', () => {
    const runtime = createRuntime()
    runtime.scenario.directives = {
      ...createDefaultScenarioDirectives(),
      maxCoastPredictionHorizonHours: 12,
      maxTimeWarp: 100,
      maxViewportSize: 400,
      minViewportSize: 80,
    }

    applyRuntimeScenarioDirectiveConstraints(runtime, {
      maxCoastPredictionHorizonHours: 48,
      defaultViewportSize: 520,
      maxViewportSize: 800,
      minViewportSize: EARTH_VIEWPORT_SIZE,
      timeWarps: [1, 10, 100, 1000],
    })

    expect(runtime.simulation.coastPredictionHorizonHours).toBe(12)
    expect(runtime.simulation.timeWarpIndex).toBe(2)
    expect(runtime.simulation.viewportSize).toBe(400)
  })

  it('keeps time warp index within the configured max warp cap', () => {
    expect(getConstrainedTimeWarpIndex(3, [1, 10, 100, 1000], 100)).toBe(2)
    expect(getConstrainedTimeWarpIndex(1, [1, 10, 100, 1000], null)).toBe(1)
  })

  it('derives tutorial phase-1 directives from tutorial scenario state', () => {
    const runtime = createRuntime()
    runtime.scenario.session =
      getRuntimeScenarioDefinition('tutorial')?.createScenario()
        .scenarioSession ?? runtime.scenario.session

    const directives = resolveRuntimeScenarioDirectives(
      runtime,
      globalScenarioDirectiveLimits,
    )

    expect(directives).toEqual({
      cameraFollowBodyId: null,
      cameraFollowOffset: { x: 0, y: 0 },
      forcedAssistTargetId: 'earth',
      hiddenBodyIds: ['moon'],
      hiddenUIElements: new Set(),
      maxCoastPredictionHorizonHours: 2,
      maxTimeWarp: 500,
      maxViewportSize: EARTH_VIEWPORT_SIZE,
      minViewportSize: null,
    })
  })

  it('syncs directives without advancing when advancement is disabled', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession('tutorial', {
      phase: 'escape-earth',
      pendingPrompt: null,
      onboarding: {
        activeStepId: 'intro-thrust',
        completedStepIds: [],
        gateActive: true,
        progress: {
          accumulatedHeadingChangeRadians: 0,
          accumulatedMainThrustMs: 0,
          lastSampleHeading: runtime.simulation.state.spacecraft.heading,
          lastSampleAtMs: 1_000,
          stepStartHeading: runtime.simulation.state.spacecraft.heading,
          stepStartTargetHeadingSelectionEpoch: 0,
          stepStartTimeWarpMultiplier: 1,
        },
      },
    })

    updateRuntimeScenario(runtime, globalScenarioDirectiveLimits, {
      shouldAdvance: false,
    })

    expect(runtime.scenario.session.state).toMatchObject({
      phase: 'escape-earth',
      onboarding: {
        activeStepId: 'intro-thrust',
        gateActive: true,
      },
    })
    expect(runtime.scenario.directives.hiddenUIElements).toEqual(
      new Set(['scenarioInfoButton', 'timeWarpPill', 'trajectory']),
    )
  })

  it('applies returned transitions and syncs directives centrally', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession('tutorial', {
      phase: 'escape-earth',
      pendingPrompt: 'phase-one-intro',
    })

    const result =
      getRuntimeScenarioDefinition('tutorial')?.acknowledgePrompt?.(runtime) ??
      null

    expect(result).toMatchObject({
      acknowledged: true,
      transition: {
        nextState: {
          phase: 'escape-earth',
          pendingPrompt: null,
        },
      },
    })

    applyScenarioRuntimeTransition(
      runtime,
      globalScenarioDirectiveLimits,
      result?.transition,
    )

    expect(runtime.scenario.session.state).toMatchObject({
      phase: 'escape-earth',
      pendingPrompt: null,
      onboarding: {
        activeStepId: 'intro-thrust',
        gateActive: true,
      },
    })
    expect(runtime.scenario.directives.hiddenUIElements).toEqual(
      new Set(['scenarioInfoButton', 'timeWarpPill', 'trajectory']),
    )
  })

  it('advances tutorial state and syncs directives in one call', () => {
    const runtime = createRuntime()
    runtime.scenario.session = createRuntimeScenarioSession('tutorial', {
      phase: 'escape-earth',
      pendingPrompt: null,
      onboarding: {
        activeStepId: 'intro-thrust',
        completedStepIds: [],
        gateActive: true,
        progress: {
          accumulatedHeadingChangeRadians: 0,
          accumulatedMainThrustMs: 1_100,
          lastSampleHeading: runtime.simulation.state.spacecraft.heading,
          lastSampleAtMs: performance.now() - 1_100,
          stepStartHeading: runtime.simulation.state.spacecraft.heading,
          stepStartTargetHeadingSelectionEpoch: 0,
          stepStartTimeWarpMultiplier: 1,
        },
      },
    })
    runtime.simulation.state.controls.main = 1
    runtime.simulation.state.spacecraft.fuel = 1
    runtime.simulation.timeWarpIndex = 0

    updateRuntimeScenario(runtime, globalScenarioDirectiveLimits)

    expect(runtime.scenario.session.state).toMatchObject({
      phase: 'escape-earth',
      onboarding: {
        activeStepId: 'intro-keep-thrusting',
        gateActive: true,
      },
    })
    expect(runtime.scenario.directives.hiddenUIElements).toEqual(
      new Set(['scenarioInfoButton', 'timeWarpPill', 'trajectory']),
    )
  })
})
