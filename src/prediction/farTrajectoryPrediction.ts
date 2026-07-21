import {
  type AssistMode,
  getAssistPredictionControlsForState,
  getCaptureMetricsForState,
} from '../assist/orbitalAssist'
import { semiImplicitEuler } from '../simulation/physics/semiImplicitEuler'
import type {
  Body,
  ControlInput,
  SimulationState,
  Spacecraft,
} from '../simulation/types'
import { length, sub, type Vec2 } from '../simulation/vector'
import type {
  CoastTrajectoryPredictionComputation,
  CoastTrajectoryPredictionSample,
  TrajectoryPredictionConfig,
  TrajectoryPredictionResult,
} from './trajectoryPrediction'
import {
  computeCoastTrajectoryPrediction,
  getCoastTrajectoryEventMarkers,
  isCloseBoundCoastPrediction,
  predictAssistedTrajectory,
} from './trajectoryPrediction'

export type FarTrajectoryPredictionBodySnapshot = Omit<Body, 'color'>

export type FarTrajectoryPredictionStateSnapshot = {
  bodies: FarTrajectoryPredictionBodySnapshot[]
  controls: ControlInput
  elapsed: number
  spacecraft: Spacecraft
}

export type FarTrajectoryPredictionRequestPayload = {
  assistMode: AssistMode
  autopilotRotationRate: number
  inputKey: string
  jobId: number
  predictionConfig: TrajectoryPredictionConfig
  semanticInputKey: string
  state: FarTrajectoryPredictionStateSnapshot
  targetId: string
}

export type FarTrajectoryPredictionResultPayload = {
  assistedPoints: Array<{ x: number; y: number }>
  calculationMs: number
  coastPrediction: TrajectoryPredictionResult
  inputKey: string
  jobId: number
  semanticInputKey: string
  targetId: string
  reuse: FarTrajectoryPredictionReuseDiagnostics
}

export type FarTrajectoryPredictionReuseFallbackReason =
  | 'cached-path-incomplete'
  | 'elapsed-outside-window'
  | 'loop-trim-risk'
  | 'no-cache'
  | 'not-passive-coast'
  | 'reuse-limit'
  | 'semantic-change'
  | 'state-diverged'

export type FarTrajectoryPredictionDivergenceReason =
  | 'extension-target-missing'
  | 'seam-endpoint-missing'
  | 'seam-impact'
  | 'seam-position'
  | 'validation-body-count'
  | 'validation-body-id'
  | 'validation-body-position'
  | 'validation-body-velocity'
  | 'validation-elapsed'
  | 'validation-impact'
  | 'validation-spacecraft-fuel'
  | 'validation-spacecraft-fuel-used'
  | 'validation-spacecraft-heading'
  | 'validation-spacecraft-position'
  | 'validation-spacecraft-velocity'
  | 'validation-target-missing'

export type FarTrajectoryPredictionDivergenceMeasurement = {
  bodyId: string | null
  delta: number | null
  gatesReuse: boolean
  metric:
    | 'body-count'
    | 'body-position'
    | 'body-velocity'
    | 'elapsed'
    | 'seam-position'
    | 'spacecraft-fuel'
    | 'spacecraft-fuel-used'
    | 'spacecraft-heading'
    | 'spacecraft-position'
    | 'spacecraft-target-relative-position'
    | 'spacecraft-target-relative-velocity'
    | 'spacecraft-velocity'
    | 'target-position'
    | 'target-velocity'
  tolerance: number
  unit: 'count' | 'meters' | 'meters-per-second' | 'scalar' | 'seconds'
}

export type FarTrajectoryPredictionDivergenceDiagnostics = {
  detail: string | null
  measurements: FarTrajectoryPredictionDivergenceMeasurement[]
  reason: FarTrajectoryPredictionDivergenceReason
}

