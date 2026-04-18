import * as THREE from 'three'

import type { CircularizePlan } from '../assist/orbitalAssist'
import {
  updateColoredLine2Geometry,
  updateLine2Geometry,
} from '../rendering/line2Geometry'
import { renderPosition } from '../render/sceneUpdates'
import type { AppRuntimeState } from '../runtime/appRuntimeState'
import type { GameQueries } from '../runtime/gameQueries'
import type { TrajectoryPredictionRuntime } from '../runtime/trajectoryPredictionRuntime'
import type { GameSceneRefs } from '../scene/createGameScene'
import { RENDER_SCALE } from '../simulation/constants'
import type { Body, PhysicsEngine } from '../simulation/types'
import { fromAngle, type Vec2 } from '../simulation/vector'

const hideTrajectoryVisuals = (gameScene: GameSceneRefs) => {
  gameScene.assistedPredictionLine.visible = false
  gameScene.circularOrbitLine.visible = false
  gameScene.desiredVelocityLine.visible = false
  gameScene.impactGradientLine.visible = false
  gameScene.inertialPredictionLine.visible = false
  gameScene.predictionEndMarker.visible = false
  gameScene.predictionLine.visible = false
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
  debugModeEnabled: boolean
  gameScene: GameSceneRefs
  predictedImpact: { bodyName: string; time: number } | null
  target: Body
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

  applyTargetRelativePredictionLine(
    options.gameScene,
    options.targetRelativePredictionPoints,
    'predictionGeometry',
    'predictionLine',
    0.18,
    options.target,
  )
  applyTargetRelativePredictionLine(
    options.gameScene,
    options.targetRelativeAssistedPoints,
    'assistedPredictionGeometry',
    'assistedPredictionLine',
    0.2,
    options.target,
  )

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
  trajectoryPredictionRuntime: TrajectoryPredictionRuntime
}) => {
  const syncInertialPredictionVisual = () => {
    updateInertialPredictionVisual({
      enabled:
        options.runtime.debugModeEnabled &&
        options.runtime.debugNoGravityEnabled,
      gameScene: options.gameScene,
      predictionSeconds: Math.min(
        options.queries.getCoastPredictionHorizonSeconds() * 0.3,
        90 * 60,
      ),
      spacecraftPosition: options.runtime.state.spacecraft.position,
      spacecraftVelocity: options.runtime.state.spacecraft.velocity,
    })
  }

  const refreshPrediction = () => {
    options.trajectoryPredictionRuntime.refresh({
      assistMode: options.runtime.assistMode,
      getAssistPredictionControls: options.queries.getAssistPredictionControls,
      getAssistTarget: options.queries.getAssistTarget,
      getCaptureMetrics: options.queries.getCaptureMetrics,
      physicsEngine: options.physicsEngine,
      predictionConfig: options.queries.getPredictionConfig(),
      state: options.runtime.state,
    })
    syncInertialPredictionVisual()
  }

  return {
    getPredictionState: () => options.trajectoryPredictionRuntime.getState(),
    maybeRefreshPrediction: (realDt: number) => {
      const refreshed = options.trajectoryPredictionRuntime.maybeRefresh(
        realDt,
        {
          assistMode: options.runtime.assistMode,
          getAssistPredictionControls:
            options.queries.getAssistPredictionControls,
          getAssistTarget: options.queries.getAssistTarget,
          getCaptureMetrics: options.queries.getCaptureMetrics,
          physicsEngine: options.physicsEngine,
          predictionConfig: options.queries.getPredictionConfig(),
          state: options.runtime.state,
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
        hideTrajectoryVisuals(options.gameScene)
        return
      }

      const predictionState = options.trajectoryPredictionRuntime.getState()
      const target = options.queries.getAssistTarget()

      if (options.runtime.assistMode !== 'off') {
        options.gameScene.assistedPredictionMaterial.color.set(
          options.runtime.assistMode === 'capture' ? 0xf59e0b : 0xfacc15,
        )
      }

      updateTargetRelativePredictionVisuals({
        debugModeEnabled: options.runtime.debugModeEnabled,
        gameScene: options.gameScene,
        predictedImpact: predictionState.predictedImpact,
        target,
        targetRelativeAssistedPoints:
          predictionState.targetRelativeAssistedPoints,
        targetRelativePredictionEnd:
          predictionState.targetRelativePredictionEnd,
        targetRelativePredictionPoints:
          predictionState.targetRelativePredictionPoints,
        viewportHeight: window.innerHeight,
        viewportSize: options.runtime.viewportSize,
      })
      updateCircularizationVisuals({
        circularizePlan:
          options.runtime.assistMode === 'circularize' &&
          !options.runtime.crashedBodyName
            ? options.queries.getCircularizePlan(target)
            : null,
        gameScene: options.gameScene,
        spacecraftPosition: options.runtime.state.spacecraft.position,
        target:
          options.runtime.assistMode === 'circularize' &&
          !options.runtime.crashedBodyName
            ? target
            : null,
        viewportSize: options.runtime.viewportSize,
      })
    },
  }
}

export type TrajectoryPresentation = ReturnType<
  typeof createTrajectoryPresentation
>
