import type { AssistMode, CaptureMetrics } from '../assist/orbitalAssist'
import {
  type PredictedClosestApproach,
  type PredictedImpact,
  getCoastTrajectoryPredictionMaxIntegrationStepSeconds,
  predictAssistedTrajectory,
  predictCoastTrajectory,
  type TrajectoryPredictionEventMarker,
  type TrajectoryPredictionConfig,
} from '../prediction/trajectoryPrediction'
import type {
  Body,
  ControlInput,
  PhysicsEngine,
  SimulationState,
} from '../simulation/types'
import type { Vec2 } from '../simulation/vector'

export type TrajectoryPredictionState = {
  absolutePredictionEnd: Vec2 | null
  absolutePredictionPoints: Vec2[]
  predictedImpact: PredictedImpact | null
  predictedTargetClosestApproach: PredictedClosestApproach | null
  targetId: string | null
  targetRelativeEventMarkers: TrajectoryPredictionEventMarker[]
  targetRelativeAssistedPoints: Vec2[]
  targetRelativePredictionEnd: Vec2 | null
  targetRelativePredictionPoints: Vec2[]
}

export type TrajectoryPredictionRefreshReason =
  | 'assist-change'
  | 'body-state-change'
  | 'controls-change'
  | 'horizon-change'
  | 'initial'
  | 'manual'
  | 'sampling-change'
  | 'spacecraft-change'
  | 'target-change'
  | 'timed-refresh'

export type TrajectoryPredictionDiagnostics = {
  absolutePointCount: number
  assistedPointCount: number
  eventMarkerCount: number
  geometryUpdateMs: number
  horizonSeconds: number
  inputKey: string | null
  integrationStepSeconds: number
  predictionRefreshMs: number
  refreshReason: TrajectoryPredictionRefreshReason | null
  relativePointCount: number
  sampleStepSeconds: number
}

export type RefreshTrajectoryPredictionOptions = {
  assistMode: AssistMode
  getAssistPredictionControls(
    simulationState: SimulationState,
    targetId: string,
  ): ControlInput
  getAssistTarget(): Body
  getCaptureMetrics(target: Body): CaptureMetrics
  physicsEngine: PhysicsEngine
  predictionConfig: TrajectoryPredictionConfig
  state: SimulationState
}

type PredictionInputKeyParts = {
  assist: string
  bodies: string
  config: string
  controls: string
  spacecraft: string
  target: string
}

const emptyTrajectoryPredictionState = (): TrajectoryPredictionState => ({
  absolutePredictionEnd: null,
  absolutePredictionPoints: [],
  predictedImpact: null,
  predictedTargetClosestApproach: null,
  targetId: null,
  targetRelativeEventMarkers: [],
  targetRelativeAssistedPoints: [],
  targetRelativePredictionEnd: null,
  targetRelativePredictionPoints: [],
})

const emptyTrajectoryPredictionDiagnostics =
  (): TrajectoryPredictionDiagnostics => ({
    absolutePointCount: 0,
    assistedPointCount: 0,
    eventMarkerCount: 0,
    geometryUpdateMs: 0,
    horizonSeconds: 0,
    inputKey: null,
    integrationStepSeconds: 0,
    predictionRefreshMs: 0,
    refreshReason: null,
    relativePointCount: 0,
    sampleStepSeconds: 0,
  })

const nowMs = () => performance.now()

const quantize = (value: number, precision: number) =>
  Math.round(value / precision) * precision

const quantizeAngle = (value: number) => quantize(value, 0.0001)
const quantizePosition = (value: number) => quantize(value, 5_000)
const quantizeScalar = (value: number) => quantize(value, 0.001)
const quantizeVelocity = (value: number) => quantize(value, 5)

const createPredictionInputKeyParts = (
  options: RefreshTrajectoryPredictionOptions,
  target: Body,
): PredictionInputKeyParts => ({
  assist: JSON.stringify({
    mode: options.assistMode,
    targetId: target.id,
  }),
  bodies: JSON.stringify(
    options.state.bodies.map((body) => ({
      id: body.id,
      mass: quantizeScalar(body.mass),
      px: quantizePosition(body.position.x),
      py: quantizePosition(body.position.y),
      radius: quantizeScalar(body.radius),
      vx: quantizeVelocity(body.velocity.x),
      vy: quantizeVelocity(body.velocity.y),
    })),
  ),
  config: JSON.stringify({
    horizonSeconds: quantizeScalar(options.predictionConfig.horizonSeconds),
    maxIntegrationStepSeconds: quantizeScalar(
      options.predictionConfig.maxIntegrationStepSeconds,
    ),
    maxLoopRevolutions: quantizeScalar(
      options.predictionConfig.maxLoopRevolutions,
    ),
    refreshInterval: quantizeScalar(options.predictionConfig.refreshInterval),
    stepSeconds: quantizeScalar(options.predictionConfig.stepSeconds),
  }),
  controls: JSON.stringify({
    main: quantizeScalar(options.state.controls.main),
    reverse: quantizeScalar(options.state.controls.reverse),
    strafe: quantizeScalar(options.state.controls.strafe),
    turn: quantizeScalar(options.state.controls.turn),
  }),
  spacecraft: JSON.stringify({
    heading: quantizeAngle(options.state.spacecraft.heading),
    px: quantizePosition(options.state.spacecraft.position.x),
    py: quantizePosition(options.state.spacecraft.position.y),
    vx: quantizeVelocity(options.state.spacecraft.velocity.x),
    vy: quantizeVelocity(options.state.spacecraft.velocity.y),
  }),
  target: target.id,
})

