import * as THREE from 'three'

import type { CircularizePlan } from '../assist/orbitalAssist'
import type {
  TrajectoryPredictionEventMarker,
  TrajectoryPredictionEventMarkerKind,
} from '../prediction/trajectoryPrediction'
import { renderPosition } from '../render/sceneUpdates'
import {
  updateColoredLine2Geometry,
  updateLine2Geometry,
} from '../rendering/line2Geometry'
import type { AppRuntimeState } from '../runtime/appRuntimeState'
import type { GameQueries } from '../runtime/gameQueries'
import type {
  TrajectoryPredictionFarVisibility,
  TrajectoryPredictionRuntime,
} from '../runtime/trajectoryPredictionRuntime'
import { isTutorialScenarioState } from '../scenario/specific-scenarios/tutorial/tutorialScenarioTypes'
import type { GameSceneRefs } from '../scene/createGameScene'
import { RENDER_SCALE } from '../simulation/constants'
import type { Body, PhysicsEngine } from '../simulation/types'
import { fromAngle, type Vec2 } from '../simulation/vector'
import type { OrbitPointDisplaySettings } from '../userSettingsStorage'
import { getCoastPredictionFadeColors } from './predictionLineFade'
import {
  getTrajectoryRenderMaxChordErrorMeters,
  getTrajectoryRenderSampleDistanceMeters,
  selectTrajectoryRenderGeometry,
} from './trajectoryRenderSelection'

const trajectoryEventMarkerMaxViewportSize = 500
const trajectoryEventMarkerLift = 0.22
const trajectoryEventMarkerLabelViewportPadding = 8
const trajectoryEventMarkerUpdateAltitudeRatioThreshold = 0.025
const predictionEndMarkerMaxScreenDiameter = 11
const predictionLineBaseColor = 0x7dd3fc
const predictionLineDebugMaterialColor = 0xffffff
const predictionLineDebugNearColor = new THREE.Color(0x38bdf8)
const predictionLineDebugFarColor = new THREE.Color(0xf59e0b)

type TrajectoryEventMarkerLabelRefs = Record<
  TrajectoryPredictionEventMarkerKind,
  HTMLElement
>

export type TrajectoryRenderDiagnostics = {
  assisted: {
    selectedPointCount: number
    sourcePointCount: number
  }
  coast: {
    selectedPointCount: number
    sourcePointCount: number
    staleSelectedPointCount: number
  }
  maxChordErrorMeters: number
  minSampleDistanceMeters: number
}

type TrajectoryRenderSelections = {
  assisted: ReturnType<typeof selectTrajectoryRenderGeometry>
  coast: ReturnType<typeof selectTrajectoryRenderGeometry>
  maxChordErrorMeters: number
  minSampleDistanceMeters: number
}

const createTrajectoryRenderSelectionCache = () => {
  let previous: {
    assistedPoints: readonly Vec2[]
    coastPoints: readonly Vec2[]
    farVisible: TrajectoryPredictionFarVisibility
    impactGradientStartIndex: number | null
    nearPointCount: number
    result: TrajectoryRenderSelections
    viewportHeight: number
    viewportSize: number
  } | null = null

  return (options: {
    assistedPoints: readonly Vec2[]
    coastPoints: readonly Vec2[]
    farVisible: TrajectoryPredictionFarVisibility
    impactGradientStartIndex: number | null
    nearPointCount: number
    viewportHeight: number
    viewportSize: number
  }): TrajectoryRenderSelections => {
    if (
      previous &&
      previous.assistedPoints === options.assistedPoints &&
      previous.coastPoints === options.coastPoints &&
      previous.farVisible === options.farVisible &&
      previous.impactGradientStartIndex === options.impactGradientStartIndex &&
      previous.nearPointCount === options.nearPointCount &&
      previous.viewportHeight === options.viewportHeight &&
      previous.viewportSize === options.viewportSize
    ) {
      return previous.result
    }

    const minSampleDistanceMeters = getTrajectoryRenderSampleDistanceMeters(
      options.viewportSize,
    )
    const maxChordErrorMeters = getTrajectoryRenderMaxChordErrorMeters({
      viewportHeight: options.viewportHeight,
      viewportSize: options.viewportSize,
    })
    const coast = selectTrajectoryRenderGeometry({
      farVisible: options.farVisible,
      mandatoryPointIndices:
        options.impactGradientStartIndex === null
          ? []
          : [options.impactGradientStartIndex],
      nearPointCount: options.nearPointCount,
      points: options.coastPoints,
      viewportHeight: options.viewportHeight,
      viewportSize: options.viewportSize,
    })
    const assisted = selectTrajectoryRenderGeometry({
      farVisible: 'none',
      nearPointCount: 0,
      points: options.assistedPoints,
      viewportHeight: options.viewportHeight,
      viewportSize: options.viewportSize,
    })
    const result = {
      assisted,
      coast,
      maxChordErrorMeters,
      minSampleDistanceMeters,
    }
    previous = { ...options, result }
    return result
  }
}