export type FarTrajectoryPredictionReuseDiagnostics = {
  divergence: FarTrajectoryPredictionDivergenceDiagnostics | null
  extendedPointCount: number
  extendedSeconds: number
  fallbackReason: FarTrajectoryPredictionReuseFallbackReason | null
  mode: 'full' | 'trim-extend'
  retainedPointCount: number
  retainedSeconds: number
  trimmedPointCount: number
  trimmedSeconds: number
  validation: 'full' | 'performed'
  validationSeconds: number
}

const nowMs = () => performance.now()
const maxReuseElapsedHorizonRatio = 0.25
const maxConsecutiveCoastReusesBeforeFullRecalculation = 16
const boundReusePrecisionStepSeconds = 1
const boundValidationPositionPhaseToleranceSeconds = 20
const maxBoundValidationPositionToleranceMeters = 50_000
const boundSeamPositionPhaseToleranceSeconds = 25
const maxBoundSeamPositionToleranceMeters = 60_000
const statePositionToleranceMeters = 5_000
const stateVelocityToleranceMetersPerSecond = 5
const stateScalarTolerance = 0.001
const timeToleranceSeconds = 0.001

type FarTrajectoryPredictionCache = {
  allowLoopTrim: boolean
  computation: CoastTrajectoryPredictionComputation
  initialState: SimulationState
  reuseCount: number
  semanticInputKey: string
}

type FarTrajectoryPredictionCalculation = {
  cache: FarTrajectoryPredictionCache
  result: FarTrajectoryPredictionResultPayload
}

type CoastPredictionCalculation = {
  computation: CoastTrajectoryPredictionComputation
  reuse: FarTrajectoryPredictionReuseDiagnostics
  reuseCount: number
}

type CoastPredictionFallback = {
  divergence: FarTrajectoryPredictionDivergenceDiagnostics | null
  fallbackReason: FarTrajectoryPredictionReuseFallbackReason
}

const cloneBodySnapshot = (body: Body): FarTrajectoryPredictionBodySnapshot => {
  const { color: _color, ...snapshot } = body

  return {
    ...snapshot,
    position: { ...body.position },
    velocity: { ...body.velocity },
  }
}

export const createFarTrajectoryPredictionStateSnapshot = (
  state: SimulationState,
): FarTrajectoryPredictionStateSnapshot => ({
  bodies: state.bodies.map(cloneBodySnapshot),
  controls: { ...state.controls },
  elapsed: state.elapsed,
  spacecraft: {
    ...state.spacecraft,
    position: { ...state.spacecraft.position },
    velocity: { ...state.spacecraft.velocity },
  },
})

const toBody = (body: FarTrajectoryPredictionBodySnapshot): Body => ({
  ...body,
  color: '',
  position: { ...body.position },
  velocity: { ...body.velocity },
})

const toSimulationState = (
  snapshot: FarTrajectoryPredictionStateSnapshot,
): SimulationState => ({
  bodies: snapshot.bodies.map(toBody),
  controls: { ...snapshot.controls },
  elapsed: snapshot.elapsed,
  spacecraft: {
    ...snapshot.spacecraft,
    position: { ...snapshot.spacecraft.position },
    velocity: { ...snapshot.spacecraft.velocity },
  },
})

const isPassiveCoast = (payload: FarTrajectoryPredictionRequestPayload) =>
  payload.assistMode === 'off' &&
  payload.state.controls.main === 0 &&
  payload.state.controls.reverse === 0 &&
  payload.state.controls.strafe === 0 &&
  payload.state.controls.turn === 0

const getScalarDelta = (left: number, right: number) =>
  Number.isFinite(left) && Number.isFinite(right)
    ? Math.abs(left - right)
    : null

const getVectorDelta = (left: Vec2, right: Vec2) => {
  const delta = length(sub(left, right))
  return Number.isFinite(delta) ? delta : null
}

