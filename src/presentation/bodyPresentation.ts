import * as THREE from 'three'
import { renderPosition } from '../render/sceneUpdates'
import type { GameSceneRefs } from '../scene/createGameScene'
import { RENDER_SCALE } from '../simulation/constants'
import type { Body } from '../simulation/types'
import type { Vec2 } from '../simulation/vector'
import { formatDistance } from '../ui/formatters'
import type { OverlayUiRefs } from '../ui/overlayUI/createOverlayUi'
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

const updateOffscreenIndicators = (options: {
  bodies: Body[]
  gameScene: GameSceneRefs
  overlayUi: OverlayUiRefs
  spacecraftPosition: Vec2
}) => {
  const edgePadding = 28
  const screenCenterX = window.innerWidth * 0.5
  const screenCenterY = window.innerHeight * 0.5
  const mobileViewport = window.matchMedia(
    '(hover: none), (pointer: coarse)',
  ).matches
  const portraitViewport = window.innerWidth < window.innerHeight

  const telemetryStrip = document.querySelector<HTMLElement>('.telemetry-strip')
  const telemetryStripBottom =
    telemetryStrip?.getBoundingClientRect().bottom ?? 0
  const reservedTop = telemetryStripBottom + 12
  const scenarioPromptPill = document.querySelector<HTMLElement>(
    '.bottom-pill-area .scenario-prompt-pill',
  )
  const scenarioPromptPillTop =
    scenarioPromptPill?.style.display !== 'none'
      ? (scenarioPromptPill?.getBoundingClientRect().top ?? window.innerHeight)
      : window.innerHeight
  const reservedBottom =
    scenarioPromptPillTop < window.innerHeight
      ? window.innerHeight - scenarioPromptPillTop + 12
      : edgePadding

  const visibleIndicators: Array<{
    distance: number
    indicator: HTMLElement
    rect: DOMRect
  }> = []

  for (const body of options.bodies) {
    const indicator = options.overlayUi.offscreenIndicators.get(body.id)
    if (!indicator) {
      continue
    }

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

    if (isVisible) {
      indicator.style.display = 'none'
      continue
    }

    const projectedX = (position.x * 0.5 + 0.5) * window.innerWidth
    const projectedY = (-position.y * 0.5 + 0.5) * window.innerHeight
    const direction = Math.atan2(
      projectedY - screenCenterY,
      projectedX - screenCenterX,
    )
    const distance = Math.max(
      0,
      Math.hypot(
        body.position.x - options.spacecraftPosition.x,
        body.position.y - options.spacecraftPosition.y,
      ) - body.radius,
    )
    const pointer = indicator.querySelector<HTMLElement>('.pointer')
    const label = indicator.querySelector<HTMLElement>('.label')

    if (pointer) {
      pointer.style.transform = `rotate(${direction + Math.PI / 2}rad)`
    }
    if (label) {
      label.textContent = `${body.name} ${formatDistance(distance)}`
    }

    indicator.style.display = 'flex'
    indicator.style.visibility = 'hidden'
    const bounds = indicator.getBoundingClientRect()
    const edgeY = THREE.MathUtils.clamp(
      projectedY,
      bounds.height * 0.5 + Math.max(edgePadding, reservedTop),
      window.innerHeight -
        bounds.height * 0.5 -
        Math.max(edgePadding, reservedBottom),
    )
    const shouldStackIndicator =
      mobileViewport &&
      portraitViewport &&
      edgeY > window.innerHeight * 0.2 &&
      edgeY < window.innerHeight * 0.8
    indicator.classList.toggle(
      'offscreen-indicator-mobile-stack',
      shouldStackIndicator,
    )
    indicator.classList.toggle(
      'offscreen-indicator-edge-left',
      projectedX < screenCenterX,
    )
    indicator.classList.toggle(
      'offscreen-indicator-edge-right',
      projectedX >= screenCenterX,
    )
    const stackedBounds = indicator.getBoundingClientRect()
    const stackedEdgeX = THREE.MathUtils.clamp(
      projectedX,
      stackedBounds.width * 0.5 + edgePadding,
      window.innerWidth - stackedBounds.width * 0.5 - edgePadding,
    )
    const stackedEdgeY = THREE.MathUtils.clamp(
      projectedY,
      stackedBounds.height * 0.5 + Math.max(edgePadding, reservedTop),
      window.innerHeight -
        stackedBounds.height * 0.5 -
        Math.max(edgePadding, reservedBottom),
    )

    indicator.style.left = `${stackedEdgeX}px`
    indicator.style.top = `${stackedEdgeY}px`
    indicator.style.visibility = 'visible'
    visibleIndicators.push({
      distance,
      indicator,
      rect: indicator.getBoundingClientRect(),
    })
  }

  const overlapPadding = 6
  const keptRects: DOMRect[] = []
  const overlaps = (a: DOMRect, b: DOMRect) =>
    a.left < b.right + overlapPadding &&
    a.right > b.left - overlapPadding &&
    a.top < b.bottom + overlapPadding &&
    a.bottom > b.top - overlapPadding

  visibleIndicators
    .sort((left, right) => left.distance - right.distance)
    .forEach(({ indicator, rect }) => {
      const collides = keptRects.some((keptRect) => overlaps(rect, keptRect))
      indicator.style.display = collides ? 'none' : 'flex'
      if (!collides) {
        keptRects.push(rect)
      }
    })

  for (const [
    bodyId,
    indicator,
  ] of options.overlayUi.offscreenIndicators.entries()) {
    if (!options.bodies.some((body) => body.id === bodyId)) {
      indicator.style.display = 'none'
    }
  }
}

const updateBodyLabels = (options: {
  bodies: Body[]
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

    if (!isVisible || apparentRadius > labelRadiusThreshold) {
      label.style.display = 'none'
      continue
    }

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
    })
    updateBodyLabels({
      bodies: visibleBodies,
      gameScene: options.gameScene,
      overlayUi: options.overlayUi,
      viewportSize: state.viewportSize,
    })
  },
})

export type BodyPresentation = ReturnType<typeof createBodyPresentation>