const trajectoryEventMarkerShortLabels = {
  apoapsis: 'Ap',
  periapsis: 'Pe',
} satisfies Record<TrajectoryPredictionEventMarkerKind, string>

const trajectoryEventMarkerAccessibleNames = {
  apoapsis: 'Apoapsis',
  periapsis: 'Periapsis',
} satisfies Record<TrajectoryPredictionEventMarkerKind, string>

const hideTrajectoryEventMarkerLabel = (label: HTMLElement) => {
  label.style.display = 'none'
  label.style.visibility = 'hidden'
  label.setAttribute('aria-hidden', 'true')
}

const hideTrajectoryEventMarkerLabels = (
  labels: TrajectoryEventMarkerLabelRefs,
) => {
  for (const label of Object.values(labels)) {
    hideTrajectoryEventMarkerLabel(label)
  }
}

const hideTrajectoryEventMarkers = (labels: TrajectoryEventMarkerLabelRefs) =>
  hideTrajectoryEventMarkerLabels(labels)

const hideTrajectoryVisuals = (
  gameScene: GameSceneRefs,
  labels: TrajectoryEventMarkerLabelRefs,
) => {
  gameScene.assistedPredictionLine.visible = false
  gameScene.circularOrbitLine.visible = false
  gameScene.desiredVelocityLine.visible = false
  gameScene.impactGradientLine.visible = false
  gameScene.inertialPredictionLine.visible = false
  gameScene.predictionEndMarker.visible = false
  gameScene.predictionLine.visible = false
  gameScene.predictionStaleFarLine.visible = false
  hideTrajectoryEventMarkers(labels)
}

const updateInertialPredictionVisual = (options: {
  enabled: boolean
  gameScene: GameSceneRefs
  predictionSeconds: number
  spacecraftPosition: Vec2
  spacecraftVelocity: Vec2
}) => {
  if (!options.enabled) {
    options.gameScene.inertialPredictionLine.visible = false
    return
  }

  const steps = 64
  const points: number[] = []

  for (let step = 0; step <= steps; step += 1) {
    const t = (options.predictionSeconds * step) / steps
    const x = options.spacecraftPosition.x + options.spacecraftVelocity.x * t
    const y = options.spacecraftPosition.y + options.spacecraftVelocity.y * t
    const point = renderPosition(x, y, 0.14)
    points.push(point.x, point.y, point.z)
  }

  options.gameScene.inertialPredictionGeometry.setPositions(points)
  options.gameScene.inertialPredictionLine.computeLineDistances()
  options.gameScene.inertialPredictionLine.visible = true
}

const applyTargetRelativePredictionLine = (
  gameScene: GameSceneRefs,
  relativePoints: Vec2[],
  geometryKey:
    | 'predictionGeometry'
    | 'predictionStaleFarGeometry'
    | 'assistedPredictionGeometry',
  lineKey:
    | 'predictionLine'
    | 'predictionStaleFarLine'
    | 'assistedPredictionLine',
  lift: number,
  target: Body,
  colors?: number[],
) => {
  const line = gameScene[lineKey]

  if (relativePoints.length === 0) {
    line.visible = false
    return
  }

  const positions: number[] = []

  for (const point of relativePoints) {
    const renderedPoint = renderPosition(
      target.position.x + point.x,
      target.position.y + point.y,
      lift,
    )
    positions.push(renderedPoint.x, renderedPoint.y, renderedPoint.z)
  }

  if (colors) {
    gameScene[geometryKey] = updateColoredLine2Geometry(
      line,
      gameScene[geometryKey],
      positions,
      colors,
      {
        replaceGeometryOnUpdate:
          gameScene.replacePredictionLineGeometryOnUpdate,
      },
    )
    return
  }

  gameScene[geometryKey] = updateLine2Geometry(
    line,
    gameScene[geometryKey],
    positions,
    {
      replaceGeometryOnUpdate: gameScene.replacePredictionLineGeometryOnUpdate,
    },
  )
}

const getDebugPredictionTierColors = (
  pointCount: number,
  nearPointCount: number,
  farVisible: TrajectoryPredictionFarVisibility,
) =>
  Array.from({ length: pointCount }).flatMap((_, index) => {
    const color =
      index < nearPointCount || farVisible === 'none'
        ? predictionLineDebugNearColor
        : predictionLineDebugFarColor

    return [color.r, color.g, color.b]
  })

const selectPredictionPoints = (
  points: readonly Vec2[],
  pointIndices: readonly number[],
) => pointIndices.map((index) => points[index])

const selectPredictionColors = (
  colors: readonly number[],
  pointIndices: readonly number[],
) => pointIndices.flatMap((index) => colors.slice(index * 3, index * 3 + 3))

