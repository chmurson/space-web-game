import { describe, expect, it } from 'vitest'

import {
  EARTH_MOON_VIEWPORT_SIZE,
  EARTH_VIEWPORT_SIZE,
} from '../domain/viewportPresets'
import type { AppRuntimeState } from '../runtime/appRuntimeState'
import {
  applyRuntimeScenarioDirectiveConstraints,
  getConstrainedTimeWarpIndex,
  resolveRuntimeScenarioDirectives,
} from './scenarioDirectives'
import { createDefaultScenarioDirectives } from './scenarioDirectiveTypes'
import { getRuntimeScenarioDefinition } from './scenarioRegistry'
import { createRuntimeScenarioSession } from './scenarioSession'

const createRuntime = (): AppRuntimeState => ({
  assistMode: 'off',
  assistTargetIndex: 0,
  coastPredictionHorizonHours: 24,
  crashedBodyName: null,
  debugModeEnabled: false,
  debugNoGravityEnabled: false,
  debugSnapshotStatus: '',
  fpsIndicatorEnabled: false,
  performanceDebugEnabled: false,
  scenario: {
    activeDescription: 'Tutorial description',
    activeTitle: 'Tutorial',
    directives: createDefaultScenarioDirectives(),
    session: createRuntimeScenarioSession('tutorial', {
      forcedAssistTargetId: 'moon',
      hiddenBodyIds: ['moon'],
    }),
  },
  spacecraftLabelIntroUntil: 0,
  targetHeadingSelectionEpoch: 0,
  uiEffectEpoch: 0,
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

    expect(runtime.coastPredictionHorizonHours).toBe(12)
    expect(runtime.timeWarpIndex).toBe(2)
    expect(runtime.viewportSize).toBe(400)
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

    const directives = resolveRuntimeScenarioDirectives(runtime, {
      maxCoastPredictionHorizonHours: 48,
      defaultViewportSize: 520,
      maxViewportSize: 800,
      minViewportSize: EARTH_VIEWPORT_SIZE,
      timeWarps: [1, 10, 50, 100, 500, 2000],
    })

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
})
