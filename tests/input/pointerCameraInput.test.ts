import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { bindPointerCameraInput } from '@/input/pointerCameraInput'
import type { CameraControlMode } from '@/scenario/scenarioDirectiveTypes'

class FakeCanvas extends EventTarget {
  capturedPointerIds: number[] = []

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

const createHarness = (cameraMode: CameraControlMode = 'centered') => {
  const canvas = new FakeCanvas()
  const windowTarget = new FakeWindow()
  const onCameraPan = vi.fn(() => true)
  const onTargetHeadingPlan = vi.fn()
  const onTargetHeadingPlanCanceled = vi.fn()
  const onTargetHeadingPlanCommitted = vi.fn(() => true)

  bindPointerCameraInput({
    camera: createCamera(),
    getCameraMode: () => cameraMode,
    getCameraModeChangesLocked: () => false,
    getInteractionsEnabled: () => true,
    getSpacecraftPosition: () => ({ x: 0, y: 0 }),
    getSpacecraftVisible: () => true,
    onCameraModeSelected: () => true,
    onCameraPan,
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
    onCameraPan,
    onTargetHeadingPlan,
    onTargetHeadingPlanCanceled,
    onTargetHeadingPlanCommitted,
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

  it('keeps drag gestures available for unlocked camera pan before planning', () => {
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
})
