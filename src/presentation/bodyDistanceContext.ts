import type { CaptureMetrics } from '../assist/orbitalAssist'
import type { PredictedClosestApproach } from '../prediction/trajectoryPrediction'
import { G } from '../simulation/constants'
import type { Body, Spacecraft } from '../simulation/types'
import { length, lengthSq, sub } from '../simulation/vector'
import { formatDistance } from '../ui/formatters'

export type BodyDistanceContext = {
  accessibleLabel: string
  altitudeLabel: string
  bodyId: string
  detailAccessibleLabel: string
  tooltipLabel: string
}

type ApsisAltitudes = {
  apoapsisMeters: number | null
  periapsisMeters: number | null
}

const getCurrentApsisAltitudes = (
  body: Body,
  spacecraft: Spacecraft,
): ApsisAltitudes => {
  const mu = G * body.mass
  if (mu <= 0) {
    return { apoapsisMeters: null, periapsisMeters: null }
  }

  const relativePosition = sub(spacecraft.position, body.position)
  const relativeVelocity = sub(spacecraft.velocity, body.velocity)
  const radiusMeters = Math.max(length(relativePosition), body.radius)
  const speedSq = lengthSq(relativeVelocity)
  const specificEnergy = speedSq / 2 - mu / radiusMeters
  const angularMomentum =
    relativePosition.x * relativeVelocity.y -
    relativePosition.y * relativeVelocity.x
  const angularMomentumSq = angularMomentum ** 2

  if (angularMomentumSq <= 0) {
    return { apoapsisMeters: null, periapsisMeters: null }
  }

  const eccentricity = Math.sqrt(
    Math.max(0, 1 + (2 * specificEnergy * angularMomentumSq) / mu ** 2),
  )
  const periapsisRadius = angularMomentumSq / (mu * (1 + eccentricity))
  const periapsisMeters = Number.isFinite(periapsisRadius)
    ? Math.max(0, periapsisRadius - body.radius)
    : null

  if (specificEnergy >= 0 || eccentricity >= 1) {
    return { apoapsisMeters: null, periapsisMeters }
  }

  const apoapsisRadius = angularMomentumSq / (mu * (1 - eccentricity))
  const apoapsisMeters = Number.isFinite(apoapsisRadius)
    ? Math.max(0, apoapsisRadius - body.radius)
    : null

  return { apoapsisMeters, periapsisMeters }
}

export const createBodyDistanceContext = (options: {
  predictedClosestApproach: PredictedClosestApproach | null
  spacecraft: Spacecraft
  target: Body
  targetMetrics: CaptureMetrics
}): BodyDistanceContext => {
  const altitudeLabel = `alt ${formatDistance(options.targetMetrics.surfaceDistance)}`
  const apsis = getCurrentApsisAltitudes(options.target, options.spacecraft)
  const useBoundApsides = options.targetMetrics.specificEnergy < 0
  const predictedPeriapsisMeters =
    options.predictedClosestApproach?.bodyName === options.target.name
      ? options.predictedClosestApproach.altitude
      : null
  const periapsisMeters = useBoundApsides
    ? apsis.periapsisMeters
    : (predictedPeriapsisMeters ?? apsis.periapsisMeters)
  const apoapsisMeters = useBoundApsides ? apsis.apoapsisMeters : null
  const parts = [altitudeLabel]
  const accessibleParts = [
    `altitude ${formatDistance(options.targetMetrics.surfaceDistance)}`,
  ]

  if (periapsisMeters !== null) {
    parts.push(`Pe ${formatDistance(Math.max(0, periapsisMeters))}`)
    accessibleParts.push(
      `closest point ${formatDistance(Math.max(0, periapsisMeters))}`,
    )
  }

  if (apoapsisMeters !== null) {
    parts.push(`Ap ${formatDistance(apoapsisMeters)}`)
    accessibleParts.push(`farthest point ${formatDistance(apoapsisMeters)}`)
  }

  return {
    accessibleLabel: `${options.target.name}, ${accessibleParts.join(', ')}`,
    altitudeLabel,
    bodyId: options.target.id,
    detailAccessibleLabel: accessibleParts.join(', '),
    tooltipLabel: `${options.target.name} · ${parts.join(' · ')}`,
  }
}
