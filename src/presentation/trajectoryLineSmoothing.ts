import type { Vec2 } from '../simulation/vector'

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)

export const getUnrevealedTrajectoryTipSeconds = (options: {
  predictionRefreshAgeSeconds: number
  predictionRefreshIntervalSeconds: number
  timeWarp: number
}) =>
  Math.max(
    0,
    options.predictionRefreshIntervalSeconds -
      Math.max(0, options.predictionRefreshAgeSeconds),
  ) * Math.max(0, options.timeWarp)

export const getTrajectoryPointsWithStart = (
  points: Vec2[],
  startPoint: Vec2,
): Vec2[] => (points.length === 0 ? points : [startPoint, ...points])

export const getBlendedTrajectoryPoints = (
  currentPoints: Vec2[],
  previousPoints: Vec2[] | null,
  blend: number,
): Vec2[] => {
  if (
    !previousPoints ||
    previousPoints.length !== currentPoints.length ||
    currentPoints.length < 2
  ) {
    return currentPoints
  }

  const clampedBlend = clamp01(blend)
  if (clampedBlend >= 1) {
    return currentPoints
  }

  return currentPoints.map((point, index) => {
    if (index === 0) {
      return point
    }

    const previousPoint = previousPoints[index]
    return {
      x: previousPoint.x + (point.x - previousPoint.x) * clampedBlend,
      y: previousPoint.y + (point.y - previousPoint.y) * clampedBlend,
    }
  })
}

export const getSmoothedTrajectoryTipPoints = (
  points: Vec2[],
  options: {
    predictionStepSeconds: number
    unrevealedPredictionSeconds: number
  },
): Vec2[] => {
  if (points.length < 2 || options.predictionStepSeconds <= 0) {
    return points
  }

  const trimSegments =
    Math.max(0, options.unrevealedPredictionSeconds) /
    options.predictionStepSeconds
  const visibleTrimSegments = Math.min(trimSegments, points.length - 2)
  if (visibleTrimSegments <= 0) {
    return points
  }

  const wholeSegments = Math.floor(visibleTrimSegments)
  const partialSegment = visibleTrimSegments - wholeSegments
  const segmentEndIndex = points.length - 1 - wholeSegments

  if (partialSegment === 0) {
    return points.slice(0, segmentEndIndex + 1)
  }

  const segmentStart = points[segmentEndIndex - 1]
  const segmentEnd = points[segmentEndIndex]
  const segmentProgress = 1 - partialSegment

  return [
    ...points.slice(0, segmentEndIndex),
    {
      x: segmentStart.x + (segmentEnd.x - segmentStart.x) * segmentProgress,
      y: segmentStart.y + (segmentEnd.y - segmentStart.y) * segmentProgress,
    },
  ]
}
