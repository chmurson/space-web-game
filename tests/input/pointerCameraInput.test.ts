import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { bindPointerCameraInput } from '@/input/pointerCameraInput'

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

const createBrowserZoomWheelEvent = (modifier: 'ctrlKey' | 'metaKey') => {
  const event = new Event('wheel', {
    bubbles: true,
    cancelable: true,
  }) as WheelEvent

  Object.defineProperties(event, {
    ctrlKey: { value: modifier === 'ctrlKey' },
    metaKey: { value: modifier === 'metaKey' },
  })

  return event
}

const createHarness = (
  options: {
    cameraControlsLocked?: boolean
    edgePanSpeedPixelsPerSecond?: number
    edgeScrollEnabled?: boolean
    primaryTapHandled?: boolean
  } = {},
) => {
  const canvas = new FakeCanvas()
  const windowTarget = new FakeWindow()
  let cameraControlsLocked = options.cameraControlsLocked ?? false
  let edgeScrollEnabled = options.edgeScrollEnabled ?? false
  const onCameraPan = vi.fn<(delta: { x: number; y: number }) => boolean>(
    () => true,
  )
  const onPrimaryTap = vi.fn(() => options.primaryTapHandled ?? false)
  const onZoom = vi.fn()

  const input = bindPointerCameraInput({
    camera: createCamera(),
    getDesktopEdgePanSpeedPixelsPerSecond: () =>
      options.edgePanSpeedPixelsPerSecond ?? 420,
    getCameraControlsLocked: () => cameraControlsLocked,
    getEdgeScrollEnabled: () => edgeScrollEnabled,
    getInteractionsEnabled: () => true,
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
    setEdgeScrollEnabled: (enabled: boolean) => {
      edgeScrollEnabled = enabled
    },
  }
}

describe('bindPointerCameraInput browser zoom isolation', () => {
  it('leaves browser-modified wheel gestures to the browser', () => {
    const harness = createHarness()

    for (const modifier of ['ctrlKey', 'metaKey'] as const) {
      const event = createBrowserZoomWheelEvent(modifier)

      harness.windowTarget.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(false)
    }

    expect(harness.onZoom).not.toHaveBeenCalled()
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
    const harness = createHarness()

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
      edgeScrollEnabled: true,
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

describe('bindPointerCameraInput desktop edge-scroll', () => {
  it('pans from an edge immediately', () => {
    const harness = createHarness({
      edgePanSpeedPixelsPerSecond: 420,
      edgeScrollEnabled: true,
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
      edgePanSpeedPixelsPerSecond: 420,
      edgeScrollEnabled: true,
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
      edgeScrollEnabled: true,
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
      edgePanSpeedPixelsPerSecond: 280,
      edgeScrollEnabled: true,
    })
    const fast = createHarness({
      edgePanSpeedPixelsPerSecond: 620,
      edgeScrollEnabled: true,
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
      edgeScrollEnabled: true,
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
      edgeScrollEnabled: true,
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
      edgeScrollEnabled: true,
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