const getSpacecraftPositionToleranceMeters = (
  state: SimulationState,
  target: Body,
  allowLoopTrim: boolean,
  boundPhaseToleranceSeconds: number,
  maxBoundToleranceMeters: number,
) => {
  if (!allowLoopTrim) {
    return statePositionToleranceMeters
  }

  const targetRelativeSpeed = length(
    sub(state.spacecraft.velocity, target.velocity),
  )
  if (!Number.isFinite(targetRelativeSpeed)) {
    return statePositionToleranceMeters
  }

  return Math.min(
    maxBoundToleranceMeters,
    Math.max(
      statePositionToleranceMeters,
      targetRelativeSpeed * boundPhaseToleranceSeconds,
    ),
  )
}

const isWithinTolerance = (
  measurement: FarTrajectoryPredictionDivergenceMeasurement,
) => measurement.delta !== null && measurement.delta <= measurement.tolerance

const getStateDivergenceDiagnostics = (
  predictedState: SimulationState,
  liveState: SimulationState,
  targetId: string,
  spacecraftPositionToleranceMeters: number,
): FarTrajectoryPredictionDivergenceDiagnostics | null => {
  const measurements: FarTrajectoryPredictionDivergenceMeasurement[] = [
    {
      bodyId: null,
      delta: getScalarDelta(predictedState.elapsed, liveState.elapsed),
      gatesReuse: true,
      metric: 'elapsed',
      tolerance: timeToleranceSeconds,
      unit: 'seconds',
    },
    {
      bodyId: null,
      delta: getVectorDelta(
        predictedState.spacecraft.position,
        liveState.spacecraft.position,
      ),
      gatesReuse: true,
      metric: 'spacecraft-position',
      tolerance: spacecraftPositionToleranceMeters,
      unit: 'meters',
    },
    {
      bodyId: null,
      delta: getVectorDelta(
        predictedState.spacecraft.velocity,
        liveState.spacecraft.velocity,
      ),
      gatesReuse: true,
      metric: 'spacecraft-velocity',
      tolerance: stateVelocityToleranceMetersPerSecond,
      unit: 'meters-per-second',
    },
    {
      bodyId: null,
      delta: getScalarDelta(
        predictedState.spacecraft.heading,
        liveState.spacecraft.heading,
      ),
      gatesReuse: true,
      metric: 'spacecraft-heading',
      tolerance: stateScalarTolerance,
      unit: 'scalar',
    },
    {
      bodyId: null,
      delta: getScalarDelta(
        predictedState.spacecraft.fuel,
        liveState.spacecraft.fuel,
      ),
      gatesReuse: true,
      metric: 'spacecraft-fuel',
      tolerance: stateScalarTolerance,
      unit: 'scalar',
    },
    {
      bodyId: null,
      delta: getScalarDelta(
        predictedState.spacecraft.fuelUsed,
        liveState.spacecraft.fuelUsed,
      ),
      gatesReuse: true,
      metric: 'spacecraft-fuel-used',
      tolerance: stateScalarTolerance,
      unit: 'scalar',
    },
  ]

  if (predictedState.bodies.length !== liveState.bodies.length) {
    measurements.push({
      bodyId: null,
      delta: Math.abs(predictedState.bodies.length - liveState.bodies.length),
      gatesReuse: true,
      metric: 'body-count',
      tolerance: 0,
      unit: 'count',
    })
    return {
      detail: `${predictedState.bodies.length} predicted / ${liveState.bodies.length} live`,
      measurements,
      reason: 'validation-body-count',
    }
  }

  let maxBodyPosition: FarTrajectoryPredictionDivergenceMeasurement | null =
    null
  let maxBodyVelocity: FarTrajectoryPredictionDivergenceMeasurement | null =
    null
  for (const [index, predictedBody] of predictedState.bodies.entries()) {
    const liveBody = liveState.bodies[index]
    if (liveBody?.id !== predictedBody.id) {
      return {
        detail: `index ${index}: expected ${predictedBody.id}, got ${liveBody?.id ?? 'missing'}`,
        measurements,
        reason: 'validation-body-id',
      }
    }

    const bodyPosition: FarTrajectoryPredictionDivergenceMeasurement = {
      bodyId: predictedBody.id,
      delta: getVectorDelta(predictedBody.position, liveBody.position),
      gatesReuse: true,
      metric: 'body-position',
      tolerance: statePositionToleranceMeters,
      unit: 'meters',
    }
    if (
      !maxBodyPosition ||
      bodyPosition.delta === null ||
      (maxBodyPosition.delta !== null &&
        bodyPosition.delta > maxBodyPosition.delta)
    ) {
      maxBodyPosition = bodyPosition
    }

    const bodyVelocity: FarTrajectoryPredictionDivergenceMeasurement = {
      bodyId: predictedBody.id,
      delta: getVectorDelta(predictedBody.velocity, liveBody.velocity),
      gatesReuse: true,
      metric: 'body-velocity',
      tolerance: stateVelocityToleranceMetersPerSecond,
      unit: 'meters-per-second',
    }
    if (
      !maxBodyVelocity ||
      bodyVelocity.delta === null ||
      (maxBodyVelocity.delta !== null &&
        bodyVelocity.delta > maxBodyVelocity.delta)
    ) {
      maxBodyVelocity = bodyVelocity
    }
  }
  if (maxBodyPosition) {
    measurements.push(maxBodyPosition)
  }
  if (maxBodyVelocity) {
    measurements.push(maxBodyVelocity)
  }

  const predictedTarget = predictedState.bodies.find(
    (body) => body.id === targetId,
  )
  const liveTarget = liveState.bodies.find((body) => body.id === targetId)
  if (predictedTarget && liveTarget) {
    measurements.push(
      {
        bodyId: targetId,
        delta: getVectorDelta(predictedTarget.position, liveTarget.position),
        gatesReuse: false,
        metric: 'target-position',
        tolerance: statePositionToleranceMeters,
        unit: 'meters',
      },
      {
        bodyId: targetId,
        delta: getVectorDelta(predictedTarget.velocity, liveTarget.velocity),
        gatesReuse: false,
        metric: 'target-velocity',
        tolerance: stateVelocityToleranceMetersPerSecond,
        unit: 'meters-per-second',
      },
      {
        bodyId: targetId,
        delta: getVectorDelta(
          sub(predictedState.spacecraft.position, predictedTarget.position),
          sub(liveState.spacecraft.position, liveTarget.position),
        ),
        gatesReuse: false,
        metric: 'spacecraft-target-relative-position',
        tolerance: spacecraftPositionToleranceMeters,
        unit: 'meters',
      },
      {
        bodyId: targetId,
        delta: getVectorDelta(
          sub(predictedState.spacecraft.velocity, predictedTarget.velocity),
          sub(liveState.spacecraft.velocity, liveTarget.velocity),
        ),
        gatesReuse: false,
        metric: 'spacecraft-target-relative-velocity',
        tolerance: stateVelocityToleranceMetersPerSecond,
        unit: 'meters-per-second',
      },
    )
  }

  const failures = measurements.filter(
    (measurement) => measurement.gatesReuse && !isWithinTolerance(measurement),
  )
  const dominantFailure = failures.reduce<
    FarTrajectoryPredictionDivergenceMeasurement | undefined
  >((dominant, measurement) => {
    if (!dominant || measurement.delta === null) {
      return measurement
    }
    if (dominant.delta === null) {
      return dominant
    }
    return measurement.delta / measurement.tolerance >
      dominant.delta / dominant.tolerance
      ? measurement
      : dominant
  }, undefined)
  if (!dominantFailure) {
    return null
  }

  return {
    detail: null,
    measurements,
    reason:
      `validation-${dominantFailure.metric}` as FarTrajectoryPredictionDivergenceReason,
  }
}

