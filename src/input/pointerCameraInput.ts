import * as THREE from 'three'
import type { Vec2 } from '../simulation/vector'
import type { DesktopCameraPanMode } from '../userSettingsStorage'

export type PointerScreenPosition = {
  x: number
  y: number
}

export type PointerCameraInput = {
  pointerScreenPosition: PointerScreenPosition
  updateEdgeScroll(nowMs: number, dtSeconds: number): void
}

export type PointerCameraInputOptions = {
  camera: THREE.Camera
  getDesktopCameraInputEnabled: () => boolean
  getDesktopCameraInteractionsEnabled: () => boolean
  getDesktopCameraPanMode: () => DesktopCameraPanMode
  getDesktopEdgePanSpeedPixelsPerSecond?: () => number
  getDesktopWheelPanSpeedMultiplier?: () => number
  getInteractionsEnabled: () => boolean
  getCameraControlsLocked: () => boolean
  onCameraPan: (delta: Vec2) => boolean
  onPrimaryTap?: (clientX: number, clientY: number) => boolean
  onResize: () => void
  onZoom: (zoomFactor: number) => void
  renderScale: number
  rendererElement: HTMLCanvasElement
  windowTarget: Window
}

const wheelZoomSensitivity = 0.0015
// Chromium encodes touchpad pinch scale as a wheel delta of -100 * log(scale).
const pinchWheelZoomSensitivity = 1 / 100
const minZoomFactorPerEvent = 0.75
const maxZoomFactorPerEvent = 1.35
const wheelLineModePixels = 16
const wheelDeltaModeLine = 1
const wheelDeltaModePage = 2
const cameraPanTapTolerancePx = 8
const wheelZoomGestureIdleMs = 125
const defaultDesktopEdgePanSpeedPixelsPerSecond = 420
const edgeScrollBandPx = 44

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const getWheelModeScale = (deltaMode: number, viewportDimension: number) => {
  if (deltaMode === wheelDeltaModeLine) {
    return wheelLineModePixels
  }

  if (deltaMode === wheelDeltaModePage) {
    return viewportDimension
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

const getEdgeScrollCursor = (direction: Vec2) => {
  const x = Math.sign(direction.x)
  const y = Math.sign(direction.y)

  if (x < 0 && y < 0) {
    return 'nw-resize'
  }
  if (x > 0 && y < 0) {
    return 'ne-resize'
  }
  if (x < 0 && y > 0) {
    return 'sw-resize'
  }
  if (x > 0 && y > 0) {
    return 'se-resize'
  }
  if (x < 0) {
    return 'w-resize'
  }
  if (x > 0) {
    return 'e-resize'
  }
  if (y < 0) {
    return 'n-resize'
  }
  return 's-resize'
}

const getWheelZoomFactorWithSensitivity = (
  event: Pick<WheelEvent, 'deltaMode' | 'deltaY'>,
  viewportHeight: number,
  sensitivity: number,
) => {
  const normalizedDelta =
    event.deltaY * getWheelModeScale(event.deltaMode, viewportHeight)
  return clamp(
    Math.exp(normalizedDelta * sensitivity),
    minZoomFactorPerEvent,
    maxZoomFactorPerEvent,
  )
}

export const getWheelZoomFactor = (
  event: Pick<WheelEvent, 'deltaMode' | 'deltaY'>,
  viewportHeight: number,
) =>
  getWheelZoomFactorWithSensitivity(event, viewportHeight, wheelZoomSensitivity)

const getPinchWheelZoomFactor = (
  event: Pick<WheelEvent, 'deltaMode' | 'deltaY'>,
  viewportHeight: number,
) =>
  getWheelZoomFactorWithSensitivity(
    event,
    viewportHeight,
    pinchWheelZoomSensitivity,
  )

const getSafariGestureScale = (event: Event) => {
  const scale = (event as Event & { scale?: unknown }).scale
  return typeof scale === 'number' && Number.isFinite(scale) && scale > 0
    ? scale
    : null
}

const getSafariGestureZoomFactor = (
  previousScale: number,
  currentScale: number,
) =>
  clamp(
    previousScale / currentScale,
    minZoomFactorPerEvent,
    maxZoomFactorPerEvent,
  )

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

export const bindPointerCameraInput = (
  options: PointerCameraInputOptions,
): PointerCameraInput => {
  const pointerScreenPosition: PointerScreenPosition = { x: 0, y: 0 }
  const pickWorldPointFromScreenPoint = createScreenPointWorldPicker(
    options.camera,
    options.rendererElement,
    options.renderScale,
  )
  let pointerInsideRenderer = false
  const defaultRendererCursor = options.rendererElement.style.cursor
  let edgeScrollCursor: string | null = null
  let wheelZoomGestureActive = false
  let wheelZoomGestureIdleTimer: ReturnType<typeof setTimeout> | null = null
  let safariGesturePreviousScale: number | null = null
  let activeCameraPan: {
    button: number
    hasMovedForTap: boolean
    hasPanned: boolean
    panBehavior: 'left-drag' | 'none' | 'right-drag' | 'touch'
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

  const syncRendererCursor = () => {
    const nextCursor =
      activeCameraPan?.panBehavior === 'right-drag'
        ? 'move'
        : (edgeScrollCursor ?? defaultRendererCursor)
    if (options.rendererElement.style.cursor === nextCursor) {
      return
    }
    options.rendererElement.style.cursor = nextCursor
  }

  const setEdgeScrollCursor = (cursor: string | null) => {
    edgeScrollCursor = cursor
    syncRendererCursor()
  }

  const continueWheelZoomGesture = () => {
    wheelZoomGestureActive = true
    if (wheelZoomGestureIdleTimer !== null) {
      clearTimeout(wheelZoomGestureIdleTimer)
    }
    wheelZoomGestureIdleTimer = setTimeout(() => {
      wheelZoomGestureActive = false
      wheelZoomGestureIdleTimer = null
    }, wheelZoomGestureIdleMs)
  }

  const canOwnDesktopZoomGesture = () =>
    options.getInteractionsEnabled() &&
    options.getDesktopCameraInputEnabled() &&
    options.getDesktopCameraInteractionsEnabled()

  const getEdgeScrollDirection = (bounds: DOMRectReadOnly): Vec2 | null => {
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

  const panCameraAlongEdge = (
    direction: Vec2,
    dtSeconds: number,
    bounds: DOMRectReadOnly,
  ) => {
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

  const updateEdgeScroll = (_nowMs: number, dtSeconds: number) => {
    if (
      !pointerInsideRenderer ||
      activeCameraPan !== null ||
      !options.getInteractionsEnabled() ||
      !options.getDesktopCameraInputEnabled() ||
      !options.getDesktopCameraInteractionsEnabled() ||
      options.getDesktopCameraPanMode() !== 'edge'
    ) {
      setEdgeScrollCursor(null)
      return
    }

    const bounds = options.rendererElement.getBoundingClientRect()
    const direction = getEdgeScrollDirection(bounds)

    if (!direction) {
      setEdgeScrollCursor(null)
      return
    }

    if (options.getCameraControlsLocked()) {
      setEdgeScrollCursor(null)
      return
    }

    setEdgeScrollCursor(getEdgeScrollCursor(direction))
    panCameraAlongEdge(direction, dtSeconds, bounds)
  }

  options.windowTarget.addEventListener('mousemove', (event) => {
    updatePointerPosition(event.clientX, event.clientY)
  })

  options.windowTarget.addEventListener('pointermove', (event) => {
    updatePointerPosition(event.clientX, event.clientY)
  })

  const clearActiveCameraPan = (event: PointerEvent) => {
    if (activeCameraPan?.pointerId !== event.pointerId) {
      return
    }

    activeCameraPan = null
    syncRendererCursor()

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
      return
    }

    if (!event.isPrimary) {
      return
    }

    let panBehavior: NonNullable<typeof activeCameraPan>['panBehavior'] =
      'touch'
    if (event.pointerType === 'mouse') {
      if (!options.getDesktopCameraInputEnabled()) {
        if (event.button !== 0) {
          return
        }
        panBehavior = 'left-drag'
      } else {
        if (!options.getDesktopCameraInteractionsEnabled()) {
          return
        }

        const panMode = options.getDesktopCameraPanMode()
        if (event.button === 0) {
          panBehavior = panMode === 'drag' ? 'left-drag' : 'none'
        } else if (event.button === 2 && panMode === 'wheel') {
          panBehavior = 'right-drag'
        } else {
          return
        }
      }
    }

    activeCameraPan = {
      button: event.button,
      hasMovedForTap: false,
      hasPanned: false,
      panBehavior,
      pointerId: event.pointerId,
      previousX: event.clientX,
      previousY: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
    }
    setEdgeScrollCursor(null)

    try {
      options.rendererElement.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is best effort; camera pan still works without it.
    }
  })

  options.rendererElement.addEventListener('pointermove', (event) => {
    pointerInsideRenderer = true
    updatePointerPosition(event.clientX, event.clientY)

    if (activeCameraPan?.pointerId !== event.pointerId) {
      return
    }
    if (!options.getInteractionsEnabled()) {
      clearActiveCameraPan(event)
      return
    }
    if (
      event.pointerType === 'mouse' &&
      options.getDesktopCameraInputEnabled() &&
      !options.getDesktopCameraInteractionsEnabled()
    ) {
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

    const shouldPan =
      activeCameraPan.panBehavior === 'touch' ||
      activeCameraPan.panBehavior === 'left-drag' ||
      (activeCameraPan.panBehavior === 'right-drag' &&
        activeCameraPan.hasMovedForTap)
    if (!shouldPan) {
      activeCameraPan.previousX = event.clientX
      activeCameraPan.previousY = event.clientY
      return
    }

    if (options.getCameraControlsLocked()) {
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
      const completedButton = activeCameraPan.button
      const completedPan =
        activeCameraPan.hasMovedForTap || activeCameraPan.hasPanned
      clearActiveCameraPan(event)
      if (
        completedButton === 0 &&
        !completedPan &&
        event.isPrimary &&
        options.onPrimaryTap?.(event.clientX, event.clientY)
      ) {
        event.preventDefault()
      }
      return
    }
  })
  options.rendererElement.addEventListener('pointercancel', (event) => {
    clearActiveCameraPan(event)
  })

  options.rendererElement.addEventListener('contextmenu', (event) => {
    if (
      event.button !== 2 ||
      !options.getInteractionsEnabled() ||
      !options.getDesktopCameraInputEnabled() ||
      !options.getDesktopCameraInteractionsEnabled() ||
      options.getCameraControlsLocked() ||
      options.getDesktopCameraPanMode() !== 'wheel'
    ) {
      return
    }

    event.preventDefault()
  })

  options.rendererElement.addEventListener('pointerenter', () => {
    pointerInsideRenderer = true
  })

  options.rendererElement.addEventListener('pointerleave', () => {
    pointerInsideRenderer = false
    setEdgeScrollCursor(null)
  })

  options.rendererElement.addEventListener(
    'gesturestart',
    (event) => {
      safariGesturePreviousScale = null
      if (!canOwnDesktopZoomGesture()) {
        return
      }

      const scale = getSafariGestureScale(event)
      if (scale === null) {
        return
      }

      safariGesturePreviousScale = scale
      event.preventDefault()
    },
    { passive: false },
  )

  options.rendererElement.addEventListener(
    'gesturechange',
    (event) => {
      if (safariGesturePreviousScale === null) {
        return
      }
      if (!canOwnDesktopZoomGesture()) {
        safariGesturePreviousScale = null
        return
      }

      event.preventDefault()
      const scale = getSafariGestureScale(event)
      if (scale === null) {
        return
      }

      const zoomFactor = getSafariGestureZoomFactor(
        safariGesturePreviousScale,
        scale,
      )
      safariGesturePreviousScale = scale
      if (zoomFactor !== 1) {
        options.onZoom(zoomFactor)
      }
    },
    { passive: false },
  )

  options.rendererElement.addEventListener(
    'gestureend',
    (event) => {
      const gestureWasActive = safariGesturePreviousScale !== null
      safariGesturePreviousScale = null
      if (gestureWasActive && canOwnDesktopZoomGesture()) {
        event.preventDefault()
      }
    },
    { passive: false },
  )

  options.rendererElement.addEventListener(
    'wheel',
    (event) => {
      if (!options.getInteractionsEnabled()) {
        return
      }

      const modifiedForZoom = event.ctrlKey || event.metaKey
      if (!options.getDesktopCameraInputEnabled()) {
        if (modifiedForZoom) {
          return
        }
        event.preventDefault()
        options.onZoom(
          getWheelZoomFactor(event, options.windowTarget.innerHeight),
        )
        return
      }
      if (!options.getDesktopCameraInteractionsEnabled()) {
        return
      }

      const panMode = options.getDesktopCameraPanMode()
      if (modifiedForZoom || (panMode === 'wheel' && wheelZoomGestureActive)) {
        if (panMode === 'wheel') {
          continueWheelZoomGesture()
        }
        event.preventDefault()
        options.onZoom(
          getPinchWheelZoomFactor(event, options.windowTarget.innerHeight),
        )
        return
      }

      if (panMode === 'wheel') {
        if (options.getCameraControlsLocked()) {
          return
        }

        const bounds = options.rendererElement.getBoundingClientRect()
        const centerX = bounds.left + bounds.width * 0.5
        const centerY = bounds.top + bounds.height * 0.5
        const speedMultiplier = Math.max(
          0,
          options.getDesktopWheelPanSpeedMultiplier?.() ?? 1,
        )
        const deltaX =
          event.deltaX *
          getWheelModeScale(event.deltaMode, bounds.width) *
          speedMultiplier
        const deltaY =
          event.deltaY *
          getWheelModeScale(event.deltaMode, bounds.height) *
          speedMultiplier

        if (
          (deltaX !== 0 || deltaY !== 0) &&
          panCameraBetweenScreenPoints(
            centerX,
            centerY,
            centerX - deltaX,
            centerY - deltaY,
          )
        ) {
          event.preventDefault()
        }
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
