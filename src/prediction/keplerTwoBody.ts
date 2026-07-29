import { G } from '../simulation/constants'
import { cloneSimulationState } from '../simulation/state'
import type { Body, SimulationState, Spacecraft } from '../simulation/types'
import {
  add,
  length,
  lengthSq,
  scale,
  sub,
  type Vec2,
} from '../simulation/vector'
import {
  type CoastTrajectoryPredictionComputation,
  type CoastTrajectoryPredictionSample,
  getCoastTrajectoryEventMarkers,
  type PredictedClosestApproach,
  type PredictedImpact,
  type TrajectoryPredictionConfig,
} from './trajectoryPrediction'

export type KeplerTwoBodyPropagation = {
  position: Vec2
  velocity: Vec2
}

export type KeplerTwoBodyTrajectory = {
  absolutePoints: Vec2[]
  closedOrbit: boolean
  closestApproach: PredictedClosestApproach | null
  eventMarkers: ReturnType<typeof getCoastTrajectoryEventMarkers>
  impact: PredictedImpact | null
  relativePoints: Vec2[]
  sampleTimes: number[]
}

type KeplerTwoBodyParameters = {
  gravitationalParameter: number
  orbitalPeriod: number | null
  periapsisRadius: number | null
  radialVelocity: number
  radius: number
  reciprocalSemimajorAxis: number
  relativePosition: Vec2
  relativeVelocity: Vec2
}

const closedOrbitMinSampleCount = 128
const closedOrbitMaxSampleCount = 1_200
const universalAnomalyTolerance = 1e-8

const getKeplerTwoBodyParameters = (
  body: Body,
  spacecraft: Pick<Spacecraft, 'position' | 'velocity'>,
): KeplerTwoBodyParameters | null => {
  if (body.mass <= 0) {
    return null
  }

  const gravitationalParameter = G * body.mass
  const relativePosition = sub(spacecraft.position, body.position)
  const relativeVelocity = sub(spacecraft.velocity, body.velocity)
  const radius = length(relativePosition)
  if (
    !Number.isFinite(gravitationalParameter) ||
    gravitationalParameter <= 0 ||
    !Number.isFinite(radius) ||
    radius <= 0
  ) {
    return null
  }

  const speedSquared =
    relativeVelocity.x * relativeVelocity.x +
    relativeVelocity.y * relativeVelocity.y
  const radialVelocity =
    (relativePosition.x * relativeVelocity.x +
      relativePosition.y * relativeVelocity.y) /
    radius
  const reciprocalSemimajorAxis =
    2 / radius - speedSquared / gravitationalParameter
  if (reciprocalSemimajorAxis <= 0) {
    return {
      gravitationalParameter,
      orbitalPeriod: null,
      periapsisRadius: null,
      radialVelocity,
      radius,
      reciprocalSemimajorAxis,
      relativePosition,
      relativeVelocity,
    }
  }

  const angularMomentum =
    relativePosition.x * relativeVelocity.y -
    relativePosition.y * relativeVelocity.x
  const eccentricity = Math.sqrt(
    Math.max(
      0,
      1 -
        (reciprocalSemimajorAxis * angularMomentum ** 2) /
          gravitationalParameter,
    ),
  )
  const semimajorAxis = 1 / reciprocalSemimajorAxis

  return {
    gravitationalParameter,
    orbitalPeriod:
      (2 * Math.PI) /
      Math.sqrt(gravitationalParameter * reciprocalSemimajorAxis ** 3),
    periapsisRadius: semimajorAxis * (1 - eccentricity),
    radialVelocity,
    radius,
    reciprocalSemimajorAxis,
    relativePosition,
    relativeVelocity,
  }
}