const combineIntegrationDiagnostics = (
  first: TrajectoryPredictionResult['integration'],
  second: TrajectoryPredictionResult['integration'],
): TrajectoryPredictionResult['integration'] => {
  const stepCount = first.stepCount + second.stepCount
  const totalStepSeconds =
    (first.averageStepSeconds ?? 0) * first.stepCount +
    (second.averageStepSeconds ?? 0) * second.stepCount
  let minStepSeconds = first.minStepSeconds
  if (
    second.minStepSeconds !== null &&
    (minStepSeconds === null || second.minStepSeconds < minStepSeconds)
  ) {
    minStepSeconds = second.minStepSeconds
  }

  return {
    averageStepSeconds: stepCount > 0 ? totalStepSeconds / stepCount : null,
    minStepSeconds,
    stepCount,
  }
}

const shiftClosestApproach = (
  closestApproach: TrajectoryPredictionResult['closestApproach'],
  timeOffset: number,
) =>
  closestApproach
    ? { ...closestApproach, time: closestApproach.time + timeOffset }
    : null

const shiftSample = (
  sample: CoastTrajectoryPredictionSample,
  timeOffset: number,
): CoastTrajectoryPredictionSample => {
  const closestApproach = shiftClosestApproach(
    sample.closestApproach,
    timeOffset,
  )

  return {
    absolutePoint: { ...sample.absolutePoint },
    closestApproach:
      closestApproach && closestApproach.time > timeToleranceSeconds
        ? closestApproach
        : null,
    distanceSq: sample.distanceSq,
    point: { ...sample.point },
    time: sample.time + timeOffset,
  }
}

