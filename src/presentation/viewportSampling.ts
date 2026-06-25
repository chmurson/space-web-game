export type ViewportSamplingStop = {
  viewportSize: number
  minSampleDistanceMeters: number
}

export const getViewportMinSampleDistanceMeters = (
  viewportSize: number,
  stops: readonly ViewportSamplingStop[],
) => {
  if (stops.length === 0) {
    throw new Error('Viewport sampling requires at least one density stop.')
  }

  const viewportSizes = new Set(stops.map((stop) => stop.viewportSize))
  if (viewportSizes.size !== stops.length) {
    throw new Error('Viewport sampling stops must have unique viewport sizes.')
  }

  const sortedStops = [...stops].sort(
    (left, right) => left.viewportSize - right.viewportSize,
  )
  const closestStop = sortedStops[0]
  const farthestStop = sortedStops.at(-1) ?? closestStop

  if (viewportSize <= closestStop.viewportSize) {
    return closestStop.minSampleDistanceMeters
  }

  if (viewportSize >= farthestStop.viewportSize) {
    return farthestStop.minSampleDistanceMeters
  }

  for (let index = 1; index < sortedStops.length; index += 1) {
    const lowerStop = sortedStops[index - 1]
    const upperStop = sortedStops[index]

    if (viewportSize <= upperStop.viewportSize) {
      const blend =
        (viewportSize - lowerStop.viewportSize) /
        (upperStop.viewportSize - lowerStop.viewportSize)

      return (
        lowerStop.minSampleDistanceMeters +
        (upperStop.minSampleDistanceMeters -
          lowerStop.minSampleDistanceMeters) *
          blend
      )
    }
  }

  return farthestStop.minSampleDistanceMeters
}
