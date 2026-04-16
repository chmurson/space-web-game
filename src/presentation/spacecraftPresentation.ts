import * as THREE from 'three'

import type { PointerCameraInput } from '../input/pointerCameraInput'
import { renderPosition } from '../render/sceneUpdates'
import type { GameSceneRefs } from '../scene/createGameScene'
import type { Spacecraft } from '../simulation/types'
import type { OverlayUiRefs } from '../ui/overlayUI/createOverlayUi'

const trailPointDistanceThreshold = 4
const maxTrailPoints = 450
const normalizeAngleDelta = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))
const unwrapAngle = (angle: number, previousAngle: number | null) =>
  previousAngle === null
    ? angle
    : previousAngle + normalizeAngleDelta(angle - previousAngle)

const updateSpacecraftWorldVisuals = (options: {
  displayRotationY: number
  defaultViewport: number
  gameScene: GameSceneRefs
  spacecraft: Spacecraft
  spacecraftModelZoomThreshold: number
  viewportSize: number
}) => {
  const useSymbolicShip =
    options.viewportSize >
    options.defaultViewport / options.spacecraftModelZoomThreshold

  options.gameScene.spacecraftMesh.position.copy(
    renderPosition(
      options.spacecraft.position.x,
      options.spacecraft.position.y,
      1.2,
    ),
  )
  options.gameScene.spacecraftMesh.rotation.y = options.displayRotationY
  options.gameScene.spacecraftMesh.visible = !useSymbolicShip
  options.gameScene.spacecraftMarker.position.copy(
    renderPosition(
      options.spacecraft.position.x,
      options.spacecraft.position.y,
      1.1,
    ),
  )
  options.gameScene.spacecraftMarker.scale.setScalar(
    Math.max(1, options.viewportSize / 520),
  )
  options.gameScene.spacecraftMarker.visible = !useSymbolicShip
}

const updateSpacecraftTrail = (options: {
  gameScene: GameSceneRefs
  isThrusting: boolean
  spacecraft: Spacecraft
}) => {
  options.gameScene.engineGlow.material.opacity = options.isThrusting ? 0.8 : 0

  const trailPosition = renderPosition(
    options.spacecraft.position.x,
    options.spacecraft.position.y,
    0.35,
  )
  const lastPoint = options.gameScene.trailPoints.at(-1)
  if (
    !lastPoint ||
    lastPoint.distanceToSquared(trailPosition) > trailPointDistanceThreshold
  ) {
    options.gameScene.trailPoints.push(trailPosition)
    if (options.gameScene.trailPoints.length > maxTrailPoints) {
      options.gameScene.trailPoints.shift()
    }
    options.gameScene.trail.geometry.dispose()
    options.gameScene.trail.geometry = new THREE.BufferGeometry().setFromPoints(
      options.gameScene.trailPoints,
    )
  }
}