const createPredictionInputKey = (parts: PredictionInputKeyParts) =>
  JSON.stringify(parts)

const getRefreshReason = (
  previousParts: PredictionInputKeyParts | null,
  nextParts: PredictionInputKeyParts,
  elapsed: number,
  refreshInterval: number,
): TrajectoryPredictionRefreshReason | null => {
  if (!previousParts) {
    return 'initial'
  }

  if (previousParts.target !== nextParts.target) {
    return 'target-change'
  }

  if (previousParts.config !== nextParts.config) {
    const previousConfig = JSON.parse(previousParts.config) as {
      horizonSeconds: number
      maxIntegrationStepSeconds: number
      maxLoopRevolutions: number
      refreshInterval: number
      stepSeconds: number
    }
    const nextConfig = JSON.parse(nextParts.config) as typeof previousConfig
    if (previousConfig.horizonSeconds !== nextConfig.horizonSeconds) {
      return 'horizon-change'
    }
    return 'sampling-change'
  }

  if (previousParts.assist !== nextParts.assist) {
    return 'assist-change'
  }

  if (previousParts.spacecraft !== nextParts.spacecraft) {
    return 'spacecraft-change'
  }

  if (previousParts.controls !== nextParts.controls) {
    return 'controls-change'
  }

  if (previousParts.bodies !== nextParts.bodies) {
    return 'body-state-change'
  }

  return elapsed >= refreshInterval ? 'timed-refresh' : null
}

export const createTrajectoryPredictionRuntime = () => {
  let predictionInputKeyParts: PredictionInputKeyParts | null = null
  let predictionRefreshElapsed = 0
  let predictionDiagnostics = emptyTrajectoryPredictionDiagnostics()
  let predictionState = emptyTrajectoryPredictionState()

  const refreshForTarget = (
    options: RefreshTrajectoryPredictionOptions,
    target: Body,
    reason: TrajectoryPredictionRefreshReason,
    nextInputKeyParts = createPredictionInputKeyParts(options, target),
  ) => {
    const refreshStartMs = nowMs()
    const predictionConfig = options.predictionConfig
    const allowLoopTrim = options.getCaptureMetrics(target).specificEnergy < 0
    const integrationStepSeconds =
      getCoastTrajectoryPredictionMaxIntegrationStepSeconds(
        options.state,
        target,
        predictionConfig,
        allowLoopTrim,
      )
    const coastPrediction = predictCoastTrajectory(
      options.state,
      options.physicsEngine,
      target,
      predictionConfig,
      allowLoopTrim,
    )
    const targetRelativePredictionPoints = coastPrediction.relativePoints

    predictionState = {
      absolutePredictionEnd: coastPrediction.absoluteEndPoint,
      absolutePredictionPoints: coastPrediction.absolutePoints,
      predictedImpact: coastPrediction.impact,
      predictedTargetClosestApproach: coastPrediction.closestApproach,
      targetId: target.id,
      targetRelativeEventMarkers: coastPrediction.eventMarkers,
      targetRelativeAssistedPoints:
        options.assistMode === 'off'
          ? []
          : predictAssistedTrajectory(
              options.state,
              options.physicsEngine,
              target.id,
              predictionConfig,
              options.getAssistPredictionControls,
            ).relativePoints,
      targetRelativePredictionEnd:
        targetRelativePredictionPoints.at(-1) ?? null,
      targetRelativePredictionPoints,
    }
    const inputKey = createPredictionInputKey(nextInputKeyParts)
    predictionInputKeyParts = nextInputKeyParts
    predictionDiagnostics = {
      ...predictionDiagnostics,
      absolutePointCount: predictionState.absolutePredictionPoints.length,
      assistedPointCount: predictionState.targetRelativeAssistedPoints.length,
      eventMarkerCount: predictionState.targetRelativeEventMarkers.length,
      horizonSeconds: predictionConfig.horizonSeconds,
      inputKey,
      integrationStepSeconds,
      predictionRefreshMs: nowMs() - refreshStartMs,
      refreshReason: reason,
      relativePointCount: predictionState.targetRelativePredictionPoints.length,
      sampleStepSeconds: predictionConfig.stepSeconds,
    }
    predictionRefreshElapsed = 0
  }

  const refresh = (
    options: RefreshTrajectoryPredictionOptions,
    reason: TrajectoryPredictionRefreshReason = predictionInputKeyParts
      ? 'manual'
      : 'initial',
  ) => {
    const target = options.getAssistTarget()
    refreshForTarget(options, target, reason)
  }

  return {
    getDiagnostics: () => predictionDiagnostics,
    getState: () => predictionState,
    maybeRefresh: (
      realDt: number,
      options: RefreshTrajectoryPredictionOptions,
    ) => {
      predictionRefreshElapsed += realDt
      const target = options.getAssistTarget()
      const nextInputKeyParts = createPredictionInputKeyParts(options, target)
      const reason = getRefreshReason(
        predictionInputKeyParts,
        nextInputKeyParts,
        predictionRefreshElapsed,
        options.predictionConfig.refreshInterval,
      )
      if (reason) {
        refreshForTarget(options, target, reason, nextInputKeyParts)
        return true
      }
      return false
    },
    recordGeometryUpdate: (geometryUpdateMs: number) => {
      predictionDiagnostics = {
        ...predictionDiagnostics,
        geometryUpdateMs,
      }
    },
    refresh,
  }
}

export type TrajectoryPredictionRuntime = ReturnType<
  typeof createTrajectoryPredictionRuntime
>
