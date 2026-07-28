import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { bindPointerCameraInput } from '@/input/pointerCameraInput'
import type { DesktopCameraPanMode } from '@/userSettingsStorage'

class FakeCanvas extends EventTarget {
  capturedPointerIds: number[] = []
  style = {
    cursor: '',
  }

  getBoundingClientRect() {
    return {
      bottom: 200,
      height: 200,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
  }

  releasePointerCapture(pointerId: number) {
    this.capturedPointerIds = this.capturedPointerIds.filter(
      (capturedPointerId) => capturedPointerId !== pointerId,
    )
  }

  setPointerCapture(pointerId: number) {
    this.capturedPointerIds.push(pointerId)
  }
}

class FakeWindow extends EventTarget {
  innerHeight = 200
  innerWidth = 200
}

const createCamera = () => {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1_000)
  camera.position.set(0, 10, 10)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  return camera
}

const createPointerEvent = (
  type: string,
  init: {
    button?: number
    clientX: number
    clientY: number
    isPrimary?: boolean
    pointerId?: number
    pointerType?: string
  },
) => {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  }) as PointerEvent

  Object.defineProperties(event, {
    button: { value: init.button ?? 0 },
    clientX: { value: init.clientX },
    clientY: { value: init.clientY },
    isPrimary: { value: init.isPrimary ?? true },
    pointerId: { value: init.pointerId ?? 1 },
    pointerType: { value: init.pointerType ?? 'mouse' },
  })

  return event
}

const createWheelEvent = (
  init: {
    ctrlKey?: boolean
    deltaMode?: number
    deltaX?: number
    deltaY?: number
    metaKey?: boolean
  } = {},
) => {
  const event = new Event('wheel', {
    bubbles: true,
    cancelable: true,
  }) as WheelEvent

  Object.defineProperties(event, {
    ctrlKey: { value: init.ctrlKey ?? false },
    deltaMode: { value: init.deltaMode ?? 0 },
    deltaX: { value: init.deltaX ?? 0 },
    deltaY: { value: init.deltaY ?? 0 },
    metaKey: { value: init.metaKey ?? false },
  })

  return event
}

const createSafariGestureEvent = (type: string, scale: number) => {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperty(event, 'scale', { value: scale })
  return event
}

const createContextMenuEvent = (button = 2) =>
  createPointerEvent('contextmenu', {
    button,
    clientX: 100,
    clientY: 100,
  })

const createHarness = (
  options: {
    cameraControlsLocked?: boolean
    desktopCameraInputEnabled?: boolean
    desktopCameraInteractionsEnabled?: boolean
    desktopCameraPanMode?: DesktopCameraPanMode
    edgePanSpeedPixelsPerSecond?: number
    interactionsEnabled?: boolean
    primaryTapHandled?: boolean
    wheelPanSpeedMultiplier?: number
  } = {},
) => {
  const canvas = new FakeCanvas()
  const windowTarget = new FakeWindow()
  let cameraControlsLocked = options.cameraControlsLocked ?? false
  let desktopCameraInputEnabled = options.desktopCameraInputEnabled ?? true
  let desktopCameraInteractionsEnabled =
    options.desktopCameraInteractionsEnabled ?? true
  let desktopCameraPanMode = options.desktopCameraPanMode ?? 'drag'
  let interactionsEnabled = options.interactionsEnabled ?? true
  let wheelPanSpeedMultiplier = options.wheelPanSpeedMultiplier ?? 1
  const onCameraPan = vi.fn<(delta: { x: number; y: number }) => boolean>(
    () => true,
  )
  const onPrimaryTap = vi.fn(() => options.primaryTapHandled ?? false)
  const onZoom = vi.fn()

  const input = bindPointerCameraInput({
    camera: createCamera(),
    getDesktopCameraInputEnabled: () => desktopCameraInputEnabled,
    getDesktopCameraInteractionsEnabled: () => desktopCameraInteractionsEnabled,
    getDesktopCameraPanMode: () => desktopCameraPanMode,
    getDesktopEdgePanSpeedPixelsPerSecond: () =>
      options.edgePanSpeedPixelsPerSecond ?? 420,
    getDesktopWheelPanSpeedMultiplier: () => wheelPanSpeedMultiplier,
    getCameraControlsLocked: () => cameraControlsLocked,
    getInteractionsEnabled: () => interactionsEnabled,
    onCameraPan,
    onPrimaryTap,
    onResize: () => {},
    onZoom,
    renderScale: 1,
    rendererElement: canvas as unknown as HTMLCanvasElement,
    windowTarget: windowTarget as unknown as Window,
  })

  return {
    canvas,
    input,
    onCameraPan,
    onPrimaryTap,
    onZoom,
    windowTarget,
    setCameraControlsLocked: (locked: boolean) => {
      cameraControlsLocked = locked
    },
    setDesktopCameraInputEnabled: (enabled: boolean) => {
      desktopCameraInputEnabled = enabled
    },
    setDesktopCameraInteractionsEnabled: (enabled: boolean) => {
      desktopCameraInteractionsEnabled = enabled
    },
    setDesktopCameraPanMode: (mode: DesktopCameraPanMode) => {
      desktopCameraPanMode = mode
    },
    setInteractionsEnabled: (enabled: boolean) => {
      interactionsEnabled = enabled
    },
    setWheelPanSpeedMultiplier: (multiplier: number) => {
      wheelPanSpeedMultiplier = multiplier
    },
  }
}

