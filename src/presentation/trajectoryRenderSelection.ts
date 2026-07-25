import type { TrajectoryPredictionFarVisibility } from '../runtime/trajectoryPredictionRuntime'
import { length, sub, type Vec2 } from '../simulation/vector'
import { getViewportMinSampleDistanceMeters } from './viewportSampling'

const retainedStaleFarMaxBridgeSegmentMultiplier = 3

const trajectoryRenderDensityStops = [
  { minSampleDistanceMeters: 50_000, viewportSize: 5 },
  { minSampleDistanceMeters: 125_000, viewportSize: 15 },
  { minSampleDistanceMeters: 500_000, viewportSize: 50 },
  { minSampleDistanceMeters: 1_250_000, viewportSize: 100 },
  { minSampleDistanceMeters: 3_000_000, viewportSize: 250 },
  { minSampleDistanceMeters: 6_000_000, viewportSize: 500 },
  { minSampleDistanceMeters: 12_000_000, viewportSize: 1_000 },
  { minSampleDistanceMeters: 30_000_000, viewportSize: 2_500 },
] as const

const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y

const getRetainedStaleFarPointIndices = (
  points: readonly Vec2[],
  nearPointCount: number,
) => {
  const staleFarPointIndices = Array.from(
    { length: points.length - nearPointCount },
    (_, index) => nearPointCount + index,
  )

  if (nearPointCount < 2 || staleFarPointIndices.length === 0) {
    return staleFarPointIndices
  }

  const nearEndIndex = nearPointCount - 1
  const nearEnd = points[nearEndIndex]
  const nearDelta = sub(nearEnd, points[nearEndIndex - 1])
  const nearSegmentDistance = length(nearDelta)

  if (nearSegmentDistance <= 0) {
    return staleFarPointIndices
  }

  const nearDirection = {
    x: nearDelta.x / nearSegmentDistance,
    y: nearDelta.y / nearSegmentDistance,
  }
  let startOffset = 0

  while (
    startOffset < staleFarPointIndices.length &&
    dot(
      sub(points[staleFarPointIndices[startOffset]], nearEnd),
      nearDirection,
    ) < 0
  ) {
    startOffset += 1
  }

  const retainedIndices = staleFarPointIndices.slice(startOffset)
  const staleStartIndex = retainedIndices[0]
  if (staleStartIndex === undefined) {
    return []
  }

  const staleStart = points[staleStartIndex]
  const seamDistance = length(sub(staleStart, nearEnd))
  const nextStaleIndex = retainedIndices[1]
  const nextStaleSegmentDistance =
    nextStaleIndex === undefined
      ? nearSegmentDistance
      : length(sub(points[nextStaleIndex], staleStart))
  const maxBridgeDistance =
    Math.max(nearSegmentDistance, nextStaleSegmentDistance) *
    retainedStaleFarMaxBridgeSegmentMultiplier

  return seamDistance <= maxBridgeDistance
    ? [nearEndIndex, ...retainedIndices]
    : retainedIndices
}

const selectPointIndicesByDistance = (options: {
  mandatoryPointIndices: ReadonlySet<number>
  minSampleDistanceMeters: number
  pointIndices: readonly number[]
  points: readonly Vec2[]
}) => {
  const firstPointIndex = options.pointIndices[0]
  if (firstPointIndex === undefined) {
    return []
  }

  const lastPointIndex = options.pointIndices.at(-1) ?? firstPointIndex
  if (firstPointIndex === lastPointIndex) {
    return [firstPointIndex]
  }

  const selectedPointIndices = [firstPointIndex]
  let distanceSinceSelection = 0
  let previousPointIndex = firstPointIndex

  for (let offset = 1; offset < options.pointIndices.length - 1; offset += 1) {
    const pointIndex = options.pointIndices[offset]
    distanceSinceSelection += length(
      sub(options.points[pointIndex], options.points[previousPointIndex]),
    )
    previousPointIndex = pointIndex

    if (
      options.mandatoryPointIndices.has(pointIndex) ||
      distanceSinceSelection >= options.minSampleDistanceMeters
    ) {
      selectedPointIndices.push(pointIndex)
      distanceSinceSelection = 0
    }
  }

  selectedPointIndices.push(lastPointIndex)
  return selectedPointIndices
}

export const getTrajectoryRenderSampleDistanceMeters = (viewportSize: number) =>
  getViewportMinSampleDistanceMeters(viewportSize, trajectoryRenderDensityStops)

export const selectTrajectoryRenderGeometry = (options: {
  farVisible: TrajectoryPredictionFarVisibility
  mandatoryPointIndices?: readonly number[]
  nearPointCount: number
  points: readonly Vec2[]
  viewportSize: number
}) => {
  const sourcePointCount = options.points.length
  if (sourcePointCount === 0) {
    return {
      staleFarPointIndices: [],
      visiblePointIndices: [],
    }
  }

  const minSampleDistanceMeters = getTrajectoryRenderSampleDistanceMeters(
    options.viewportSize,
  )
  const splitRetainedFar =
    options.farVisible === 'retained-stale' &&
    options.nearPointCount > 0 &&
    options.nearPointCount < sourcePointCount
  const visibleSourcePointCount = splitRetainedFar
    ? options.nearPointCount
    : sourcePointCount
  const visibleSourcePointIndices = Array.from(
    { length: visibleSourcePointCount },
    (_, index) => index,
  )
  const staleFarSourcePointIndices = splitRetainedFar
    ? getRetainedStaleFarPointIndices(options.points, options.nearPointCount)
    : []
  const mandatoryPointIndices = new Set(
    options.mandatoryPointIndices?.filter(
      (index) =>
        Number.isInteger(index) && index >= 0 && index < sourcePointCount,
    ) ?? [],
  )

  if (options.nearPointCount > 0 && options.nearPointCount < sourcePointCount) {
    mandatoryPointIndices.add(options.nearPointCount - 1)
    mandatoryPointIndices.add(options.nearPointCount)
  }

  const staleFarStartIndex =
    staleFarSourcePointIndices[0] === options.nearPointCount - 1
      ? staleFarSourcePointIndices[1]
      : staleFarSourcePointIndices[0]
  if (staleFarStartIndex !== undefined) {
    mandatoryPointIndices.add(staleFarStartIndex)
  }

  const visiblePointIndices = selectPointIndicesByDistance({
    mandatoryPointIndices,
    minSampleDistanceMeters,
    pointIndices: visibleSourcePointIndices,
    points: options.points,
  })
  const staleFarPointIndices = selectPointIndicesByDistance({
    mandatoryPointIndices,
    minSampleDistanceMeters,
    pointIndices: staleFarSourcePointIndices,
    points: options.points,
  })

  return {
    staleFarPointIndices,
    visiblePointIndices,
  }
}
