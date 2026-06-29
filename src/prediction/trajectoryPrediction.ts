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

export type TrajectoryPredictionResult = {
  absoluteEndPoint: Vec2 | null
  absolutePoints: Vec2[]
  closestApproach: PredictedClosestApproach | null
  eventMarkers: TrajectoryPredictionEventMarker[]
  impact: PredictedImpact | null
  relativePoints: Vec2[]
}

export type AssistedTrajectoryPredictionResult = {
  relativePoints: Vec2[]
}

const normalizeAngle = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))
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

type TargetRelativePredictionSample = {
  distanceSq: number
  point: Vec2
  time: number
}

const isInteriorSample = (
  index: number,
  samples: TargetRelativePredictionSample[],
) => index > 0 && index < samples.length - 1

const findTargetRelativeExtremum = (
  samples: TargetRelativePredictionSample[],
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

const getTargetRelativeEventMarkers = (
  samples: TargetRelativePredictionSample[],
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

export const predictCoastTrajectory = (
  state: SimulationState,
  physicsEngine: PhysicsEngine,
  target: Body,
  predictionConfig: TrajectoryPredictionConfig,
  allowLoopTrim: boolean,
): TrajectoryPredictionResult => {
  let predictedState = cloneSimulationState(state)
  const absolutePoints: Vec2[] = [{ ...state.spacecraft.position }]
  const relativePoints: Vec2[] = []
  const targetRelativeSamples: TargetRelativePredictionSample[] = []
  const maxLoopAngularTravel = predictionConfig.maxLoopRevolutions * Math.PI * 2
  let closestApproach: PredictedClosestApproach | null = null
  let impact: PredictedImpact | null = null
  let previousPredictionAngle = Math.atan2(
    state.spacecraft.position.y - target.position.y,
    state.spacecraft.position.x - target.position.x,
  )
  let predictionAngularTravel = 0
  let predictionTime = 0

  while (predictionTime < predictionConfig.horizonSeconds && !impact) {
    const sampleEndTime = Math.min(
      predictionTime + predictionConfig.stepSeconds,
      predictionConfig.horizonSeconds,
    )
    while (predictionTime < sampleEndTime && !impact) {
      const dt = Math.min(
        getAdaptiveIntegrationStepSeconds(
          predictedState,
          predictionConfig.maxIntegrationStepSeconds,
        ),
        sampleEndTime - predictionTime,
      )
      predictedState = physicsEngine.step(predictedState, dt)
      predictionTime += dt
      const { spacecraft: predictedSpacecraft } = predictedState
      const predictedTarget = predictedState.bodies.find(
        (body) => body.id === target.id,
      )
      if (predictedTarget) {
        const altitude =
          length(sub(predictedSpacecraft.position, predictedTarget.position)) -
          predictedTarget.radius

        if (!closestApproach || altitude < closestApproach.altitude) {
          closestApproach = {
            altitude,
            bodyName: predictedTarget.name,
            time: predictionTime,
          }
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
    absolutePoints.push({ ...predictedState.spacecraft.position })
    relativePoints.push(relativePoint)
    targetRelativeSamples.push({
      distanceSq: lengthSq(relativePoint),
      point: relativePoint,
      time: predictionTime,
    })

    if (allowLoopTrim && predictionAngularTravel >= maxLoopAngularTravel) {
      break
    }
  }

  return {
    absoluteEndPoint:
      relativePoints.length > 0
        ? { ...predictedState.spacecraft.position }
        : null,
    absolutePoints,
    closestApproach,
    eventMarkers: getTargetRelativeEventMarkers(targetRelativeSamples, {
      includeApoapsis: allowLoopTrim && !impact,
      targetRadius: target.radius,
    }),
    impact,
    relativePoints,
  }
}

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
