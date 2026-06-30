import * as THREE from 'three'

import type {
  TrajectoryPredictionEventMarker,
  TrajectoryPredictionEventMarkerKind,
} from '../prediction/trajectoryPrediction'
import type { CircularizePlan } from '../assist/orbitalAssist'
import { renderPosition } from '../render/sceneUpdates'
import {
  updateColoredLine2Geometry,
  updateLine2Geometry,
} from '../rendering/line2Geometry'
import type { AppRuntimeState } from '../runtime/appRuntimeState'
import type { GameQueries } from '../runtime/gameQueries'
import type { TrajectoryPredictionRuntime } from '../runtime/trajectoryPredictionRuntime'
import type { GameSceneRefs } from '../scene/createGameScene'
import { RENDER_SCALE } from '../simulation/constants'
import type { Body, PhysicsEngine } from '../simulation/types'
import { fromAngle, length, sub, type Vec2 } from '../simulation/vector'
import { formatDistance } from '../ui/formatters'
import { getCoastPredictionFadeColors } from './predictionLineFade'

const trajectoryEventMarkerFullSizeMaxViewportSize = 160
const trajectoryEventMarkerMaxViewportSize = 500
const trajectoryEventMarkerMaxScreenViewportSize = 20
const trajectoryEventMarkerLabelMaxViewportSize = 70
const trajectoryEventMarkerLift = 0.22
const trajectoryEventMarkerLabelOffsetX = 10
const trajectoryEventMarkerLabelOffsetY = 10
const trajectoryEventMarkerLabelViewportPadding = 8
const trajectoryEventMarkerUpdateAltitudeRatioThreshold = 0.05

type TrajectoryEventMarkerLabelRefs = Record<
  TrajectoryPredictionEventMarkerKind,
  HTMLElement
>

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

const hideTrajectoryEventMarkers = (
  gameScene: GameSceneRefs,
  labels: TrajectoryEventMarkerLabelRefs,
) => {
  for (const marker of Object.values(gameScene.trajectoryEventMarkers)) {
    marker.group.visible = false
  }
  hideTrajectoryEventMarkerLabels(labels)
}

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
  hideTrajectoryEventMarkers(gameScene, labels)
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
  geometryKey: 'predictionGeometry' | 'assistedPredictionGeometry',
  lineKey: 'predictionLine' | 'assistedPredictionLine',
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

