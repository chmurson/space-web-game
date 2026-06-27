import type { SpacecraftTrailPoint } from '../scene/createGameScene'
import type { Body } from '../simulation/types'
import { lengthSq, sub, type Vec2 } from '../simulation/vector'
import { getViewportMinSampleDistanceMeters } from './viewportSampling'

export const spacecraftTrailMaxPoints = 2_000
export const spacecraftTrailLifetimeSeconds = 24 * 60 * 60
export const spacecraftTrailMaxOrbitRevolutions = 2
export const spacecraftTrailCaptureMinSampleDistanceMeters = 250_000

const spacecraftTrailRenderDensityStops = [
  {
    detailLabel: 'inspection',
    detailLevel: 7,
    minSampleDistanceMeters: 250_000,
    viewportSize: 15,
  },
  {
    detailLabel: 'close',
    detailLevel: 6,
    minSampleDistanceMeters: 500_000,
    viewportSize: 30,
  },
  {
    detailLabel: 'planet',
    detailLevel: 5,
    minSampleDistanceMeters: 1_000_000,
    viewportSize: 50,
  },
  {
    detailLabel: 'orbit',
    detailLevel: 4,
    minSampleDistanceMeters: 2_000_000,
    viewportSize: 100,
  },
  {
    detailLabel: 'wide',
    detailLevel: 3,
    minSampleDistanceMeters: 4_000_000,
    viewportSize: 250,
  },
  {
    detailLabel: 'far',
    detailLevel: 2,
    minSampleDistanceMeters: 8_000_000,
    viewportSize: 500,
  },
  {
    detailLabel: 'system',
    detailLevel: 1,
    minSampleDistanceMeters: 12_000_000,
    viewportSize: 1000,
  },
] as const

const maxOrbitAngularTravel = spacecraftTrailMaxOrbitRevolutions * Math.PI * 2
const normalizeAngleDelta = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))

export type SpacecraftTrailReferenceTarget = Pick<Body, 'id' | 'position'>

export type SpacecraftTrailDetail = {
  label: string
  level: number
  levelCount: number
  captureSampleDistanceMeters: number
  renderSampleDistanceMeters: number
}

export const createSpacecraftTrailPoint = (options: {
  bodies: Body[]
  elapsed: number
  spacecraftPosition: Vec2
}): SpacecraftTrailPoint => {
  const position = { ...options.spacecraftPosition }
  const targetRelativePositions: Record<string, Vec2> = {}

  for (const body of options.bodies) {
    targetRelativePositions[body.id] = sub(position, body.position)
  }

  return {
    elapsed: options.elapsed,
    position,
    targetRelativePositions,
  }
}

export const getSpacecraftTrailTargetRelativePosition = (
  point: SpacecraftTrailPoint,
  target: SpacecraftTrailReferenceTarget,
): Vec2 =>
  point.targetRelativePositions[target.id] ??
  sub(point.position, target.position)

export const getSpacecraftTrailRenderPosition = (
  point: SpacecraftTrailPoint,
  target: SpacecraftTrailReferenceTarget | null,
): Vec2 =>
  target
    ? getSpacecraftTrailTargetRelativePosition(point, target)
    : point.position

export const getSpacecraftTrailRenderSampleDistanceMeters = (
  viewportSize: number,
) =>
  getViewportMinSampleDistanceMeters(
    viewportSize,
    spacecraftTrailRenderDensityStops,
  )

export const getSpacecraftTrailDetail = (
  viewportSize: number,
): SpacecraftTrailDetail => {
  const fallbackStop =
    spacecraftTrailRenderDensityStops[
      spacecraftTrailRenderDensityStops.length - 1
    ] ?? spacecraftTrailRenderDensityStops[0]
  const activeStop =
    spacecraftTrailRenderDensityStops.find(
      (stop) => viewportSize <= stop.viewportSize,
    ) ?? fallbackStop

  return {
    captureSampleDistanceMeters: spacecraftTrailCaptureMinSampleDistanceMeters,
    label: activeStop.detailLabel,
    level: activeStop.detailLevel,
    levelCount: spacecraftTrailRenderDensityStops.length,
    renderSampleDistanceMeters:
      getSpacecraftTrailRenderSampleDistanceMeters(viewportSize),
  }
}