const getCloserApproach = (
  first: TrajectoryPredictionResult['closestApproach'],
  second: TrajectoryPredictionResult['closestApproach'],
) => {
  if (!first) {
    return second
  }
  if (!second) {
    return first
  }
  return first.altitude <= second.altitude ? first : second
}

const getSamplesClosestApproach = (
  samples: CoastTrajectoryPredictionSample[],
) =>
  samples.reduce<TrajectoryPredictionResult['closestApproach']>(
    (closestApproach, sample) =>
      getCloserApproach(closestApproach, sample.closestApproach),
    null,
  )

const normalizeAngle = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))

const getPredictionAngularTravel = (
  state: SimulationState,
  target: Body,
  samples: CoastTrajectoryPredictionSample[],
) => {
  const initialRelativePoint = sub(state.spacecraft.position, target.position)
  let previousAngle = Math.atan2(initialRelativePoint.y, initialRelativePoint.x)

  return samples.reduce((angularTravel, sample) => {
    const angle = Math.atan2(sample.point.y, sample.point.x)
    const nextAngularTravel =
      angularTravel + Math.abs(normalizeAngle(angle - previousAngle))
    previousAngle = angle
    return nextAngularTravel
  }, 0)
}

const getReuseFallbackReason = (
  payload: FarTrajectoryPredictionRequestPayload,
  state: SimulationState,
  cache: FarTrajectoryPredictionCache | null,
  allowLoopTrim: boolean,
): FarTrajectoryPredictionReuseFallbackReason | null => {
  if (!cache) {
    return 'no-cache'
  }
  if (cache.semanticInputKey !== payload.semanticInputKey) {
    return 'semantic-change'
  }
  if (!isPassiveCoast(payload)) {
    return 'not-passive-coast'
  }
  if (cache.allowLoopTrim !== allowLoopTrim) {
    return 'loop-trim-risk'
  }
  if (cache.reuseCount >= maxConsecutiveCoastReusesBeforeFullRecalculation) {
    return 'reuse-limit'
  }

  const elapsedSeconds = state.elapsed - cache.initialState.elapsed
  if (
    !Number.isFinite(elapsedSeconds) ||
    elapsedSeconds <= timeToleranceSeconds ||
    elapsedSeconds >
      payload.predictionConfig.horizonSeconds * maxReuseElapsedHorizonRatio
  ) {
    return 'elapsed-outside-window'
  }
  if (
    cache.computation.result.impact ||
    (!cache.allowLoopTrim &&
      Math.abs(
        cache.computation.predictionTime -
          payload.predictionConfig.horizonSeconds,
      ) > timeToleranceSeconds) ||
    cache.computation.samples.filter(
      (sample) => sample.time > elapsedSeconds + timeToleranceSeconds,
    ).length < 2
  ) {
    return 'cached-path-incomplete'
  }
  return null
}

