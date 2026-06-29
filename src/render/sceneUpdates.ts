import * as THREE from 'three'

import type {
  GameSceneRefs,
  ScreenSpaceDashPattern,
} from '../scene/createGameScene'
import { RENDER_SCALE } from '../simulation/constants'
import type { Vec2 } from '../simulation/vector'

export const renderPosition = (x: number, y: number, lift = 0) =>
  new THREE.Vector3(x * RENDER_SCALE, lift, y * RENDER_SCALE)

const updateScreenSpaceDashPattern = (
  pattern: ScreenSpaceDashPattern,
  renderUnitsPerPixel: number,
) => {
  pattern.material.dashSize = renderUnitsPerPixel * pattern.dashPixels
  pattern.material.gapSize = renderUnitsPerPixel * pattern.gapPixels
}

export const updateCameraView = (options: {
  cameraDistance: number
  cameraElevation: number
  cameraTargetPosition: Vec2
  gameScene: GameSceneRefs
  viewportHeight: number
  viewportSize: number
  viewportWidth: number
}) => {
  const target = renderPosition(
    options.cameraTargetPosition.x,
    options.cameraTargetPosition.y,
  )
  options.gameScene.cameraTarget.set(target.x, 0, target.z)

  options.gameScene.camera.left =
    -options.viewportSize *
    (options.viewportWidth / options.viewportHeight) *
    0.5
  options.gameScene.camera.right =
    options.viewportSize *
    (options.viewportWidth / options.viewportHeight) *
    0.5
  options.gameScene.camera.top = options.viewportSize * 0.5
  options.gameScene.camera.bottom = -options.viewportSize * 0.5

  const horizontal = Math.cos(options.cameraElevation) * options.cameraDistance
  const vertical = Math.sin(options.cameraElevation) * options.cameraDistance
  options.gameScene.camera.position.set(
    options.gameScene.cameraTarget.x + horizontal,
    vertical,
    options.gameScene.cameraTarget.z + horizontal,
  )
  options.gameScene.camera.lookAt(options.gameScene.cameraTarget)
  options.gameScene.camera.updateProjectionMatrix()
  options.gameScene.camera.updateMatrixWorld()
  options.gameScene.predictionMaterial.resolution.set(
    options.viewportWidth,
    options.viewportHeight,
  )
  options.gameScene.impactGradientMaterial.resolution.set(
    options.viewportWidth,
    options.viewportHeight,
  )
  options.gameScene.inertialPredictionMaterial.resolution.set(
    options.viewportWidth,
    options.viewportHeight,
  )
  options.gameScene.assistedPredictionMaterial.resolution.set(
    options.viewportWidth,
    options.viewportHeight,
  )
  options.gameScene.circularOrbitMaterial.resolution.set(
    options.viewportWidth,
    options.viewportHeight,
  )
  options.gameScene.desiredVelocityMaterial.resolution.set(
    options.viewportWidth,
    options.viewportHeight,
  )
  const renderUnitsPerPixel = options.viewportSize / options.viewportHeight
  for (const pattern of options.gameScene.screenSpaceDashPatterns) {
    updateScreenSpaceDashPattern(pattern, renderUnitsPerPixel)
  }
  options.gameScene.starfield.update({
    cameraTarget: options.gameScene.cameraTarget,
    viewportHeight: options.viewportHeight,
    viewportSize: options.viewportSize,
    viewportWidth: options.viewportWidth,
  })
}
