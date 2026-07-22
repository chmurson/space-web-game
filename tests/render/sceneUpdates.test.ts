import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import { updateCameraView } from '@/render/sceneUpdates'
import type { GameSceneRefs } from '@/scene/createGameScene'

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
})
