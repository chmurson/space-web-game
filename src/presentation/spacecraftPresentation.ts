import * as THREE from 'three'

import type { PointerCameraInput } from '../input/pointerCameraInput'
import { renderPosition } from '../render/sceneUpdates'
import type {
  GameSceneRefs,
  SpacecraftTrailPoint,
} from '../scene/createGameScene'
import type { Spacecraft } from '../simulation/types'
import type { Vec2 } from '../simulation/vector'
import type { OverlayUiRefs } from '../ui/overlayUI/createOverlayUi'

const trailPointDistanceThreshold = 4
const maxTrailPoints = 450
const trailLifetimeSeconds = 24 * 60 * 60
const trailOldestColor = new THREE.Color('#0b1220')
const trailNewestColor = new THREE.Color('#7c8fa8')
const headingTargetArcRadiusPx = 44
const normalizeAngleDelta = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))
const unwrapAngle = (angle: number, previousAngle: number | null) =>
  previousAngle === null
    ? angle
    : previousAngle + normalizeAngleDelta(angle - previousAngle)

const syncSpacecraftTrailGeometry = (
  gameScene: GameSceneRefs,
  trailPoints: SpacecraftTrailPoint[],
) => {
  const trailGeometry = new THREE.BufferGeometry().setFromPoints(
    trailPoints.map((point) => point.position),
  )
  const trailColors: number[] = []

  for (let index = 0; index < trailPoints.length; index += 1) {
    const blend = index / Math.max(trailPoints.length - 1, 1)
    const color = trailOldestColor.clone().lerp(trailNewestColor, blend)
    trailColors.push(color.r, color.g, color.b)
  }

  trailGeometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(trailColors, 3),
  )
  gameScene.trail.geometry.dispose()
  gameScene.trail.geometry = trailGeometry
  gameScene.trail.computeLineDistances()
}

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
  elapsed: number
  gameScene: GameSceneRefs
  isThrusting: boolean
  spacecraft: Spacecraft
}) => {
  options.gameScene.engineGlow.material.opacity = options.isThrusting ? 0.8 : 0

  const minElapsed = options.elapsed - trailLifetimeSeconds
  const originalTrailPointCount = options.gameScene.trailPoints.length
  options.gameScene.trailPoints = options.gameScene.trailPoints.filter(
    (point) => point.elapsed >= minElapsed,
  )

  const trailPosition = renderPosition(
    options.spacecraft.position.x,
    options.spacecraft.position.y,
    0.35,
  )
  const lastPoint = options.gameScene.trailPoints.at(-1)?.position
  let trailChanged =
    options.gameScene.trailPoints.length !== originalTrailPointCount

  if (
    !lastPoint ||
    lastPoint.distanceToSquared(trailPosition) > trailPointDistanceThreshold
  ) {
    options.gameScene.trailPoints.push({
      elapsed: options.elapsed,
      position: trailPosition,
    })
    if (options.gameScene.trailPoints.length > maxTrailPoints) {
      options.gameScene.trailPoints.shift()
    }
    trailChanged = true
  }

  if (trailChanged) {
    syncSpacecraftTrailGeometry(
      options.gameScene,
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
  targetHeading: number | null
  targetHeadingScreenPosition: { x: number; y: number } | null
  targetHeadingWorldPosition: Vec2 | null
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
    options.overlayUi.headingTargetOverlay.style.display = 'none'
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

  if (
    options.targetHeading !== null &&
    (options.targetHeadingWorldPosition || options.targetHeadingScreenPosition)
  ) {
    const targetForward = {
      x: Math.cos(options.targetHeading),
      y: Math.sin(options.targetHeading),
    }
    const targetForwardPosition = renderPosition(
      options.spacecraft.position.x + targetForward.x * 1_000_000,
      options.spacecraft.position.y + targetForward.y * 1_000_000,
      1.2,
    )
    targetForwardPosition.project(options.gameScene.camera)
    const targetHeadingAngle = Math.atan2(
      (-targetForwardPosition.y * 0.5 + 0.5) * window.innerHeight - screenY,
      (targetForwardPosition.x * 0.5 + 0.5) * window.innerWidth - screenX,
    )
    const remainingDelta = normalizeAngleDelta(
      targetHeadingAngle - headingAngle,
    )
    const arcEndAngle = headingAngle + remainingDelta
    const largeArcFlag = Math.abs(remainingDelta) > Math.PI ? 1 : 0
    const sweepFlag = remainingDelta >= 0 ? 1 : 0
    const startX = screenX + Math.cos(headingAngle) * headingTargetArcRadiusPx
    const startY = screenY + Math.sin(headingAngle) * headingTargetArcRadiusPx
    const endX = screenX + Math.cos(arcEndAngle) * headingTargetArcRadiusPx
    const endY = screenY + Math.sin(arcEndAngle) * headingTargetArcRadiusPx
    const targetHeadingScreenPosition = options.targetHeadingWorldPosition
      ? (() => {
          const targetPosition = renderPosition(
            options.targetHeadingWorldPosition.x,
            options.targetHeadingWorldPosition.y,
            1.2,
          )
          targetPosition.project(options.gameScene.camera)
          return {
            x: (targetPosition.x * 0.5 + 0.5) * window.innerWidth,
            y: (-targetPosition.y * 0.5 + 0.5) * window.innerHeight,
          }
        })()
      : options.targetHeadingScreenPosition

    options.overlayUi.headingTargetOverlay.style.display = 'block'
    options.overlayUi.headingTargetOverlay.setAttribute(
      'viewBox',
      `0 0 ${window.innerWidth} ${window.innerHeight}`,
    )
    options.overlayUi.headingTargetLine.setAttribute('x1', `${screenX}`)
    options.overlayUi.headingTargetLine.setAttribute('y1', `${screenY}`)
    options.overlayUi.headingTargetLine.setAttribute(
      'x2',
      `${targetHeadingScreenPosition?.x ?? screenX}`,
    )
    options.overlayUi.headingTargetLine.setAttribute(
      'y2',
      `${targetHeadingScreenPosition?.y ?? screenY}`,
    )
    options.overlayUi.headingTargetArc.setAttribute(
      'd',
      `M ${startX} ${startY} A ${headingTargetArcRadiusPx} ${headingTargetArcRadiusPx} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY}`,
    )
  } else {
    options.overlayUi.headingTargetOverlay.style.display = 'none'
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
      elapsed: number
      isThrusting: boolean
      spacecraft: Spacecraft
      spacecraftLabelIntroUntil: number
      targetHeading: number | null
      targetHeadingScreenPosition: { x: number; y: number } | null
      targetHeadingWorldPosition: Vec2 | null
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
        elapsed: state.elapsed,
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
        targetHeading: state.targetHeading,
        targetHeadingScreenPosition: state.targetHeadingScreenPosition,
        targetHeadingWorldPosition: state.targetHeadingWorldPosition,
        viewportSize: state.viewportSize,
      })
    },
  }
}

export type SpacecraftPresentation = ReturnType<
  typeof createSpacecraftPresentation
>
