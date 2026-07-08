import * as THREE from 'three'
import type { CameraControlMode } from '../scenario/scenarioDirectiveTypes'
import type { Vec2 } from '../simulation/vector'
import { getIntentionalSwipeThresholdPoint } from './intentionalSwipeThreshold'

export type PointerScreenPosition = {
  x: number
  y: number
}

export type TargetHeadingSelection = {
  screenPosition: PointerScreenPosition
  worldPosition: Vec2
}

export type PointerCameraInput = {
  pointerScreenPosition: PointerScreenPosition
  updateEdgeScroll(nowMs: number, dtSeconds: number): void
}

export type PointerCameraInputOptions = {
  camera: THREE.Camera
  getDesktopEdgePanSpeedPixelsPerSecond?: () => number
  getEdgeScrollEnabled?: () => boolean
  getInteractionsEnabled: () => boolean
  getCameraMode: () => CameraControlMode
  getCameraModeChangesLocked: () => boolean
  getSpacecraftVisible: () => boolean
  getSpacecraftPosition: () => Vec2
  getTargetHeadingSelectionEnabled?: () => boolean
  onCameraModeSelected: (mode: CameraControlMode) => boolean
  onCameraPan: (delta: Vec2) => boolean
  onCameraUnlockedByEdgeScroll?: () => void
  onResize: () => void
  onTargetHeadingPlan: (
    heading: number,
    selection: TargetHeadingSelection,
  ) => void
  onTargetHeadingPlanCanceled: () => void
  onTargetHeadingPlanCommitted: () => boolean
  onZoom: (zoomFactor: number) => void
  renderScale: number
  rendererElement: HTMLCanvasElement
  windowTarget: Window
}

const wheelZoomSensitivity = 0.0015
const minWheelZoomFactor = 0.75
const maxWheelZoomFactor = 1.35
const wheelLineModePixels = 16
const cameraPanTapTolerancePx = 8
const defaultDesktopEdgePanSpeedPixelsPerSecond = 420
const edgeScrollBandPx = 44
const edgeUnlockDwellMs = 3_000
const intentionalSwipeViewportRatio = 0.5

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const getWheelModeScale = (deltaMode: number, viewportHeight: number) => {
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return wheelLineModePixels
  }

  if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return viewportHeight
  }

  return 1
}

const getEdgeAxis = (position: number, min: number, max: number) => {
  const distanceFromStart = position - min
  const distanceFromEnd = max - position

  if (distanceFromStart <= edgeScrollBandPx) {
    return -clamp(
      (edgeScrollBandPx - distanceFromStart) / edgeScrollBandPx,
      0,
      1,
    )
  }

  if (distanceFromEnd <= edgeScrollBandPx) {
    return clamp((edgeScrollBandPx - distanceFromEnd) / edgeScrollBandPx, 0, 1)
  }

  return 0
}

const normalizeEdgeVector = (vector: Vec2): Vec2 | null => {
  const length = Math.hypot(vector.x, vector.y)

  if (length <= 0) {
    return null
  }

  if (length <= 1) {
    return vector
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  }
}

export const getWheelZoomFactor = (
  event: Pick<WheelEvent, 'deltaMode' | 'deltaY'>,
  viewportHeight: number,
) => {
  const normalizedDelta =
    event.deltaY * getWheelModeScale(event.deltaMode, viewportHeight)
  return clamp(
    Math.exp(normalizedDelta * wheelZoomSensitivity),
    minWheelZoomFactor,
    maxWheelZoomFactor,
  )
}

export const createScreenPointWorldPicker = (
  camera: THREE.Camera,
  rendererElement: HTMLCanvasElement,
  renderScale: number,
) => {
  const raycaster = new THREE.Raycaster()
  const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const pointerNdc = new THREE.Vector2()
  const pointerWorld = new THREE.Vector3()

  return (clientX: number, clientY: number): Vec2 | null => {
    const bounds = rendererElement.getBoundingClientRect()
    pointerNdc.x = ((clientX - bounds.left) / bounds.width) * 2 - 1
    pointerNdc.y = -(((clientY - bounds.top) / bounds.height) * 2 - 1)

    raycaster.setFromCamera(pointerNdc, camera)
    const intersection = raycaster.ray.intersectPlane(
      pointerPlane,
      pointerWorld,
    )

    if (!intersection) {
      return null
    }

    return {
      x: pointerWorld.x / renderScale,
      y: pointerWorld.z / renderScale,
    }
  }
}

