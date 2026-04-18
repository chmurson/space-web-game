import { describe, expect, it } from 'vitest'

import { createDefaultScenarioDirectives } from '../scenario/scenarioDirectiveTypes'
import {
  createRuntimeScenarioCheckpoint,
  createRuntimeScenarioSession,
} from '../scenario/scenarioSession'
import type { AppRuntimeState } from './appRuntimeState'
import { restoreRuntimeFromScenarioCheckpoint } from './scenarioRecovery'

const createRuntime = (): AppRuntimeState => ({
  activeScenarioDescription: 'Tutorial description',
  activeScenarioTitle: 'Tutorial',
  assistMode: 'capture',
  assistTargetIndex: 1,
  coastPredictionHorizonHours: 24,
  crashedBodyName: 'Earth',
  debugModeEnabled: false,
  debugNoGravityEnabled: false,
  debugSnapshotStatus: '',
  fpsIndicatorEnabled: false,
  performanceDebugEnabled: false,
  resetScenario: {
    description: 'Tutorial description',
    scenarioId: 'tutorial',
    title: 'Tutorial',
  },
  scenarioDirectives: createDefaultScenarioDirectives(),
  scenarioSession: createRuntimeScenarioSession('tutorial', {
    phase: 'reach-moon',
  }),
  spacecraftLabelIntroUntil: 0,
  targetHeadingSelectionEpoch: 0,
  uiEffectEpoch: 0,
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
})

describe('restoreRuntimeFromScenarioCheckpoint', () => {
  it('restores runtime state from the active scenario checkpoint', () => {
    const runtime = createRuntime()
    runtime.scenarioSession.checkpoint = createRuntimeScenarioCheckpoint({
      assistMode: 'off',
      assistTargetIndex: 0,
      coastPredictionHorizonHours: 12,
      targetHeading: null,
      viewportSize: 320,
      world: {
        elapsed: 42,
        bodies: [
          {
            id: 'earth',
            name: 'Earth',
            mass: 10,
            radius: 20,
            position: { x: 1, y: 2 },
            velocity: { x: 3, y: 4 },
            color: '#2f80ed',
          },
        ],
        controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
        spacecraft: {
          position: { x: 5, y: 6 },
          velocity: { x: 7, y: 8 },
          heading: 0.2,
          fuel: 9,
          fuelUsed: 10,
          dryMass: 11,
          fuelMass: 12,
          fuelCapacity: 13,
        },
      },
    })

    expect(restoreRuntimeFromScenarioCheckpoint(runtime)).toBe(true)
    expect(runtime.assistMode).toBe('off')
    expect(runtime.assistTargetIndex).toBe(0)
    expect(runtime.coastPredictionHorizonHours).toBe(12)
    expect(runtime.targetHeading).toBeNull()
    expect(runtime.timeWarpIndex).toBe(0)
    expect(runtime.viewportSize).toBe(320)
    expect(runtime.state.elapsed).toBe(42)
    expect(runtime.state.spacecraft.position).toEqual({ x: 5, y: 6 })
    expect(runtime.state).not.toBe(runtime.scenarioSession.checkpoint.world)
  })

  it('returns false when no checkpoint exists', () => {
    const runtime = createRuntime()
    runtime.scenarioSession.checkpoint = null

    expect(restoreRuntimeFromScenarioCheckpoint(runtime)).toBe(false)
  })
})
