import { G } from '../simulation/constants'
import { cloneSimulationState } from '../simulation/state'
import type {
  Body,
  ControlInput,
  PhysicsEngine,
  SimulationState,
} from '../simulation/types'
import { length, lengthSq, sub, type Vec2 } from '../simulation/vector'

export type TrajectoryPredictionConfig = {
  horizonSeconds: number
  maxIntegrationStepSeconds: number
  maxLoopRevolutions: number
  refreshInterval: number
  stepSeconds: number
}

export type TrajectoryPredictionSamplingConfig = {
  maxIntegrationStepSeconds: number
  refreshInterval: number
  stepOptionsSeconds: number[]
  targetMaxSteps: number
}

export type PredictedImpact = {
  bodyName: string
  time: number
}

export type PredictedClosestApproach = {
  altitude: number
  bodyName: string
  time: number
}

export type TrajectoryPredictionEventMarkerKind = 'apoapsis' | 'periapsis'

export type TrajectoryPredictionEventMarker = {
  altitude: number
  distance: number
  kind: TrajectoryPredictionEventMarkerKind
  point: Vec2
  time: number
}

export type TrajectoryPredictionIntegrationDiagnostics = {
  averageStepSeconds: number | null
  minStepSeconds: number | null
  stepCount: number
}

export type TrajectoryPredictionResult = {
  absoluteEndPoint: Vec2 | null
  absolutePoints: Vec2[]
  closestApproach: PredictedClosestApproach | null
  eventMarkers: TrajectoryPredictionEventMarker[]
  impact: PredictedImpact | null
  integration: TrajectoryPredictionIntegrationDiagnostics
  relativePoints: Vec2[]
}

export type CoastTrajectoryPredictionSample = {
  absolutePoint: Vec2
  closestApproach: PredictedClosestApproach | null
  distanceSq: number
  point: Vec2
  time: number
}

export type CoastTrajectoryPredictionTerminationReason =
  | 'horizon'
  | 'impact'
  | 'loop-limit'

export type CoastTrajectoryPredictionComputation = {
  finalState: SimulationState
  predictionTime: number
  result: TrajectoryPredictionResult
  samples: CoastTrajectoryPredictionSample[]
  terminationReason: CoastTrajectoryPredictionTerminationReason
}

export type AssistedTrajectoryPredictionResult = {
  relativePoints: Vec2[]
}

const normalizeAngle = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))
const closeBoundCoastPrecisionRadiusRatio = 3
const closeBoundCoastMaxIntegrationStepSeconds = 2
const gravityTimescaleStepRatio = 0.01
const minIntegrationStepSeconds = 1

export const getTrajectoryPredictionStepSeconds = (
  horizonSeconds: number,
  sampling: TrajectoryPredictionSamplingConfig,
) => {
  const targetStepSeconds = horizonSeconds / sampling.targetMaxSteps
  return (
    sampling.stepOptionsSeconds.find(
      (stepSeconds) => stepSeconds >= targetStepSeconds,
    ) ??
    sampling.stepOptionsSeconds.at(-1) ??
    1800
  )
}

export const getTrajectoryPredictionConfig = (
  horizonSeconds: number,
  sampling: TrajectoryPredictionSamplingConfig,
  maxLoopRevolutions: number,
): TrajectoryPredictionConfig => {
  const stepSeconds = getTrajectoryPredictionStepSeconds(
    horizonSeconds,
    sampling,
  )

  return {
    horizonSeconds,
    maxIntegrationStepSeconds: Math.min(
      stepSeconds,
      sampling.maxIntegrationStepSeconds,
    ),
    maxLoopRevolutions,
    refreshInterval: sampling.refreshInterval,
    stepSeconds,
  }
}

const getTargetRelativePosition = (
  simulationState: SimulationState,
  targetId: string,
  spacecraftPosition: Vec2,
) => {
  const predictedTarget = simulationState.bodies.find(
    (body) => body.id === targetId,
  )

  if (!predictedTarget) {
    return { ...spacecraftPosition }
  }

  return sub(spacecraftPosition, predictedTarget.position)
}

const getAdaptiveIntegrationStepSeconds = (
  state: SimulationState,
  maxStepSeconds: number,
) => {
  const gravityLimitedStepSeconds = state.bodies.reduce((stepSeconds, body) => {
    if (body.mass <= 0) {
      return stepSeconds
    }

    const distance = Math.max(
      length(sub(state.spacecraft.position, body.position)),
      body.radius,
    )
    const gravitationalTimescale = Math.sqrt(distance ** 3 / (G * body.mass))

    return Math.min(
      stepSeconds,
      gravitationalTimescale * gravityTimescaleStepRatio,
    )
  }, maxStepSeconds)

  return Math.max(minIntegrationStepSeconds, gravityLimitedStepSeconds)
}