describe('bindPointerCameraInput wheel routing', () => {
  it.each([
    'wheel',
    'drag',
    'edge',
  ] as const)('matches Chromium pinch scale for Ctrl/Cmd-modified wheel gestures in %s mode', (desktopCameraPanMode) => {
    const harness = createHarness({ desktopCameraPanMode })

    for (const modifier of ['ctrlKey', 'metaKey'] as const) {
      for (const pinchScale of [1.2, 0.8]) {
        const event = createWheelEvent({
          [modifier]: true,
          deltaY: -100 * Math.log(pinchScale),
        })

        harness.canvas.dispatchEvent(event)

        expect(event.defaultPrevented).toBe(true)
        const [zoomFactor] = harness.onZoom.mock.lastCall ?? []
        expect(zoomFactor).toBeCloseTo(1 / pinchScale, 10)
      }
    }

    expect(harness.onZoom).toHaveBeenCalledTimes(4)
    expect(harness.onCameraPan).not.toHaveBeenCalled()
  })

  it.each([
    'drag',
    'edge',
  ] as const)('keeps ordinary wheel zoom sensitivity unchanged in %s mode', (desktopCameraPanMode) => {
    const harness = createHarness({ desktopCameraPanMode })
    const deltaY = -100 * Math.log(1.2)

    harness.canvas.dispatchEvent(createWheelEvent({ deltaY }))

    const [zoomFactor] = harness.onZoom.mock.lastCall ?? []
    expect(zoomFactor).toBeCloseTo(Math.exp(deltaY * 0.0015), 10)
  })

  it('pans both platform wheel axes diagonally in wheel mode', () => {
    const harness = createHarness({ desktopCameraPanMode: 'wheel' })
    const event = createWheelEvent({ deltaX: 20, deltaY: 30 })

    harness.canvas.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(harness.onZoom).not.toHaveBeenCalled()
    expect(harness.onCameraPan).toHaveBeenCalledTimes(1)
    const [delta] = harness.onCameraPan.mock.calls[0] ?? []
    expect(delta?.x).toBeGreaterThan(0)
    expect(delta?.y).toBeGreaterThan(0)
  })

  it('applies wheel pan speed equally to both axes', () => {
    const slow = createHarness({
      desktopCameraPanMode: 'wheel',
      wheelPanSpeedMultiplier: 0.6,
    })
    const fast = createHarness({
      desktopCameraPanMode: 'wheel',
      wheelPanSpeedMultiplier: 1.6,
    })

    slow.canvas.dispatchEvent(createWheelEvent({ deltaX: 10, deltaY: 10 }))
    fast.canvas.dispatchEvent(createWheelEvent({ deltaX: 10, deltaY: 10 }))

    const [slowDelta] = slow.onCameraPan.mock.calls[0] ?? []
    const [fastDelta] = fast.onCameraPan.mock.calls[0] ?? []
    expect(slowDelta).toBeDefined()
    expect(fastDelta).toBeDefined()
    if (!slowDelta || !fastDelta) {
      throw new Error('Expected wheel pan deltas')
    }

    expect(fastDelta.x).toBeGreaterThan(slowDelta.x * 2)
    expect(fastDelta.y).toBeGreaterThan(slowDelta.y * 2)
  })

  it('normalizes line-mode wheel deltas on both axes', () => {
    const pixel = createHarness({ desktopCameraPanMode: 'wheel' })
    const line = createHarness({ desktopCameraPanMode: 'wheel' })

    pixel.canvas.dispatchEvent(
      createWheelEvent({
        deltaMode: 0,
        deltaX: 1,
        deltaY: 1,
      }),
    )
    line.canvas.dispatchEvent(
      createWheelEvent({
        deltaMode: 1,
        deltaX: 1,
        deltaY: 1,
      }),
    )

    const [pixelDelta] = pixel.onCameraPan.mock.calls[0] ?? []
    const [lineDelta] = line.onCameraPan.mock.calls[0] ?? []
    expect(pixelDelta).toBeDefined()
    expect(lineDelta).toBeDefined()
    if (!pixelDelta || !lineDelta) {
      throw new Error('Expected normalized wheel pan deltas')
    }
    expect(lineDelta.x).toBeGreaterThan(pixelDelta.x * 15)
    expect(lineDelta.y).toBeGreaterThan(pixelDelta.y * 15)
  })

  it.each([
    'ctrlKey',
    'metaKey',
  ] as const)('keeps the unmodified %s wheel tail in zoom until 125 ms of inactivity', (modifier) => {
    vi.useFakeTimers()
    try {
      const harness = createHarness({ desktopCameraPanMode: 'wheel' })
      const pinchDeltaY = -100 * Math.log(1.1)
      const modifiedEvent =
        modifier === 'ctrlKey'
          ? createWheelEvent({ ctrlKey: true, deltaY: pinchDeltaY })
          : createWheelEvent({ deltaY: pinchDeltaY, metaKey: true })
      const firstTailEvent = createWheelEvent({ deltaY: pinchDeltaY })
      const continuedTailEvent = createWheelEvent({ deltaY: pinchDeltaY })
      const postIdleEvent = createWheelEvent({ deltaY: 30 })

      harness.canvas.dispatchEvent(modifiedEvent)
      vi.advanceTimersByTime(100)
      harness.canvas.dispatchEvent(firstTailEvent)
      vi.advanceTimersByTime(124)
      harness.canvas.dispatchEvent(continuedTailEvent)
      vi.advanceTimersByTime(126)
      harness.canvas.dispatchEvent(postIdleEvent)

      expect(modifiedEvent.defaultPrevented).toBe(true)
      expect(firstTailEvent.defaultPrevented).toBe(true)
      expect(continuedTailEvent.defaultPrevented).toBe(true)
      expect(postIdleEvent.defaultPrevented).toBe(true)
      expect(harness.onZoom).toHaveBeenCalledTimes(3)
      expect(harness.onCameraPan).toHaveBeenCalledTimes(1)
      for (const [zoomFactor] of harness.onZoom.mock.calls) {
        expect(zoomFactor).toBeCloseTo(1 / 1.1, 10)
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([
    'drag',
    'edge',
  ] as const)('zooms and consumes unmodified wheel gestures in %s mode', (desktopCameraPanMode) => {
    const harness = createHarness({ desktopCameraPanMode })
    const event = createWheelEvent({ deltaY: 120 })

    harness.canvas.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(harness.onZoom).toHaveBeenCalledTimes(1)
    expect(harness.onCameraPan).not.toHaveBeenCalled()
  })

  it('leaves wheel gestures unhandled while desktop camera interactions are gated', () => {
    const harness = createHarness({
      desktopCameraInteractionsEnabled: false,
      desktopCameraPanMode: 'wheel',
    })
    const event = createWheelEvent({ deltaX: 20, deltaY: 30 })

    harness.canvas.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(harness.onCameraPan).not.toHaveBeenCalled()
    expect(harness.onZoom).not.toHaveBeenCalled()
  })

  it('leaves wheel pan unhandled while camera controls are locked', () => {
    const harness = createHarness({
      cameraControlsLocked: true,
      desktopCameraPanMode: 'wheel',
    })
    const event = createWheelEvent({ deltaY: 30 })

    harness.canvas.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(harness.onCameraPan).not.toHaveBeenCalled()
  })

  it('preserves unmodified wheel zoom when fine-pointer modes are unavailable', () => {
    const harness = createHarness({
      desktopCameraInputEnabled: false,
      desktopCameraPanMode: 'wheel',
    })
    const event = createWheelEvent({ deltaX: 20, deltaY: 30 })

    harness.canvas.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(harness.onZoom).toHaveBeenCalledTimes(1)
    expect(harness.onCameraPan).not.toHaveBeenCalled()
  })
})

describe('bindPointerCameraInput Safari gesture routing', () => {
  it.each([
    'wheel',
    'drag',
    'edge',
  ] as const)('converts cumulative pinch scale into incremental zoom in %s mode', (desktopCameraPanMode) => {
    const harness = createHarness({ desktopCameraPanMode })
    const start = createSafariGestureEvent('gesturestart', 1)
    const firstChange = createSafariGestureEvent('gesturechange', 1.2)
    const secondChange = createSafariGestureEvent('gesturechange', 1.5)
    const end = createSafariGestureEvent('gestureend', 1.5)

    harness.canvas.dispatchEvent(start)
    harness.canvas.dispatchEvent(firstChange)
    harness.canvas.dispatchEvent(secondChange)
    harness.canvas.dispatchEvent(end)

    expect(start.defaultPrevented).toBe(true)
    expect(firstChange.defaultPrevented).toBe(true)
    expect(secondChange.defaultPrevented).toBe(true)
    expect(end.defaultPrevented).toBe(true)
    expect(harness.onZoom).toHaveBeenNthCalledWith(1, 1 / 1.2)
    expect(harness.onZoom).toHaveBeenNthCalledWith(2, 1.2 / 1.5)
    expect(harness.onCameraPan).not.toHaveBeenCalled()
  })

  it('clamps large scale steps and resets normalization at gesture end', () => {
    const harness = createHarness({ desktopCameraPanMode: 'drag' })

    harness.canvas.dispatchEvent(createSafariGestureEvent('gesturestart', 1))
    harness.canvas.dispatchEvent(createSafariGestureEvent('gesturechange', 4))
    harness.canvas.dispatchEvent(createSafariGestureEvent('gestureend', 4))
    const orphanedChange = createSafariGestureEvent('gesturechange', 8)
    harness.canvas.dispatchEvent(orphanedChange)

    expect(harness.onZoom).toHaveBeenCalledOnce()
    expect(harness.onZoom).toHaveBeenCalledWith(0.75)
    expect(orphanedChange.defaultPrevented).toBe(false)
  })

  it.each([
    ['disabled game interactions', { interactionsEnabled: false }],
    [
      'gated desktop camera interactions',
      { desktopCameraInteractionsEnabled: false },
    ],
    ['coarse-pointer input', { desktopCameraInputEnabled: false }],
  ] as const)('leaves Safari pinch unhandled for %s', (_label, options) => {
    const harness = createHarness(options)
    const start = createSafariGestureEvent('gesturestart', 1)
    const change = createSafariGestureEvent('gesturechange', 1.2)

    harness.canvas.dispatchEvent(start)
    harness.canvas.dispatchEvent(change)

    expect(start.defaultPrevented).toBe(false)
    expect(change.defaultPrevented).toBe(false)
    expect(harness.onZoom).not.toHaveBeenCalled()
  })

  it('preserves zoom while camera pan controls are locked', () => {
    const harness = createHarness({
      cameraControlsLocked: true,
      desktopCameraPanMode: 'edge',
    })

    harness.canvas.dispatchEvent(createSafariGestureEvent('gesturestart', 1))
    harness.canvas.dispatchEvent(createSafariGestureEvent('gesturechange', 0.8))

    expect(harness.onZoom).toHaveBeenCalledWith(1.25)
    expect(harness.onCameraPan).not.toHaveBeenCalled()
  })
})

describe('bindPointerCameraInput canvas interactions', () => {
  it('offers a stationary mouse click to canvas interactions without panning', () => {
    const harness = createHarness()

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 100, clientY: 100 }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 100, clientY: 100 }),
    )
    expect(harness.onPrimaryTap).toHaveBeenCalledWith(100, 100)
    expect(harness.onCameraPan).not.toHaveBeenCalled()
  })

  it('offers a stationary touch tap to canvas interactions without panning', () => {
    const harness = createHarness()

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pointerType: 'touch',
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', {
        clientX: 100,
        clientY: 100,
        pointerType: 'touch',
      }),
    )
    expect(harness.onPrimaryTap).toHaveBeenCalledWith(100, 100)
    expect(harness.onCameraPan).not.toHaveBeenCalled()
  })

  it('consumes a handled touch tap', () => {
    const harness = createHarness({ primaryTapHandled: true })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pointerType: 'touch',
      }),
    )
    const pointerUp = createPointerEvent('pointerup', {
      clientX: 100,
      clientY: 100,
      pointerType: 'touch',
    })
    harness.canvas.dispatchEvent(pointerUp)

    expect(harness.onPrimaryTap).toHaveBeenCalledWith(100, 100)
    expect(pointerUp.defaultPrevented).toBe(true)
  })

  it('offers stationary primary mouse clicks to canvas interactions', () => {
    const harness = createHarness({ primaryTapHandled: true })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 90, clientY: 110 }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 90, clientY: 110 }),
    )

    expect(harness.onPrimaryTap).toHaveBeenCalledWith(90, 110)
    expect(harness.onCameraPan).not.toHaveBeenCalled()
  })

  it('uses touch drag gestures for camera pan', () => {
    const harness = createHarness({ desktopCameraPanMode: 'wheel' })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pointerType: 'touch',
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', {
        clientX: 140,
        clientY: 100,
        pointerType: 'touch',
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', {
        clientX: 140,
        clientY: 100,
        pointerType: 'touch',
      }),
    )

    expect(harness.onCameraPan).toHaveBeenCalled()
    expect(harness.onPrimaryTap).not.toHaveBeenCalled()
  })

  it('uses desktop drag gestures for camera pan when edge-scroll is disabled', () => {
    const harness = createHarness()

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 100, clientY: 100 }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 130, clientY: 100 }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 130, clientY: 100 }),
    )

    expect(harness.onCameraPan).toHaveBeenCalled()
  })

  it('does not use desktop drag gestures while edge-scroll is enabled', () => {
    const harness = createHarness({
      desktopCameraPanMode: 'edge',
    })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 100, clientY: 100 }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 130, clientY: 100 }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 130, clientY: 100 }),
    )

    expect(harness.onCameraPan).not.toHaveBeenCalled()
  })

  it('does not use left-button drag gestures in wheel mode', () => {
    const harness = createHarness({ desktopCameraPanMode: 'wheel' })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 100, clientY: 100 }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 130, clientY: 100 }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 130, clientY: 100 }),
    )

    expect(harness.onCameraPan).not.toHaveBeenCalled()
  })

  it('starts desktop drag pan on the first movement without an unlock threshold', () => {
    const harness = createHarness()

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 100, clientY: 100 }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 101, clientY: 100 }),
    )

    expect(harness.onCameraPan).toHaveBeenCalledTimes(1)
  })
})

