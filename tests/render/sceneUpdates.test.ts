import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import { updateCameraView } from '@/render/sceneUpdates'
import type { GameSceneRefs } from '@/scene/createGameScene'
import { createStarfield, type Starfield } from '@/scene/starfield'
import { RENDER_SCALE } from '@/simulation/constants'

const createGameScene = (
  starfield: GameSceneRefs['starfield'] = { update: vi.fn() } as never,
) => {
  const createScreenSpaceMaterial = () => ({
    resolution: { set: vi.fn() },
  })

  return {
    assistedPredictionMaterial: createScreenSpaceMaterial(),
    camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10_000),
    cameraTarget: new THREE.Vector3(),
    circularOrbitMaterial: createScreenSpaceMaterial(),
    desiredVelocityMaterial: createScreenSpaceMaterial(),
    impactGradientMaterial: createScreenSpaceMaterial(),
    inertialPredictionMaterial: createScreenSpaceMaterial(),
    predictionMaterial: createScreenSpaceMaterial(),
    predictionStaleFarMaterial: createScreenSpaceMaterial(),
    screenSpaceDashPatterns: [],
    starfield,
  } as unknown as GameSceneRefs
}

const getFirstVisibleStarWorldPosition = (starfield: Starfield) => {
  starfield.group.updateMatrixWorld(true)
  const layer = starfield.group.children.find((candidate) => {
    const points = candidate.children[0]
    return (
      candidate.visible &&
      points instanceof THREE.Points &&
      points.geometry.drawRange.count > 0
    )
  })
  const points = layer?.children[0]
  if (!(points instanceof THREE.Points)) {
    throw new Error('Expected the starfield to have a visible point layer')
  }
  const position = points.geometry.getAttribute('position')
  return new THREE.Vector3()
    .fromBufferAttribute(position, 0)
    .applyMatrix4(points.matrixWorld)
}

describe('updateCameraView', () => {
  it('projects the tracked target into the center of the unobscured viewport', () => {
    const gameScene = createGameScene()

    updateCameraView({
      cameraDistance: 700,
      cameraElevation: 1,
      cameraTargetPosition: { x: 12, y: 34 },
      gameScene,
      viewportBottomInset: 260,
      viewportHeight: 800,
      viewportSize: 600,
      viewportWidth: 400,
    })

    const targetNdc = gameScene.cameraTarget.clone().project(gameScene.camera)
    const targetScreenY = (-targetNdc.y * 0.5 + 0.5) * 800

    expect(targetNdc.x).toBeCloseTo(0)
    expect(targetNdc.y).toBeCloseTo(260 / 800)
    expect(targetScreenY).toBeCloseTo((800 - 260) / 2)
    expect(gameScene.camera.top).toBeCloseTo(202.5)
    expect(gameScene.camera.bottom).toBeCloseTo(-397.5)
  })

  it('keeps the tracked target at device center without an inset', () => {
    const gameScene = createGameScene()

    updateCameraView({
      cameraDistance: 700,
      cameraElevation: 1,
      cameraTargetPosition: { x: 12, y: 34 },
      gameScene,
      viewportHeight: 800,
      viewportSize: 600,
      viewportWidth: 400,
    })

    const targetNdc = gameScene.cameraTarget.clone().project(gameScene.camera)

    expect(targetNdc.x).toBeCloseTo(0)
    expect(targetNdc.y).toBeCloseTo(0)
    expect(gameScene.camera.top).toBeCloseTo(300)
    expect(gameScene.camera.bottom).toBeCloseTo(-300)
  })

  it('keeps stars fixed when the unlock target replaces the follow inset', () => {
    const starfield = createStarfield()
    const gameScene = createGameScene(starfield)
    const cameraElevation = 1
    const cameraTargetPosition = { x: 12, y: 34 }
    const viewportBottomInset = 260
    const viewportHeight = 844
    const viewportSize = 600

    updateCameraView({
      cameraDistance: 700,
      cameraElevation,
      cameraTargetPosition,
      gameScene,
      viewportBottomInset,
      viewportHeight,
      viewportSize,
      viewportWidth: 390,
    })

    const lockedStarPosition = getFirstVisibleStarWorldPosition(starfield)
    const lockedStarNdc = lockedStarPosition.clone().project(gameScene.camera)
    const verticalDirection = Math.sin(cameraElevation)
    const cameraDirectionLength = Math.hypot(
      Math.SQRT2 * Math.cos(cameraElevation),
      verticalDirection,
    )
    const screenUpOffset =
      (viewportSize *
        0.5 *
        (viewportBottomInset / viewportHeight) *
        cameraDirectionLength) /
      (Math.SQRT2 * verticalDirection * RENDER_SCALE)

    updateCameraView({
      cameraDistance: 700,
      cameraElevation,
      cameraTargetPosition: {
        x: cameraTargetPosition.x + screenUpOffset,
        y: cameraTargetPosition.y + screenUpOffset,
      },
      gameScene,
      preserveStarfieldWorldPosition: true,
      viewportHeight,
      viewportSize,
      viewportWidth: 390,
    })

    const unlockedStarPosition = getFirstVisibleStarWorldPosition(starfield)
    const unlockedStarNdc = unlockedStarPosition
      .clone()
      .project(gameScene.camera)

    expect(unlockedStarPosition).toEqual(lockedStarPosition)
    expect(unlockedStarNdc.x).toBeCloseTo(lockedStarNdc.x)
    expect(unlockedStarNdc.y).toBeCloseTo(lockedStarNdc.y)
  })
})
