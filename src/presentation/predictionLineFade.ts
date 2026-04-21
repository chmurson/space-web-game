const DAY_SECONDS = 24 * 60 * 60
const LONG_HORIZON_BLEND_END_SECONDS = 12 * DAY_SECONDS
const SHORT_FADE_START_RATIO = 0.5
const MEDIUM_FADE_START_RATIO = 0.25
const LONG_FADE_START_RATIO = 0.125
const MIN_BRIGHTNESS = 0.22

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)

const lerp = (start: number, end: number, t: number) =>
  start + (end - start) * t

const smoothstep = (edge0: number, edge1: number, value: number) => {
  if (edge0 === edge1) {
    return value >= edge1 ? 1 : 0
  }

  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

export const getCoastPredictionFadeStartRatio = (horizonSeconds: number) => {
  const shortToMediumBlend = smoothstep(
    DAY_SECONDS,
    4 * DAY_SECONDS,
    horizonSeconds,
  )
  const mediumToLongBlend = smoothstep(
    4 * DAY_SECONDS,
    LONG_HORIZON_BLEND_END_SECONDS,
    horizonSeconds,
  )
  const shortToMediumStartRatio = lerp(
    SHORT_FADE_START_RATIO,
    MEDIUM_FADE_START_RATIO,
    shortToMediumBlend,
  )

  return lerp(shortToMediumStartRatio, LONG_FADE_START_RATIO, mediumToLongBlend)
}

export const getCoastPredictionFadeBlend = (
  lineProgress: number,
  horizonSeconds: number,
) =>
  smoothstep(getCoastPredictionFadeStartRatio(horizonSeconds), 1, lineProgress)

export const getLineDistanceProgress = (positions: number[]) => {
  const pointCount = positions.length / 3

  if (pointCount === 0) {
    return []
  }

  const cumulativeDistances = [0]
  let totalDistance = 0

  for (let pointIndex = 1; pointIndex < pointCount; pointIndex += 1) {
    const previousOffset = (pointIndex - 1) * 3
    const currentOffset = pointIndex * 3
    const dx = positions[currentOffset] - positions[previousOffset]
    const dy = positions[currentOffset + 1] - positions[previousOffset + 1]
    const dz = positions[currentOffset + 2] - positions[previousOffset + 2]

    totalDistance += Math.hypot(dx, dy, dz)
    cumulativeDistances.push(totalDistance)
  }

  if (totalDistance <= 0) {
    return cumulativeDistances.map(() => 0)
  }

  return cumulativeDistances.map((distance) => distance / totalDistance)
}

export const getCoastPredictionFadeColors = (
  positions: number[],
  horizonSeconds: number,
) =>
  getLineDistanceProgress(positions).flatMap((lineProgress) => {
    const fadeBlend = getCoastPredictionFadeBlend(lineProgress, horizonSeconds)
    const brightness = lerp(1, MIN_BRIGHTNESS, fadeBlend)

    return [brightness, brightness, brightness]
  })