const updateTargetRelativePredictionVisuals = (options: {
  coastPredictionHorizonSeconds: number
  debugModeEnabled: boolean
  eventMarkerLabels: TrajectoryEventMarkerLabelRefs
  gameScene: GameSceneRefs
  predictedImpact: { bodyName: string; time: number } | null
  stabilizedEventMarkers: Map<
    TrajectoryPredictionEventMarkerKind,
    TrajectoryPredictionEventMarker
  >
  target: Body
  targetRelativeEventMarkers: TrajectoryPredictionEventMarker[]
  targetRelativeAssistedPoints: Vec2[]
  targetRelativePredictionEnd: Vec2 | null
  targetRelativePredictionPoints: Vec2[]
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
  const predictionPositions: number[] = []

  for (const point of options.targetRelativePredictionPoints) {
    const renderedPoint = renderPosition(
      options.target.position.x + point.x,
      options.target.position.y + point.y,
      0.18,
    )
    predictionPositions.push(renderedPoint.x, renderedPoint.y, renderedPoint.z)
  }

  applyTargetRelativePredictionLine(
    options.gameScene,
    options.targetRelativePredictionPoints,
    'predictionGeometry',
    'predictionLine',
    0.18,
    options.target,
    getCoastPredictionFadeColors(
      predictionPositions,
      options.coastPredictionHorizonSeconds,
    ),
  )
  applyTargetRelativePredictionLine(
    options.gameScene,
    options.targetRelativeAssistedPoints,
    'assistedPredictionGeometry',
    'assistedPredictionLine',
    0.2,
    options.target,
  )
  updateTrajectoryEventMarkers({
    eventMarkers: options.targetRelativeEventMarkers,
    eventMarkerLabels: options.eventMarkerLabels,
    gameScene: options.gameScene,
    stabilizedEventMarkers: options.stabilizedEventMarkers,
    target: options.target,
    viewportHeight: options.viewportHeight,
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
  options.gameScene.predictionEndMarker.scale.setScalar(markerRadius)
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

const getTrajectoryEventMarkerPointChangeAltitudeRatio = (
  eventMarker: TrajectoryPredictionEventMarker,
  previous: TrajectoryPredictionEventMarker,
) => {
  const altitudeScale = Math.max(
    Number.isFinite(eventMarker.altitude) ? Math.abs(eventMarker.altitude) : 0,
    Number.isFinite(previous.altitude) ? Math.abs(previous.altitude) : 0,
    1,
  )

  return length(sub(eventMarker.point, previous.point)) / altitudeScale
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
      getTrajectoryEventMarkerPointChangeAltitudeRatio(eventMarker, previous) <=
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
  const distanceLabel = formatDistance(Math.max(0, eventMarker.distance))
  const altitudeLabel = formatDistance(Math.max(0, eventMarker.altitude))

  return {
    accessibleLabel: `${trajectoryEventMarkerAccessibleNames[eventMarker.kind]}: distance ${distanceLabel}, altitude ${altitudeLabel}`,
    text: `${trajectoryEventMarkerShortLabels[eventMarker.kind]} ${distanceLabel} -> alt ${altitudeLabel}`,
  }
}

const updateTrajectoryEventMarkerLabel = (options: {
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
  const { accessibleLabel, text } = getTrajectoryEventMarkerText(
    options.eventMarker,
  )

  options.label.textContent = text
  options.label.title = accessibleLabel
  options.label.setAttribute('aria-label', accessibleLabel)
  options.label.setAttribute('aria-hidden', 'false')
  options.label.style.display = 'block'
  options.label.style.visibility = 'hidden'

  const bounds = options.label.getBoundingClientRect()
  const labelX = THREE.MathUtils.clamp(
    screenX + trajectoryEventMarkerLabelOffsetX,
    trajectoryEventMarkerLabelViewportPadding,
    window.innerWidth -
      bounds.width -
      trajectoryEventMarkerLabelViewportPadding,
  )
  const labelY = THREE.MathUtils.clamp(
    screenY - bounds.height - trajectoryEventMarkerLabelOffsetY,
    trajectoryEventMarkerLabelViewportPadding,
    window.innerHeight -
      bounds.height -
      trajectoryEventMarkerLabelViewportPadding,
  )

  options.label.style.left = `${labelX}px`
  options.label.style.top = `${labelY}px`
  options.label.style.visibility = 'visible'
}

const updateTrajectoryEventMarkers = (options: {
  eventMarkers: TrajectoryPredictionEventMarker[]
  eventMarkerLabels: TrajectoryEventMarkerLabelRefs
  gameScene: GameSceneRefs
  stabilizedEventMarkers: Map<
    TrajectoryPredictionEventMarkerKind,
    TrajectoryPredictionEventMarker
  >
  target: Body
  viewportHeight: number
  viewportSize: number
}) => {
  if (options.eventMarkers.length === 0) {
    options.stabilizedEventMarkers.clear()
    hideTrajectoryEventMarkers(options.gameScene, options.eventMarkerLabels)
    return
  }

  if (options.viewportSize > trajectoryEventMarkerMaxViewportSize) {
    hideTrajectoryEventMarkers(options.gameScene, options.eventMarkerLabels)
    return
  }

  const eventMarkers = getStabilizedTrajectoryEventMarkers({
    eventMarkers: options.eventMarkers,
    stabilizedEventMarkers: options.stabilizedEventMarkers,
  })
  const markerScaleViewportSize = Math.max(
    options.viewportSize,
    trajectoryEventMarkerMaxScreenViewportSize,
  )
  const distantViewportScale =
    options.viewportSize > trajectoryEventMarkerFullSizeMaxViewportSize
      ? Math.sqrt(
          trajectoryEventMarkerFullSizeMaxViewportSize / options.viewportSize,
        )
      : 1
  const markerRadius =
    Math.max(
      options.gameScene.predictionEndMarkerRadius * 0.72,
      options.gameScene.predictionEndMarkerMinScreenRadius *
        0.72 *
        (markerScaleViewportSize / Math.max(options.viewportHeight, 1)),
    ) *
    (options.viewportSize / markerScaleViewportSize) *
    distantViewportScale
  const labelVisible =
    options.viewportSize <= trajectoryEventMarkerLabelMaxViewportSize
  const visibleKinds = new Set<TrajectoryPredictionEventMarker['kind']>()

  for (const eventMarker of eventMarkers) {
    const marker = options.gameScene.trajectoryEventMarkers[eventMarker.kind]
    const label = options.eventMarkerLabels[eventMarker.kind]

    if (
      !Number.isFinite(eventMarker.point.x) ||
      !Number.isFinite(eventMarker.point.y)
    ) {
      marker.group.visible = false
      hideTrajectoryEventMarkerLabel(label)
      continue
    }

    const position = renderPosition(
      options.target.position.x + eventMarker.point.x,
      options.target.position.y + eventMarker.point.y,
      trajectoryEventMarkerLift,
    )

    marker.group.position.copy(position)
    marker.group.quaternion.copy(options.gameScene.camera.quaternion)
    marker.group.scale.setScalar(markerRadius)
    marker.group.visible = true

    if (labelVisible) {
      updateTrajectoryEventMarkerLabel({
        camera: options.gameScene.camera,
        eventMarker,
        label,
        position,
      })
    } else {
      hideTrajectoryEventMarkerLabel(label)
    }

    visibleKinds.add(eventMarker.kind)
  }

  for (const [kind, marker] of Object.entries(
    options.gameScene.trajectoryEventMarkers,
  )) {
    if (!visibleKinds.has(kind as TrajectoryPredictionEventMarker['kind'])) {
      marker.group.visible = false
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

export const createTrajectoryPresentation = (options: {
  gameScene: GameSceneRefs
  physicsEngine: PhysicsEngine
  queries: GameQueries
  runtime: AppRuntimeState
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
      getAssistPredictionControls: options.queries.getAssistPredictionControls,
      getAssistTarget: options.queries.getAssistTarget,
      getCaptureMetrics: options.queries.getCaptureMetrics,
      physicsEngine: options.physicsEngine,
      predictionConfig: options.queries.getPredictionConfig(),
      state: options.runtime.simulation.state,
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
    getPredictionState: () => options.trajectoryPredictionRuntime.getState(),
    maybeRefreshPrediction: (realDt: number) => {
      const refreshed = options.trajectoryPredictionRuntime.maybeRefresh(
        realDt,
        {
          assistMode: options.runtime.simulation.assistMode,
          getAssistPredictionControls:
            options.queries.getAssistPredictionControls,
          getAssistTarget: options.queries.getAssistTarget,
          getCaptureMetrics: options.queries.getCaptureMetrics,
          physicsEngine: options.physicsEngine,
          predictionConfig: options.queries.getPredictionConfig(),
          state: options.runtime.simulation.state,
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
        return
      }

      const predictionState = options.trajectoryPredictionRuntime.getState()
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

      updateTargetRelativePredictionVisuals({
        coastPredictionHorizonSeconds:
          options.queries.getCoastPredictionHorizonSeconds(),
        debugModeEnabled: options.runtime.debug.debugModeEnabled,
        eventMarkerLabels: options.trajectoryEventMarkerLabels,
        gameScene: options.gameScene,
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
        targetRelativePredictionEnd: predictionTargetMatches
          ? predictionState.targetRelativePredictionEnd
          : null,
        targetRelativePredictionPoints: predictionTargetMatches
          ? predictionState.targetRelativePredictionPoints
          : [],
        viewportHeight: window.innerHeight,
        viewportSize: options.runtime.simulation.viewportSize,
      })
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