export const getCoastTrajectoryPredictionMaxIntegrationStepSeconds = (
  state: SimulationState,
  target: Body,
  predictionConfig: TrajectoryPredictionConfig,
  allowLoopTrim: boolean,
) => {
  return isCloseBoundCoastPrediction(state, target, allowLoopTrim)
    ? Math.min(
        closeBoundCoastMaxIntegrationStepSeconds,
        predictionConfig.maxIntegrationStepSeconds,
      )
    : predictionConfig.maxIntegrationStepSeconds
}

export const isCloseBoundCoastPrediction = (
  state: SimulationState,
  target: Body,
  allowLoopTrim: boolean,
) =>
  allowLoopTrim &&
  target.radius > 0 &&
  length(sub(state.spacecraft.position, target.position)) / target.radius <=
    closeBoundCoastPrecisionRadiusRatio

const isInteriorSample = (
  index: number,
  samples: CoastTrajectoryPredictionSample[],
) => index > 0 && index < samples.length - 1

const findTargetRelativeExtremum = (
  samples: CoastTrajectoryPredictionSample[],
  compare: (candidate: number, current: number) => boolean,
) => {
  if (samples.length < 3) {
    return null
  }

  let extremumIndex = 0
  for (let index = 1; index < samples.length; index += 1) {
    if (compare(samples[index].distanceSq, samples[extremumIndex].distanceSq)) {
      extremumIndex = index
    }
  }

  return isInteriorSample(extremumIndex, samples)
    ? samples[extremumIndex]
    : null
}

export const getCoastTrajectoryEventMarkers = (
  samples: CoastTrajectoryPredictionSample[],
  options: { includeApoapsis: boolean; targetRadius: number },
): TrajectoryPredictionEventMarker[] => {
  const eventMarkers: TrajectoryPredictionEventMarker[] = []
  const periapsis = findTargetRelativeExtremum(
    samples,
    (candidate, current) => candidate < current,
  )

  if (periapsis) {
    const distance = Math.sqrt(periapsis.distanceSq)
    eventMarkers.push({
      altitude: distance - options.targetRadius,
      distance,
      kind: 'periapsis',
      point: { ...periapsis.point },
      time: periapsis.time,
    })
  }

  if (!options.includeApoapsis) {
    return eventMarkers
  }

  const apoapsis = findTargetRelativeExtremum(
    samples,
    (candidate, current) => candidate > current,
  )

  if (apoapsis) {
    const distance = Math.sqrt(apoapsis.distanceSq)
    eventMarkers.push({
      altitude: distance - options.targetRadius,
      distance,
      kind: 'apoapsis',
      point: { ...apoapsis.point },
      time: apoapsis.time,
    })
  }

  return eventMarkers
}

