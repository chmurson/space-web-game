import type { CaptureMetrics } from '../assist/orbitalAssist'
import type { Body } from '../simulation/types'
import type { Vec2 } from '../simulation/vector'
import { formatDistance } from '../ui/formatters'

export type BodyDistanceContext = {
  accessibleLabel: string
  altitudeLabel: string
  bodyId: string
  detailAccessibleLabel: string
  tooltipLabel: string
}

export const getBodySurfaceDistanceMeters = (
  body: Pick<Body, 'position' | 'radius'>,
  spacecraftPosition: Vec2,
) =>
  Math.max(
    0,
    Math.hypot(
      spacecraftPosition.x - body.position.x,
      spacecraftPosition.y - body.position.y,
    ) - body.radius,
  )

export const createBodyDistanceContext = (options: {
  target: Body
  targetMetrics: CaptureMetrics
}): BodyDistanceContext => {
  const altitudeLabel = formatDistance(options.targetMetrics.surfaceDistance)
  const accessibleLabel = `altitude ${formatDistance(
    options.targetMetrics.surfaceDistance,
  )}`

  return {
    accessibleLabel: `${options.target.name}, ${accessibleLabel}`,
    altitudeLabel,
    bodyId: options.target.id,
    detailAccessibleLabel: accessibleLabel,
    tooltipLabel: `${options.target.name} · ${altitudeLabel}`,
  }
}
