import { describe, expect, it } from 'vitest'

import {
  EARTH_MOON_VIEWPORT_SIZE,
  EARTH_VIEWPORT_SIZE,
} from '../domain/viewportPresets'
import { createDefaultScenarioDirectives } from '../scenario/scenarioDirectiveTypes'
import { createRuntimeScenarioSession } from '../scenario/scenarioSession'
import type { AppRuntimeState } from './appRuntimeState'
import {
  applyCheckpointRestoreTransition,
  applyScenarioLoadTransition,
} from './runtimeStateTransitions'

const globalScenarioDirectiveLimits = {
  defaultViewportSize: 520,
  maxCoastPredictionHorizonHours: 48,
  maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
  minViewportSize: EARTH_VIEWPORT_SIZE,
  timeWarps: [1, 10, 50, 100, 500, 2000],
}

const createRuntime = (): AppRuntimeState => ({
  simulation: {
    assistMode: 'capture',
    assistTargetIndex: 1,
    coastPredictionHorizonHours: 24,
    crashedBodyName: 'Earth',
    state: {
      elapsed: 100,
      bodies: [
        {
          id: 'earth',
          name: 'Earth',
          mass: 1,
          radius: 1,
          position: { x: 10, y: 20 },
          velocity: { x: 30, y: 40 },
          color: '#2f80ed',
        },
        {
          id: 'moon',
          name: 'Moon',
          mass: 1,
          radius: 1,
          position: { x: 50, y: 60 },
          velocity: { x: 70, y: 80 },
          color: '#9aa0a6',
        },
      ],
      controls: { main: 1, reverse: 0, strafe: 0, turn: 1 },
      spacecraft: {
        position: { x: 50, y: 60 },
        velocity: { x: 70, y: 80 },
        heading: 0.4,
        fuel: 1,
        fuelUsed: 2,
        dryMass: 3,
        fuelMass: 4,
        fuelCapacity: 5,
      },
    },
    targetHeading: 1,
    timeWarpIndex: 4,
    viewportSize: 600,
  },
  scenario: {
    activeDescription: 'Tutorial description',
    activeTitle: 'Tutorial',
    directives: createDefaultScenarioDirectives(),
    session: createRuntimeScenarioSession('tutorial', {
      phase: 'reach-moon',
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

describe('runtimeStateTransitions', () => {
  it('applies scenario loads through one runtime-owned path', () => {
    const runtime = createRuntime()
    let clearTransientCalls = 0

    applyScenarioLoadTransition(
      runtime,
      {
        coastPredictionHorizonHours: 2,
        scenario: {
          activeDescription: 'Menu background description',
          activeTitle: 'Menu background',
          session: createRuntimeScenarioSession('menu-background', {
            cameraFollowBodyId: 'earth',
            cameraFollowOffsetX: 4_000_000,
            cameraFollowOffsetY: 4_000_000,
            hiddenBodyIds: ['moon'],
          }),
        },
        state: {
          elapsed: 0,
          bodies: runtime.simulation.state.bodies,
          controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
          spacecraft: runtime.simulation.state.spacecraft,
        },
        viewportSize: EARTH_VIEWPORT_SIZE,
      },
      {
        clearTransientScenarioState: () => {
          clearTransientCalls += 1
          runtime.simulation.targetHeading = null
          runtime.simulation.assistMode = 'off'
          runtime.simulation.crashedBodyName = null
        },
        globalScenarioDirectiveLimits,
      },
    )

    expect(clearTransientCalls).toBe(1)
    expect(runtime.scenario.activeTitle).toBe('Menu background')
    expect(runtime.scenario.activeDescription).toBe(
      'Menu background description',
    )
    expect(runtime.scenario.session.scenarioId).toBe('menu-background')
    expect(runtime.ui.uiEffectEpoch).toBe(1)
    expect(runtime.simulation.assistMode).toBe('off')
    expect(runtime.simulation.targetHeading).toBeNull()
    expect(runtime.scenario.directives.cameraFollowBodyId).toBe('earth')
    expect(runtime.scenario.directives.hiddenBodyIds).toEqual(['moon'])
  })

  it('applies checkpoint restores and re-syncs directives centrally', () => {
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

    const restored = applyCheckpointRestoreTransition(
      runtime,
      {
        assistMode: 'capture',
        assistTargetIndex: 0,
        coastPredictionHorizonHours: 12,
        state: {
          elapsed: 42,
          bodies: runtime.simulation.state.bodies,
          controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
          spacecraft: runtime.simulation.state.spacecraft,
        },
        targetHeading: 0.3,
        timeWarpIndex: 0,
        viewportSize: 320,
      },
      {
        clearTransientScenarioState: () => {
          runtime.simulation.targetHeading = null
          runtime.simulation.assistMode = 'off'
          runtime.simulation.crashedBodyName = null
        },
        globalScenarioDirectiveLimits,
      },
    )

    expect(restored).toBe(true)
    expect(runtime.simulation.state.elapsed).toBe(42)
    expect(runtime.simulation.viewportSize).toBe(EARTH_VIEWPORT_SIZE)
    expect(runtime.simulation.coastPredictionHorizonHours).toBe(2)
    expect(runtime.simulation.assistMode).toBe('off')
    expect(runtime.simulation.targetHeading).toBeNull()
    expect(runtime.scenario.directives.hiddenUIElements).toEqual(
      new Set(['scenarioInfoButton', 'timeWarpPill', 'trajectory']),
    )
  })
})
