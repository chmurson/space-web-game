import type { CaptureMetrics } from '../assist/orbitalAssist'
import type { Body } from '../simulation/types'
import { formatDistance } from '../ui/formatters'

export type BodyDistanceContext = {
  accessibleLabel: string
  altitudeLabel: string
  bodyId: string
  detailAccessibleLabel: string
  tooltipLabel: string
}

export const createBodyDistanceContext = (options: {
  target: Body
  targetMetrics: CaptureMetrics
}): BodyDistanceContext => {
  const altitudeLabel = `alt ${formatDistance(options.targetMetrics.surfaceDistance)}`
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
