import * as THREE from 'three'
import { renderPosition } from '../render/sceneUpdates'
import type { GameSceneRefs } from '../scene/createGameScene'
import { RENDER_SCALE } from '../simulation/constants'
import type { Body } from '../simulation/types'
import type { Vec2 } from '../simulation/vector'
import type { OverlayUiRefs } from '../ui/overlayUI/createOverlayUi'
import type { BodyDistanceContext } from './bodyDistanceContext'
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

const updateBodyLabels = (options: {
  bodies: Body[]
  distanceContext: BodyDistanceContext | null
  gameScene: GameSceneRefs
  overlayUi: OverlayUiRefs
  viewportSize: number
}) => {
  const labelRadiusThreshold = 24
  const pixelsPerRenderUnit = window.innerHeight / options.viewportSize
  const telemetryStrip = document.querySelector<HTMLElement>('.telemetry-strip')
  const reservedTop = telemetryStrip
    ? telemetryStrip.getBoundingClientRect().bottom + 12
    : 8
  const mobileViewport = window.matchMedia(
    '(hover: none), (pointer: coarse)',
  ).matches

  for (const body of options.bodies) {
    const label = options.overlayUi.bodyLabels.get(body.id)
    if (!label) {
      continue
    }

    const apparentRadius = body.radius * RENDER_SCALE * pixelsPerRenderUnit
    const position = renderPosition(
      body.position.x,
      body.position.y,
      body.radius * RENDER_SCALE,
    )
    position.project(options.gameScene.camera)
    const isVisible =
      position.x >= -1 &&
      position.x <= 1 &&
      position.y >= -1 &&
      position.y <= 1 &&
      position.z > -1 &&
      position.z < 1

    const distanceContext =
      options.distanceContext?.bodyId === body.id
        ? options.distanceContext
        : null

    if (
      !isVisible ||
      (apparentRadius > labelRadiusThreshold && !distanceContext)
    ) {
      label.style.display = 'none'
      continue
    }

    label.textContent = distanceContext
      ? distanceContext.tooltipLabel
      : body.name
    label.title = distanceContext ? distanceContext.accessibleLabel : body.name
    label.setAttribute(
      'aria-label',
      distanceContext ? distanceContext.accessibleLabel : body.name,
    )
    label.classList.toggle('body-label-distance-context', !!distanceContext)
    const screenX = (position.x * 0.5 + 0.5) * window.innerWidth
    const screenY = (-position.y * 0.5 + 0.5) * window.innerHeight
    const shouldWrapLabel =
      mobileViewport &&
      screenX > window.innerWidth * 0.22 &&
      screenX < window.innerWidth * 0.78
    label.classList.toggle('body-label-mobile-wrap', shouldWrapLabel)
    label.style.display = 'block'
    label.style.visibility = 'hidden'
    const bounds = label.getBoundingClientRect()
    const labelX = THREE.MathUtils.clamp(
      screenX + 10,
      8,
      window.innerWidth - bounds.width - 8,
    )
    const labelY = THREE.MathUtils.clamp(
      screenY,
      reservedTop + bounds.height * 0.5,
      window.innerHeight - bounds.height * 0.5 - 8,
    )
    label.style.left = `${labelX}px`
    label.style.top = `${labelY}px`
    label.style.visibility = 'visible'
  }

  for (const [bodyId, label] of options.overlayUi.bodyLabels.entries()) {
    if (!options.bodies.some((body) => body.id === bodyId)) {
      label.style.display = 'none'
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
