import * as THREE from 'three'

import type { CameraControlMode } from '../scenario/scenarioDirectiveTypes'
import type { Vec2 } from '../simulation/vector'

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
}

export type PointerCameraInputOptions = {
  camera: THREE.Camera
  getInteractionsEnabled: () => boolean
  getCameraMode: () => CameraControlMode
  getCameraModeChangesLocked: () => boolean
  getSpacecraftPosition: () => Vec2
  getTargetHeadingSelectionEnabled?: () => boolean
  onCameraModeSelected: (mode: CameraControlMode) => boolean
  onCameraPan: (delta: Vec2) => boolean
  onResize: () => void
  onTargetHeadingSelected: (
    heading: number,
    selection: TargetHeadingSelection,
  ) => void
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
const intentionalSwipeViewportRatio = 0.5

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const getAxisThresholdProgress = (delta: number, threshold: number) => {
  if (threshold <= 0) {
    return 0
  }

  const distance = Math.abs(delta)
  return distance >= threshold ? threshold / distance : Number.POSITIVE_INFINITY
}

const getIntentionalSwipeThresholdPoint = (options: {
  currentX: number
  currentY: number
  startX: number
  startY: number
  thresholdX: number
  thresholdY: number
}): PointerScreenPosition | null => {
  const deltaX = options.currentX - options.startX
  const deltaY = options.currentY - options.startY
  const crossX = getAxisThresholdProgress(deltaX, options.thresholdX)
  const crossY = getAxisThresholdProgress(deltaY, options.thresholdY)
  const thresholdProgress = Math.min(crossX, crossY)

  if (!Number.isFinite(thresholdProgress)) {
    return null
  }

  return {
    x: options.startX + deltaX * thresholdProgress,
    y: options.startY + deltaY * thresholdProgress,
  }
}

const getWheelModeScale = (deltaMode: number, viewportHeight: number) => {
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return wheelLineModePixels
  }

  if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return viewportHeight
  }

  return 1
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
    options.getTargetHeadingSelectionEnabled?.() ??
    options.getInteractionsEnabled()
  let lastTouchTap: {
    time: number
    x: number
    y: number
  } | null = null
  let suppressTouchTapUntil = 0
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

  options.windowTarget.addEventListener('mousemove', (event) => {
    updatePointerPosition(event.clientX, event.clientY)
  })

  options.windowTarget.addEventListener('pointermove', (event) => {
    updatePointerPosition(event.clientX, event.clientY)
  })

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

  const clearActiveCameraPan = (event: PointerEvent) => {
    if (activeCameraPan?.pointerId !== event.pointerId) {
      return
    }

    if (activeCameraPan.hasMovedForTap || activeCameraPan.hasPanned) {
      suppressTouchTapUntil = performance.now() + 360
      lastTouchTap = null
    }
    activeCameraPan = null

    try {
      options.rendererElement.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture may already be released by the browser.
    }
  }

  options.rendererElement.addEventListener('pointerdown', (event) => {
    if (
      !options.getInteractionsEnabled() ||
      !event.isPrimary ||
      (event.pointerType === 'mouse' && event.button !== 0)
    ) {
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

  options.rendererElement.addEventListener('pointerup', clearActiveCameraPan)
  options.rendererElement.addEventListener(
    'pointercancel',
    clearActiveCameraPan,
  )

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

  options.rendererElement.addEventListener('dblclick', (event) => {
    if (
      !options.getInteractionsEnabled() ||
      !getTargetHeadingSelectionEnabled()
    ) {
      return
    }

    const worldPosition = pickWorldPointFromScreenPoint(
      event.clientX,
      event.clientY,
    )

    if (worldPosition === null) {
      return
    }
    const spacecraftPosition = options.getSpacecraftPosition()
    const heading = Math.atan2(
      worldPosition.y - spacecraftPosition.y,
      worldPosition.x - spacecraftPosition.x,
    )

    options.onTargetHeadingSelected(heading, {
      screenPosition: {
        x: event.clientX,
        y: event.clientY,
      },
      worldPosition,
    })
  })

  options.rendererElement.addEventListener(
    'touchend',
    (event) => {
      if (
        !options.getInteractionsEnabled() ||
        !getTargetHeadingSelectionEnabled()
      ) {
        return
      }

      const touch = event.changedTouches[0]
      if (!touch) {
        return
      }

      updatePointerPosition(touch.clientX, touch.clientY)
      const now = performance.now()
      if (now < suppressTouchTapUntil) {
        return
      }
      const isDoubleTap =
        lastTouchTap &&
        now - lastTouchTap.time <= 320 &&
        Math.hypot(
          touch.clientX - lastTouchTap.x,
          touch.clientY - lastTouchTap.y,
        ) <= 32

      if (!isDoubleTap) {
        lastTouchTap = { time: now, x: touch.clientX, y: touch.clientY }
        return
      }

      event.preventDefault()
      lastTouchTap = null
      const worldPosition = pickWorldPointFromScreenPoint(
        touch.clientX,
        touch.clientY,
      )

      if (worldPosition === null) {
        return
      }
      const spacecraftPosition = options.getSpacecraftPosition()
      const heading = Math.atan2(
        worldPosition.y - spacecraftPosition.y,
        worldPosition.x - spacecraftPosition.x,
      )

      options.onTargetHeadingSelected(heading, {
        screenPosition: {
          x: touch.clientX,
          y: touch.clientY,
        },
        worldPosition,
      })
    },
    { passive: false },
  )

  return { pointerScreenPosition }
}