export const getClosedKeplerTwoBodyOrbitPeriod = (
  body: Body,
  spacecraft: Pick<Spacecraft, 'position' | 'velocity'>,
) => {
  const parameters = getKeplerTwoBodyParameters(body, spacecraft)
  if (
    !Number.isFinite(parameters?.orbitalPeriod) ||
    !parameters?.orbitalPeriod ||
    parameters.periapsisRadius === null ||
    parameters.periapsisRadius <= body.radius
  ) {
    return null
  }

  return parameters.orbitalPeriod
}

const stumpffC = (z: number) => {
  if (z > 1e-8) {
    const root = Math.sqrt(z)
    return (1 - Math.cos(root)) / z
  }

  if (z < -1e-8) {
    const root = Math.sqrt(-z)
    return (Math.cosh(root) - 1) / -z
  }

  return 0.5 - z / 24 + (z * z) / 720 - (z * z * z) / 40_320
}

const stumpffS = (z: number) => {
  if (z > 1e-8) {
    const root = Math.sqrt(z)
    return (root - Math.sin(root)) / root ** 3
  }

  if (z < -1e-8) {
    const root = Math.sqrt(-z)
    return (Math.sinh(root) - root) / root ** 3
  }

  return 1 / 6 - z / 120 + (z * z) / 5_040 - (z * z * z) / 362_880
}

const solveUniversalAnomaly = (
  radius: number,
  radialVelocity: number,
  reciprocalSemimajorAxis: number,
  gravitationalParameter: number,
  elapsedSeconds: number,
) => {
  const sqrtMu = Math.sqrt(gravitationalParameter)
  const alpha = reciprocalSemimajorAxis
  const useEnergyScaledGuess = alpha > 0 || Math.abs(alpha) > 1e-8
  let anomaly = useEnergyScaledGuess
    ? sqrtMu * Math.abs(alpha) * elapsedSeconds
    : (sqrtMu * elapsedSeconds) / radius
  let lowerBound = 0
  let upperBound = alpha > 0 ? (2 * Math.PI) / Math.sqrt(alpha) : null

  if (elapsedSeconds < 0) {
    anomaly = -anomaly
  }

  for (let iteration = 0; iteration < 50; iteration += 1) {
    const anomalySquared = anomaly * anomaly
    const z = alpha * anomalySquared
    const c = stumpffC(z)
    const s = stumpffS(z)
    const functionValue =
      (radius * radialVelocity * anomalySquared * c) / sqrtMu +
      (1 - alpha * radius) * anomaly ** 3 * s +
      radius * anomaly -
      sqrtMu * elapsedSeconds
    const derivative =
      (radius * radialVelocity * anomaly * (1 - z * s)) / sqrtMu +
      (1 - alpha * radius) * anomalySquared * c +
      radius
    const correction = functionValue / derivative
    if (Math.abs(correction) < universalAnomalyTolerance) {
      return anomaly
    }
    let nextAnomaly = anomaly - correction

    if (upperBound !== null) {
      if (functionValue > 0) {
        upperBound = anomaly
      } else {
        lowerBound = anomaly
      }
      if (
        !Number.isFinite(nextAnomaly) ||
        nextAnomaly <= lowerBound ||
        nextAnomaly >= upperBound
      ) {
        nextAnomaly = (lowerBound + upperBound) / 2
      }
    }

    anomaly = nextAnomaly
  }

  throw new Error('Kepler two-body propagation did not converge')
}

