import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'

import type { TrajectoryPredictionEventMarker } from '@/prediction/trajectoryPrediction'
import { createTrajectoryPresentation } from '@/presentation/trajectoryPresentation'
import { updateCameraView } from '@/render/sceneUpdates'
import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import type { GameQueries } from '@/runtime/gameQueries'
import type { TrajectoryPredictionRuntime } from '@/runtime/trajectoryPredictionRuntime'
import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import { createRuntimeScenarioSession } from '@/scenario/scenarioSession'
import { createGameScene } from '@/scene/createGameScene'
import { idleControls } from '@/simulation/state'
import type { Body, PhysicsEngine, SimulationState } from '@/simulation/types'
import type { Vec2 } from '@/simulation/vector'

const globals = globalThis as unknown as {
  window?: { innerHeight: number; innerWidth: number }
}
const originalWindow = globals.window

const setWindowSize = (innerWidth: number, innerHeight: number) => {
  globals.window = { innerHeight, innerWidth }
}

class FakeTrajectoryEventLabel {
  readonly classList = {
    toggle: () => undefined,
  }
  readonly dataset: Record<string, string> = {}
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

  removeAttribute(name: string) {
    this.attributes.delete(name)
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }

  toggleAttribute(name: string, force?: boolean) {
    const enabled = force ?? !this.attributes.has(name)
    if (enabled) {
      this.attributes.set(name, '')
    } else {
      this.attributes.delete(name)
    }
    return enabled
  }
}

const createTrajectoryEventMarkerLabels = () => ({
  apoapsis: new FakeTrajectoryEventLabel() as unknown as HTMLElement,
  periapsis: new FakeTrajectoryEventLabel() as unknown as HTMLElement,
})

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

