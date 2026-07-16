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
  | 'expired-metadata'
  | 'loop-trim-risk'
  | 'no-cache'
  | 'not-passive-coast'
  | 'reuse-limit'
  | 'semantic-change'
  | 'state-diverged'

export type FarTrajectoryPredictionReuseDiagnostics = {
  extendedSeconds: number
  fallbackReason: FarTrajectoryPredictionReuseFallbackReason | null
  mode: 'full' | 'trim-extend'
  retainedPointCount: number
}

const nowMs = () => performance.now()
const maxReuseElapsedHorizonRatio = 0.25
const maxConsecutiveCoastReuses = 4
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

const isCloseScalar = (left: number, right: number, tolerance: number) =>
  Number.isFinite(left) &&
  Number.isFinite(right) &&
  Math.abs(left - right) <= tolerance

const isCloseVector = (left: Vec2, right: Vec2, tolerance: number) =>
  length(sub(left, right)) <= tolerance

const isContinuousState = (
  predictedState: SimulationState,
  liveState: SimulationState,
) => {
  if (
    !isCloseScalar(
      predictedState.elapsed,
      liveState.elapsed,
      timeToleranceSeconds,
    ) ||
    predictedState.bodies.length !== liveState.bodies.length ||
    !isCloseVector(
      predictedState.spacecraft.position,
      liveState.spacecraft.position,
      statePositionToleranceMeters,
    ) ||
    !isCloseVector(
      predictedState.spacecraft.velocity,
      liveState.spacecraft.velocity,
      stateVelocityToleranceMetersPerSecond,
    ) ||
    !isCloseScalar(
      predictedState.spacecraft.heading,
      liveState.spacecraft.heading,
      stateScalarTolerance,
    ) ||
    !isCloseScalar(
      predictedState.spacecraft.fuel,
      liveState.spacecraft.fuel,
      stateScalarTolerance,
    ) ||
    !isCloseScalar(
      predictedState.spacecraft.fuelUsed,
      liveState.spacecraft.fuelUsed,
      stateScalarTolerance,
    )
  ) {
    return false
  }

  return predictedState.bodies.every((predictedBody, index) => {
    const liveBody = liveState.bodies[index]
    return (
      liveBody?.id === predictedBody.id &&
      isCloseVector(
        predictedBody.position,
        liveBody.position,
        statePositionToleranceMeters,
      ) &&
      isCloseVector(
        predictedBody.velocity,
        liveBody.velocity,
        stateVelocityToleranceMetersPerSecond,
      )
    )
  })
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

const shiftSample = (
  sample: CoastTrajectoryPredictionSample,
  timeOffset: number,
): CoastTrajectoryPredictionSample => ({
  absolutePoint: { ...sample.absolutePoint },
  distanceSq: sample.distanceSq,
  point: { ...sample.point },
  time: sample.time + timeOffset,
})

const shiftClosestApproach = (
  closestApproach: TrajectoryPredictionResult['closestApproach'],
  timeOffset: number,
) =>
  closestApproach
    ? { ...closestApproach, time: closestApproach.time + timeOffset }
    : null

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
  if (cache.allowLoopTrim || allowLoopTrim) {
    return 'loop-trim-risk'
  }
  if (cache.reuseCount >= maxConsecutiveCoastReuses) {
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
    Math.abs(
      cache.computation.predictionTime -
        payload.predictionConfig.horizonSeconds,
    ) > timeToleranceSeconds ||
    cache.computation.samples.filter(
      (sample) => sample.time > elapsedSeconds + timeToleranceSeconds,
    ).length < 2
  ) {
    return 'cached-path-incomplete'
  }
  if (
    (cache.computation.result.closestApproach?.time ??
      Number.POSITIVE_INFINITY) <=
      elapsedSeconds + timeToleranceSeconds ||
    cache.computation.result.eventMarkers.some(
      (marker) => marker.time <= elapsedSeconds + timeToleranceSeconds,
    )
  ) {
    return 'expired-metadata'
  }

  return null
}