const updateTargetRelativePredictionVisuals = (options: {
  coastPredictionHorizonSeconds: number
  debugModeEnabled: boolean
  eventMarkerLabels: TrajectoryEventMarkerLabelRefs
  gameScene: GameSceneRefs
  apsidesScenarioOwned: boolean
  orbitPointDisplaySettings: OrbitPointDisplaySettings
  pinnedEventMarkerKinds: ReadonlySet<TrajectoryPredictionEventMarkerKind>
  predictedImpact: { bodyName: string; time: number } | null
  stabilizedEventMarkers: Map<
    TrajectoryPredictionEventMarkerKind,
    TrajectoryPredictionEventMarker
  >
  target: Body
  targetRelativeEventMarkers: TrajectoryPredictionEventMarker[]
  targetRelativeAssistedPoints: Vec2[]
  targetRelativeFarVisible: TrajectoryPredictionFarVisibility
  targetRelativeNearPointCount: number
  targetRelativePredictionEnd: Vec2 | null
  targetRelativePredictionPoints: Vec2[]
  onRenderDiagnostics?(diagnostics: TrajectoryRenderDiagnostics): void
  selectRenderGeometry: ReturnType<typeof createTrajectoryRenderSelectionCache>
  viewportHeight: number
  viewportSize: number
}) => {
  const gradientPointCount = Math.min(
    18,
    options.targetRelativePredictionPoints.length,
  )
  const hasImpactGradient =
    Boolean(options.predictedImpact) &&
    options.targetRelativePredictionPoints.length >= 3
  const impactGradientStartIndex = hasImpactGradient
    ? options.targetRelativePredictionPoints.length - gradientPointCount
    : null
  const predictionPositions: number[] = []

  for (const point of options.targetRelativePredictionPoints) {
    const renderedPoint = renderPosition(
      options.target.position.x + point.x,
      options.target.position.y + point.y,
      0.18,
    )
    predictionPositions.push(renderedPoint.x, renderedPoint.y, renderedPoint.z)
  }
  options.gameScene.predictionMaterial.color.set(
    options.debugModeEnabled
      ? predictionLineDebugMaterialColor
      : predictionLineBaseColor,
  )
  options.gameScene.predictionStaleFarMaterial.color.set(
    options.debugModeEnabled
      ? predictionLineDebugMaterialColor
      : predictionLineBaseColor,
  )
  const predictionFadeColors = getCoastPredictionFadeColors(
    predictionPositions,
    options.coastPredictionHorizonSeconds,
  )
  const predictionColors = options.debugModeEnabled
    ? getDebugPredictionTierColors(
        options.targetRelativePredictionPoints.length,
        options.targetRelativeNearPointCount,
        options.targetRelativeFarVisible,
      )
    : predictionFadeColors
  const renderSelections = options.selectRenderGeometry({
    assistedPoints: options.targetRelativeAssistedPoints,
    coastPoints: options.targetRelativePredictionPoints,
    farVisible: options.targetRelativeFarVisible,
    impactGradientStartIndex,
    nearPointCount: options.targetRelativeNearPointCount,
    viewportHeight: options.viewportHeight,
    viewportSize: options.viewportSize,
  })
  const predictionSelection = renderSelections.coast
  const visiblePredictionPoints = selectPredictionPoints(
    options.targetRelativePredictionPoints,
    predictionSelection.visiblePointIndices,
  )
  const visiblePredictionColors = selectPredictionColors(
    predictionColors,
    predictionSelection.visiblePointIndices,
  )
  const staleFarPredictionPoints = selectPredictionPoints(
    options.targetRelativePredictionPoints,
    predictionSelection.staleFarPointIndices,
  )
  const staleFarPredictionColors = selectPredictionColors(
    predictionColors,
    predictionSelection.staleFarPointIndices,
  )
  const assistedPredictionSelection = renderSelections.assisted
  const assistedPredictionPoints = selectPredictionPoints(
    options.targetRelativeAssistedPoints,
    assistedPredictionSelection.visiblePointIndices,
  )

  options.onRenderDiagnostics?.({
    assisted: {
      selectedPointCount:
        assistedPredictionSelection.visiblePointIndices.length,
      sourcePointCount: options.targetRelativeAssistedPoints.length,
    },
    coast: {
      selectedPointCount:
        predictionSelection.visiblePointIndices.length +
        predictionSelection.staleFarPointIndices.length,
      sourcePointCount: options.targetRelativePredictionPoints.length,
      staleSelectedPointCount: predictionSelection.staleFarPointIndices.length,
    },
    maxChordErrorMeters: renderSelections.maxChordErrorMeters,
    minSampleDistanceMeters: renderSelections.minSampleDistanceMeters,
  })

  applyTargetRelativePredictionLine(
    options.gameScene,
    visiblePredictionPoints,
    'predictionGeometry',
    'predictionLine',
    0.18,
    options.target,
    visiblePredictionColors,
  )
  applyTargetRelativePredictionLine(
    options.gameScene,
    staleFarPredictionPoints,
    'predictionStaleFarGeometry',
    'predictionStaleFarLine',
    0.18,
    options.target,
    staleFarPredictionColors,
  )
  applyTargetRelativePredictionLine(
    options.gameScene,
    assistedPredictionPoints,
    'assistedPredictionGeometry',
    'assistedPredictionLine',
    0.2,
    options.target,
  )
  updateTrajectoryEventMarkers({
    eventMarkers: options.targetRelativeEventMarkers,
    eventMarkerLabels: options.eventMarkerLabels,
    gameScene: options.gameScene,
    apsidesScenarioOwned: options.apsidesScenarioOwned,
    orbitPointDisplaySettings: options.orbitPointDisplaySettings,
    pinnedEventMarkerKinds: options.pinnedEventMarkerKinds,
    stabilizedEventMarkers: options.stabilizedEventMarkers,
    target: options.target,
    viewportSize: options.viewportSize,
  })

  if (!options.targetRelativePredictionEnd) {
    options.gameScene.predictionEndMarker.visible = false
    options.gameScene.impactGradientLine.visible = false
    return
  }

  options.gameScene.predictionEndMarker.position.copy(
    renderPosition(
      options.target.position.x + options.targetRelativePredictionEnd.x,
      options.target.position.y + options.targetRelativePredictionEnd.y,
      0.18,
    ),
  )
  options.gameScene.predictionEndMarker.quaternion.copy(
    options.gameScene.camera.quaternion,
  )
  const markerRadius = Math.max(
    options.gameScene.predictionEndMarkerRadius,
    options.gameScene.predictionEndMarkerMinScreenRadius *
      (options.viewportSize / options.viewportHeight),
  )
  const markerMaxRadius =
    (predictionEndMarkerMaxScreenDiameter / 2) *
    (options.viewportSize / Math.max(options.viewportHeight, 1))
  options.gameScene.predictionEndMarker.scale.setScalar(
    Math.min(markerRadius, markerMaxRadius),
  )
  options.gameScene.predictionEndMarkerFill.material.color.set(
    options.predictedImpact ? '#ef4444' : '#67e8f9',
  )
  options.gameScene.predictionEndMarker.visible =
    options.debugModeEnabled || Boolean(options.predictedImpact)

  if (!hasImpactGradient) {
    options.gameScene.impactGradientLine.visible = false
    return
  }

  const gradientPoints = options.targetRelativePredictionPoints.slice(
    -gradientPointCount,
  )
  const gradientPositions: number[] = []
  const gradientColors: number[] = []
  const startColor = new THREE.Color('#67e8f9')
  const endColor = new THREE.Color('#ef4444')

  for (let index = 0; index < gradientPoints.length; index += 1) {
    const point = gradientPoints[index]
    const renderedPoint = renderPosition(
      options.target.position.x + point.x,
      options.target.position.y + point.y,
      0.19,
    )
    const blend = index / Math.max(gradientPoints.length - 1, 1)
    const color = startColor.clone().lerp(endColor, blend)

    gradientPositions.push(renderedPoint.x, renderedPoint.y, renderedPoint.z)
    gradientColors.push(color.r, color.g, color.b)
  }

  options.gameScene.impactGradientGeometry = updateColoredLine2Geometry(
    options.gameScene.impactGradientLine,
    options.gameScene.impactGradientGeometry,
    gradientPositions,
    gradientColors,
    {
      replaceGeometryOnUpdate:
        options.gameScene.replacePredictionLineGeometryOnUpdate,
    },
  )
}