const hasMovedFarEnoughForTrailPoint = (
  previous: SpacecraftTrailPoint | undefined,
  spacecraftPosition: Vec2,
  minSampleDistanceMeters: number,
) => {
  if (!previous) {
    return true
  }

  return (
    lengthSq(sub(spacecraftPosition, previous.position)) >=
    minSampleDistanceMeters * minSampleDistanceMeters
  )
}

export const selectSpacecraftTrailRenderPoints = (
  trailPoints: SpacecraftTrailPoint[],
  options: {
    renderSampleDistanceMeters: number
    target: SpacecraftTrailReferenceTarget | null
  },
) => {
  const newestPoint = trailPoints.at(-1)
  if (!newestPoint) {
    return []
  }

  const renderSampleDistanceMetersSq =
    options.renderSampleDistanceMeters * options.renderSampleDistanceMeters
  const renderPoints: SpacecraftTrailPoint[] = []
  let previousRenderedPosition: Vec2 | null = null

  for (const point of trailPoints) {
    const renderPosition = getSpacecraftTrailRenderPosition(
      point,
      options.target,
    )

    if (
      previousRenderedPosition === null ||
      lengthSq(sub(renderPosition, previousRenderedPosition)) >=
        renderSampleDistanceMetersSq ||
      point === newestPoint
    ) {
      renderPoints.push(point)
      previousRenderedPosition = renderPosition
    }
  }

  return renderPoints
}

const trimTrailToLatestTargetOrbits = (
  trailPoints: SpacecraftTrailPoint[],
  target: SpacecraftTrailReferenceTarget,
) => {
  const newestPoint = trailPoints.at(-1)
  if (!newestPoint) {
    return trailPoints
  }

  let startIndex = trailPoints.length - 1
  let angularTravel = 0
  let previousAngle = Math.atan2(
    getSpacecraftTrailTargetRelativePosition(newestPoint, target).y,
    getSpacecraftTrailTargetRelativePosition(newestPoint, target).x,
  )

  for (let index = trailPoints.length - 2; index >= 0; index -= 1) {
    const point = getSpacecraftTrailTargetRelativePosition(
      trailPoints[index],
      target,
    )
    const angle = Math.atan2(point.y, point.x)
    const delta = Math.abs(normalizeAngleDelta(previousAngle - angle))

    if (angularTravel + delta > maxOrbitAngularTravel) {
      break
    }

    angularTravel += delta
    previousAngle = angle
    startIndex = index
  }

  return trailPoints.slice(startIndex)
}

export const updateSpacecraftTrailPoints = (
  trailPoints: SpacecraftTrailPoint[],
  options: {
    bodies: Body[]
    elapsed: number
    spacecraftPosition: Vec2
    target: SpacecraftTrailReferenceTarget
    trimAroundTarget: boolean
  },
): { changed: boolean; trailPoints: SpacecraftTrailPoint[] } => {
  const minElapsed = options.elapsed - spacecraftTrailLifetimeSeconds
  let nextTrailPoints = trailPoints.filter(
    (point) => point.elapsed >= minElapsed,
  )
  let changed = nextTrailPoints.length !== trailPoints.length

  if (
    hasMovedFarEnoughForTrailPoint(
      nextTrailPoints.at(-1),
      options.spacecraftPosition,
      spacecraftTrailCaptureMinSampleDistanceMeters,
    )
  ) {
    nextTrailPoints = [
      ...nextTrailPoints,
      createSpacecraftTrailPoint({
        bodies: options.bodies,
        elapsed: options.elapsed,
        spacecraftPosition: options.spacecraftPosition,
      }),
    ]
    changed = true
  }

  if (nextTrailPoints.length > spacecraftTrailMaxPoints) {
    nextTrailPoints = nextTrailPoints.slice(-spacecraftTrailMaxPoints)
    changed = true
  }

  if (options.trimAroundTarget) {
    const orbitTrimmedTrailPoints = trimTrailToLatestTargetOrbits(
      nextTrailPoints,
      options.target,
    )

    if (orbitTrimmedTrailPoints.length !== nextTrailPoints.length) {
      changed = true
      nextTrailPoints = orbitTrimmedTrailPoints
    }
  }

  return { changed, trailPoints: nextTrailPoints }
}