const tryReuseCoastPrediction = (
  payload: FarTrajectoryPredictionRequestPayload,
  state: SimulationState,
  target: Body,
  cache: FarTrajectoryPredictionCache | null,
  allowLoopTrim: boolean,
): CoastPredictionCalculation | FarTrajectoryPredictionReuseFallbackReason => {
  const fallbackReason = getReuseFallbackReason(
    payload,
    state,
    cache,
    allowLoopTrim,
  )
  if (fallbackReason || !cache) {
    return fallbackReason ?? 'no-cache'
  }

  const elapsedSeconds = state.elapsed - cache.initialState.elapsed
  const validationTarget = cache.initialState.bodies.find(
    (body) => body.id === payload.targetId,
  )
  if (!validationTarget) {
    return 'state-diverged'
  }
  const elapsedConfig = {
    ...payload.predictionConfig,
    horizonSeconds: elapsedSeconds,
  }
  const validation = computeCoastTrajectoryPrediction(
    cache.initialState,
    semiImplicitEuler,
    validationTarget,
    elapsedConfig,
    false,
  )
  if (
    validation.result.impact ||
    !isContinuousState(validation.finalState, state)
  ) {
    return 'state-diverged'
  }

  const extensionTarget = cache.computation.finalState.bodies.find(
    (body) => body.id === payload.targetId,
  )
  if (!extensionTarget) {
    return 'state-diverged'
  }
  const extension = computeCoastTrajectoryPrediction(
    cache.computation.finalState,
    semiImplicitEuler,
    extensionTarget,
    elapsedConfig,
    false,
  )
  const retainedSamples = cache.computation.samples
    .filter((sample) => sample.time > elapsedSeconds + timeToleranceSeconds)
    .map((sample) => shiftSample(sample, -elapsedSeconds))
  const extensionOffsetSeconds =
    cache.computation.predictionTime - elapsedSeconds
  const extensionSamples = extension.samples.map((sample) =>
    shiftSample(sample, extensionOffsetSeconds),
  )
  const samples = [...retainedSamples, ...extensionSamples]
  const shiftedPreviousClosestApproach = shiftClosestApproach(
    cache.computation.result.closestApproach,
    -elapsedSeconds,
  )
  const shiftedExtensionClosestApproach = shiftClosestApproach(
    extension.result.closestApproach,
    extensionOffsetSeconds,
  )
  const impact = extension.result.impact
    ? {
        ...extension.result.impact,
        time: extension.result.impact.time + extensionOffsetSeconds,
      }
    : null
  const result: TrajectoryPredictionResult = {
    absoluteEndPoint: samples.at(-1)?.absolutePoint ?? null,
    absolutePoints: [
      { ...state.spacecraft.position },
      ...samples.map((sample) => sample.absolutePoint),
    ],
    closestApproach: getCloserApproach(
      shiftedPreviousClosestApproach,
      shiftedExtensionClosestApproach,
    ),
    eventMarkers: getCoastTrajectoryEventMarkers(samples, {
      includeApoapsis: false,
      targetRadius: target.radius,
    }),
    impact,
    integration: combineIntegrationDiagnostics(
      validation.result.integration,
      extension.result.integration,
    ),
    relativePoints: samples.map((sample) => sample.point),
  }

  return {
    computation: {
      finalState: extension.finalState,
      predictionTime: extensionOffsetSeconds + extension.predictionTime,
      result,
      samples,
    },
    reuse: {
      extendedSeconds: extension.predictionTime,
      fallbackReason: null,
      mode: 'trim-extend',
      retainedPointCount: retainedSamples.length,
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
    typeof reused === 'string'
      ? {
          computation: computeCoastTrajectoryPrediction(
            state,
            semiImplicitEuler,
            target,
            payload.predictionConfig,
            allowLoopTrim,
          ),
          reuse: {
            extendedSeconds: 0,
            fallbackReason: reused,
            mode: 'full',
            retainedPointCount: 0,
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