const copyTrajectoryEventMarker = (
  marker: TrajectoryPredictionEventMarker,
): TrajectoryPredictionEventMarker => ({
  ...marker,
  point: { ...marker.point },
})

const getTrajectoryEventMarkerAltitudeChangeRatio = (
  eventMarker: TrajectoryPredictionEventMarker,
  previous: TrajectoryPredictionEventMarker,
) => {
  const altitudeScale = Math.max(
    Number.isFinite(eventMarker.altitude) ? Math.abs(eventMarker.altitude) : 0,
    Number.isFinite(previous.altitude) ? Math.abs(previous.altitude) : 0,
    1,
  )

  return Math.abs(eventMarker.altitude - previous.altitude) / altitudeScale
}

const getStabilizedTrajectoryEventMarkers = (options: {
  eventMarkers: TrajectoryPredictionEventMarker[]
  stabilizedEventMarkers: Map<
    TrajectoryPredictionEventMarkerKind,
    TrajectoryPredictionEventMarker
  >
}) => {
  const currentKinds = new Set<TrajectoryPredictionEventMarkerKind>()
  const eventMarkers: TrajectoryPredictionEventMarker[] = []

  for (const eventMarker of options.eventMarkers) {
    currentKinds.add(eventMarker.kind)

    if (
      !Number.isFinite(eventMarker.point.x) ||
      !Number.isFinite(eventMarker.point.y)
    ) {
      options.stabilizedEventMarkers.delete(eventMarker.kind)
      eventMarkers.push(eventMarker)
      continue
    }

    const previous = options.stabilizedEventMarkers.get(eventMarker.kind)

    if (
      previous &&
      getTrajectoryEventMarkerAltitudeChangeRatio(eventMarker, previous) <=
        trajectoryEventMarkerUpdateAltitudeRatioThreshold
    ) {
      eventMarkers.push(previous)
      continue
    }

    const stabilizedEventMarker = copyTrajectoryEventMarker(eventMarker)
    options.stabilizedEventMarkers.set(eventMarker.kind, stabilizedEventMarker)
    eventMarkers.push(stabilizedEventMarker)
  }

  for (const kind of options.stabilizedEventMarkers.keys()) {
    if (!currentKinds.has(kind)) {
      options.stabilizedEventMarkers.delete(kind)
    }
  }

  return eventMarkers
}

