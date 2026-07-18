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
  | 'loop-trim-risk'
  | 'no-cache'
  | 'not-passive-coast'
  | 'reuse-limit'
  | 'semantic-change'
  | 'state-diverged'

export type FarTrajectoryPredictionReuseDiagnostics = {
  extendedPointCount: number
  extendedSeconds: number
  fallbackReason: FarTrajectoryPredictionReuseFallbackReason | null
  mode: 'full' | 'trim-extend'
  retainedPointCount: number
  retainedSeconds: number
  trimmedPointCount: number
  trimmedSeconds: number
  validation: 'full' | 'performed' | 'skipped'
}

const nowMs = () => performance.now()
const maxReuseElapsedHorizonRatio = 0.25
const validateEveryConsecutiveCoastReuses = 4
const maxConsecutiveCoastReusesBeforeFullRecalculation = 16
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
  const shouldValidate =
    cache.reuseCount % validateEveryConsecutiveCoastReuses === 0
  const validation = shouldValidate
    ? computeCoastTrajectoryPrediction(
        cache.initialState,
        semiImplicitEuler,
        validationTarget,
        {
          ...payload.predictionConfig,
          horizonSeconds: elapsedSeconds,
        },
        false,
      )
    : null
  if (
    validation &&
    (validation.result.impact ||
      !isContinuousState(validation.finalState, state))
  ) {
    return 'state-diverged'
  }

  let retainedSamples = cache.computation.samples
    .filter((sample) => sample.time > elapsedSeconds + timeToleranceSeconds)
    .map((sample) => shiftSample(sample, -elapsedSeconds))
  let seam: CoastTrajectoryPredictionComputation | null = null
  const firstRetainedSample = retainedSamples[0]
  if (firstRetainedSample && !firstRetainedSample.closestApproach) {
    const seamConfig = {
      ...payload.predictionConfig,
      horizonSeconds: firstRetainedSample.time,
    }
    seam = computeCoastTrajectoryPrediction(
      state,
      semiImplicitEuler,
      target,
      seamConfig,
      false,
    )
    if (
      seam.result.impact ||
      !seam.result.absoluteEndPoint ||
      !isCloseVector(
        seam.result.absoluteEndPoint,
        firstRetainedSample.absolutePoint,
        statePositionToleranceMeters,
      )
    ) {
      return 'state-diverged'
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
    return 'state-diverged'
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
      extendedPointCount: extensionSamples.length,
      extendedSeconds: extension?.predictionTime ?? 0,
      fallbackReason: null,
      mode: 'trim-extend',
      retainedPointCount: retainedSamples.length,
      retainedSeconds: extensionOffsetSeconds,
      trimmedPointCount:
        cache.computation.samples.length - retainedSamples.length,
      trimmedSeconds: elapsedSeconds,
      validation: shouldValidate ? 'performed' : 'skipped',
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
            extendedPointCount: 0,
            extendedSeconds: 0,
            fallbackReason: reused,
            mode: 'full',
            retainedPointCount: 0,
            retainedSeconds: 0,
            trimmedPointCount: 0,
            trimmedSeconds: 0,
            validation: 'full',
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
