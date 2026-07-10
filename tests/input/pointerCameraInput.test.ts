import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { bindPointerCameraInput } from '@/input/pointerCameraInput'
import type { CameraControlMode } from '@/scenario/scenarioDirectiveTypes'

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
  initialCameraMode: CameraControlMode = 'centered',
  options: {
    cameraModeChangesLocked?: boolean
    edgePanSpeedPixelsPerSecond?: number
    edgeScrollEnabled?: boolean
  } = {},
) => {
  const canvas = new FakeCanvas()
  const windowTarget = new FakeWindow()
  let cameraMode = initialCameraMode
  let cameraModeChangesLocked = options.cameraModeChangesLocked ?? false
  let edgeScrollEnabled = options.edgeScrollEnabled ?? false
  const onCameraPan = vi.fn<(delta: { x: number; y: number }) => boolean>(
    () => true,
  )
  const onCameraModeSelected = vi.fn((mode: CameraControlMode) => {
    if (cameraModeChangesLocked) {
      return false
    }
    cameraMode = mode
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
    getCameraMode: () => cameraMode,
    getCameraModeChangesLocked: () => cameraModeChangesLocked,
    getEdgeScrollEnabled: () => edgeScrollEnabled,
    getInteractionsEnabled: () => true,
    getSpacecraftPosition: () => ({ x: 0, y: 0 }),
    getSpacecraftVisible: () => true,
    onCameraModeSelected,
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
    getCameraMode: () => cameraMode,
    input,
    onCameraModeSelected,
    onCameraPan,
    onCameraUnlockProgressChange,
    onCameraUnlocked,
    onTargetHeadingPlan,
    onTargetHeadingPlanCanceled,
    onTargetHeadingPlanCommitted,
    setCameraModeChangesLocked: (locked: boolean) => {
      cameraModeChangesLocked = locked
    },
    setEdgeScrollEnabled: (enabled: boolean) => {
      edgeScrollEnabled = enabled
    },
  }
}

describe('bindPointerCameraInput target heading planning', () => {
  it('plans on first primary click, updates on mouse move, and commits on second primary click', () => {
    const harness = createHarness()

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 100, clientY: 100 }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 100, clientY: 100 }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', {
        clientX: 120,
        clientY: 100,
        pointerId: 2,
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', {
        clientX: 120,
        clientY: 100,
        pointerId: 3,
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', {
        clientX: 120,
        clientY: 100,
        pointerId: 3,
      }),
    )

    expect(harness.onTargetHeadingPlan).toHaveBeenCalledTimes(2)
    expect(harness.onTargetHeadingPlanCommitted).toHaveBeenCalledTimes(1)
    expect(harness.onTargetHeadingPlanCanceled).not.toHaveBeenCalled()
    expect(harness.onCameraPan).not.toHaveBeenCalled()
  })

  it('updates preview but does not commit when the second gesture drags past tolerance', () => {
    const harness = createHarness()

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 100, clientY: 100 }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 100, clientY: 100 }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pointerId: 2,
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', {
        clientX: 140,
        clientY: 100,
        pointerId: 2,
      }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', {
        clientX: 140,
        clientY: 100,
        pointerId: 2,
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
      createPointerEvent('pointerdown', { clientX: 100, clientY: 100 }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointerup', { clientX: 100, clientY: 100 }),
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

  it('uses desktop drag gestures for unlocked camera pan when edge-scroll is disabled', () => {
    const harness = createHarness('unlocked')

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

  it('does not use desktop drag gestures for unlocked camera pan while edge-scroll is enabled', () => {
    const harness = createHarness('unlocked', {
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
    const harness = createHarness('centered')

    harness.canvas.dispatchEvent(
      createPointerEvent('pointerdown', { clientX: 100, clientY: 100 }),
    )
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 201, clientY: 100 }),
    )

    expect(harness.onCameraModeSelected).toHaveBeenCalledWith('unlocked')
    expect(harness.onCameraUnlocked).toHaveBeenCalledTimes(1)
    expect(harness.onCameraPan).toHaveBeenCalledTimes(1)
  })

  it('keeps touch drag gestures available for unlocked camera pan before planning', () => {
    const harness = createHarness('unlocked')

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
  it('pans from an edge while the camera is unlocked', () => {
    const harness = createHarness('unlocked', {
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

  it('pans upward from the top edge while the camera is unlocked', () => {
    const harness = createHarness('unlocked', {
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
    const harness = createHarness('unlocked', {
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
    const slow = createHarness('unlocked', {
      edgePanSpeedPixelsPerSecond: 280,
      edgeScrollEnabled: true,
    })
    const fast = createHarness('unlocked', {
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

  it('waits for edge dwell before unlocking and panning locked cameras', () => {
    const harness = createHarness('centered', {
      edgeScrollEnabled: true,
    })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 199, clientY: 100 }),
    )
    harness.input.updateEdgeScroll(0, 0.016)
    harness.input.updateEdgeScroll(2_999, 0.016)

    expect(harness.onCameraModeSelected).not.toHaveBeenCalled()
    expect(harness.onCameraPan).not.toHaveBeenCalled()

    harness.input.updateEdgeScroll(3_000, 0.016)

    expect(harness.onCameraModeSelected).toHaveBeenCalledWith('unlocked')
    expect(harness.onCameraUnlocked).toHaveBeenCalledTimes(1)
    expect(harness.onCameraPan).toHaveBeenCalledTimes(1)
    expect(harness.getCameraMode()).toBe('unlocked')
    expect(harness.onCameraUnlockProgressChange).toHaveBeenNthCalledWith(1, {
      progress: 0,
      screenPosition: { x: 199, y: 100 },
    })
    expect(harness.onCameraUnlockProgressChange).toHaveBeenNthCalledWith(2, {
      progress: 2_999 / 3_000,
      screenPosition: { x: 199, y: 100 },
    })
    expect(harness.onCameraUnlockProgressChange).toHaveBeenNthCalledWith(3, {
      progress: 1,
      screenPosition: { x: 199, y: 100 },
    })
    expect(harness.onCameraUnlockProgressChange).toHaveBeenLastCalledWith(null)
  })

  it('does not unlock from edge dwell when camera mode changes are locked', () => {
    const harness = createHarness('target', {
      cameraModeChangesLocked: true,
      edgeScrollEnabled: true,
    })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 199, clientY: 100 }),
    )
    harness.input.updateEdgeScroll(0, 0.016)
    harness.input.updateEdgeScroll(4_000, 0.016)

    expect(harness.onCameraModeSelected).not.toHaveBeenCalled()
    expect(harness.onCameraUnlocked).not.toHaveBeenCalled()
    expect(harness.onCameraPan).not.toHaveBeenCalled()
    expect(harness.onCameraUnlockProgressChange).not.toHaveBeenCalled()
    expect(harness.getCameraMode()).toBe('target')
  })

  it('clears edge dwell progress when the pointer leaves the edge', () => {
    const harness = createHarness('centered', {
      edgeScrollEnabled: true,
    })

    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 199, clientY: 100 }),
    )
    harness.input.updateEdgeScroll(0, 0.016)
    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 100, clientY: 100 }),
    )
    harness.input.updateEdgeScroll(1_000, 0.016)

    expect(harness.onCameraModeSelected).not.toHaveBeenCalled()
    expect(harness.onCameraPan).not.toHaveBeenCalled()
    expect(harness.onCameraUnlockProgressChange).toHaveBeenLastCalledWith(null)
  })

  it('does not pan or unlock when desktop edge-scroll is disabled', () => {
    const harness = createHarness('unlocked')

    harness.canvas.dispatchEvent(
      createPointerEvent('pointermove', { clientX: 199, clientY: 100 }),
    )
    harness.input.updateEdgeScroll(100, 0.1)

    expect(harness.onCameraModeSelected).not.toHaveBeenCalled()
    expect(harness.onCameraPan).not.toHaveBeenCalled()
    expect(harness.canvas.style.cursor).toBe('')
  })
})