const getTrajectoryEventMarkerText = (
  eventMarker: TrajectoryPredictionEventMarker,
) => {
  const shortLabel = trajectoryEventMarkerShortLabels[eventMarker.kind]

  return {
    accessibleLabel: trajectoryEventMarkerAccessibleNames[eventMarker.kind],
    text: shortLabel,
  }
}

const updateTrajectoryEventMarkerLabel = (options: {
  apsidesScenarioOwned: boolean
  camera: THREE.Camera
  eventMarker: TrajectoryPredictionEventMarker
  label: HTMLElement
  position: THREE.Vector3
}) => {
  const projectedPosition = options.position.clone().project(options.camera)

  if (
    projectedPosition.x < -1 ||
    projectedPosition.x > 1 ||
    projectedPosition.y < -1 ||
    projectedPosition.y > 1 ||
    projectedPosition.z <= -1 ||
    projectedPosition.z >= 1
  ) {
    hideTrajectoryEventMarkerLabel(options.label)
    return
  }

  const screenX = (projectedPosition.x * 0.5 + 0.5) * window.innerWidth
  const screenY = (-projectedPosition.y * 0.5 + 0.5) * window.innerHeight
  const markerText = getTrajectoryEventMarkerText(options.eventMarker)

  options.label.textContent = markerText.text
  delete options.label.dataset.tooltip
  options.label.removeAttribute('title')
  options.label.setAttribute(
    'aria-label',
    options.apsidesScenarioOwned
      ? `${markerText.accessibleLabel}; selected by scenario`
      : `${markerText.accessibleLabel}; unselect Pe and Ap in Info`,
  )
  options.label.setAttribute('aria-pressed', 'true')
  options.label.setAttribute('aria-hidden', 'false')
  options.label.toggleAttribute('disabled', options.apsidesScenarioOwned)
  options.label.style.display = 'block'
  options.label.style.visibility = 'hidden'

  const bounds = options.label.getBoundingClientRect()
  const minimumLabelX =
    trajectoryEventMarkerLabelViewportPadding + bounds.width * 0.5
  const minimumLabelY =
    trajectoryEventMarkerLabelViewportPadding + bounds.height
  let maximumLabelX =
    window.innerWidth -
    trajectoryEventMarkerLabelViewportPadding -
    bounds.width * 0.5
  let maximumLabelY =
    window.innerHeight - trajectoryEventMarkerLabelViewportPadding
  const infoRails =
    typeof document === 'undefined'
      ? []
      : document.querySelectorAll<HTMLElement>('.info-hud-rail')
  for (const rail of infoRails) {
    const railBounds = rail.getBoundingClientRect()
    if (railBounds.width <= 0 || railBounds.height <= 0) {
      continue
    }

    const alignedWithRightRail =
      railBounds.left > window.innerWidth * 0.5 &&
      screenY >= railBounds.top - trajectoryEventMarkerLabelViewportPadding &&
      screenY <= railBounds.bottom + trajectoryEventMarkerLabelViewportPadding
    if (alignedWithRightRail) {
      maximumLabelX = Math.min(
        maximumLabelX,
        railBounds.left -
          trajectoryEventMarkerLabelViewportPadding -
          bounds.width * 0.5,
      )
    }

    const alignedWithBottomRail =
      railBounds.top > window.innerHeight * 0.5 &&
      screenX >= railBounds.left - trajectoryEventMarkerLabelViewportPadding &&
      screenX <= railBounds.right + trajectoryEventMarkerLabelViewportPadding
    if (alignedWithBottomRail) {
      maximumLabelY = Math.min(
        maximumLabelY,
        railBounds.top - trajectoryEventMarkerLabelViewportPadding,
      )
    }
  }
  const labelX = THREE.MathUtils.clamp(
    screenX,
    minimumLabelX,
    Math.max(minimumLabelX, maximumLabelX),
  )
  const labelY = THREE.MathUtils.clamp(
    screenY,
    minimumLabelY,
    Math.max(minimumLabelY, maximumLabelY),
  )

  options.label.style.left = `${labelX}px`
  options.label.style.top = `${labelY}px`
  options.label.style.visibility = 'visible'
}