export const createScreenPointHeadingPicker = (
  camera: THREE.Camera,
  rendererElement: HTMLCanvasElement,
  renderScale: number,
) => {
  const pickWorldPoint = createScreenPointWorldPicker(
    camera,
    rendererElement,
    renderScale,
  )

  return (
    clientX: number,
    clientY: number,
    spacecraftPosition: Vec2,
  ): number | null => {
    const target = pickWorldPoint(clientX, clientY)

    if (!target) {
      return null
    }

    return Math.atan2(
      target.y - spacecraftPosition.y,
      target.x - spacecraftPosition.x,
    )
  }
}

export const bindPointerCameraInput = (
  options: PointerCameraInputOptions,
): PointerCameraInput => {
  const pointerScreenPosition: PointerScreenPosition = { x: 0, y: 0 }
  const pickWorldPointFromScreenPoint = createScreenPointWorldPicker(
    options.camera,
    options.rendererElement,
    options.renderScale,
  )
  const getTargetHeadingSelectionEnabled = () =>
    options.getSpacecraftVisible() &&
    (options.getTargetHeadingSelectionEnabled?.() ??
      options.getInteractionsEnabled())
  let targetHeadingPlanActive = false
  let suppressNextContextMenu = false
  let pointerInsideRenderer = false
  let edgeDwellStartedAtMs: number | null = null
  let edgeDwellDirectionKey = ''
  let activeCameraPan: {
    hasMovedForTap: boolean
    hasPanned: boolean
    pointerId: number
    previousX: number
    previousY: number
    startX: number
    startY: number
  } | null = null

  options.windowTarget.addEventListener('resize', () => {
    options.onResize()
  })

  const updatePointerPosition = (clientX: number, clientY: number) => {
    pointerScreenPosition.x = clientX
    pointerScreenPosition.y = clientY
  }

  const clearEdgeDwell = () => {
    edgeDwellStartedAtMs = null
    edgeDwellDirectionKey = ''
  }

  const getEdgeScrollDirection = (): Vec2 | null => {
    const bounds = options.rendererElement.getBoundingClientRect()

    if (
      bounds.width <= 0 ||
      bounds.height <= 0 ||
      pointerScreenPosition.x < bounds.left ||
      pointerScreenPosition.x > bounds.right ||
      pointerScreenPosition.y < bounds.top ||
      pointerScreenPosition.y > bounds.bottom
    ) {
      return null
    }

    return normalizeEdgeVector({
      x: getEdgeAxis(pointerScreenPosition.x, bounds.left, bounds.right),
      y: getEdgeAxis(pointerScreenPosition.y, bounds.top, bounds.bottom),
    })
  }

  const panCameraBetweenScreenPoints = (
    previousX: number,
    previousY: number,
    nextX: number,
    nextY: number,
  ) => {
    const previousWorld = pickWorldPointFromScreenPoint(previousX, previousY)
    const nextWorld = pickWorldPointFromScreenPoint(nextX, nextY)

    if (!previousWorld || !nextWorld) {
      return false
    }

    return options.onCameraPan({
      x: previousWorld.x - nextWorld.x,
      y: previousWorld.y - nextWorld.y,
    })
  }

  const panCameraAlongEdge = (direction: Vec2, dtSeconds: number) => {
    const bounds = options.rendererElement.getBoundingClientRect()
    const centerX = bounds.left + bounds.width * 0.5
    const centerY = bounds.top + bounds.height * 0.5
    const speed =
      options.getDesktopEdgePanSpeedPixelsPerSecond?.() ??
      defaultDesktopEdgePanSpeedPixelsPerSecond
    const pixelDelta = speed * dtSeconds

    if (pixelDelta <= 0) {
      return false
    }

    return panCameraBetweenScreenPoints(
      centerX,
      centerY,
      centerX - direction.x * pixelDelta,
      centerY - direction.y * pixelDelta,
    )
  }

  const updateEdgeScroll = (nowMs: number, dtSeconds: number) => {
    if (
      !pointerInsideRenderer ||
      activeCameraPan !== null ||
      targetHeadingPlanActive ||
      !options.getInteractionsEnabled() ||
      !(options.getEdgeScrollEnabled?.() ?? false)
    ) {
      clearEdgeDwell()
      return
    }

    const direction = getEdgeScrollDirection()

    if (!direction) {
      clearEdgeDwell()
      return
    }

    if (options.getCameraMode() !== 'unlocked') {
      if (options.getCameraModeChangesLocked()) {
        clearEdgeDwell()
        return
      }

      const directionKey = `${Math.sign(direction.x)},${Math.sign(direction.y)}`
      if (
        edgeDwellStartedAtMs === null ||
        edgeDwellDirectionKey !== directionKey
      ) {
        edgeDwellStartedAtMs = nowMs
        edgeDwellDirectionKey = directionKey
        return
      }

      if (nowMs - edgeDwellStartedAtMs < edgeUnlockDwellMs) {
        return
      }

      if (!options.onCameraModeSelected('unlocked')) {
        clearEdgeDwell()
        return
      }
      options.onCameraUnlockedByEdgeScroll?.()
    }

    clearEdgeDwell()
    panCameraAlongEdge(direction, dtSeconds)
  }

  options.windowTarget.addEventListener('mousemove', (event) => {
    updatePointerPosition(event.clientX, event.clientY)
  })

  options.windowTarget.addEventListener('pointermove', (event) => {
    updatePointerPosition(event.clientX, event.clientY)
  })

  const pickTargetHeadingSelection = (
    clientX: number,
    clientY: number,
  ): { heading: number; selection: TargetHeadingSelection } | null => {
    const worldPosition = pickWorldPointFromScreenPoint(clientX, clientY)

    if (worldPosition === null) {
      return null
    }
    const spacecraftPosition = options.getSpacecraftPosition()
    const heading = Math.atan2(
      worldPosition.y - spacecraftPosition.y,
      worldPosition.x - spacecraftPosition.x,
    )

    return {
      heading,
      selection: {
        screenPosition: {
          x: clientX,
          y: clientY,
        },
        worldPosition,
      },
    }
  }

  const updateTargetHeadingPlan = (clientX: number, clientY: number) => {
    const target = pickTargetHeadingSelection(clientX, clientY)
    if (!target) {
      return false
    }
    options.onTargetHeadingPlan(target.heading, target.selection)
    return true
  }

  const beginTargetHeadingPlan = (clientX: number, clientY: number) => {
    if (!getTargetHeadingSelectionEnabled()) {
      return false
    }

    targetHeadingPlanActive = updateTargetHeadingPlan(clientX, clientY)
    return targetHeadingPlanActive
  }

  const cancelTargetHeadingPlan = () => {
    if (!targetHeadingPlanActive) {
      return
    }
    targetHeadingPlanActive = false
    options.onTargetHeadingPlanCanceled()
  }

  const commitTargetHeadingPlan = () => {
    if (!targetHeadingPlanActive) {
      return false
    }

    targetHeadingPlanActive = false
    if (!getTargetHeadingSelectionEnabled()) {
      options.onTargetHeadingPlanCanceled()
      return false
    }

    return options.onTargetHeadingPlanCommitted()
  }

  const clearActiveCameraPan = (event: PointerEvent) => {
    if (activeCameraPan?.pointerId !== event.pointerId) {
      return
    }

    activeCameraPan = null

    try {
      options.rendererElement.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture may already be released by the browser.
    }
  }

  options.rendererElement.addEventListener('pointerdown', (event) => {
    pointerInsideRenderer = true
    updatePointerPosition(event.clientX, event.clientY)

    if (!options.getInteractionsEnabled()) {
      cancelTargetHeadingPlan()
      return
    }

    if (
      !event.isPrimary ||
      (event.pointerType === 'mouse' &&
        event.button !== 0 &&
        event.button !== 2)
    ) {
      return
    }

    if (event.pointerType === 'mouse' && event.button === 2) {
      if (targetHeadingPlanActive) {
        event.preventDefault()
        suppressNextContextMenu = true
        cancelTargetHeadingPlan()
      }
      return
    }

    activeCameraPan = {
      hasMovedForTap: false,
      hasPanned: false,
      pointerId: event.pointerId,
      previousX: event.clientX,
      previousY: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
    }

    try {
      options.rendererElement.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is best effort; camera pan still works without it.
    }
  })

  options.rendererElement.addEventListener('pointermove', (event) => {
    pointerInsideRenderer = true
    updatePointerPosition(event.clientX, event.clientY)

    if (targetHeadingPlanActive) {
      if (!getTargetHeadingSelectionEnabled()) {
        cancelTargetHeadingPlan()
        return
      }

      if (activeCameraPan?.pointerId === event.pointerId) {
        const totalDeltaX = event.clientX - activeCameraPan.startX
        const totalDeltaY = event.clientY - activeCameraPan.startY
        if (Math.hypot(totalDeltaX, totalDeltaY) >= cameraPanTapTolerancePx) {
          activeCameraPan.hasMovedForTap = true
        }
      }

      event.preventDefault()
      updateTargetHeadingPlan(event.clientX, event.clientY)
      return
    }

    if (activeCameraPan?.pointerId !== event.pointerId) {
      return
    }
    if (!options.getInteractionsEnabled()) {
      clearActiveCameraPan(event)
      return
    }

    const totalDeltaX = event.clientX - activeCameraPan.startX
    const totalDeltaY = event.clientY - activeCameraPan.startY
    const previousDeltaX = event.clientX - activeCameraPan.previousX
    const previousDeltaY = event.clientY - activeCameraPan.previousY
    const previousDistance = Math.hypot(previousDeltaX, previousDeltaY)
    if (Math.hypot(totalDeltaX, totalDeltaY) >= cameraPanTapTolerancePx) {
      activeCameraPan.hasMovedForTap = true
    }

    if (event.pointerType === 'mouse') {
      return
    }

    if (options.getCameraMode() !== 'unlocked') {
      const unlockThresholdX =
        options.windowTarget.innerWidth * intentionalSwipeViewportRatio
      const unlockThresholdY =
        options.windowTarget.innerHeight * intentionalSwipeViewportRatio
      const shouldUnlock =
        !options.getCameraModeChangesLocked() &&
        (Math.abs(totalDeltaX) >= unlockThresholdX ||
          Math.abs(totalDeltaY) >= unlockThresholdY)

      if (!shouldUnlock) {
        return
      }

      const thresholdPoint = getIntentionalSwipeThresholdPoint({
        currentX: event.clientX,
        currentY: event.clientY,
        startX: activeCameraPan.startX,
        startY: activeCameraPan.startY,
        thresholdX: unlockThresholdX,
        thresholdY: unlockThresholdY,
      })

      event.preventDefault()
      if (thresholdPoint && options.onCameraModeSelected('unlocked')) {
        activeCameraPan.hasPanned =
          panCameraBetweenScreenPoints(
            thresholdPoint.x,
            thresholdPoint.y,
            event.clientX,
            event.clientY,
          ) || activeCameraPan.hasPanned
      }
      activeCameraPan.previousX = event.clientX
      activeCameraPan.previousY = event.clientY
      return
    }

    if (previousDistance <= 0) {
      return
    }

    event.preventDefault()
    activeCameraPan.hasPanned =
      panCameraBetweenScreenPoints(
        activeCameraPan.previousX,
        activeCameraPan.previousY,
        event.clientX,
        event.clientY,
      ) || activeCameraPan.hasPanned
    activeCameraPan.previousX = event.clientX
    activeCameraPan.previousY = event.clientY
  })

  options.rendererElement.addEventListener('pointerup', (event) => {
    updatePointerPosition(event.clientX, event.clientY)

    if (activeCameraPan?.pointerId === event.pointerId) {
      const completedPan =
        activeCameraPan.hasMovedForTap || activeCameraPan.hasPanned
      clearActiveCameraPan(event)
      if (
        !completedPan &&
        event.isPrimary &&
        (event.pointerType !== 'mouse' || event.button === 0)
      ) {
        if (!getTargetHeadingSelectionEnabled()) {
          cancelTargetHeadingPlan()
          return
        }

        event.preventDefault()
        if (targetHeadingPlanActive) {
          commitTargetHeadingPlan()
        } else {
          beginTargetHeadingPlan(event.clientX, event.clientY)
        }
      }
      return
    }
  })
  options.rendererElement.addEventListener('pointercancel', (event) => {
    clearActiveCameraPan(event)
  })

  options.rendererElement.addEventListener('pointerenter', () => {
    pointerInsideRenderer = true
  })

  options.rendererElement.addEventListener('pointerleave', () => {
    pointerInsideRenderer = false
    clearEdgeDwell()
  })

  options.rendererElement.addEventListener('contextmenu', (event) => {
    if (!suppressNextContextMenu) {
      return
    }
    suppressNextContextMenu = false
    event.preventDefault()
  })

  options.windowTarget.addEventListener(
    'wheel',
    (event) => {
      if (!options.getInteractionsEnabled()) {
        return
      }

      event.preventDefault()
      options.onZoom(
        getWheelZoomFactor(event, options.windowTarget.innerHeight),
      )
    },
    { passive: false },
  )

  return { pointerScreenPosition, updateEdgeScroll }
}
