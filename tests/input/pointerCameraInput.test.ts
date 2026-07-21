import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { bindPointerCameraInput } from '@/input/pointerCameraInput'
import type { CameraViewMode } from '@/scenario/scenarioDirectiveTypes'

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

const createHarness = (
  initialCameraView: CameraViewMode = 'locked',
  options: {
    cameraControlsLocked?: boolean
    edgePanSpeedPixelsPerSecond?: number
    edgeScrollEnabled?: boolean
  } = {},
) => {
  const canvas = new FakeCanvas()
  const windowTarget = new FakeWindow()
  let cameraView = initialCameraView
  let cameraControlsLocked = options.cameraControlsLocked ?? false
  let edgeScrollEnabled = options.edgeScrollEnabled ?? false
  const onCameraPan = vi.fn<(delta: { x: number; y: number }) => boolean>(
    () => true,
  )
  const onCameraViewSelected = vi.fn((view: CameraViewMode) => {
    if (cameraControlsLocked) {
      return false
    }
    cameraView = view
    return true
  })
  const onCameraUnlockProgressChange = vi.fn()
  const onCameraUnlocked = vi.fn()
  const onTargetHeadingPlan = vi.fn()
  const onTargetHeadingPlanCanceled = vi.fn()
  const onTargetHeadingPlanCommitted = vi.fn(() => true)

  const input = bindPointerCameraInput({
    camera: createCamera(),
    getDesktopEdgePanSpeedPixelsPerSecond: () =>
      options.edgePanSpeedPixelsPerSecond ?? 420,
    getCameraControlsLocked: () => cameraControlsLocked,
    getCameraView: () => cameraView,
    getEdgeScrollEnabled: () => edgeScrollEnabled,
    getInteractionsEnabled: () => true,
    getSpacecraftPosition: () => ({ x: 0, y: 0 }),
    getSpacecraftVisible: () => true,
    onCameraViewSelected,
    onCameraPan,
    onCameraUnlockProgressChange,
    onCameraUnlocked,
    onResize: () => {},
    onTargetHeadingPlan,
    onTargetHeadingPlanCanceled,
    onTargetHeadingPlanCommitted,
    onZoom: () => {},
    renderScale: 1,
    rendererElement: canvas as unknown as HTMLCanvasElement,
    windowTarget: windowTarget as unknown as Window,
  })

  return {
    canvas,
    getCameraView: () => cameraView,
    input,
    onCameraViewSelected,
    onCameraPan,
    onCameraUnlockProgressChange,
    onCameraUnlocked,
    onTargetHeadingPlan,
    onTargetHeadingPlanCanceled,
    onTargetHeadingPlanCommitted,
    setCameraControlsLocked: (locked: boolean) => {
      cameraControlsLocked = locked
    },
    setEdgeScrollEnabled: (enabled: boolean) => {
      edgeScrollEnabled = enabled
    },
  }
}