const updateTrajectoryEventMarkers = (options: {
  apsidesScenarioOwned: boolean
  eventMarkers: TrajectoryPredictionEventMarker[]
  eventMarkerLabels: TrajectoryEventMarkerLabelRefs
  gameScene: GameSceneRefs
  orbitPointDisplaySettings: OrbitPointDisplaySettings
  pinnedEventMarkerKinds: ReadonlySet<TrajectoryPredictionEventMarkerKind>
  stabilizedEventMarkers: Map<
    TrajectoryPredictionEventMarkerKind,
    TrajectoryPredictionEventMarker
  >
  target: Body
  viewportSize: number
}) => {
  if (!options.orbitPointDisplaySettings.markersVisible) {
    options.stabilizedEventMarkers.clear()
    hideTrajectoryEventMarkers(options.eventMarkerLabels)
    return
  }

  const selectedEventMarkers = options.eventMarkers.filter((eventMarker) =>
    options.pinnedEventMarkerKinds.has(eventMarker.kind),
  )
  if (selectedEventMarkers.length === 0) {
    options.stabilizedEventMarkers.clear()
    hideTrajectoryEventMarkers(options.eventMarkerLabels)
    return
  }

  if (options.viewportSize > trajectoryEventMarkerMaxViewportSize) {
    hideTrajectoryEventMarkers(options.eventMarkerLabels)
    return
  }

  const eventMarkers = getStabilizedTrajectoryEventMarkers({
    eventMarkers: selectedEventMarkers,
    stabilizedEventMarkers: options.stabilizedEventMarkers,
  })
  const visibleKinds = new Set<TrajectoryPredictionEventMarker['kind']>()

  for (const eventMarker of eventMarkers) {
    const label = options.eventMarkerLabels[eventMarker.kind]

    if (
      !Number.isFinite(eventMarker.point.x) ||
      !Number.isFinite(eventMarker.point.y)
    ) {
      hideTrajectoryEventMarkerLabel(label)
      continue
    }

    const position = renderPosition(
      options.target.position.x + eventMarker.point.x,
      options.target.position.y + eventMarker.point.y,
      trajectoryEventMarkerLift,
    )

    updateTrajectoryEventMarkerLabel({
      apsidesScenarioOwned: options.apsidesScenarioOwned,
      camera: options.gameScene.camera,
      eventMarker,
      label,
      position,
    })

    visibleKinds.add(eventMarker.kind)
  }

  for (const kind of Object.keys(options.eventMarkerLabels)) {
    if (!visibleKinds.has(kind as TrajectoryPredictionEventMarker['kind'])) {
      hideTrajectoryEventMarkerLabel(
        options.eventMarkerLabels[
          kind as TrajectoryPredictionEventMarker['kind']
        ],
      )
    }
  }
}

const updateCircularizationVisuals = (options: {
  circularizePlan: CircularizePlan | null
  gameScene: GameSceneRefs
  spacecraftPosition: Vec2
  target: Body | null
  viewportSize: number
}) => {
  if (!options.circularizePlan || !options.target) {
    options.gameScene.circularOrbitLine.visible = false
    options.gameScene.desiredVelocityLine.visible = false
    return
  }

  const targetPosition = renderPosition(
    options.target.position.x,
    options.target.position.y,
    0.11,
  )
  const orbitRadius = options.circularizePlan.distance * RENDER_SCALE
  const orbitPoints: number[] = []
  const segments = 128

  for (let index = 0; index <= segments; index += 1) {
    const angle = (Math.PI * 2 * index) / segments
    orbitPoints.push(
      targetPosition.x + Math.cos(angle) * orbitRadius,
      0.11,
      targetPosition.z + Math.sin(angle) * orbitRadius,
    )
  }

  options.gameScene.circularOrbitGeometry.setPositions(orbitPoints)
  options.gameScene.circularOrbitLine.computeLineDistances()
  options.gameScene.circularOrbitLine.visible = true

  const spacecraftPosition = renderPosition(
    options.spacecraftPosition.x,
    options.spacecraftPosition.y,
    0.16,
  )
  const arrowLength = THREE.MathUtils.clamp(
    orbitRadius * 0.2,
    1.5,
    options.viewportSize * 0.16,
  )
  const desiredDirection = fromAngle(
    options.circularizePlan.desiredVelocityHeading,
  )
  const desiredEnd = {
    x: spacecraftPosition.x + desiredDirection.x * arrowLength,
    z: spacecraftPosition.z + desiredDirection.y * arrowLength,
  }

  options.gameScene.desiredVelocityGeometry.setPositions([
    spacecraftPosition.x,
    0.16,
    spacecraftPosition.z,
    desiredEnd.x,
    0.16,
    desiredEnd.z,
  ])
  options.gameScene.desiredVelocityLine.computeLineDistances()
  options.gameScene.desiredVelocityLine.visible = true
}

const shouldHideTutorialOrbitPointMarkers = (runtime: AppRuntimeState) => {
  const session = runtime.scenario.session
  if (session.scenarioId !== 'tutorial') {
    return false
  }

  const state = session.state
  return isTutorialScenarioState(state) && state.phase === 'escape-earth'
}

const getEffectiveOrbitPointDisplaySettings = (
  runtime: AppRuntimeState,
  settings: OrbitPointDisplaySettings,
): OrbitPointDisplaySettings => {
  if (
    !settings.markersVisible ||
    !shouldHideTutorialOrbitPointMarkers(runtime)
  ) {
    return settings
  }

  return {
    ...settings,
    markersVisible: false,
  }
}

