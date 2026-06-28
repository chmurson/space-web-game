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
const headingTargetSliceInnerRadiusPx = 20
const headingTargetSliceOuterRadiusPx = 52
const headingTargetSliceArcSegmentRadians = Math.PI / 20
const normalizeAngleDelta = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))
const unwrapAngle = (angle: number, previousAngle: number | null) =>
  previousAngle === null
    ? angle
    : previousAngle + normalizeAngleDelta(angle - previousAngle)
const projectRenderPositionToScreen = (
  position: THREE.Vector3,
  camera: THREE.Camera,
) => {
  const projected = position.clone().project(camera)
  return {
    x: (projected.x * 0.5 + 0.5) * window.innerWidth,
    y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
  }
}
const getHeadingTargetPlanePoint = (options: {
  camera: THREE.Camera
  center: Vec2
  lift: number
  planeAngle: number
  radiusPx: number
  viewportSize: number
}) => {
  const renderUnitsPerPixel =
    options.viewportSize / Math.max(window.innerHeight, 1)
  const radius = options.radiusPx * renderUnitsPerPixel
  const position = renderPosition(
    options.center.x,
    options.center.y,
    options.lift,
  )
  position.x += Math.cos(options.planeAngle) * radius
  position.z += Math.sin(options.planeAngle) * radius
  return projectRenderPositionToScreen(position, options.camera)
}
const getHeadingTargetSlicePath = (options: {
  camera: THREE.Camera
  center: Vec2
  deltaAngle: number
  lift: number
  startAngle: number
  viewportSize: number
}) => {
  const segmentCount = Math.max(
    1,
    Math.ceil(
      Math.abs(options.deltaAngle) / headingTargetSliceArcSegmentRadians,
    ),
  )
  const points: { x: number; y: number }[] = []

  for (let index = 0; index <= segmentCount; index += 1) {
    const progress = index / segmentCount
    points.push(
      getHeadingTargetPlanePoint({
        ...options,
        planeAngle: options.startAngle + options.deltaAngle * progress,
        radiusPx: headingTargetSliceOuterRadiusPx,
      }),
    )
  }

  for (let index = segmentCount; index >= 0; index -= 1) {
    const progress = index / segmentCount
    points.push(
      getHeadingTargetPlanePoint({
        ...options,
        planeAngle: options.startAngle + options.deltaAngle * progress,
        radiusPx: headingTargetSliceInnerRadiusPx,
      }),
    )
  }

  return [
    ...points.map(
      (point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`,
    ),
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
    const remainingPlaneDelta = normalizeAngleDelta(
      options.targetHeading - options.spacecraft.heading,
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
      getHeadingTargetSlicePath({
        camera: options.gameScene.camera,
        center: options.spacecraft.position,
        deltaAngle: remainingPlaneDelta,
        lift: 1.2,
        startAngle: options.spacecraft.heading,
        viewportSize: options.viewportSize,
      }),
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
