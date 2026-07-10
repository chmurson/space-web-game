import { renderPosition } from '../render/sceneUpdates'
import type { GameSceneRefs } from '../scene/createGameScene'
import type { Body } from '../simulation/types'
import type { Vec2 } from '../simulation/vector'
import type { OverlayUiRefs } from '../ui/overlayUI/createOverlayUi'
import type { BodyDistanceContext } from './bodyDistanceContext'
import { updateBodyLabels } from './bodyPresentation/updateBodyLabels'
import { updateOffscreenIndicators } from './bodyPresentation/updateOffscreenIndicators'
import {
  getEarthCloudDriftRotationY,
  setBodyVisualQuaternion,
} from './bodyRotation'

const updateBodyWorldVisuals = (options: {
  allBodies: Body[]
  bodies: Body[]
  elapsedSeconds: number
  gameScene: GameSceneRefs
}) => {
  const { bodies, gameScene } = options
  const visibleBodyIds = new Set(bodies.map((body) => body.id))

  for (const [bodyId, mesh] of gameScene.bodyMeshes.entries()) {
    mesh.visible = visibleBodyIds.has(bodyId)
  }

  for (const body of bodies) {
    const mesh = gameScene.bodyMeshes.get(body.id)
    if (mesh) {
      mesh.visible = true
      mesh.position.copy(renderPosition(body.position.x, body.position.y))
      setBodyVisualQuaternion(mesh.quaternion, {
        bodies: options.allBodies,
        body,
        elapsedSeconds: options.elapsedSeconds,
      })
      const cloudMesh = gameScene.bodyCloudMeshes.get(body.id)
      if (cloudMesh) {
        cloudMesh.rotation.y = getEarthCloudDriftRotationY(
          options.elapsedSeconds,
        )
      }
    }
  }
}

export const createBodyPresentation = (options: {
  gameScene: GameSceneRefs
  overlayUi: OverlayUiRefs
}) => ({
  updateVisuals: (state: {
    bodies: Body[]
    distanceContext?: BodyDistanceContext | null
    elapsed: number
    hiddenBodyIds: string[]
    spacecraftPosition: Vec2
    viewportSize: number
  }) => {
    const visibleBodies = state.bodies.filter(
      (body) => !state.hiddenBodyIds.includes(body.id),
    )

    updateBodyWorldVisuals({
      allBodies: state.bodies,
      bodies: visibleBodies,
      elapsedSeconds: state.elapsed,
      gameScene: options.gameScene,
    })
    updateOffscreenIndicators({
      bodies: visibleBodies,
      gameScene: options.gameScene,
      overlayUi: options.overlayUi,
      spacecraftPosition: state.spacecraftPosition,
      viewportSize: state.viewportSize,
    })
    updateBodyLabels({
      bodies: visibleBodies,
      distanceContext: state.distanceContext ?? null,
      gameScene: options.gameScene,
      overlayUi: options.overlayUi,
      viewportSize: state.viewportSize,
    })
  },
})

export type BodyPresentation = ReturnType<typeof createBodyPresentation>