/** Propagates a spacecraft under only one body's gravity for elapsedSeconds. */
export const propagateKeplerTwoBody = (
  body: Body,
  spacecraft: Pick<Spacecraft, 'position' | 'velocity'>,
  elapsedSeconds: number,
): KeplerTwoBodyPropagation => {
  if (elapsedSeconds === 0) {
    return {
      position: { ...spacecraft.position },
      velocity: { ...spacecraft.velocity },
    }
  }

  const parameters = getKeplerTwoBodyParameters(body, spacecraft)
  if (!parameters) {
    return {
      position: add(
        spacecraft.position,
        scale(spacecraft.velocity, elapsedSeconds),
      ),
      velocity: { ...spacecraft.velocity },
    }
  }

  // The spacecraft mass is negligible relative to the attracting body and the
  // scenario's numerical gravity uses the body's mass as the source parameter.
  const propagationSeconds = parameters.orbitalPeriod
    ? ((elapsedSeconds % parameters.orbitalPeriod) + parameters.orbitalPeriod) %
      parameters.orbitalPeriod
    : elapsedSeconds
  const anomaly = solveUniversalAnomaly(
    parameters.radius,
    parameters.radialVelocity,
    parameters.reciprocalSemimajorAxis,
    parameters.gravitationalParameter,
    propagationSeconds,
  )
  const anomalySquared = anomaly * anomaly
  const z = parameters.reciprocalSemimajorAxis * anomalySquared
  const c = stumpffC(z)
  const s = stumpffS(z)
  const f = 1 - (anomalySquared / parameters.radius) * c
  const g =
    propagationSeconds -
    (anomaly ** 3 / Math.sqrt(parameters.gravitationalParameter)) * s
  const propagatedRelativePosition = add(
    scale(parameters.relativePosition, f),
    scale(parameters.relativeVelocity, g),
  )
  const propagatedRadius = length(propagatedRelativePosition)
  const fdot =
    (Math.sqrt(parameters.gravitationalParameter) /
      (propagatedRadius * parameters.radius)) *
    (parameters.reciprocalSemimajorAxis * anomaly ** 3 * s - anomaly)
  const gdot = 1 - (anomalySquared / propagatedRadius) * c
  const propagatedRelativeVelocity = add(
    scale(parameters.relativePosition, fdot),
    scale(parameters.relativeVelocity, gdot),
  )

  return {
    position: add(
      add(body.position, scale(body.velocity, elapsedSeconds)),
      propagatedRelativePosition,
    ),
    velocity: add(body.velocity, propagatedRelativeVelocity),
  }
}

const getKeplerTrajectorySampleTimes = (
  horizonSeconds: number,
  sampleStepSeconds: number,
  closedOrbitPeriod: number | null,
) => {
  if (closedOrbitPeriod !== null) {
    const requestedSampleCount =
      Number.isFinite(sampleStepSeconds) && sampleStepSeconds > 0
        ? Math.ceil(closedOrbitPeriod / sampleStepSeconds)
        : closedOrbitMinSampleCount
    const sampleCount = Math.min(
      closedOrbitMaxSampleCount,
      Math.max(closedOrbitMinSampleCount, requestedSampleCount),
    )

    return Array.from(
      { length: sampleCount },
      (_, index) => (closedOrbitPeriod * (index + 1)) / sampleCount,
    )
  }

  if (
    !Number.isFinite(horizonSeconds) ||
    horizonSeconds <= 0 ||
    !Number.isFinite(sampleStepSeconds) ||
    sampleStepSeconds <= 0
  ) {
    return []
  }

  const sampleTimes: number[] = []
  for (
    let elapsedSeconds = Math.min(sampleStepSeconds, horizonSeconds);
    elapsedSeconds <= horizonSeconds;
    elapsedSeconds = Math.min(
      elapsedSeconds + sampleStepSeconds,
      horizonSeconds,
    )
  ) {
    sampleTimes.push(elapsedSeconds)
    if (elapsedSeconds === horizonSeconds) {
      break
    }
  }
  return sampleTimes
}

