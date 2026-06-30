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
import type { OrbitPointDisplaySettings } from '@/userSettingsStorage'

const globals = globalThis as unknown as {
  window?: { innerHeight: number; innerWidth: number }
}
const originalWindow = globals.window

const setWindowSize = (innerWidth: number, innerHeight: number) => {
  globals.window = { innerHeight, innerWidth }
}

class FakeTrajectoryEventLabel {
  readonly style: Record<string, string> = {}
  private readonly attributes = new Map<string, string>()
  textContent = ''
  title = ''

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null
  }

  getBoundingClientRect() {
    return {
      bottom: 0,
      height: 18,
      left: 0,
      right: 132,
      top: 0,
      width: 132,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }
}

const createTrajectoryEventMarkerLabels = () => ({
  apoapsis: new FakeTrajectoryEventLabel() as unknown as HTMLElement,
  periapsis: new FakeTrajectoryEventLabel() as unknown as HTMLElement,
})

const defaultOrbitPointDisplaySettings: OrbitPointDisplaySettings = {
  altitudeVisible: true,
  centerDistanceVisible: false,
  labelsVisible: true,
  markersVisible: true,
  pointNameVisible: true,
}

const createEventMarker = (
  marker: Pick<TrajectoryPredictionEventMarker, 'kind' | 'point' | 'time'> &
    Partial<Pick<TrajectoryPredictionEventMarker, 'altitude' | 'distance'>>,
): TrajectoryPredictionEventMarker => ({
  altitude: marker.altitude ?? Math.max(0, marker.point.x - 1),
  distance: marker.distance ?? Math.max(0, marker.point.x),
  kind: marker.kind,
  point: marker.point,
  time: marker.time,
})

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

