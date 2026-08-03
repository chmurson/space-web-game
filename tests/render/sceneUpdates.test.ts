import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import { updateCameraView } from '@/render/sceneUpdates'
import type { GameSceneRefs } from '@/scene/createGameScene'
import { createSphereOfInfluenceVisual } from '@/scene/sphereOfInfluenceVisual'
import type { Body } from '@/simulation/types'

const body: Body = {
  color: '#2f80ed',
  id: 'earth',
  mass: 5.9722e24,
  name: 'Earth',
  position: { x: 0, y: 0 },
  radius: 6_371_000,
  sphereOfInfluenceRadius: 924_637_562,
  velocity: { x: 0, y: 1 },
}

const createGameSceneRefs = (
  starfield: GameSceneRefs['starfield'] = { update: vi.fn() } as never,
) => {
  const createScreenSpaceMaterial = () => ({
    resolution: { set: vi.fn() },
  })

  return {
    assistedPredictionMaterial: createScreenSpaceMaterial(),
    bodySphereOfInfluenceGroups: new Map(),
    camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10_000),
    cameraTarget: new THREE.Vector3(),
    circularOrbitMaterial: createScreenSpaceMaterial(),
    desiredVelocityMaterial: createScreenSpaceMaterial(),
    impactGradientMaterial: createScreenSpaceMaterial(),
    inertialPredictionMaterial: createScreenSpaceMaterial(),
    predictionMaterial: createScreenSpaceMaterial(),
    predictionStaleFarMaterial: createScreenSpaceMaterial(),
    starfield,
  } as unknown as GameSceneRefs
}

describe('updateCameraView', () => {
  it('projects the tracked target into the center of the unobscured viewport', () => {
    const gameScene = createGameSceneRefs()

    updateCameraView({
      cameraDistance: 700,
      cameraElevation: 1,
      cameraTargetPosition: { x: 12, y: 34 },
      gameScene,
      maxViewportSize: 4_000,
      minViewportSize: 100 / 30,
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
    const gameScene = createGameSceneRefs()

    updateCameraView({
      cameraDistance: 700,
      cameraElevation: 1,
      cameraTargetPosition: { x: 12, y: 34 },
      gameScene,
      maxViewportSize: 4_000,
      minViewportSize: 100 / 30,
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

  it('updates SOI gradient width from the current camera viewport', () => {
    const gameScene = createGameSceneRefs()
    const visual = createSphereOfInfluenceVisual(
      body,
      'gradient-max-zoom-width-25pct',
    )
    gameScene.bodySphereOfInfluenceGroups.set(body.id, visual.group)

    updateCameraView({
      cameraDistance: 700,
      cameraElevation: 1,
      cameraTargetPosition: { x: 0, y: 0 },
      gameScene,
      maxViewportSize: 4_000,
      minViewportSize: 100 / 30,
      viewportHeight: 800,
      viewportSize: 2_000,
      viewportWidth: 400,
    })

    expect(visual.group.getObjectByName('soi-field-fill')).toHaveProperty(
      'material.uniforms.uSoiEdgeGradientWidthScale.value',
      0.5,
    )
  })
})