export const sampleKeplerTwoBodyTrajectory = (
  body: Body,
  spacecraft: Pick<Spacecraft, 'position' | 'velocity'>,
  horizonSeconds: number,
  sampleStepSeconds: number,
): KeplerTwoBodyTrajectory => {
  const absolutePoints: Vec2[] = [{ ...spacecraft.position }]
  const samples: CoastTrajectoryPredictionSample[] = []
  let closestApproach: PredictedClosestApproach | null = null
  let impact: PredictedImpact | null = null
  const relativePoints: Vec2[] = []
  const sampleTimes: number[] = []
  const closedOrbitPeriod = getClosedKeplerTwoBodyOrbitPeriod(body, spacecraft)

  for (const elapsedSeconds of getKeplerTrajectorySampleTimes(
    horizonSeconds,
    sampleStepSeconds,
    closedOrbitPeriod,
  )) {
    const propagated = propagateKeplerTwoBody(body, spacecraft, elapsedSeconds)
    const bodyPosition = add(
      body.position,
      scale(body.velocity, elapsedSeconds),
    )

    absolutePoints.push(propagated.position)
    const relativePoint = sub(propagated.position, bodyPosition)
    const approach = {
      altitude: length(relativePoint) - body.radius,
      bodyName: body.name,
      time: elapsedSeconds,
    }
    closestApproach =
      closestApproach && closestApproach.altitude <= approach.altitude
        ? closestApproach
        : approach
    relativePoints.push(relativePoint)
    sampleTimes.push(elapsedSeconds)
    samples.push({
      absolutePoint: propagated.position,
      closestApproach: approach,
      distanceSq: lengthSq(relativePoint),
      point: relativePoint,
      time: elapsedSeconds,
    })

    if (approach.altitude <= 0) {
      impact = { bodyName: body.name, time: elapsedSeconds }
      break
    }
  }

  return {
    absolutePoints,
    closedOrbit: closedOrbitPeriod !== null && !impact,
    closestApproach,
    eventMarkers: getCoastTrajectoryEventMarkers(samples, {
      includeApoapsis: closedOrbitPeriod !== null && !impact,
      targetRadius: body.radius,
    }),
    impact,
    relativePoints,
    sampleTimes,
  }
}

export const computeKeplerTwoBodyTrajectoryPrediction = (
  state: SimulationState,
  target: Body,
  predictionConfig: TrajectoryPredictionConfig,
): CoastTrajectoryPredictionComputation => {
  const trajectory = sampleKeplerTwoBodyTrajectory(
    target,
    state.spacecraft,
    predictionConfig.horizonSeconds,
    predictionConfig.stepSeconds,
  )
  const predictionTime = trajectory.sampleTimes.at(-1) ?? 0
  const finalPropagation = propagateKeplerTwoBody(
    target,
    state.spacecraft,
    predictionTime,
  )
  const finalState = cloneSimulationState(state)
  finalState.elapsed += predictionTime
  finalState.spacecraft.position = finalPropagation.position
  finalState.spacecraft.velocity = finalPropagation.velocity
  let terminationReason: CoastTrajectoryPredictionComputation['terminationReason'] =
    'horizon'
  if (trajectory.impact) {
    terminationReason = 'impact'
  } else if (trajectory.closedOrbit) {
    terminationReason = 'closed-orbit'
  }

  return {
    finalState,
    predictionTime,
    result: {
      absoluteEndPoint: trajectory.absolutePoints.at(-1) ?? null,
      absolutePoints: trajectory.absolutePoints,
      closestApproach: trajectory.closestApproach,
      eventMarkers: trajectory.eventMarkers,
      impact: trajectory.impact,
      integration: {
        averageStepSeconds: null,
        minStepSeconds: null,
        stepCount: 0,
      },
      relativePoints: trajectory.relativePoints,
    },
    samples: trajectory.sampleTimes.flatMap((time, index) => {
      const absolutePoint = trajectory.absolutePoints[index + 1]
      const relativePoint = trajectory.relativePoints[index]
      if (!absolutePoint || !relativePoint) {
        return []
      }
      return [
        {
          absolutePoint,
          closestApproach: {
            altitude: length(relativePoint) - target.radius,
            bodyName: target.name,
            time,
          },
          distanceSq: lengthSq(relativePoint),
          point: relativePoint,
          time,
        },
      ]
    }),
    terminationReason,
  }
}