const updateSpacecraftCallout = (options: {
  defaultViewport: number
  displayHeadingAngle: number | null
  gameScene: GameSceneRefs
  isThrusting: boolean
  overlayUi: OverlayUiRefs
  pointerCameraInput: PointerCameraInput
  spacecraft: Spacecraft
  spacecraftLabelIntroUntil: number
  spacecraftModelZoomThreshold: number
  viewportSize: number
}) => {
  const position = renderPosition(
    options.spacecraft.position.x,
    options.spacecraft.position.y,
    1.2,
  )
  position.project(options.gameScene.camera)

  const screenX = (position.x * 0.5 + 0.5) * window.innerWidth
  const screenY = (-position.y * 0.5 + 0.5) * window.innerHeight
  const isVisible = position.z > -1 && position.z < 1
  const useSymbolicShip =
    options.viewportSize >
    options.defaultViewport / options.spacecraftModelZoomThreshold
  const showLabel =
    performance.now() < options.spacecraftLabelIntroUntil ||
    Math.hypot(
      options.pointerCameraInput.pointerScreenPosition.x - screenX,
      options.pointerCameraInput.pointerScreenPosition.y - screenY,
    ) < 28

  options.overlayUi.spacecraftCallout.style.setProperty(
    '--dot-opacity',
    useSymbolicShip ? '1' : '0',
  )

  if (!isVisible) {
    options.overlayUi.spacecraftCallout.style.display = 'none'
    options.overlayUi.spacecraftIconThrust.style.display = 'none'
    return options.displayHeadingAngle
  }

  options.overlayUi.spacecraftCallout.style.display =
    useSymbolicShip || showLabel ? 'flex' : 'none'
  options.overlayUi.spacecraftCallout.style.left = `${screenX}px`
  options.overlayUi.spacecraftCallout.style.top = `${screenY}px`
  if (options.overlayUi.spacecraftCalloutLabel) {
    options.overlayUi.spacecraftCalloutLabel.style.display = showLabel
      ? 'inline-block'
      : 'none'
  }

  const forward = {
    x: Math.cos(options.spacecraft.heading),
    y: Math.sin(options.spacecraft.heading),
  }
  const forwardPosition = renderPosition(
    options.spacecraft.position.x + forward.x * 1_000_000,
    options.spacecraft.position.y + forward.y * 1_000_000,
    1.2,
  )
  forwardPosition.project(options.gameScene.camera)
  const forwardX = (forwardPosition.x * 0.5 + 0.5) * window.innerWidth
  const forwardY = (-forwardPosition.y * 0.5 + 0.5) * window.innerHeight
  const headingAngle = unwrapAngle(
    Math.atan2(forwardY - screenY, forwardX - screenX),
    options.displayHeadingAngle,
  )

  options.overlayUi.spacecraftCallout.style.setProperty(
    '--ship-heading',
    `${headingAngle}rad`,
  )

  const iconThrustVisible =
    options.viewportSize >
      options.defaultViewport / options.spacecraftModelZoomThreshold &&
    options.isThrusting
  options.overlayUi.spacecraftIconThrust.style.display = iconThrustVisible
    ? 'block'
    : 'none'
  if (iconThrustVisible) {
    const backOffset = 8
    options.overlayUi.spacecraftIconThrust.style.left = `${screenX - Math.cos(headingAngle) * backOffset}px`
    options.overlayUi.spacecraftIconThrust.style.top = `${screenY - Math.sin(headingAngle) * backOffset}px`
    options.overlayUi.spacecraftIconThrust.style.transform = `translate(-50%, -50%) rotate(${headingAngle}rad)`
  }

  return headingAngle
}

export const createSpacecraftPresentation = (options: {
  defaultViewport: number
  gameScene: GameSceneRefs
  overlayUi: OverlayUiRefs
  pointerCameraInput: PointerCameraInput
  spacecraftModelZoomThreshold: number
}) => {
  let lastMeshRotationY: number | null = null
  let lastHeadingAngle: number | null = null

  return {
    updateVisuals: (state: {
      isThrusting: boolean
      spacecraft: Spacecraft
      spacecraftLabelIntroUntil: number
      viewportSize: number
    }) => {
      const rawMeshRotationY = -state.spacecraft.heading + Math.PI / 2
      const displayRotationY = unwrapAngle(rawMeshRotationY, lastMeshRotationY)
      lastMeshRotationY = displayRotationY

      updateSpacecraftWorldVisuals({
        displayRotationY,
        defaultViewport: options.defaultViewport,
        gameScene: options.gameScene,
        spacecraft: state.spacecraft,
        spacecraftModelZoomThreshold: options.spacecraftModelZoomThreshold,
        viewportSize: state.viewportSize,
      })
      updateSpacecraftTrail({
        gameScene: options.gameScene,
        isThrusting: state.isThrusting,
        spacecraft: state.spacecraft,
      })
      lastHeadingAngle = updateSpacecraftCallout({
        defaultViewport: options.defaultViewport,
        displayHeadingAngle: lastHeadingAngle,
        gameScene: options.gameScene,
        isThrusting: state.isThrusting,
        overlayUi: options.overlayUi,
        pointerCameraInput: options.pointerCameraInput,
        spacecraft: state.spacecraft,
        spacecraftLabelIntroUntil: state.spacecraftLabelIntroUntil,
        spacecraftModelZoomThreshold: options.spacecraftModelZoomThreshold,
        viewportSize: state.viewportSize,
      })
    },
  }
}

export type SpacecraftPresentation = ReturnType<
  typeof createSpacecraftPresentation
>