const tryReuseCoastPrediction = (
  payload: FarTrajectoryPredictionRequestPayload,
  state: SimulationState,
  target: Body,
  cache: FarTrajectoryPredictionCache | null,
  allowLoopTrim: boolean,
): CoastPredictionCalculation | CoastPredictionFallback => {
  const fallbackReason = getReuseFallbackReason(
    payload,
    state,
    cache,
    allowLoopTrim,
  )
  if (fallbackReason || !cache) {
    return {
      divergence: null,
      fallbackReason: fallbackReason ?? 'no-cache',
    }
  }

  const elapsedSeconds = state.elapsed - cache.initialState.elapsed
  const validationElapsedSeconds = elapsedSeconds
  const validationTarget = cache.initialState.bodies.find(
    (body) => body.id === payload.targetId,
  )
  if (!validationTarget) {
    return {
      divergence: {
        detail: payload.targetId,
        measurements: [],
        reason: 'validation-target-missing',
      },
      fallbackReason: 'state-diverged',
    }
  }
  const validationSpacecraftPositionToleranceMeters =
    getSpacecraftPositionToleranceMeters(
      state,
      target,
      allowLoopTrim,
      boundValidationPositionPhaseToleranceSeconds,
      maxBoundValidationPositionToleranceMeters,
    )
  const validationMaxIntegrationStepSeconds = isCloseBoundCoastPrediction(
    cache.initialState,
    validationTarget,
    allowLoopTrim,
  )
    ? Math.min(
        boundReusePrecisionStepSeconds,
        payload.predictionConfig.maxIntegrationStepSeconds,
      )
    : payload.predictionConfig.maxIntegrationStepSeconds
  const validation = computeCoastTrajectoryPrediction(
    cache.initialState,
    semiImplicitEuler,
    validationTarget,
    {
      ...payload.predictionConfig,
      horizonSeconds: validationElapsedSeconds,
      maxIntegrationStepSeconds: validationMaxIntegrationStepSeconds,
    },
    false,
  )
  if (validation.result.impact) {
    return {
      divergence: {
        detail: validation.result.impact.bodyName,
        measurements: [],
        reason: 'validation-impact',
      },
      fallbackReason: 'state-diverged',
    }
  }
  const divergence = getStateDivergenceDiagnostics(
    validation.finalState,
    state,
    payload.targetId,
    validationSpacecraftPositionToleranceMeters,
  )
  if (divergence) {
    return {
      divergence,
      fallbackReason: 'state-diverged',
    }
  }

  let retainedSamples = cache.computation.samples
    .filter((sample) => sample.time > elapsedSeconds + timeToleranceSeconds)
    .map((sample) => shiftSample(sample, -elapsedSeconds))
  let seam: CoastTrajectoryPredictionComputation | null = null
  const firstRetainedSample = retainedSamples[0]
  if (firstRetainedSample) {
    const seamSpacecraftPositionToleranceMeters =
      getSpacecraftPositionToleranceMeters(
        state,
        target,
        allowLoopTrim,
        boundSeamPositionPhaseToleranceSeconds,
        maxBoundSeamPositionToleranceMeters,
      )
    const seamConfig = {
      ...payload.predictionConfig,
      horizonSeconds: firstRetainedSample.time,
      maxIntegrationStepSeconds: allowLoopTrim
        ? Math.min(
            boundReusePrecisionStepSeconds,
            payload.predictionConfig.maxIntegrationStepSeconds,
          )
        : payload.predictionConfig.maxIntegrationStepSeconds,
    }
    seam = computeCoastTrajectoryPrediction(
      state,
      semiImplicitEuler,
      target,
      seamConfig,
      false,
    )
    if (seam.result.impact) {
      return {
        divergence: {
          detail: seam.result.impact.bodyName,
          measurements: [],
          reason: 'seam-impact',
        },
        fallbackReason: 'state-diverged',
      }
    }
    if (!seam.result.absoluteEndPoint) {
      return {
        divergence: {
          detail: null,
          measurements: [],
          reason: 'seam-endpoint-missing',
        },
        fallbackReason: 'state-diverged',
      }
    }
    const seamPositionMeasurement: FarTrajectoryPredictionDivergenceMeasurement =
      {
        bodyId: null,
        delta: getVectorDelta(
          seam.result.absoluteEndPoint,
          firstRetainedSample.absolutePoint,
        ),
        gatesReuse: true,
        metric: 'seam-position',
        tolerance: seamSpacecraftPositionToleranceMeters,
        unit: 'meters',
      }
    if (!isWithinTolerance(seamPositionMeasurement)) {
      return {
        divergence: {
          detail: null,
          measurements: [seamPositionMeasurement],
          reason: 'seam-position',
        },
        fallbackReason: 'state-diverged',
      }
    }
    retainedSamples = [
      {
        ...firstRetainedSample,
        closestApproach: seam.result.closestApproach,
      },
      ...retainedSamples.slice(1),
    ]
  }

  const extensionOffsetSeconds =
    cache.computation.predictionTime - elapsedSeconds
  const extensionHorizonSeconds = Math.max(
    0,
    payload.predictionConfig.horizonSeconds - extensionOffsetSeconds,
  )
  const retainedAngularTravel = getPredictionAngularTravel(
    state,
    target,
    retainedSamples,
  )
  const remainingLoopAngularTravel = Math.max(
    0,
    payload.predictionConfig.maxLoopRevolutions * Math.PI * 2 -
      retainedAngularTravel,
  )
  const shouldExtend =
    extensionHorizonSeconds > timeToleranceSeconds &&
    (!allowLoopTrim || remainingLoopAngularTravel > 0)
  const extensionTarget = cache.computation.finalState.bodies.find(
    (body) => body.id === payload.targetId,
  )
  if (shouldExtend && !extensionTarget) {
    return {
      divergence: {
        detail: payload.targetId,
        measurements: [],
        reason: 'extension-target-missing',
      },
      fallbackReason: 'state-diverged',
    }
  }
  const extension =
    shouldExtend && extensionTarget
      ? computeCoastTrajectoryPrediction(
          cache.computation.finalState,
          semiImplicitEuler,
          extensionTarget,
          {
            ...payload.predictionConfig,
            horizonSeconds: extensionHorizonSeconds,
            maxLoopRevolutions: allowLoopTrim
              ? remainingLoopAngularTravel / (Math.PI * 2)
              : payload.predictionConfig.maxLoopRevolutions,
          },
          allowLoopTrim,
        )
      : null
  const extensionSamples = (extension?.samples ?? []).map((sample) =>
    shiftSample(sample, extensionOffsetSeconds),
  )
  const samples = [...retainedSamples, ...extensionSamples]
  const impact = extension?.result.impact
    ? {
        ...extension.result.impact,
        time: extension.result.impact.time + extensionOffsetSeconds,
      }
    : null
  const calculations = [validation, seam, extension].filter(
    (calculation): calculation is CoastTrajectoryPredictionComputation =>
      calculation !== null,
  )
  let integration = calculations.shift()?.result.integration ?? {
    averageStepSeconds: 0,
    minStepSeconds: 0,
    stepCount: 0,
  }
  for (const calculation of calculations) {
    integration = combineIntegrationDiagnostics(
      integration,
      calculation.result.integration,
    )
  }
  const result: TrajectoryPredictionResult = {
    absoluteEndPoint: samples.at(-1)?.absolutePoint ?? null,
    absolutePoints: [
      { ...state.spacecraft.position },
      ...samples.map((sample) => sample.absolutePoint),
    ],
    closestApproach: getSamplesClosestApproach(samples),
    eventMarkers: getCoastTrajectoryEventMarkers(samples, {
      includeApoapsis: allowLoopTrim && !impact,
      targetRadius: target.radius,
    }),
    impact,
    integration,
    relativePoints: samples.map((sample) => sample.point),
  }

  return {
    computation: {
      finalState: extension?.finalState ?? cache.computation.finalState,
      predictionTime: extensionOffsetSeconds + (extension?.predictionTime ?? 0),
      result,
      samples,
    },
    reuse: {
      divergence: null,
      extendedPointCount: extensionSamples.length,
      extendedSeconds: extension?.predictionTime ?? 0,
      fallbackReason: null,
      mode: 'trim-extend',
      retainedPointCount: retainedSamples.length,
      retainedSeconds: extensionOffsetSeconds,
      trimmedPointCount:
        cache.computation.samples.length - retainedSamples.length,
      trimmedSeconds: elapsedSeconds,
      validation: 'performed',
      validationSeconds: validationElapsedSeconds,
    },
    reuseCount: cache.reuseCount + 1,
  }
}

