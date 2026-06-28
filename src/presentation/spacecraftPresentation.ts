import * as THREE from 'three'

import type { PointerCameraInput } from '../input/pointerCameraInput'
import { renderPosition } from '../render/sceneUpdates'
import type {
  GameSceneRefs,
  SpacecraftTrailPoint,
} from '../scene/createGameScene'
import type { Body, Spacecraft } from '../simulation/types'
import type { Vec2 } from '../simulation/vector'
import type { OverlayUiRefs } from '../ui/overlayUI/createOverlayUi'
import {
  getSpacecraftTrailDetail,
  getSpacecraftTrailRenderPosition,
  selectSpacecraftTrailRenderPoints,
  updateSpacecraftTrailPoints,
} from './spacecraftTrail'

const trailOldestColor = new THREE.Color('#0b1220')
const trailNewestColor = new THREE.Color('#7c8fa8')
const flightPlaneCueViewportScale = 0.055
const headingTargetSliceInnerRadiusPx = 20
const headingTargetSliceOuterRadiusPx = 52
const normalizeAngleDelta = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))
const unwrapAngle = (angle: number, previousAngle: number | null) =>
  previousAngle === null
    ? angle
    : previousAngle + normalizeAngleDelta(angle - previousAngle)
const getScreenCirclePoint = (
  centerX: number,
  centerY: number,
  angle: number,
  radius: number,
) => ({
  x: centerX + Math.cos(angle) * radius,
  y: centerY + Math.sin(angle) * radius,
})
const getHeadingTargetSlicePath = (
  centerX: number,
  centerY: number,
  startAngle: number,
  deltaAngle: number,
) => {
  const endAngle = startAngle + deltaAngle
  const largeArcFlag = Math.abs(deltaAngle) > Math.PI ? 1 : 0
  const sweepFlag = deltaAngle >= 0 ? 1 : 0
  const innerSweepFlag = sweepFlag === 1 ? 0 : 1
  const outerStart = getScreenCirclePoint(
    centerX,
    centerY,
    startAngle,
    headingTargetSliceOuterRadiusPx,
  )
  const outerEnd = getScreenCirclePoint(
    centerX,
    centerY,
    endAngle,
    headingTargetSliceOuterRadiusPx,
  )
  const innerEnd = getScreenCirclePoint(
    centerX,
    centerY,
    endAngle,
    headingTargetSliceInnerRadiusPx,
  )
  const innerStart = getScreenCirclePoint(
    centerX,
    centerY,
    startAngle,
    headingTargetSliceInnerRadiusPx,
  )

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${headingTargetSliceOuterRadiusPx} ${headingTargetSliceOuterRadiusPx} 0 ${largeArcFlag} ${sweepFlag} ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${headingTargetSliceInnerRadiusPx} ${headingTargetSliceInnerRadiusPx} 0 ${largeArcFlag} ${innerSweepFlag} ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

const syncSpacecraftTrailGeometry = (
  gameScene: GameSceneRefs,
  trailPoints: SpacecraftTrailPoint[],
  target: Body | null,
  renderSampleDistanceMeters: number,
) => {
  const renderTrailPoints = selectSpacecraftTrailRenderPoints(trailPoints, {
    renderSampleDistanceMeters,
    target,
  })
  gameScene.trailRenderedSliceCount = Math.max(renderTrailPoints.length - 1, 0)
  const trailGeometry = new THREE.BufferGeometry().setFromPoints(
    renderTrailPoints.map((point) => {
      const trailPosition = getSpacecraftTrailRenderPosition(point, target)
      return renderPosition(trailPosition.x, trailPosition.y, 0.35)
    }),
  )
  const trailColors: number[] = []

  for (let index = 0; index < renderTrailPoints.length; index += 1) {
    const blend = index / Math.max(renderTrailPoints.length - 1, 1)
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
  options.gameScene.flightPlaneCue.position.copy(
    renderPosition(
      options.spacecraft.position.x,
      options.spacecraft.position.y,
      0.08,
    ),
  )
  options.gameScene.flightPlaneCue.scale.setScalar(
    options.viewportSize * flightPlaneCueViewportScale,
  )
  options.gameScene.flightPlaneCue.visible = true
}

const updateSpacecraftTrail = (options: {
  bodies: Body[]
  elapsed: number
  forceSync: boolean
  gameScene: GameSceneRefs
  isThrusting: boolean
  spacecraft: Spacecraft
  target: Body
  trimAroundTarget: boolean
  renderSampleDistanceMeters: number
}) => {
  options.gameScene.engineGlow.material.opacity = options.isThrusting ? 0.8 : 0
  const renderTarget = options.trimAroundTarget ? options.target : null
  const trailOrigin = renderTarget?.position ?? { x: 0, y: 0 }
  options.gameScene.trail.position.copy(
    renderPosition(trailOrigin.x, trailOrigin.y),
  )

  const trailUpdate = updateSpacecraftTrailPoints(
    options.gameScene.trailPoints,
    {
      bodies: options.bodies,
      elapsed: options.elapsed,
      spacecraftPosition: options.spacecraft.position,
      target: options.target,
      trimAroundTarget: options.trimAroundTarget,
    },
  )
  options.gameScene.trailPoints = trailUpdate.trailPoints

  if (trailUpdate.changed || options.forceSync) {
    syncSpacecraftTrailGeometry(
      options.gameScene,
      options.gameScene.trailPoints,
      renderTarget,
      options.renderSampleDistanceMeters,
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
    options.overlayUi.headingTargetDot.style.display = 'none'
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
    options.overlayUi.headingTargetDot.style.display = 'block'
    options.overlayUi.headingTargetDot.style.left = `${
      targetHeadingScreenPosition?.x ?? screenX
    }px`
    options.overlayUi.headingTargetDot.style.top = `${
      targetHeadingScreenPosition?.y ?? screenY
    }px`
    options.overlayUi.headingTargetTurnSlice.setAttribute(
      'd',
      getHeadingTargetSlicePath(screenX, screenY, headingAngle, remainingDelta),
    )
  } else {
    options.overlayUi.headingTargetDot.style.display = 'none'
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
  let lastTrailRenderTargetId: string | null = null
  let lastTrailRenderSampleDistanceMeters: number | null = null

  return {
    updateVisuals: (state: {
      bodies: Body[]
      elapsed: number
      isThrusting: boolean
      spacecraft: Spacecraft
      spacecraftLabelIntroUntil: number
      trailTarget: Body
      trimTrailAroundTarget: boolean
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
      const trailDetail = getSpacecraftTrailDetail(state.viewportSize)
      const trailRenderTargetId = state.trimTrailAroundTarget
        ? state.trailTarget.id
        : null
      const trailTargetChanged = trailRenderTargetId !== lastTrailRenderTargetId
      const trailRenderDistanceChanged =
        trailDetail.renderSampleDistanceMeters !==
        lastTrailRenderSampleDistanceMeters
      updateSpacecraftTrail({
        bodies: state.bodies,
        elapsed: state.elapsed,
        forceSync: trailTargetChanged || trailRenderDistanceChanged,
        gameScene: options.gameScene,
        isThrusting: state.isThrusting,
        renderSampleDistanceMeters: trailDetail.renderSampleDistanceMeters,
        spacecraft: state.spacecraft,
        target: state.trailTarget,
        trimAroundTarget: state.trimTrailAroundTarget,
      })
      lastTrailRenderTargetId = trailRenderTargetId
      lastTrailRenderSampleDistanceMeters =
        trailDetail.renderSampleDistanceMeters
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
