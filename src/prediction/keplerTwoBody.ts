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
  type CoastTrajectoryPredictionTerminationReason,
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
  closestApproach: PredictedClosestApproach | null
  eventMarkers: ReturnType<typeof getCoastTrajectoryEventMarkers>
  impact: PredictedImpact | null
  relativePoints: Vec2[]
  sampleTimes: number[]
  terminationReason: CoastTrajectoryPredictionTerminationReason
}

const normalizeAngle = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))

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
  let anomaly =
    Math.abs(alpha) > 1e-8
      ? sqrtMu * Math.abs(alpha) * elapsedSeconds
      : (sqrtMu * elapsedSeconds) / radius

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
    anomaly -= correction

    if (Math.abs(correction) < 1e-10) {
      return anomaly
    }
  }

  // Keep prediction best-effort so an experimental solver miss cannot unwind
  // the main animation loop. Consumers can reject unusable output separately.
  return anomaly
}

/** Propagates a spacecraft under only one body's gravity for elapsedSeconds. */
export const propagateKeplerTwoBody = (
  body: Body,
  spacecraft: Pick<Spacecraft, 'dryMass' | 'position' | 'velocity'>,
  elapsedSeconds: number,
): KeplerTwoBodyPropagation => {
  if (elapsedSeconds === 0) {
    return {
      position: { ...spacecraft.position },
      velocity: { ...spacecraft.velocity },
    }
  }

  if (body.mass <= 0) {
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
  const mu = G * body.mass
  const relativePosition = sub(spacecraft.position, body.position)
  const relativeVelocity = sub(spacecraft.velocity, body.velocity)
  const radius = length(relativePosition)
  const speedSquared =
    relativeVelocity.x * relativeVelocity.x +
    relativeVelocity.y * relativeVelocity.y
  const radialVelocity =
    (relativePosition.x * relativeVelocity.x +
      relativePosition.y * relativeVelocity.y) /
    radius
  const alpha = 2 / radius - speedSquared / mu
  const orbitalPeriod =
    alpha > 0 ? (2 * Math.PI) / Math.sqrt(mu * alpha ** 3) : null
  const propagationSeconds = orbitalPeriod
    ? ((elapsedSeconds % orbitalPeriod) + orbitalPeriod) % orbitalPeriod
    : elapsedSeconds
  const anomaly = solveUniversalAnomaly(
    radius,
    radialVelocity,
    alpha,
    mu,
    propagationSeconds,
  )
  const anomalySquared = anomaly * anomaly
  const z = alpha * anomalySquared
  const c = stumpffC(z)
  const s = stumpffS(z)
  const f = 1 - (anomalySquared / radius) * c
  const g = propagationSeconds - (anomaly ** 3 / Math.sqrt(mu)) * s
  const propagatedRelativePosition = add(
    scale(relativePosition, f),
    scale(relativeVelocity, g),
  )
  const propagatedRadius = length(propagatedRelativePosition)
  const fdot =
    (Math.sqrt(mu) / (propagatedRadius * radius)) *
    (alpha * anomaly ** 3 * s - anomaly)
  const gdot = 1 - (anomalySquared / propagatedRadius) * c
  const propagatedRelativeVelocity = add(
    scale(relativePosition, fdot),
    scale(relativeVelocity, gdot),
  )

  return {
    position: add(
      add(body.position, scale(body.velocity, elapsedSeconds)),
      propagatedRelativePosition,
    ),
    velocity: add(body.velocity, propagatedRelativeVelocity),
  }
}

export const sampleKeplerTwoBodyTrajectory = (
  body: Body,
  spacecraft: Pick<Spacecraft, 'dryMass' | 'position' | 'velocity'>,
  horizonSeconds: number,
  sampleStepSeconds: number,
  maxLoopRevolutions: number | null = null,
): KeplerTwoBodyTrajectory => {
  if (sampleStepSeconds <= 0) {
    throw new RangeError('sampleStepSeconds must be positive')
  }

  const absolutePoints: Vec2[] = [{ ...spacecraft.position }]
  const samples: CoastTrajectoryPredictionSample[] = []
  let closestApproach: PredictedClosestApproach | null = null
  let impact: PredictedImpact | null = null
  const relativePoints: Vec2[] = []
  const sampleTimes: number[] = []
  const maxLoopAngularTravel =
    maxLoopRevolutions === null ? null : maxLoopRevolutions * Math.PI * 2
  const initialRelativePoint = sub(spacecraft.position, body.position)
  let previousPredictionAngle = Math.atan2(
    initialRelativePoint.y,
    initialRelativePoint.x,
  )
  let predictionAngularTravel = 0
  let reachedLoopLimit = false

  for (
    let elapsedSeconds = Math.min(sampleStepSeconds, horizonSeconds);
    elapsedSeconds <= horizonSeconds;
    elapsedSeconds = Math.min(
      elapsedSeconds + sampleStepSeconds,
      horizonSeconds,
    )
  ) {
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
    const predictionAngle = Math.atan2(relativePoint.y, relativePoint.x)
    predictionAngularTravel += Math.abs(
      normalizeAngle(predictionAngle - previousPredictionAngle),
    )
    previousPredictionAngle = predictionAngle

    if (approach.altitude <= 0) {
      impact = { bodyName: body.name, time: elapsedSeconds }
      break
    }

    if (
      maxLoopAngularTravel !== null &&
      predictionAngularTravel >= maxLoopAngularTravel
    ) {
      reachedLoopLimit = true
      break
    }

    if (elapsedSeconds === horizonSeconds) {
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
    absolutePoints,
    closestApproach,
    eventMarkers: getCoastTrajectoryEventMarkers(samples, {
      includeApoapsis: false,
      targetRadius: body.radius,
    }),
    impact,
    relativePoints,
    sampleTimes,
    terminationReason,
  }
}

export const computeKeplerTwoBodyTrajectoryPrediction = (
  state: SimulationState,
  target: Body,
  predictionConfig: TrajectoryPredictionConfig,
  allowLoopTrim: boolean,
): CoastTrajectoryPredictionComputation => {
  const trajectory = sampleKeplerTwoBodyTrajectory(
    target,
    state.spacecraft,
    predictionConfig.horizonSeconds,
    predictionConfig.stepSeconds,
    allowLoopTrim ? predictionConfig.maxLoopRevolutions : null,
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
    terminationReason: trajectory.terminationReason,
  }
}
