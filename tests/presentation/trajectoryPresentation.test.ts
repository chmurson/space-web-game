import { afterEach, describe, expect, it } from 'vitest'

import type { TrajectoryPredictionEventMarker } from '@/prediction/trajectoryPrediction'
import { createTrajectoryPresentation } from '@/presentation/trajectoryPresentation'
import { updateCameraView } from '@/render/sceneUpdates'
import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import type { GameQueries } from '@/runtime/gameQueries'
import type { TrajectoryPredictionRuntime } from '@/runtime/trajectoryPredictionRuntime'
import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import { createGameScene } from '@/scene/createGameScene'
import { idleControls } from '@/simulation/state'
import type { Body, PhysicsEngine, SimulationState } from '@/simulation/types'

const globals = globalThis as unknown as {
  window?: { innerHeight: number; innerWidth: number }
}
const originalWindow = globals.window

const setWindowSize = (innerWidth: number, innerHeight: number) => {
  globals.window = { innerHeight, innerWidth }
}

const createTarget = (): Body => ({
  color: '#2f80ed',
  id: 'earth',
  mass: 0,
  name: 'Earth',
  position: { x: 0, y: 0 },
  radius: 1,
  velocity: { x: 0, y: 0 },
})

const createState = (target: Body): SimulationState => ({
  bodies: [target],
  controls: idleControls(),
  elapsed: 0,
  spacecraft: {
    dryMass: 1,
    fuel: 1,
    fuelCapacity: 1,
    fuelMass: 1,
    fuelUsed: 0,
    heading: 0,
    position: { x: 20, y: 0 },
    velocity: { x: 0, y: 0 },
  },
})

const createRuntime = (target: Body, viewportSize: number): AppRuntimeState =>
  ({
    debug: {
      debugModeEnabled: false,
      debugNoGravityEnabled: false,
      debugSnapshotStatus: '',
      fpsIndicatorEnabled: false,
    },
    scenario: {
      directives: createDefaultScenarioDirectives(),
      metadata: { description: '', title: '' },
      session: { id: 'test' },
    },
    simulation: {
      assistMode: 'off',
      assistTargetIndex: 0,
      assistTargetSelectionMode: 'manual',
      coastPredictionHorizonHours: 1,
      crashedBodyName: null,
      state: createState(target),
      targetHeading: null,
      targetHeadingTurn: null,
      timeWarpIndex: 0,
      viewportSize,
    },
    ui: {
      camera: { mode: 'centered', panOffset: { x: 0, y: 0 } },
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
  }) as unknown as AppRuntimeState

const createQueries = (target: Body): GameQueries =>
  ({
    getAssistTarget: () => target,
    getCoastPredictionHorizonSeconds: () => 3_600,
    getCircularizePlan: () => ({
      burnHeading: 0,
      deltaV: 0,
      desiredVelocityHeading: 0,
      distance: 0,
      radialSpeed: 0,
      tangentialSpeed: 0,
    }),
  }) as unknown as GameQueries

const physicsEngine: PhysicsEngine = {
  name: 'noop',
  step: (state) => state,
}

const createPredictionRuntime = (
  targetId: string,
  eventMarkers: TrajectoryPredictionEventMarker[],
): TrajectoryPredictionRuntime =>
  ({
    getState: () => ({
      absolutePredictionEnd: null,
      absolutePredictionPoints: [],
      predictedImpact: null,
      predictedTargetClosestApproach: null,
      targetId,
      targetRelativeAssistedPoints: [],
      targetRelativeEventMarkers: eventMarkers,
      targetRelativePredictionEnd: { x: 20, y: 0 },
      targetRelativePredictionPoints: [
        { x: 10, y: 0 },
        { x: 12, y: 0 },
        { x: 20, y: 0 },
      ],
    }),
    maybeRefresh: () => false,
    refresh: () => {},
  }) as TrajectoryPredictionRuntime

const createTestPresentation = (options: {
  eventMarkers: TrajectoryPredictionEventMarker[]
  viewportSize: number
}) => {
  setWindowSize(800, 600)
  const target = createTarget()
  const gameScene = createGameScene([target], {
    dashPixels: 12,
    endMarkerMinScreenRadius: 5.5,
    endMarkerRadius: 0.17,
    gapPixels: 8,
    replaceLineGeometryOnUpdate: true,
  })
  updateCameraView({
    cameraDistance: 700,
    cameraElevation: 1,
    cameraTargetPosition: { x: 0, y: 0 },
    gameScene,
    viewportHeight: 600,
    viewportSize: options.viewportSize,
    viewportWidth: 800,
  })

  return {
    gameScene,
    presentation: createTrajectoryPresentation({
      gameScene,
      physicsEngine,
      queries: createQueries(target),
      runtime: createRuntime(target, options.viewportSize),
      trajectoryPredictionRuntime: createPredictionRuntime(
        target.id,
        options.eventMarkers,
      ),
    }),
  }
}

describe('createTrajectoryPresentation', () => {
  afterEach(() => {
    if (originalWindow) {
      globals.window = originalWindow
    } else {
      Reflect.deleteProperty(globals, 'window')
    }
  })

  it('gates Pe/Ap marker dots and labels by zoom', () => {
    const eventMarkers: TrajectoryPredictionEventMarker[] = [
      { kind: 'periapsis', point: { x: 12, y: 0 }, time: 30 },
      { kind: 'apoapsis', point: { x: 20, y: 0 }, time: 60 },
    ]
    const close = createTestPresentation({
      eventMarkers,
      viewportSize: 50,
    })
    close.presentation.updateVisuals()

    expect(close.gameScene.trajectoryEventMarkers.periapsis.group.visible).toBe(
      true,
    )
    expect(close.gameScene.trajectoryEventMarkers.periapsis.label.visible).toBe(
      true,
    )
    expect(close.gameScene.trajectoryEventMarkers.apoapsis.group.visible).toBe(
      true,
    )

    const mid = createTestPresentation({
      eventMarkers,
      viewportSize: 100,
    })
    mid.presentation.updateVisuals()

    expect(mid.gameScene.trajectoryEventMarkers.periapsis.group.visible).toBe(
      true,
    )
    expect(mid.gameScene.trajectoryEventMarkers.periapsis.label.visible).toBe(
      false,
    )

    const far = createTestPresentation({
      eventMarkers,
      viewportSize: 220,
    })
    far.presentation.updateVisuals()

    expect(far.gameScene.trajectoryEventMarkers.periapsis.group.visible).toBe(
      false,
    )
    expect(far.gameScene.trajectoryEventMarkers.apoapsis.group.visible).toBe(
      false,
    )
  })
})