const createRuntime = (target: Body, viewportSize: number): AppRuntimeState =>
  ({
    debug: {
      debugModeEnabled: false,
      debugNoGravityEnabled: false,
      debugSnapshotStatus: '',
      fpsIndicatorEnabled: false,
    },
    info: {
      userPins: [],
    },
    scenario: {
      directives: createDefaultScenarioDirectives(),
      metadata: { description: '', title: '' },
      session: createRuntimeScenarioSession('test'),
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
      camera: {
        follow: 'spacecraft',
        panOffset: { x: 0, y: 0 },
      },
      spacecraftLabelIntroUntil: 0,
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
  getTargetId: () => string,
  eventMarkers: TrajectoryPredictionEventMarker[],
  predictedImpact: { bodyName: string; time: number } | null = null,
  nearPointCount = 0,
  farVisible: 'current' | 'none' | 'retained-stale' = 'none',
  predictionPoints = [
    { x: 10, y: 0 },
    { x: 12, y: 0 },
    { x: 20, y: 0 },
  ],
): TrajectoryPredictionRuntime =>
  ({
    getDiagnostics: () => ({
      absolutePointCount: 0,
      activeFar: false,
      activeFarInputKeyShort: null,
      assistedPointCount: 0,
      elapsedSinceRefreshSeconds: 0,
      events: [],
      eventMarkerCount: 0,
      farCalculationAgeSeconds: null,
      farCalculationAverageMs: null,
      farCalculationMs: null,
      farCalculationSampleCount: 0,
      farCalculationWindows: {
        averageLastSecondMs: null,
        averageLastTenSecondsMs: null,
        averageLastThirtySecondsMs: null,
        countLastSecond: 0,
        countLastTenSeconds: 0,
        countLastThirtySeconds: 0,
      },
      farCoalescingLastSkipReason: null,
      farCoalescingLastSkipStage: null,
      farCoalescingMinIntervalOverrideSeconds: null,
      farCoalescingMinIntervalSeconds: 0,
      farCoalescingSkippedCount: 0,
      farInputKeyShort: null,
      farPointCount: 0,
      farReuseDivergence: null,
      farReuseExtendedPointCount: 0,
      farReuseExtendedSeconds: 0,
      farReuseFallbackReason: null,
      farReuseHistory: [],
      farReuseMode: null,
      farReuseRetainedPointCount: 0,
      farReuseRetainedSeconds: 0,
      farReuseTrimmedPointCount: 0,
      farReuseTrimmedSeconds: 0,
      farReuseValidation: null,
      farReuseValidationSeconds: 0,
      farVisible,
      geometryUpdateMs: 0,
      hasFarTier: false,
      horizonSeconds: 0,
      inputKey: null,
      inputKeyShort: null,
      integrationStepSeconds: 0,
      integrationTiers: {
        far: null,
        near: null,
      },
      nearCalculationAgeSeconds: null,
      nearCalculationAverageMs: null,
      nearCalculationMs: null,
      nearCalculationSampleCount: 0,
      nearCalculationTravel: {
        distanceSinceCalculationMeters: null,
        horizonDistanceMeters: null,
        horizonRatio: null,
        lastCalculationGapMeters: null,
        lastCalculationGapRatio: null,
        lastStepDistanceMeters: null,
        lastStepHorizonRatio: null,
      },
      nearCalculationWindows: {
        averageLastSecondMs: null,
        averageLastTenSecondsMs: null,
        averageLastThirtySecondsMs: null,
        countLastSecond: 0,
        countLastTenSeconds: 0,
        countLastThirtySeconds: 0,
      },
      nearFallbackReason: null,
      nearPointCount,
      nearSource: null,
      pendingFar: false,
      pendingFarInputKeyShort: null,
      predictionAnchorElapsed: null,
      predictionRefreshMs: 0,
      predictionTerminationReason: null,
      refreshCountLastSecond: 0,
      refreshIntervalSeconds: 0,
      refreshReason: null,
      relativePointCount: 0,
      remainingUsableCoverageSeconds: 0,
      retainedFarPointCount: 0,
      retainedNearPointCount: 0,
      sampleStepSeconds: 0,
      splitHorizon: false,
      visiblePointCount: 0,
    }),
    getRemainingUsableCoverageSeconds: () => 0,
    getState: () => ({
      absolutePredictionEnd: null,
      absolutePredictionPoints: [],
      predictedImpact,
      predictedTargetClosestApproach: null,
      targetId: getTargetId(),
      targetRelativeAssistedPoints: [],
      targetRelativeEventMarkers: eventMarkers,
      targetRelativePredictionEnd: { x: 20, y: 0 },
      targetRelativePredictionPoints: predictionPoints,
    }),
    hasCompletePredictionForCurrentTarget: () => true,
    maybeRefresh: () => false,
    recordGeometryUpdate: () => {},
    refresh: () => {},
    setFarCoalescingMinIntervalOverrideSeconds: () => true,
  }) as TrajectoryPredictionRuntime

const createTestPresentation = (options: {
  debugModeEnabled?: boolean
  eventMarkers: TrajectoryPredictionEventMarker[]
  farVisible?: 'current' | 'none' | 'retained-stale'
  nearPointCount?: number
  predictedImpact?: { bodyName: string; time: number } | null
  predictionPoints?: Vec2[]
  scenarioSession?: AppRuntimeState['scenario']['session']
  viewportSize: number
}) => {
  setWindowSize(800, 600)
  const target = createTarget()
  const runtime = createRuntime(target, options.viewportSize)
  runtime.debug.debugModeEnabled = options.debugModeEnabled ?? false
  runtime.scenario.session = options.scenarioSession ?? runtime.scenario.session
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
    maxViewportSize: 4_000,
    viewportHeight: 600,
    viewportSize: options.viewportSize,
    viewportWidth: 800,
  })

  return {
    gameScene,
    presentation: createTrajectoryPresentation({
      autopilotRotationRate: 0.9,
      gameScene,
      physicsEngine,
      queries: createQueries(target),
      runtime,
      timeWarps: [1],
      trajectoryEventMarkerLabels,
      trajectoryPredictionRuntime: createPredictionRuntime(
        () => target.id,
        options.eventMarkers,
        options.predictedImpact,
        options.nearPointCount,
        options.farVisible,
        options.predictionPoints,
      ),
    }),
    runtime,
    target,
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

  it('shows both selected Pe/Ap markers until the marker zoom cutoff', () => {
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

    expect(close.trajectoryEventMarkerLabels.periapsis.style.display).toBe(
      'none',
    )
    expect(close.trajectoryEventMarkerLabels.apoapsis.style.display).toBe(
      'none',
    )

    close.runtime.info.userPins = [
      { apsis: 'periapsis', kind: 'apsis' },
      { apsis: 'apoapsis', kind: 'apsis' },
    ]
    close.presentation.updateVisuals()

    expect(close.trajectoryEventMarkerLabels.periapsis.style.display).toBe(
      'block',
    )
    expect(close.trajectoryEventMarkerLabels.apoapsis.style.display).toBe(
      'block',
    )
    expect(close.trajectoryEventMarkerLabels.periapsis.textContent).toBe('Pe')
    expect(
      close.trajectoryEventMarkerLabels.periapsis.getAttribute('aria-label'),
    ).toBe('Periapsis; unselect Pe and Ap in Info')

    const far = createTestPresentation({
      eventMarkers,
      viewportSize: 500,
    })
    far.runtime.info.userPins = [{ apsis: 'periapsis', kind: 'apsis' }]
    far.presentation.updateVisuals()

    expect(far.trajectoryEventMarkerLabels.periapsis.style.display).toBe(
      'block',
    )
    expect(far.trajectoryEventMarkerLabels.apoapsis.style.display).toBe('block')

    const beyond = createTestPresentation({
      eventMarkers,
      viewportSize: 520,
    })
    beyond.runtime.info.userPins = [{ apsis: 'apoapsis', kind: 'apsis' }]
    beyond.presentation.updateVisuals()

    expect(beyond.trajectoryEventMarkerLabels.periapsis.style.display).toBe(
      'none',
    )
    expect(beyond.trajectoryEventMarkerLabels.apoapsis.style.display).toBe(
      'none',
    )
  })

  it('caps the crash marker screen-space diameter while preserving smaller sizes', () => {
    const normal = createTestPresentation({
      eventMarkers: [],
      predictedImpact: { bodyName: 'Earth', time: 30 },
      viewportSize: 100,
    })
    normal.presentation.updateVisuals()
    const normalDiameter =
      (normal.gameScene.predictionEndMarker.scale.x / (100 / 600)) * 2

    expect(normal.gameScene.predictionEndMarker.visible).toBe(true)
    expect(normalDiameter).toBeCloseTo(11)

    const viewportTwenty = createTestPresentation({
      eventMarkers: [],
      predictedImpact: { bodyName: 'Earth', time: 30 },
      viewportSize: 20,
    })
    viewportTwenty.presentation.updateVisuals()
    const viewportTwentyDiameter =
      (viewportTwenty.gameScene.predictionEndMarker.scale.x / (20 / 600)) * 2

    const zoomedIn = createTestPresentation({
      eventMarkers: [],
      predictedImpact: { bodyName: 'Earth', time: 30 },
      viewportSize: 5,
    })
    zoomedIn.presentation.updateVisuals()
    const zoomedInDiameter =
      (zoomedIn.gameScene.predictionEndMarker.scale.x / (5 / 600)) * 2

    expect(zoomedIn.gameScene.predictionEndMarker.visible).toBe(true)
    expect(viewportTwentyDiameter).toBeCloseTo(11)
    expect(zoomedInDiameter).toBeCloseTo(viewportTwentyDiameter)
  })

  it('decimates line geometry on zoom out and restores it from the same prediction', () => {
    const predictionPoints = Array.from({ length: 49 }, (_, index) => ({
      x: index * 250_000,
      y: 0,
    }))
    const test = createTestPresentation({
      eventMarkers: [],
      predictionPoints,
      viewportSize: 50,
    })

    test.presentation.updateVisuals()
    const closeSegmentCount =
      test.gameScene.predictionGeometry.getAttribute('instanceStart').count

    test.runtime.simulation.viewportSize = 1_000
    test.presentation.updateVisuals()
    const systemSegmentCount =
      test.gameScene.predictionGeometry.getAttribute('instanceStart').count

    test.runtime.simulation.viewportSize = 50
    test.presentation.updateVisuals()
    const restoredSegmentCount =
      test.gameScene.predictionGeometry.getAttribute('instanceStart').count

    expect(closeSegmentCount).toBe(24)
    expect(systemSegmentCount).toBe(1)
    expect(restoredSegmentCount).toBe(closeSegmentCount)
    expect(predictionPoints).toHaveLength(49)
  })

  it('keeps impact-gradient endpoints on the decimated prediction line', () => {
    const test = createTestPresentation({
      eventMarkers: [],
      predictedImpact: { bodyName: 'Earth', time: 30 },
      predictionPoints: Array.from({ length: 49 }, (_, index) => ({
        x: index * 250_000,
        y: 0,
      })),
      viewportSize: 1_000,
    })
    test.presentation.updateVisuals()

    const predictionStarts =
      test.gameScene.predictionGeometry.getAttribute('instanceStart')
    const predictionEnds =
      test.gameScene.predictionGeometry.getAttribute('instanceEnd')
    const gradientStarts =
      test.gameScene.impactGradientGeometry.getAttribute('instanceStart')
    const gradientEnds =
      test.gameScene.impactGradientGeometry.getAttribute('instanceEnd')

    expect(predictionStarts.count).toBe(2)
    expect(predictionEnds.getX(0)).toBeCloseTo(7.75)
    expect(predictionEnds.getX(1)).toBeCloseTo(12)
    expect(gradientStarts.count).toBe(17)
    expect(gradientStarts.getX(0)).toBeCloseTo(7.75)
    expect(gradientEnds.getX(gradientEnds.count - 1)).toBeCloseTo(12)
    expect(test.gameScene.impactGradientLine.visible).toBe(true)
  })

  it('colors near and far trajectory tiers in debug mode', () => {
    const test = createTestPresentation({
      debugModeEnabled: true,
      eventMarkers: [],
      farVisible: 'current',
      nearPointCount: 2,
      viewportSize: 50,
    })
    test.presentation.updateVisuals()

    const colorStart =
      test.gameScene.predictionGeometry.getAttribute('instanceColorStart')
    const colorEnd =
      test.gameScene.predictionGeometry.getAttribute('instanceColorEnd')
    const nearColor = new THREE.Color(0x38bdf8)
    const farColor = new THREE.Color(0xf59e0b)

    expect(test.gameScene.predictionMaterial.color.getHex()).toBe(0xffffff)
    expect(colorStart.getX(0)).toBeCloseTo(nearColor.r)
    expect(colorStart.getY(0)).toBeCloseTo(nearColor.g)
    expect(colorStart.getZ(0)).toBeCloseTo(nearColor.b)
    expect(colorStart.getX(1)).toBeCloseTo(nearColor.r)
    expect(colorEnd.getX(1)).toBeCloseTo(farColor.r)
    expect(colorEnd.getY(1)).toBeCloseTo(farColor.g)
    expect(colorEnd.getZ(1)).toBeCloseTo(farColor.b)
  })

  it('bridges a plausible retained stale far gap from the stale line', () => {
    const test = createTestPresentation({
      debugModeEnabled: true,
      eventMarkers: [],
      farVisible: 'retained-stale',
      nearPointCount: 2,
      predictionPoints: [
        { x: 10, y: 0 },
        { x: 12, y: 0 },
        { x: 20, y: 0 },
        { x: 40, y: 0 },
      ],
      viewportSize: 50,
    })
    test.presentation.updateVisuals()

    expect(test.gameScene.predictionLine.visible).toBe(true)
    expect(test.gameScene.predictionStaleFarLine.visible).toBe(true)
    expect(
      test.gameScene.predictionGeometry.getAttribute('instanceStart').count,
    ).toBe(1)
    expect(
      test.gameScene.predictionStaleFarGeometry.getAttribute('instanceStart')
        .count,
    ).toBe(2)
    expect(test.gameScene.predictionStaleFarMaterial.opacity).toBe(1)
    expect(test.gameScene.predictionStaleFarLine.renderOrder).toBeLessThan(
      test.gameScene.predictionLine.renderOrder,
    )
  })

  it('trims retained stale far points behind the fresh near tip', () => {
    const test = createTestPresentation({
      debugModeEnabled: true,
      eventMarkers: [],
      farVisible: 'retained-stale',
      nearPointCount: 2,
      predictionPoints: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 4, y: 0 },
        { x: 8, y: 0 },
        { x: 12, y: 0 },
        { x: 20, y: 0 },
      ],
      viewportSize: 50,
    })
    test.presentation.updateVisuals()

    expect(
      test.gameScene.predictionStaleFarGeometry.getAttribute('instanceStart')
        .count,
    ).toBe(2)
  })

  it('bridges a close curved retained stale far seam', () => {
    const test = createTestPresentation({
      debugModeEnabled: true,
      eventMarkers: [],
      farVisible: 'retained-stale',
      nearPointCount: 2,
      predictionPoints: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 3 },
        { x: 18, y: 6 },
      ],
      viewportSize: 50,
    })
    test.presentation.updateVisuals()

    expect(
      test.gameScene.predictionStaleFarGeometry.getAttribute('instanceStart')
        .count,
    ).toBe(2)
  })

  it('keeps an implausible retained stale far gap disconnected', () => {
    const test = createTestPresentation({
      debugModeEnabled: true,
      eventMarkers: [],
      farVisible: 'retained-stale',
      nearPointCount: 2,
      predictionPoints: [
        { x: 10, y: 0 },
        { x: 12, y: 0 },
        { x: 200, y: 0 },
        { x: 210, y: 0 },
      ],
      viewportSize: 50,
    })
    test.presentation.updateVisuals()

    expect(
      test.gameScene.predictionStaleFarGeometry.getAttribute('instanceStart')
        .count,
    ).toBe(1)
  })

  it('keeps split near and far trajectory fade on the combined path', () => {
    const test = createTestPresentation({
      eventMarkers: [],
      farVisible: 'retained-stale',
      nearPointCount: 2,
      predictionPoints: [
        { x: 10, y: 0 },
        { x: 12, y: 0 },
        { x: 20, y: 0 },
        { x: 40, y: 0 },
      ],
      viewportSize: 50,
    })
    test.presentation.updateVisuals()

    const colorEnd =
      test.gameScene.predictionGeometry.getAttribute('instanceColorEnd')
    const staleFarColorStart =
      test.gameScene.predictionStaleFarGeometry.getAttribute(
        'instanceColorStart',
      )

    expect(colorEnd.getX(0)).toBeCloseTo(1)
    expect(colorEnd.getY(0)).toBeCloseTo(1)
    expect(colorEnd.getZ(0)).toBeCloseTo(1)
    expect(staleFarColorStart.getX(0)).toBeCloseTo(1)
    expect(staleFarColorStart.getY(0)).toBeCloseTo(1)
    expect(staleFarColorStart.getZ(0)).toBeCloseTo(1)
  })

  it('hides only Pe/Ap marker visuals during tutorial phases before reach-moon', () => {
    const eventMarkers = [
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
    const test = createTestPresentation({
      eventMarkers,
      scenarioSession: createRuntimeScenarioSession('tutorial', {
        onboarding: {
          activeStepId: 'intro-trajectory',
          completedStepIds: [],
          gateActive: true,
          progress: {},
        },
        phase: 'escape-earth',
      }),
      viewportSize: 50,
    })
    test.runtime.info.userPins = [{ apsis: 'periapsis', kind: 'apsis' }]
    test.presentation.updateVisuals()

    expect(test.gameScene.predictionLine.visible).toBe(true)
    expect(
      test.presentation.getPredictionState().targetRelativeEventMarkers,
    ).toHaveLength(2)
    expect(test.trajectoryEventMarkerLabels.periapsis.style.display).toBe(
      'none',
    )
    expect(test.trajectoryEventMarkerLabels.apoapsis.style.display).toBe('none')
  })

  it('renders Pe/Ap marker visuals again during the tutorial reach-moon phase', () => {
    const eventMarkers = [
      createEventMarker({
        altitude: 400_000,
        distance: 12_000_000,
        kind: 'periapsis',
        point: { x: 12_000_000, y: 0 },
        time: 30,
      }),
    ]
    const test = createTestPresentation({
      eventMarkers,
      scenarioSession: createRuntimeScenarioSession('tutorial', {
        phase: 'reach-moon',
      }),
      viewportSize: 50,
    })
    test.runtime.info.userPins = [{ apsis: 'periapsis', kind: 'apsis' }]
    test.presentation.updateVisuals()

    expect(test.trajectoryEventMarkerLabels.periapsis.style.display).toBe(
      'block',
    )
  })

  it('keeps Pe/Ap marker visuals unchanged outside the tutorial', () => {
    const eventMarkers = [
      createEventMarker({
        altitude: 400_000,
        distance: 12_000_000,
        kind: 'periapsis',
        point: { x: 12_000_000, y: 0 },
        time: 30,
      }),
    ]
    const test = createTestPresentation({
      eventMarkers,
      scenarioSession: createRuntimeScenarioSession('earth-moon'),
      viewportSize: 50,
    })
    test.runtime.info.userPins = [{ apsis: 'apoapsis', kind: 'apsis' }]
    test.presentation.updateVisuals()

    expect(test.trajectoryEventMarkerLabels.periapsis.style.display).toBe(
      'block',
    )
  })

  it('keeps selected Pe/Ap markers numeric-free without canvas tooltips', () => {
    const eventMarkers = [
      createEventMarker({
        altitude: 400_000,
        distance: 12_000_000,
        kind: 'periapsis',
        point: { x: 12_000_000, y: 0 },
        time: 30,
      }),
    ]
    const test = createTestPresentation({
      eventMarkers,
      viewportSize: 50,
    })
    test.presentation.updateVisuals()

    expect(test.trajectoryEventMarkerLabels.periapsis.style.display).toBe(
      'none',
    )

    test.runtime.info.userPins = [{ apsis: 'periapsis', kind: 'apsis' }]
    test.presentation.updateVisuals()

    expect(test.trajectoryEventMarkerLabels.periapsis.style.display).toBe(
      'block',
    )
    expect(test.trajectoryEventMarkerLabels.apoapsis.style.display).toBe('none')
    expect(test.trajectoryEventMarkerLabels.periapsis.textContent).toBe('Pe')
    expect(test.trajectoryEventMarkerLabels.periapsis.dataset.tooltip).toBe(
      undefined,
    )
    expect(test.trajectoryEventMarkerLabels.periapsis.title).toBe('')
    expect(
      test.trajectoryEventMarkerLabels.periapsis.getAttribute('aria-label'),
    ).toBe('Periapsis; unselect Pe and Ap in Info')
    expect(
      test.trajectoryEventMarkerLabels.periapsis.getAttribute('aria-pressed'),
    ).toBe('true')
    expect(test.trajectoryEventMarkerLabels.periapsis.textContent).not.toMatch(
      /\d|alt|center/i,
    )
  })

  it('stabilizes Pe/Ap markers by altitude changes', () => {
    const eventMarkers = [
      createEventMarker({
        altitude: 10_000_000,
        distance: 20_000_000,
        kind: 'periapsis',
        point: { x: 20_000_000, y: 0 },
        time: 30,
      }),
    ]
    const test = createTestPresentation({
      eventMarkers,
      viewportSize: 50,
    })
    test.runtime.info.userPins = [{ apsis: 'periapsis', kind: 'apsis' }]
    test.presentation.updateVisuals()
    const initialLeft = test.trajectoryEventMarkerLabels.periapsis.style.left

    eventMarkers[0] = createEventMarker({
      altitude: 10_000_000,
      distance: 20_700_000,
      kind: 'periapsis',
      point: { x: 20_700_000, y: 0 },
      time: 31,
    })
    test.presentation.updateVisuals()

    expect(test.trajectoryEventMarkerLabels.periapsis.style.left).toBe(
      initialLeft,
    )
    expect(test.trajectoryEventMarkerLabels.periapsis.textContent).toBe('Pe')

    eventMarkers[0] = createEventMarker({
      altitude: 10_700_000,
      distance: 20_700_000,
      kind: 'periapsis',
      point: { x: 20_700_000, y: 0 },
      time: 32,
    })
    test.presentation.updateVisuals()

    expect(test.trajectoryEventMarkerLabels.periapsis.style.left).not.toBe(
      initialLeft,
    )
  })

  it('resets stale stabilized markers when a marker kind disappears', () => {
    const eventMarkers = [
      createEventMarker({
        altitude: 10_000_000,
        distance: 20_000_000,
        kind: 'periapsis',
        point: { x: 20_000_000, y: 0 },
        time: 30,
      }),
    ]
    const test = createTestPresentation({
      eventMarkers,
      viewportSize: 50,
    })
    test.runtime.info.userPins = [{ apsis: 'periapsis', kind: 'apsis' }]
    test.presentation.updateVisuals()
    const initialLeft = test.trajectoryEventMarkerLabels.periapsis.style.left

    eventMarkers.splice(
      0,
      1,
      createEventMarker({
        altitude: 16_000_000,
        distance: 26_000_000,
        kind: 'apoapsis',
        point: { x: 26_000_000, y: 0 },
        time: 31,
      }),
    )
    test.presentation.updateVisuals()

    expect(test.trajectoryEventMarkerLabels.periapsis.style.display).toBe(
      'none',
    )

    eventMarkers.splice(
      0,
      1,
      createEventMarker({
        altitude: 10_000_000,
        distance: 20_300_000,
        kind: 'periapsis',
        point: { x: 20_300_000, y: 0 },
        time: 32,
      }),
    )
    test.presentation.updateVisuals()

    expect(test.trajectoryEventMarkerLabels.periapsis.style.left).not.toBe(
      initialLeft,
    )
  })

  it('resets stale stabilized markers when the event marker target changes', () => {
    const eventMarkers = [
      createEventMarker({
        altitude: 10_000_000,
        distance: 20_000_000,
        kind: 'periapsis',
        point: { x: 20_000_000, y: 0 },
        time: 30,
      }),
    ]
    const test = createTestPresentation({
      eventMarkers,
      viewportSize: 50,
    })
    test.runtime.info.userPins = [{ apsis: 'periapsis', kind: 'apsis' }]
    test.presentation.updateVisuals()
    const initialLeft = test.trajectoryEventMarkerLabels.periapsis.style.left

    eventMarkers[0] = createEventMarker({
      altitude: 10_000_000,
      distance: 20_300_000,
      kind: 'periapsis',
      point: { x: 20_300_000, y: 0 },
      time: 31,
    })
    test.target.id = 'moon'
    test.presentation.updateVisuals()

    expect(test.trajectoryEventMarkerLabels.periapsis.style.left).not.toBe(
      initialLeft,
    )
  })

  it('resets stale stabilized markers when the scenario session changes', () => {
    const eventMarkers = [
      createEventMarker({
        altitude: 10_000_000,
        distance: 20_000_000,
        kind: 'periapsis',
        point: { x: 20_000_000, y: 0 },
        time: 30,
      }),
    ]
    const test = createTestPresentation({
      eventMarkers,
      viewportSize: 50,
    })
    test.runtime.info.userPins = [{ apsis: 'periapsis', kind: 'apsis' }]
    test.presentation.updateVisuals()
    const initialLeft = test.trajectoryEventMarkerLabels.periapsis.style.left

    eventMarkers[0] = createEventMarker({
      altitude: 10_000_000,
      distance: 20_300_000,
      kind: 'periapsis',
      point: { x: 20_300_000, y: 0 },
      time: 31,
    })
    test.runtime.scenario.session = createRuntimeScenarioSession('test')
    test.presentation.updateVisuals()

    expect(test.trajectoryEventMarkerLabels.periapsis.style.left).not.toBe(
      initialLeft,
    )
  })
})