describe('bindPointerCameraInput wheel-mode right-button fallback', () => {
  it('suppresses a stationary right-click context menu', () => {
    const harness = createHarness({ desktopCameraPanMode: 'wheel' })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', {
        button: 2,
        clientX: 100,
        clientY: 100,
      }),
    )
    expect(harness.canvas.style.cursor).toBe('move')
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', {
        button: 2,
        clientX: 100,
        clientY: 100,
      }),
    )
    const contextMenu = createContextMenuEvent()
    harness.canvas.dispatchEvent(contextMenu)

    expect(harness.onCameraPan).not.toHaveBeenCalled()
    expect(harness.canvas.style.cursor).toBe('')
    expect(contextMenu.defaultPrevented).toBe(true)
  })

  it('suppresses the context menu below the existing drag tolerance', () => {
    const harness = createHarness({ desktopCameraPanMode: 'wheel' })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', {
        button: 2,
        clientX: 100,
        clientY: 100,
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', {
        button: 2,
        clientX: 107,
        clientY: 100,
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', {
        button: 2,
        clientX: 107,
        clientY: 100,
      }),
    )
    const contextMenu = createContextMenuEvent()
    harness.canvas.dispatchEvent(contextMenu)

    expect(harness.onCameraPan).not.toHaveBeenCalled()
    expect(contextMenu.defaultPrevented).toBe(true)
  })

  it('pans at the existing drag tolerance and suppresses canvas context menus', () => {
    const harness = createHarness({ desktopCameraPanMode: 'wheel' })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', {
        button: 2,
        clientX: 100,
        clientY: 100,
      }),
    )
    const pointerMove = createPointerEvent('pointermove', {
      button: 2,
      clientX: 108,
      clientY: 100,
    })
    harness.canvas.dispatchEvent(pointerMove)
    expect(harness.canvas.style.cursor).toBe('move')
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', {
        button: 2,
        clientX: 108,
        clientY: 100,
      }),
    )
    const keyboardContextMenu = createContextMenuEvent(0)
    harness.canvas.dispatchEvent(keyboardContextMenu)
    const handledContextMenu = createContextMenuEvent()
    harness.canvas.dispatchEvent(handledContextMenu)
    const bodyContextMenu = createContextMenuEvent()
    harness.windowTarget.dispatchEvent(bodyContextMenu)

    expect(harness.onCameraPan).toHaveBeenCalledTimes(1)
    expect(pointerMove.defaultPrevented).toBe(true)
    expect(harness.canvas.style.cursor).toBe('')
    expect(keyboardContextMenu.defaultPrevented).toBe(false)
    expect(handledContextMenu.defaultPrevented).toBe(true)
    expect(bodyContextMenu.defaultPrevented).toBe(false)
  })

  it('allows window-boundary context menus during and after an accepted drag', () => {
    const harness = createHarness({ desktopCameraPanMode: 'wheel' })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', {
        button: 2,
        clientX: 100,
        clientY: 100,
      }),
    )
    harness.input.updateEdgeScroll(100, 0.1)
    expect(harness.canvas.style.cursor).toBe('move')
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', {
        button: 2,
        clientX: 130,
        clientY: 100,
      }),
    )
    const contextMenu = createContextMenuEvent()
    harness.windowTarget.dispatchEvent(contextMenu)
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', {
        button: 2,
        clientX: 130,
        clientY: 100,
      }),
    )
    const laterContextMenu = createContextMenuEvent()
    harness.windowTarget.dispatchEvent(laterContextMenu)

    expect(harness.onCameraPan).toHaveBeenCalledTimes(1)
    expect(contextMenu.defaultPrevented).toBe(false)
    expect(laterContextMenu.defaultPrevented).toBe(false)
    expect(harness.canvas.style.cursor).toBe('')
  })

  it('restores the renderer cursor when a right-button fallback is canceled', () => {
    const harness = createHarness({ desktopCameraPanMode: 'wheel' })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', {
        button: 2,
        clientX: 100,
        clientY: 100,
      }),
    )
    expect(harness.canvas.style.cursor).toBe('move')

    harness.canvas.dispatchEvent(
      createPointerEvent('pointercancel', {
        button: 2,
        clientX: 100,
        clientY: 100,
      }),
    )

    expect(harness.canvas.style.cursor).toBe('')
  })

  it.each([
    'drag',
    'edge',
  ] as const)('does not start right-button camera pan in %s mode', (desktopCameraPanMode) => {
    const harness = createHarness({ desktopCameraPanMode })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', {
        button: 2,
        clientX: 100,
        clientY: 100,
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', {
        button: 2,
        clientX: 130,
        clientY: 100,
      }),
    )
    const contextMenu = createContextMenuEvent()
    harness.canvas.dispatchEvent(contextMenu)

    expect(harness.onCameraPan).not.toHaveBeenCalled()
    expect(harness.canvas.style.cursor).toBe('')
    expect(contextMenu.defaultPrevented).toBe(false)
  })

  it.each([
    {
      label: 'global interactions are disabled',
      options: { interactionsEnabled: false },
    },
    {
      label: 'desktop camera input is unavailable',
      options: { desktopCameraInputEnabled: false },
    },
    {
      label: 'desktop camera interactions are disabled',
      options: { desktopCameraInteractionsEnabled: false },
    },
  ])('allows canvas context menus when $label', ({ options }) => {
    const harness = createHarness({
      desktopCameraPanMode: 'wheel',
      ...options,
    })
    const contextMenu = createContextMenuEvent()

    harness.canvas.dispatchEvent(contextMenu)

    expect(contextMenu.defaultPrevented).toBe(false)
  })

  it('allows context menus when a locked camera rejects right drag', () => {
    const harness = createHarness({
      cameraControlsLocked: true,
      desktopCameraPanMode: 'wheel',
    })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', {
        button: 2,
        clientX: 100,
        clientY: 100,
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', {
        button: 2,
        clientX: 130,
        clientY: 100,
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', {
        button: 2,
        clientX: 130,
        clientY: 100,
      }),
    )
    const contextMenu = createContextMenuEvent()
    harness.canvas.dispatchEvent(contextMenu)

    expect(harness.onCameraPan).not.toHaveBeenCalled()
    expect(harness.canvas.style.cursor).toBe('')
    expect(contextMenu.defaultPrevented).toBe(false)
  })
})