describe('bindPointerCameraInput target heading planning', () => {
  it('does not start target-heading planning from a mouse click', () => {
    const harness = createHarness()

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 100, clientY: 100 }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 100, clientY: 100 }),
    )
    expect(harness.onTargetHeadingPlan).not.toHaveBeenCalled()
    expect(harness.onTargetHeadingPlanCommitted).not.toHaveBeenCalled()
    expect(harness.onTargetHeadingPlanCanceled).not.toHaveBeenCalled()
    expect(harness.onCameraPan).not.toHaveBeenCalled()
  })

  it('plans, updates, and commits with non-mouse pointers', () => {
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
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', {
        clientX: 120,
        clientY: 100,
        pointerId: 2,
        pointerType: 'touch',
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', {
        clientX: 120,
        clientY: 100,
        pointerId: 3,
        pointerType: 'touch',
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', {
        clientX: 120,
        clientY: 100,
        pointerId: 3,
        pointerType: 'touch',
      }),
    )

    expect(harness.onTargetHeadingPlan).toHaveBeenCalledTimes(2)
    expect(harness.onTargetHeadingPlanCommitted).toHaveBeenCalledTimes(1)
    expect(harness.onTargetHeadingPlanCanceled).not.toHaveBeenCalled()
    expect(harness.onCameraPan).not.toHaveBeenCalled()
  })

  it('updates touch preview but does not commit after a drag past tolerance', () => {
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
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pointerId: 2,
        pointerType: 'touch',
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', {
        clientX: 140,
        clientY: 100,
        pointerId: 2,
        pointerType: 'touch',
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', {
        clientX: 140,
        clientY: 100,
        pointerId: 2,
        pointerType: 'touch',
      }),
    )

    expect(harness.onTargetHeadingPlan).toHaveBeenCalledTimes(2)
    expect(harness.onTargetHeadingPlan).toHaveBeenLastCalledWith(
      expect.any(Number),
      expect.objectContaining({
        screenPosition: { x: 140, y: 100 },
      }),
    )
    expect(harness.onTargetHeadingPlanCommitted).not.toHaveBeenCalled()
    expect(harness.onTargetHeadingPlanCanceled).not.toHaveBeenCalled()
    expect(harness.onCameraPan).not.toHaveBeenCalled()
  })

  it('cancels an active plan on right click without committing', () => {
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
    const rightClick = createPointerEvent('pointerdown', {
      button: 2,
      clientX: 100,
      clientY: 100,
      pointerId: 2,
    })
    const contextMenu = new Event('contextmenu', { cancelable: true })

    harness.canvas.dispatchEvent(rightClick)
    harness.canvas.dispatchEvent(contextMenu)

    expect(harness.onTargetHeadingPlan).toHaveBeenCalledTimes(1)
    expect(harness.onTargetHeadingPlanCanceled).toHaveBeenCalledTimes(1)
    expect(harness.onTargetHeadingPlanCommitted).not.toHaveBeenCalled()
    expect(rightClick.defaultPrevented).toBe(true)
    expect(contextMenu.defaultPrevented).toBe(true)
  })

  it('uses desktop drag gestures for free camera pan when edge-scroll is disabled', () => {
    const harness = createHarness('free')

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
    expect(harness.onTargetHeadingPlan).not.toHaveBeenCalled()
    expect(harness.onTargetHeadingPlanCommitted).not.toHaveBeenCalled()
  })

  it('does not use desktop drag gestures for free camera pan while edge-scroll is enabled', () => {
    const harness = createHarness('free', {
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
    expect(harness.onTargetHeadingPlan).not.toHaveBeenCalled()
    expect(harness.onTargetHeadingPlanCommitted).not.toHaveBeenCalled()
  })

  it('uses the shared unlock callback when desktop drag enters free roam', () => {
    const harness = createHarness('locked')

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 100, clientY: 100 }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 201, clientY: 100 }),
    )

    expect(harness.onCameraViewSelected).toHaveBeenCalledWith('free')
    expect(harness.onCameraUnlocked).toHaveBeenCalledTimes(1)
    expect(harness.onCameraPan).toHaveBeenCalledTimes(1)
  })

  it('keeps touch drag gestures available for free camera pan before planning', () => {
    const harness = createHarness('free')

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pointerType: 'touch',
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', {
        clientX: 130,
        clientY: 100,
        pointerType: 'touch',
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', {
        clientX: 130,
        clientY: 100,
        pointerType: 'touch',
      }),
    )

    expect(harness.onCameraPan).toHaveBeenCalled()
    expect(harness.onTargetHeadingPlan).not.toHaveBeenCalled()
    expect(harness.onTargetHeadingPlanCommitted).not.toHaveBeenCalled()
  })
})