const getApsidesSelectionState = (runtime: AppRuntimeState) => {
  const scenarioOwned = runtime.scenario.directives.infoPins.some(
    (pin) => pin.kind === 'apsis',
  )
  const selected =
    scenarioOwned || runtime.info.userPins.some((pin) => pin.kind === 'apsis')

  return {
    pinnedEventMarkerKinds: selected
      ? new Set<TrajectoryPredictionEventMarkerKind>(['periapsis', 'apoapsis'])
      : new Set<TrajectoryPredictionEventMarkerKind>(),
    scenarioOwned,
  }
}

export const createTrajectoryPresentation = (options: {
  autopilotRotationRate: number
  gameScene: GameSceneRefs
  getOrbitPointDisplaySettings: () => OrbitPointDisplaySettings
  physicsEngine: PhysicsEngine
  queries: GameQueries
  runtime: AppRuntimeState
  timeWarps: number[]
  trajectoryEventMarkerLabels: TrajectoryEventMarkerLabelRefs
  trajectoryPredictionRuntime: TrajectoryPredictionRuntime
}) => {
  const stabilizedTrajectoryEventMarkers = new Map<
    TrajectoryPredictionEventMarkerKind,
    TrajectoryPredictionEventMarker
  >()
  let stabilizedTrajectoryEventMarkerSession:
    | AppRuntimeState['scenario']['session']
    | null = null
  let stabilizedTrajectoryEventMarkerTargetId: string | null = null
  let renderDiagnostics: TrajectoryRenderDiagnostics | null = null
  const selectRenderGeometry = createTrajectoryRenderSelectionCache()

  const syncInertialPredictionVisual = () => {
    updateInertialPredictionVisual({
      enabled:
        options.runtime.debug.debugModeEnabled &&
        options.runtime.debug.debugNoGravityEnabled,
      gameScene: options.gameScene,
      predictionSeconds: Math.min(
        options.queries.getCoastPredictionHorizonSeconds() * 0.3,
        90 * 60,
      ),
      spacecraftPosition: options.runtime.simulation.state.spacecraft.position,
      spacecraftVelocity: options.runtime.simulation.state.spacecraft.velocity,
    })
  }

  const refreshPrediction = () => {
    options.trajectoryPredictionRuntime.refresh({
      assistMode: options.runtime.simulation.assistMode,
      autopilotRotationRate: options.autopilotRotationRate,
      getAssistPredictionControls: options.queries.getAssistPredictionControls,
      getAssistTarget: options.queries.getAssistTarget,
      getCaptureMetrics: options.queries.getCaptureMetrics,
      physicsEngine: options.physicsEngine,
      predictionConfig: options.queries.getPredictionConfig(),
      state: options.runtime.simulation.state,
      timeWarp:
        options.timeWarps[options.runtime.simulation.timeWarpIndex] ?? 1,
    })
    syncInertialPredictionVisual()
  }

  const getCoachAnchorScreenPoint = (): { x: number; y: number } | null => {
    if (
      options.runtime.scenario.directives.hiddenUIElements.has('trajectory')
    ) {
      return null
    }

    const predictionState = options.trajectoryPredictionRuntime.getState()
    const target = options.queries.getAssistTarget()
    if (predictionState.targetId !== target.id) {
      return null
    }

    const points = predictionState.targetRelativePredictionPoints
    if (points.length === 0) {
      return null
    }

    const point =
      points[
        Math.min(
          points.length - 1,
          Math.max(1, Math.floor(points.length * 0.18)),
        )
      ]
    if (!point) {
      return null
    }

    const screenPosition = renderPosition(
      target.position.x + point.x,
      target.position.y + point.y,
      0.18,
    )
    screenPosition.project(options.gameScene.camera)

    const x = (screenPosition.x * 0.5 + 0.5) * window.innerWidth
    const y = (-screenPosition.y * 0.5 + 0.5) * window.innerHeight
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null
    }

    const padding = 24
    return {
      x: THREE.MathUtils.clamp(x, padding, window.innerWidth - padding),
      y: THREE.MathUtils.clamp(y, padding, window.innerHeight - padding),
    }
  }

  return {
    getCoachAnchorScreenPoint,
    getPredictionDiagnostics: () =>
      options.trajectoryPredictionRuntime.getDiagnostics(),
    getRenderDiagnostics: () => renderDiagnostics,
    getRemainingUsableCoverageSeconds: () =>
      options.trajectoryPredictionRuntime.getRemainingUsableCoverageSeconds(),
    getPredictionState: () => options.trajectoryPredictionRuntime.getState(),
    maybeRefreshPrediction: (realDt: number) => {
      const refreshed = options.trajectoryPredictionRuntime.maybeRefresh(
        realDt,
        {
          assistMode: options.runtime.simulation.assistMode,
          autopilotRotationRate: options.autopilotRotationRate,
          getAssistPredictionControls:
            options.queries.getAssistPredictionControls,
          getAssistTarget: options.queries.getAssistTarget,
          getCaptureMetrics: options.queries.getCaptureMetrics,
          physicsEngine: options.physicsEngine,
          predictionConfig: options.queries.getPredictionConfig(),
          state: options.runtime.simulation.state,
          timeWarp:
            options.timeWarps[options.runtime.simulation.timeWarpIndex] ?? 1,
        },
      )

      if (refreshed) {
        syncInertialPredictionVisual()
      }
    },
    refreshPrediction,
    updateVisuals: () => {
      if (
        options.runtime.scenario.directives.hiddenUIElements.has('trajectory')
      ) {
        stabilizedTrajectoryEventMarkerSession = null
        stabilizedTrajectoryEventMarkerTargetId = null
        stabilizedTrajectoryEventMarkers.clear()
        hideTrajectoryVisuals(
          options.gameScene,
          options.trajectoryEventMarkerLabels,
        )
        renderDiagnostics = null
        return
      }

      const predictionState = options.trajectoryPredictionRuntime.getState()
      const predictionDiagnostics =
        options.trajectoryPredictionRuntime.getDiagnostics()
      const target = options.queries.getAssistTarget()
      const predictionTargetMatches = predictionState.targetId === target.id
      const trajectoryEventMarkerSession = predictionTargetMatches
        ? options.runtime.scenario.session
        : null
      const trajectoryEventMarkerTargetId = predictionTargetMatches
        ? target.id
        : null

      if (
        trajectoryEventMarkerSession !==
          stabilizedTrajectoryEventMarkerSession ||
        trajectoryEventMarkerTargetId !==
          stabilizedTrajectoryEventMarkerTargetId
      ) {
        stabilizedTrajectoryEventMarkers.clear()
        stabilizedTrajectoryEventMarkerSession = trajectoryEventMarkerSession
        stabilizedTrajectoryEventMarkerTargetId = trajectoryEventMarkerTargetId
      }

      if (options.runtime.simulation.assistMode !== 'off') {
        options.gameScene.assistedPredictionMaterial.color.set(
          options.runtime.simulation.assistMode === 'capture'
            ? 0xf59e0b
            : 0xfacc15,
        )
      }

      const geometryUpdateStartMs = performance.now()
      const apsidesSelection = getApsidesSelectionState(options.runtime)
      updateTargetRelativePredictionVisuals({
        apsidesScenarioOwned: apsidesSelection.scenarioOwned,
        coastPredictionHorizonSeconds:
          options.queries.getCoastPredictionHorizonSeconds(),
        debugModeEnabled: options.runtime.debug.debugModeEnabled,
        eventMarkerLabels: options.trajectoryEventMarkerLabels,
        gameScene: options.gameScene,
        orbitPointDisplaySettings: getEffectiveOrbitPointDisplaySettings(
          options.runtime,
          options.getOrbitPointDisplaySettings(),
        ),
        pinnedEventMarkerKinds: apsidesSelection.pinnedEventMarkerKinds,
        predictedImpact: predictionTargetMatches
          ? predictionState.predictedImpact
          : null,
        stabilizedEventMarkers: stabilizedTrajectoryEventMarkers,
        target,
        targetRelativeEventMarkers: predictionTargetMatches
          ? predictionState.targetRelativeEventMarkers
          : [],
        targetRelativeAssistedPoints: predictionTargetMatches
          ? predictionState.targetRelativeAssistedPoints
          : [],
        targetRelativeFarVisible: predictionTargetMatches
          ? predictionDiagnostics.farVisible
          : 'none',
        targetRelativeNearPointCount: predictionTargetMatches
          ? predictionDiagnostics.nearPointCount
          : 0,
        targetRelativePredictionEnd: predictionTargetMatches
          ? predictionState.targetRelativePredictionEnd
          : null,
        targetRelativePredictionPoints: predictionTargetMatches
          ? predictionState.targetRelativePredictionPoints
          : [],
        onRenderDiagnostics: options.runtime.debug.debugModeEnabled
          ? (diagnostics) => {
              renderDiagnostics = diagnostics
            }
          : undefined,
        selectRenderGeometry,
        viewportHeight: window.innerHeight,
        viewportSize: options.runtime.simulation.viewportSize,
      })
      options.trajectoryPredictionRuntime.recordGeometryUpdate?.(
        performance.now() - geometryUpdateStartMs,
      )
      updateCircularizationVisuals({
        circularizePlan:
          options.runtime.simulation.assistMode === 'circularize' &&
          !options.runtime.simulation.crashedBodyName
            ? options.queries.getCircularizePlan(target)
            : null,
        gameScene: options.gameScene,
        spacecraftPosition:
          options.runtime.simulation.state.spacecraft.position,
        target:
          options.runtime.simulation.assistMode === 'circularize' &&
          !options.runtime.simulation.crashedBodyName
            ? target
            : null,
        viewportSize: options.runtime.simulation.viewportSize,
      })
    },
  }
}

export type TrajectoryPresentation = ReturnType<
  typeof createTrajectoryPresentation
>