const createRuntime = (
  target: Body,
  viewportSize: number,
  timeWarpIndex = 0,
): AppRuntimeState =>
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
      timeWarpIndex,
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
  orbitPointDisplaySettings?: OrbitPointDisplaySettings
  eventMarkers: TrajectoryPredictionEventMarker[]
  timeWarpIndex?: number
  timeWarps?: number[]
  viewportSize: number
}) => {
  setWindowSize(800, 600)
  const target = createTarget()
  const trajectoryEventMarkerLabels = createTrajectoryEventMarkerLabels()
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
      getOrbitPointDisplaySettings: () =>
        options.orbitPointDisplaySettings ?? defaultOrbitPointDisplaySettings,
      physicsEngine,
      queries: createQueries(target),
      runtime: createRuntime(
        target,
        options.viewportSize,
        options.timeWarpIndex,
      ),
      timeWarps: options.timeWarps ?? [1],
      trajectoryEventMarkerLabels,
      trajectoryPredictionRuntime: createPredictionRuntime(
        target.id,
        options.eventMarkers,
      ),
    }),
    trajectoryEventMarkerLabels,
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
      createEventMarker({
        altitude: 400_000,
        distance: 12_000_000,
        kind: 'periapsis',
        point: { x: 12_000_000, y: 0 },
        time: 30,
      }),
      createEventMarker({
        altitude: 13_000_000,
        distance: 20_000_000,
        kind: 'apoapsis',
        point: { x: 20_000_000, y: 0 },
        time: 60,
      }),
    ]
    const close = createTestPresentation({
      eventMarkers,
      viewportSize: 50,
    })
    close.presentation.updateVisuals()

    expect(close.gameScene.trajectoryEventMarkers.periapsis.group.visible).toBe(
      true,
    )
    expect(close.trajectoryEventMarkerLabels.periapsis.style.display).toBe(
      'block',
    )
    expect(close.trajectoryEventMarkerLabels.periapsis.textContent).toBe(
      'Pe · alt 400 km',
    )
    expect(
      close.trajectoryEventMarkerLabels.periapsis.getAttribute('aria-label'),
    ).toBe('Periapsis: altitude 400 km')
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
    expect(mid.trajectoryEventMarkerLabels.periapsis.style.display).toBe('none')

    const threshold = createTestPresentation({
      eventMarkers,
      viewportSize: 160,
    })
    threshold.presentation.updateVisuals()
    const thresholdScreenRadius =
      threshold.gameScene.trajectoryEventMarkers.periapsis.group.scale.x /
      (160 / 600)

    const far = createTestPresentation({
      eventMarkers,
      viewportSize: 500,
    })
    far.presentation.updateVisuals()
    const farScreenRadius =
      far.gameScene.trajectoryEventMarkers.periapsis.group.scale.x / (500 / 600)

    expect(far.gameScene.trajectoryEventMarkers.periapsis.group.visible).toBe(
      true,
    )
    expect(far.gameScene.trajectoryEventMarkers.apoapsis.group.visible).toBe(
      true,
    )
    expect(far.trajectoryEventMarkerLabels.periapsis.style.display).toBe('none')
    expect(farScreenRadius).toBeLessThan(thresholdScreenRadius)

    const beyond = createTestPresentation({
      eventMarkers,
      viewportSize: 520,
    })
    beyond.presentation.updateVisuals()

    expect(
      beyond.gameScene.trajectoryEventMarkers.periapsis.group.visible,
    ).toBe(false)
    expect(beyond.gameScene.trajectoryEventMarkers.apoapsis.group.visible).toBe(
      false,
    )

    const viewportTwenty = createTestPresentation({
      eventMarkers,
      viewportSize: 20,
    })
    viewportTwenty.presentation.updateVisuals()
    const maxZoom = createTestPresentation({
      eventMarkers,
      viewportSize: 5,
    })
    maxZoom.presentation.updateVisuals()
    const viewportTwentyScreenRadius =
      viewportTwenty.gameScene.trajectoryEventMarkers.periapsis.group.scale.x /
      (20 / 600)
    const maxZoomScreenRadius =
      maxZoom.gameScene.trajectoryEventMarkers.periapsis.group.scale.x /
      (5 / 600)

    expect(maxZoomScreenRadius).toBeCloseTo(viewportTwentyScreenRadius)
  })

  it('uses orbit point display settings for marker and label visibility', () => {
    const eventMarkers = [
      createEventMarker({
        altitude: 400_000,
        distance: 12_000_000,
        kind: 'periapsis',
        point: { x: 12_000_000, y: 0 },
        time: 30,
      }),
    ]
    const hiddenMarkers = createTestPresentation({
      eventMarkers,
      orbitPointDisplaySettings: {
        ...defaultOrbitPointDisplaySettings,
        markersVisible: false,
      },
      viewportSize: 50,
    })
    hiddenMarkers.presentation.updateVisuals()

    expect(
      hiddenMarkers.gameScene.trajectoryEventMarkers.periapsis.group.visible,
    ).toBe(false)
    expect(
      hiddenMarkers.trajectoryEventMarkerLabels.periapsis.style.display,
    ).toBe('none')

    const hiddenLabels = createTestPresentation({
      eventMarkers,
      orbitPointDisplaySettings: {
        ...defaultOrbitPointDisplaySettings,
        labelsVisible: false,
      },
      viewportSize: 50,
    })
    hiddenLabels.presentation.updateVisuals()

    expect(
      hiddenLabels.gameScene.trajectoryEventMarkers.periapsis.group.visible,
    ).toBe(true)
    expect(
      hiddenLabels.trajectoryEventMarkerLabels.periapsis.style.display,
    ).toBe('none')
  })

  it('composes orbit point labels from enabled fields', () => {
    const eventMarkers = [
      createEventMarker({
        altitude: 400_000,
        distance: 12_000_000,
        kind: 'periapsis',
        point: { x: 12_000_000, y: 0 },
        time: 30,
      }),
    ]
    const centerOnly = createTestPresentation({
      eventMarkers,
      orbitPointDisplaySettings: {
        ...defaultOrbitPointDisplaySettings,
        altitudeVisible: false,
        centerDistanceVisible: true,
        pointNameVisible: false,
      },
      viewportSize: 50,
    })
    centerOnly.presentation.updateVisuals()

    expect(centerOnly.trajectoryEventMarkerLabels.periapsis.textContent).toBe(
      'center 12 Mm',
    )
    expect(
      centerOnly.trajectoryEventMarkerLabels.periapsis.getAttribute(
        'aria-label',
      ),
    ).toBe('Orbit point: center distance 12 Mm')

    const noFields = createTestPresentation({
      eventMarkers,
      orbitPointDisplaySettings: {
        ...defaultOrbitPointDisplaySettings,
        altitudeVisible: false,
        centerDistanceVisible: false,
        pointNameVisible: false,
      },
      viewportSize: 50,
    })
    noFields.presentation.updateVisuals()

    expect(
      noFields.gameScene.trajectoryEventMarkers.periapsis.group.visible,
    ).toBe(true)
    expect(noFields.trajectoryEventMarkerLabels.periapsis.style.display).toBe(
      'none',
    )
  })

  it('uses a larger display stability threshold at higher time warp', () => {
    const createMutableMarkers = () => [
      createEventMarker({
        altitude: 400_000,
        distance: 12_000_000,
        kind: 'periapsis',
        point: { x: 12_000_000, y: 0 },
        time: 30,
      }),
    ]
    const lowWarpMarkers = createMutableMarkers()
    const lowWarp = createTestPresentation({
      eventMarkers: lowWarpMarkers,
      timeWarps: [1],
      viewportSize: 50,
    })
    lowWarp.presentation.updateVisuals()
    lowWarpMarkers[0] = createEventMarker({
      altitude: 1_400_000,
      distance: 13_000_000,
      kind: 'periapsis',
      point: { x: 13_000_000, y: 0 },
      time: 31,
    })
    lowWarp.presentation.updateVisuals()

    expect(
      lowWarp.gameScene.trajectoryEventMarkers.periapsis.group.position.x,
    ).toBeCloseTo(13)

    const highWarpMarkers = createMutableMarkers()
    const highWarp = createTestPresentation({
      eventMarkers: highWarpMarkers,
      timeWarpIndex: 1,
      timeWarps: [1, 1800],
      viewportSize: 50,
    })
    highWarp.presentation.updateVisuals()
    highWarpMarkers[0] = createEventMarker({
      altitude: 1_400_000,
      distance: 13_000_000,
      kind: 'periapsis',
      point: { x: 13_000_000, y: 0 },
      time: 31,
    })
    highWarp.presentation.updateVisuals()

    expect(
      highWarp.gameScene.trajectoryEventMarkers.periapsis.group.position.x,
    ).toBeCloseTo(12)

    highWarpMarkers[0] = createEventMarker({
      altitude: 3_400_000,
      distance: 15_000_000,
      kind: 'periapsis',
      point: { x: 15_000_000, y: 0 },
      time: 32,
    })
    highWarp.presentation.updateVisuals()

    expect(
      highWarp.gameScene.trajectoryEventMarkers.periapsis.group.position.x,
    ).toBeCloseTo(15)
  })
})
