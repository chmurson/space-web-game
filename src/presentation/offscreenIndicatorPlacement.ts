export type OffscreenIndicatorEdge = 'bottom' | 'left' | 'right' | 'top'

export type OffscreenIndicatorRect = {
  bottom: number
  left: number
  right: number
  top: number
}

export type OffscreenIndicatorPlacement = {
  edge: OffscreenIndicatorEdge
  x: number
  y: number
}

type PlacementBounds = {
  bottom: number
  left: number
  right: number
  top: number
}

type EdgeHit = {
  edge: OffscreenIndicatorEdge
  t: number
}

type BlockedInterval = {
  end: number
  start: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const blockedIntervalSwitchRatio = 2 / 3

const getPlacementBounds = (options: {
  edgePadding: number
  indicatorHeight: number
  indicatorWidth: number
  reservedBottom: number
  reservedTop: number
  viewportHeight: number
  viewportWidth: number
}): PlacementBounds => {
  const halfWidth = options.indicatorWidth * 0.5
  const halfHeight = options.indicatorHeight * 0.5
  const left = Math.min(
    options.viewportWidth * 0.5,
    halfWidth + options.edgePadding,
  )
  const top = Math.min(
    options.viewportHeight * 0.5,
    halfHeight + Math.max(options.edgePadding, options.reservedTop),
  )

  return {
    bottom: Math.max(
      top,
      options.viewportHeight -
        halfHeight -
        Math.max(options.edgePadding, options.reservedBottom),
    ),
    left,
    right: Math.max(
      left,
      options.viewportWidth - halfWidth - options.edgePadding,
    ),
    top,
  }
}

const getDirectionalEdgeHit = (options: {
  bounds: PlacementBounds
  centerX: number
  centerY: number
  dx: number
  dy: number
  projectedX: number
  projectedY: number
}): EdgeHit => {
  const candidates: EdgeHit[] = []

  if (options.dx < 0) {
    candidates.push({
      edge: 'left',
      t: (options.bounds.left - options.centerX) / options.dx,
    })
  } else if (options.dx > 0) {
    candidates.push({
      edge: 'right',
      t: (options.bounds.right - options.centerX) / options.dx,
    })
  }

  if (options.dy < 0) {
    candidates.push({
      edge: 'top',
      t: (options.bounds.top - options.centerY) / options.dy,
    })
  } else if (options.dy > 0) {
    candidates.push({
      edge: 'bottom',
      t: (options.bounds.bottom - options.centerY) / options.dy,
    })
  }

  const hit = candidates
    .filter((candidate) => Number.isFinite(candidate.t) && candidate.t >= 0)
    .sort((left, right) => left.t - right.t)[0]

  if (hit) {
    return hit
  }

  const overflows = [
    {
      amount: options.bounds.left - options.projectedX,
      edge: 'left' as const,
    },
    {
      amount: options.projectedX - options.bounds.right,
      edge: 'right' as const,
    },
    {
      amount: options.bounds.top - options.projectedY,
      edge: 'top' as const,
    },
    {
      amount: options.projectedY - options.bounds.bottom,
      edge: 'bottom' as const,
    },
  ]
    .filter((overflow) => overflow.amount > 0)
    .sort((left, right) => right.amount - left.amount)

  return {
    edge: overflows[0]?.edge ?? 'right',
    t: 1,
  }
}

const isCoordinateBlocked = (value: number, intervals: BlockedInterval[]) =>
  intervals.some((interval) => value > interval.start && value < interval.end)

const avoidBlockedIntervals = (options: {
  intervals: BlockedInterval[]
  max: number
  min: number
  previousValue?: number
  value: number
}) => {
  const value = clamp(options.value, options.min, options.max)
  if (!isCoordinateBlocked(value, options.intervals)) {
    return value
  }

  const blockedInterval = options.intervals.find(
    (interval) => value > interval.start && value < interval.end,
  )
  if (
    blockedInterval &&
    options.previousValue !== undefined &&
    !isCoordinateBlocked(options.previousValue, options.intervals)
  ) {
    const intervalSize = blockedInterval.end - blockedInterval.start
    const previousBefore = options.previousValue <= blockedInterval.start
    const previousAfter = options.previousValue >= blockedInterval.end
    const switchAfter =
      blockedInterval.start + intervalSize * blockedIntervalSwitchRatio
    const switchBefore =
      blockedInterval.start + intervalSize * (1 - blockedIntervalSwitchRatio)
    const hysteresisCandidate =
      previousBefore && value < switchAfter
        ? blockedInterval.start
        : previousAfter && value > switchBefore
          ? blockedInterval.end
          : null

    if (
      hysteresisCandidate !== null &&
      !isCoordinateBlocked(hysteresisCandidate, options.intervals)
    ) {
      return clamp(hysteresisCandidate, options.min, options.max)
    }
  }

  const candidates = [
    value,
    options.min,
    options.max,
    ...options.intervals.flatMap((interval) => [
      clamp(interval.start, options.min, options.max),
      clamp(interval.end, options.min, options.max),
    ]),
  ]

  return (
    candidates
      .filter((candidate) => !isCoordinateBlocked(candidate, options.intervals))
      .sort(
        (left, right) => Math.abs(left - value) - Math.abs(right - value),
      )[0] ?? value
  )
}

const getBlockingIntervals = (options: {
  blockerPadding: number
  blockerRects: OffscreenIndicatorRect[]
  edge: OffscreenIndicatorEdge
  indicatorHeight: number
  indicatorWidth: number
  x: number
  y: number
}) => {
  const halfWidth = options.indicatorWidth * 0.5
  const halfHeight = options.indicatorHeight * 0.5

  if (options.edge === 'left' || options.edge === 'right') {
    const indicatorLeft = options.x - halfWidth
    const indicatorRight = options.x + halfWidth

    return options.blockerRects
      .filter(
        (rect) =>
          indicatorRight > rect.left - options.blockerPadding &&
          indicatorLeft < rect.right + options.blockerPadding,
      )
      .map((rect) => ({
        end: rect.bottom + halfHeight + options.blockerPadding,
        start: rect.top - halfHeight - options.blockerPadding,
      }))
  }

  const indicatorTop = options.y - halfHeight
  const indicatorBottom = options.y + halfHeight

  return options.blockerRects
    .filter(
      (rect) =>
        indicatorBottom > rect.top - options.blockerPadding &&
        indicatorTop < rect.bottom + options.blockerPadding,
    )
    .map((rect) => ({
      end: rect.right + halfWidth + options.blockerPadding,
      start: rect.left - halfWidth - options.blockerPadding,
    }))
}

export const resolveOffscreenIndicatorPlacement = (options: {
  blockerPadding: number
  blockerRects: OffscreenIndicatorRect[]
  edgePadding: number
  indicatorHeight: number
  indicatorWidth: number
  previousPlacement?: OffscreenIndicatorPlacement
  projectedX: number
  projectedY: number
  reservedBottom: number
  reservedTop: number
  viewportHeight: number
  viewportWidth: number
}): OffscreenIndicatorPlacement => {
  const bounds = getPlacementBounds(options)
  const centerX = options.viewportWidth * 0.5
  const centerY = options.viewportHeight * 0.5
  const dx = options.projectedX - centerX
  const dy = options.projectedY - centerY
  const hit = getDirectionalEdgeHit({
    bounds,
    centerX,
    centerY,
    dx,
    dy,
    projectedX: options.projectedX,
    projectedY: options.projectedY,
  })
  let x = clamp(centerX + dx * hit.t, bounds.left, bounds.right)
  let y = clamp(centerY + dy * hit.t, bounds.top, bounds.bottom)

  if (hit.edge === 'left') {
    x = bounds.left
  } else if (hit.edge === 'right') {
    x = bounds.right
  } else if (hit.edge === 'top') {
    y = bounds.top
  } else {
    y = bounds.bottom
  }

  const intervals = getBlockingIntervals({
    blockerPadding: options.blockerPadding,
    blockerRects: options.blockerRects,
    edge: hit.edge,
    indicatorHeight: options.indicatorHeight,
    indicatorWidth: options.indicatorWidth,
    x,
    y,
  })

  if (hit.edge === 'left' || hit.edge === 'right') {
    y = avoidBlockedIntervals({
      intervals,
      max: bounds.bottom,
      min: bounds.top,
      previousValue:
        options.previousPlacement?.edge === hit.edge
          ? options.previousPlacement.y
          : undefined,
      value: y,
    })
  } else {
    x = avoidBlockedIntervals({
      intervals,
      max: bounds.right,
      min: bounds.left,
      previousValue:
        options.previousPlacement?.edge === hit.edge
          ? options.previousPlacement.x
          : undefined,
      value: x,
    })
  }

  return { edge: hit.edge, x, y }
}