export const computeCoastTrajectoryPrediction = (
  state: SimulationState,
  physicsEngine: PhysicsEngine,
  target: Body,
  predictionConfig: TrajectoryPredictionConfig,
  allowLoopTrim: boolean,
): CoastTrajectoryPredictionComputation => {
  let predictedState = cloneSimulationState(state)
  const absolutePoints: Vec2[] = [{ ...state.spacecraft.position }]
  const relativePoints: Vec2[] = []
  const samples: CoastTrajectoryPredictionSample[] = []
  const maxIntegrationStepSeconds =
    getCoastTrajectoryPredictionMaxIntegrationStepSeconds(
      state,
      target,
      predictionConfig,
      allowLoopTrim,
    )
  const maxLoopAngularTravel = predictionConfig.maxLoopRevolutions * Math.PI * 2
  let closestApproach: PredictedClosestApproach | null = null
  let impact: PredictedImpact | null = null
  let sampleClosestApproach: PredictedClosestApproach | null = null
  let previousPredictionAngle = Math.atan2(
    state.spacecraft.position.y - target.position.y,
    state.spacecraft.position.x - target.position.x,
  )
  let predictionAngularTravel = 0
  let predictionTime = 0
  let reachedLoopLimit = false
  let integrationMinStepSeconds: number | null = null
  let integrationStepCount = 0
  let integrationStepSecondsTotal = 0

  while (predictionTime < predictionConfig.horizonSeconds && !impact) {
    const sampleEndTime = Math.min(
      predictionTime + predictionConfig.stepSeconds,
      predictionConfig.horizonSeconds,
    )
    while (predictionTime < sampleEndTime && !impact) {
      const dt = Math.min(
        getAdaptiveIntegrationStepSeconds(
          predictedState,
          maxIntegrationStepSeconds,
        ),
        sampleEndTime - predictionTime,
      )
      predictedState = physicsEngine.step(predictedState, dt)
      predictionTime += dt
      integrationStepCount += 1
      integrationStepSecondsTotal += dt
      integrationMinStepSeconds =
        integrationMinStepSeconds === null
          ? dt
          : Math.min(integrationMinStepSeconds, dt)
      const { spacecraft: predictedSpacecraft } = predictedState
      const predictedTarget = predictedState.bodies.find(
        (body) => body.id === target.id,
      )
      if (predictedTarget) {
        const altitude =
          length(sub(predictedSpacecraft.position, predictedTarget.position)) -
          predictedTarget.radius
        const approach = {
          altitude,
          bodyName: predictedTarget.name,
          time: predictionTime,
        }

        if (!closestApproach || altitude < closestApproach.altitude) {
          closestApproach = approach
        }
        if (
          !sampleClosestApproach ||
          altitude < sampleClosestApproach.altitude
        ) {
          sampleClosestApproach = approach
        }
      }

      const hitBody = predictedState.bodies.find(
        (body) =>
          length(sub(predictedSpacecraft.position, body.position)) <=
          body.radius,
      )
      if (hitBody) {
        impact = {
          bodyName: hitBody.name,
          time: predictionTime,
        }
      }
    }

    const relativePoint = getTargetRelativePosition(
      predictedState,
      target.id,
      predictedState.spacecraft.position,
    )
    const predictionAngle = Math.atan2(relativePoint.y, relativePoint.x)
    predictionAngularTravel += Math.abs(
      normalizeAngle(predictionAngle - previousPredictionAngle),
    )
    previousPredictionAngle = predictionAngle
    const absolutePoint = { ...predictedState.spacecraft.position }
    absolutePoints.push(absolutePoint)
    relativePoints.push(relativePoint)
    samples.push({
      absolutePoint,
      closestApproach: sampleClosestApproach,
      distanceSq: lengthSq(relativePoint),
      point: relativePoint,
      time: predictionTime,
    })
    sampleClosestApproach = null

    if (allowLoopTrim && predictionAngularTravel >= maxLoopAngularTravel) {
      reachedLoopLimit = true
      break
    }
  }

  let terminationReason: CoastTrajectoryPredictionTerminationReason = 'horizon'
  if (impact) {
    terminationReason = 'impact'
  } else if (reachedLoopLimit) {
    terminationReason = 'loop-limit'
  }

  return {
    finalState: predictedState,
    predictionTime,
    result: {
      absoluteEndPoint:
        relativePoints.length > 0
          ? { ...predictedState.spacecraft.position }
          : null,
      absolutePoints,
      closestApproach,
      eventMarkers: getCoastTrajectoryEventMarkers(samples, {
        includeApoapsis: allowLoopTrim && !impact,
        targetRadius: target.radius,
      }),
      impact,
      integration: {
        averageStepSeconds:
          integrationStepCount > 0
            ? integrationStepSecondsTotal / integrationStepCount
            : null,
        minStepSeconds: integrationMinStepSeconds,
        stepCount: integrationStepCount,
      },
      relativePoints,
    },
    samples,
    terminationReason,
  }
}

export const predictCoastTrajectory = (
  state: SimulationState,
  physicsEngine: PhysicsEngine,
  target: Body,
  predictionConfig: TrajectoryPredictionConfig,
  allowLoopTrim: boolean,
): TrajectoryPredictionResult =>
  computeCoastTrajectoryPrediction(
    state,
    physicsEngine,
    target,
    predictionConfig,
    allowLoopTrim,
  ).result

export const predictAssistedTrajectory = (
  state: SimulationState,
  physicsEngine: PhysicsEngine,
  targetId: string,
  predictionConfig: TrajectoryPredictionConfig,
  getControls: (
    simulationState: SimulationState,
    targetId: string,
  ) => ControlInput,
): AssistedTrajectoryPredictionResult => {
  let assistedState = cloneSimulationState(state)
  const relativePoints: Vec2[] = []
  let hitBody: Body | undefined
  let predictionTime = 0

  while (predictionTime < predictionConfig.horizonSeconds && !hitBody) {
    const sampleEndTime = Math.min(
      predictionTime + predictionConfig.stepSeconds,
      predictionConfig.horizonSeconds,
    )

    while (predictionTime < sampleEndTime && !hitBody) {
      const dt = Math.min(
        getAdaptiveIntegrationStepSeconds(
          assistedState,
          predictionConfig.maxIntegrationStepSeconds,
        ),
        sampleEndTime - predictionTime,
      )
      assistedState = {
        ...assistedState,
        controls: getControls(assistedState, targetId),
      }
      assistedState = physicsEngine.step(assistedState, dt)
      predictionTime += dt
      hitBody = assistedState.bodies.find(
        (body) =>
          length(sub(assistedState.spacecraft.position, body.position)) <=
          body.radius,
      )
    }

    relativePoints.push(
      getTargetRelativePosition(
        assistedState,
        targetId,
        assistedState.spacecraft.position,
      ),
    )
  }

  return { relativePoints }
}
