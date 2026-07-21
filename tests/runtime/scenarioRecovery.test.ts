import { describe, expect, it } from 'vitest'
import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import { createRuntimeCheckpointRestoreTransition } from '@/runtime/scenarioRecovery'
import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import {
  createRuntimeScenarioCheckpoint,
  createRuntimeScenarioSession,
} from '@/scenario/scenarioSession'

const createRuntime = (): AppRuntimeState => ({
  simulation: {
    assistMode: 'capture',
    assistTargetIndex: 1,
    assistTargetSelectionMode: 'auto',
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
    targetHeadingTurn: null,
    timeWarpIndex: 4,
    viewportSize: 600,
  },
  scenario: {
    directives: createDefaultScenarioDirectives(),
    metadata: {
      description: 'Tutorial description',
      title: 'Tutorial',
    },
    session: createRuntimeScenarioSession('tutorial', {
      phase: 'reach-moon',
    }),
  },
  ui: {
    camera: {
      follow: 'spacecraft',
      panOffset: { x: 0, y: 0 },
      view: 'locked',
    },
    spacecraftLabelIntroUntil: 0,
    targetHeadingSelectionEpoch: 0,
    touchThrustControl: {
      engaged: false,
      interactive: false,
      revealed: false,
      visible: false,
    },
    uiEffectEpoch: 0,
  },
  debug: {
    debugModeEnabled: false,
    debugNoGravityEnabled: false,
    debugSnapshotStatus: '',
    fpsIndicatorEnabled: false,
  },
})

describe('createRuntimeCheckpointRestoreTransition', () => {
  it('creates a checkpoint restore transition from the active scenario checkpoint', () => {
    const runtime = createRuntime()
    runtime.scenario.session.checkpoint = createRuntimeScenarioCheckpoint({
      assistMode: 'off',
      assistTargetIndex: 0,
      cameraFollow: 'target',
      cameraPanOffset: { x: 12, y: 24 },
      cameraView: 'free',
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

    const transition = createRuntimeCheckpointRestoreTransition(runtime)

    expect(transition).not.toBeNull()
    expect(transition).toMatchObject({
      assistMode: 'off',
      assistTargetIndex: 0,
      cameraFollow: 'target',
      cameraPanOffset: { x: 12, y: 24 },
      cameraView: 'free',
      coastPredictionHorizonHours: 12,
      targetHeading: null,
      timeWarpIndex: 0,
      viewportSize: 320,
    })
    expect(transition?.state.elapsed).toBe(42)
    expect(transition?.state.spacecraft.position).toEqual({ x: 5, y: 6 })
    expect(transition?.state).not.toBe(
      runtime.scenario.session.checkpoint?.world,
    )
  })

  it('migrates legacy unlocked absolute camera positions to relative offsets', () => {
    const runtime = createRuntime()
    const checkpoint = createRuntimeScenarioCheckpoint({
      assistMode: 'off',
      assistTargetIndex: 0,
      coastPredictionHorizonHours: 12,
      targetHeading: null,
      viewportSize: 320,
      world: runtime.simulation.state,
    })
    runtime.scenario.session.checkpoint = {
      ...checkpoint,
      cameraMode: 'unlocked',
      cameraPanOffset: { x: 65, y: 82 },
    }

    expect(createRuntimeCheckpointRestoreTransition(runtime)).toMatchObject({
      cameraFollow: 'spacecraft',
      cameraPanOffset: { x: 15, y: 22 },
      cameraView: 'free',
    })
  })

  it('returns null when no checkpoint exists', () => {
    const runtime = createRuntime()
    runtime.scenario.session.checkpoint = null

    expect(createRuntimeCheckpointRestoreTransition(runtime)).toBeNull()
  })
})