const calculateFarTrajectory = (
  payload: FarTrajectoryPredictionRequestPayload,
  cache: FarTrajectoryPredictionCache | null,
): FarTrajectoryPredictionCalculation => {
  const calculationStartMs = nowMs()
  const state = toSimulationState(payload.state)
  const target = state.bodies.find((body) => body.id === payload.targetId)

  if (!target) {
    throw new Error(`Missing prediction target: ${payload.targetId}`)
  }

  const allowLoopTrim =
    getCaptureMetricsForState(state, target).specificEnergy < 0
  const reused = tryReuseCoastPrediction(
    payload,
    state,
    target,
    cache,
    allowLoopTrim,
  )
  const coastCalculation: CoastPredictionCalculation =
    'fallbackReason' in reused
      ? {
          computation: computeCoastTrajectoryPrediction(
            state,
            semiImplicitEuler,
            target,
            payload.predictionConfig,
            allowLoopTrim,
          ),
          reuse: {
            divergence: reused.divergence,
            extendedPointCount: 0,
            extendedSeconds: 0,
            fallbackReason: reused.fallbackReason,
            mode: 'full',
            retainedPointCount: 0,
            retainedSeconds: 0,
            trimmedPointCount: 0,
            trimmedSeconds: 0,
            validation: 'full',
            validationSeconds: 0,
          },
          reuseCount: 0,
        }
      : reused
  const assistedPoints =
    payload.assistMode === 'off'
      ? []
      : predictAssistedTrajectory(
          state,
          semiImplicitEuler,
          target.id,
          payload.predictionConfig,
          (simulationState, targetId) =>
            getAssistPredictionControlsForState(
              simulationState,
              targetId,
              payload.assistMode,
              payload.autopilotRotationRate,
            ),
        ).relativePoints

  return {
    cache: {
      allowLoopTrim,
      computation: coastCalculation.computation,
      initialState: state,
      reuseCount: coastCalculation.reuseCount,
      semanticInputKey: payload.semanticInputKey,
    },
    result: {
      assistedPoints,
      calculationMs: nowMs() - calculationStartMs,
      coastPrediction: coastCalculation.computation.result,
      inputKey: payload.inputKey,
      jobId: payload.jobId,
      reuse: coastCalculation.reuse,
      semanticInputKey: payload.semanticInputKey,
      targetId: target.id,
    },
  }
}

export const predictFarTrajectory = (
  payload: FarTrajectoryPredictionRequestPayload,
): FarTrajectoryPredictionResultPayload =>
  calculateFarTrajectory(payload, null).result

export const createFarTrajectoryPredictor = () => {
  let cache: FarTrajectoryPredictionCache | null = null

  return (payload: FarTrajectoryPredictionRequestPayload) => {
    const calculation = calculateFarTrajectory(payload, cache)
    cache = calculation.cache
    return calculation.result
  }
}