describe('bindPointerCameraInput desktop edge-scroll', () => {
  it('pans from an edge immediately', () => {
    const harness = createHarness({
      desktopCameraPanMode: 'edge',
      edgePanSpeedPixelsPerSecond: 420,
    })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 199, clientY: 100 }),
    )
    harness.input.updateEdgeScroll(100, 0.1)

    expect(harness.onCameraPan).toHaveBeenCalledTimes(1)
    const [delta] = harness.onCameraPan.mock.calls[0] ?? []
    expect(delta?.x).toBeGreaterThan(0)
  })

  it('pans upward from the top edge', () => {
    const harness = createHarness({
      desktopCameraPanMode: 'edge',
      edgePanSpeedPixelsPerSecond: 420,
    })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 100, clientY: 1 }),
    )
    harness.input.updateEdgeScroll(100, 0.1)

    expect(harness.onCameraPan).toHaveBeenCalledTimes(1)
    const [delta] = harness.onCameraPan.mock.calls[0] ?? []
    expect(delta?.y).toBeLessThan(0)
    expect(harness.canvas.style.cursor).toBe('n-resize')
  })

  it('uses a diagonal cursor near edge-scroll corners', () => {
    const harness = createHarness({
      desktopCameraPanMode: 'edge',
    })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 199, clientY: 1 }),
    )
    harness.input.updateEdgeScroll(100, 0.1)

    expect(harness.onCameraPan).toHaveBeenCalledTimes(1)
    expect(harness.canvas.style.cursor).toBe('ne-resize')
  })

  it('scales edge panning with the desktop edge pan speed', () => {
    const slow = createHarness({
      desktopCameraPanMode: 'edge',
      edgePanSpeedPixelsPerSecond: 280,
    })
    const fast = createHarness({
      desktopCameraPanMode: 'edge',
      edgePanSpeedPixelsPerSecond: 620,
    })

    slow.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 199, clientY: 100 }),
    )
    fast.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 199, clientY: 100 }),
    )
    slow.input.updateEdgeScroll(100, 0.1)
    fast.input.updateEdgeScroll(100, 0.1)

    const [slowDelta] = slow.onCameraPan.mock.calls[0] ?? []
    const [fastDelta] = fast.onCameraPan.mock.calls[0] ?? []

    expect(slowDelta).toBeDefined()
    expect(fastDelta).toBeDefined()
    if (!slowDelta || !fastDelta) {
      throw new Error('Expected edge pan deltas')
    }
    expect(fastDelta.x).toBeGreaterThan(slowDelta.x * 2)
  })

  it('starts edge panning on the first update without dwell', () => {
    const harness = createHarness({
      desktopCameraPanMode: 'edge',
    })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 199, clientY: 100 }),
    )
    harness.input.updateEdgeScroll(0, 0.016)
    expect(harness.onCameraPan).toHaveBeenCalledTimes(1)
  })

  it('does not edge pan when camera controls are locked', () => {
    const harness = createHarness({
      cameraControlsLocked: true,
      desktopCameraPanMode: 'edge',
    })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 199, clientY: 100 }),
    )
    harness.input.updateEdgeScroll(0, 0.016)
    expect(harness.onCameraPan).not.toHaveBeenCalled()
    expect(harness.canvas.style.cursor).toBe('')
  })

  it('stops edge panning when the pointer leaves the edge', () => {
    const harness = createHarness({
      desktopCameraPanMode: 'edge',
    })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 199, clientY: 100 }),
    )
    harness.input.updateEdgeScroll(0, 0.016)
    expect(harness.onCameraPan).toHaveBeenCalledTimes(1)
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 100, clientY: 100 }),
    )
    harness.input.updateEdgeScroll(1_001, 0.016)

    expect(harness.onCameraPan).toHaveBeenCalledTimes(1)
    expect(harness.canvas.style.cursor).toBe('')
  })

  it('does not pan or unlock when desktop edge-scroll is disabled', () => {
    const harness = createHarness()

    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 199, clientY: 100 }),
    )
    harness.input.updateEdgeScroll(100, 0.1)

    expect(harness.onCameraPan).not.toHaveBeenCalled()
    expect(harness.canvas.style.cursor).toBe('')
  })
})