describe('bindPointerCameraInput desktop edge-scroll', () => {
  it('pans from an edge while the camera view is free', () => {
    const harness = createHarness('free', {
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

  it('pans upward from the top edge while the camera view is free', () => {
    const harness = createHarness('free', {
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
    const harness = createHarness('free', {
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
    const slow = createHarness('free', {
      edgePanSpeedPixelsPerSecond: 280,
      edgeScrollEnabled: true,
    })
    const fast = createHarness('free', {
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

  it('delays free-roam loading progress before unlocking after two seconds', () => {
    const harness = createHarness('locked', {
      edgeScrollEnabled: true,
    })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 199, clientY: 100 }),
    )
    harness.input.updateEdgeScroll(0, 0.016)
    harness.input.updateEdgeScroll(999, 0.016)

    expect(harness.onCameraViewSelected).not.toHaveBeenCalled()
    expect(harness.onCameraPan).not.toHaveBeenCalled()
    expect(harness.onCameraUnlockProgressChange).not.toHaveBeenCalled()

    harness.input.updateEdgeScroll(1_000, 0.016)
    harness.input.updateEdgeScroll(1_999, 0.016)

    expect(harness.onCameraViewSelected).not.toHaveBeenCalled()
    expect(harness.onCameraPan).not.toHaveBeenCalled()

    harness.input.updateEdgeScroll(2_000, 0.016)

    expect(harness.onCameraViewSelected).toHaveBeenCalledWith('free')
    expect(harness.onCameraUnlocked).toHaveBeenCalledTimes(1)
    expect(harness.onCameraPan).toHaveBeenCalledTimes(1)
    expect(harness.getCameraView()).toBe('free')
    expect(harness.onCameraUnlockProgressChange).toHaveBeenNthCalledWith(1, {
      progress: 0,
      screenPosition: { x: 199, y: 100 },
    })
    expect(harness.onCameraUnlockProgressChange).toHaveBeenNthCalledWith(2, {
      progress: 999 / 1_000,
      screenPosition: { x: 199, y: 100 },
    })
    expect(harness.onCameraUnlockProgressChange).toHaveBeenNthCalledWith(3, {
      progress: 1,
      screenPosition: { x: 199, y: 100 },
    })
    expect(harness.onCameraUnlockProgressChange).toHaveBeenLastCalledWith(null)
  })

  it('does not enter free roam from edge dwell when camera controls are locked', () => {
    const harness = createHarness('locked', {
      cameraControlsLocked: true,
      edgeScrollEnabled: true,
    })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 199, clientY: 100 }),
    )
    harness.input.updateEdgeScroll(0, 0.016)
    harness.input.updateEdgeScroll(4_000, 0.016)

    expect(harness.onCameraViewSelected).not.toHaveBeenCalled()
    expect(harness.onCameraUnlocked).not.toHaveBeenCalled()
    expect(harness.onCameraPan).not.toHaveBeenCalled()
    expect(harness.onCameraUnlockProgressChange).not.toHaveBeenCalled()
    expect(harness.getCameraView()).toBe('locked')
  })

  it('clears edge dwell progress when the pointer leaves the edge', () => {
    const harness = createHarness('locked', {
      edgeScrollEnabled: true,
    })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 199, clientY: 100 }),
    )
    harness.input.updateEdgeScroll(0, 0.016)
    harness.input.updateEdgeScroll(1_000, 0.016)
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 100, clientY: 100 }),
    )
    harness.input.updateEdgeScroll(1_001, 0.016)

    expect(harness.onCameraViewSelected).not.toHaveBeenCalled()
    expect(harness.onCameraPan).not.toHaveBeenCalled()
    expect(harness.onCameraUnlockProgressChange).toHaveBeenLastCalledWith(null)
  })

  it('does not pan or unlock when desktop edge-scroll is disabled', () => {
    const harness = createHarness('free')

    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 199, clientY: 100 }),
    )
    harness.input.updateEdgeScroll(100, 0.1)

    expect(harness.onCameraViewSelected).not.toHaveBeenCalled()
    expect(harness.onCameraPan).not.toHaveBeenCalled()
    expect(harness.canvas.style.cursor).toBe('')
  })
})
