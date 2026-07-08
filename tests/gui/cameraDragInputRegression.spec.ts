import { expect, test } from '@playwright/test'

type PointerCameraInputModule =
  typeof import('../../src/input/pointerCameraInput')
type ThreeModule = typeof import('three')
type TouchControlsModule =
  typeof import('../../src/ui/touchControls/createTouchControls')

test('keeps desktop pointer camera panning when spacecraft visibility blocks heading planning', async ({
  page,
}) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const pointerCameraInputModulePath = '/src/input/pointerCameraInput.ts'
    const threeModulePath = '/node_modules/three/build/three.module.js'
    const { bindPointerCameraInput } = (await import(
      pointerCameraInputModulePath
    )) as PointerCameraInputModule
    const THREE = (await import(threeModulePath)) as ThreeModule

    const runDrag = (visibility: {
      beforePointerDown: boolean
      beforePointerMove: boolean
    }) => {
      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 400
      canvas.style.width = '400px'
      canvas.style.height = '400px'
      Object.defineProperty(canvas, 'getBoundingClientRect', {
        value: () => ({
          bottom: 400,
          height: 400,
          left: 0,
          right: 400,
          top: 0,
          width: 400,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      })
      document.body.append(canvas)

      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)
      camera.position.set(0, 10, 10)
      camera.lookAt(0, 0, 0)
      camera.updateMatrixWorld()
      camera.updateProjectionMatrix()

      let spacecraftVisible = visibility.beforePointerDown
      const canceledPlans: number[] = []
      const committedPlans: number[] = []
      const pans: { x: number; y: number }[] = []
      const plannedHeadings: number[] = []

      bindPointerCameraInput({
        camera,
        getCameraMode: () => 'unlocked',
        getCameraModeChangesLocked: () => false,
        getInteractionsEnabled: () => true,
        getSpacecraftPosition: () => ({ x: 0, y: 0 }),
        getSpacecraftVisible: () => spacecraftVisible,
        getTargetHeadingSelectionEnabled: () => true,
        onCameraModeSelected: () => true,
        onCameraPan: (delta) => {
          pans.push(delta)
          return true
        },
        onResize: () => {},
        onTargetHeadingPlan: (heading) => {
          plannedHeadings.push(heading)
        },
        onTargetHeadingPlanCanceled: () => {
          canceledPlans.push(1)
        },
        onTargetHeadingPlanCommitted: () => {
          committedPlans.push(1)
          return true
        },
        onZoom: () => {},
        renderScale: 1,
        rendererElement: canvas,
        windowTarget: window,
      })

      const dispatchPointer = (
        type: 'pointerdown' | 'pointermove' | 'pointerup',
        point: { x: number; y: number },
      ) => {
        canvas.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            button: type === 'pointerdown' ? 0 : -1,
            buttons: type === 'pointerup' ? 0 : 1,
            cancelable: true,
            clientX: point.x,
            clientY: point.y,
            isPrimary: true,
            pointerId: 17,
            pointerType: 'mouse',
          }),
        )
      }

      dispatchPointer('pointerdown', { x: 100, y: 100 })
      spacecraftVisible = visibility.beforePointerMove
      dispatchPointer('pointermove', { x: 140, y: 118 })
      dispatchPointer('pointerup', { x: 140, y: 118 })
      canvas.remove()

      return {
        canceledPlanCount: canceledPlans.length,
        committedPlanCount: committedPlans.length,
        panCount: pans.length,
        plannedHeadingCount: plannedHeadings.length,
      }
    }

    return {
      offscreenAtStart: runDrag({
        beforePointerDown: false,
        beforePointerMove: false,
      }),
      offscreenBeforeMove: runDrag({
        beforePointerDown: true,
        beforePointerMove: false,
      }),
    }
  })

  expect(result).toEqual({
    offscreenAtStart: {
      canceledPlanCount: 0,
      committedPlanCount: 0,
      panCount: 1,
      plannedHeadingCount: 0,
    },
    offscreenBeforeMove: {
      canceledPlanCount: 0,
      committedPlanCount: 0,
      panCount: 1,
      plannedHeadingCount: 0,
    },
  })
})

test('keeps mobile touch camera panning offscreen while preserving visible heading planning', async ({
  page,
}) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const touchControlsModulePath =
      '/src/ui/touchControls/createTouchControls.ts'
    const { createTouchControls } = (await import(
      touchControlsModulePath
    )) as TouchControlsModule

    const createHarness = (spacecraftVisibleAtStart: boolean) => {
      const spacecraftVisible = spacecraftVisibleAtStart
      const body = {
        color: '#38BDF8',
        id: 'earth',
        mass: 1,
        name: 'Earth',
        position: { x: 0, y: 0 },
        radius: 1,
        velocity: { x: 0, y: 0 },
      }
      const cameraPans: {
        next: { x: number; y: number }
        previous: { x: number; y: number }
      }[] = []
      const canceledPlans: number[] = []
      const committedPlans: number[] = []
      const plannedPoints: { x: number; y: number }[] = []
      const controls = createTouchControls({
        app: document.body,
        automaticTargetingAvailable: true,
        commitTimeWarp: () => {},
        commitTrajectoryHorizon: () => {},
        getAssistTargetUiState: () => ({
          activeTarget: body,
          mode: 'auto',
          recommendedTarget: null,
        }),
        getCameraMode: () => 'unlocked',
        getCameraModeChangesLocked: () => false,
        getCurrentTimeWarp: () => 1,
        getCurrentTrajectoryHorizonHours: () => 1,
        getInteractionsEnabled: () => true,
        getMobileManeuverStartByDrag: () => true,
        getSpacecraftVisible: () => spacecraftVisible,
        getTargetControlRows: () => [],
        getTimeWarpPreview: () => ({
          canCommit: true,
          reason: null,
          value: 1,
        }),
        getTimeWarpPreviews: () => [],
        getTrajectoryHorizonPreviews: () => [],
        initialBurnControlSide: 'right',
        initialTargetControlSide: 'left',
        initialTrajectoryControlSide: 'hidden',
        initialWarpControlSide: 'right',
        keyboardInput: {
          clear: () => {},
          getManualControls: () => ({
            main: 0,
            reverse: 0,
            strafe: 0,
            turn: 0,
          }),
          hasManualTurn: () => false,
          press: () => {},
          release: () => {},
          setVirtualKey: () => {},
        },
        onCameraModeSelected: () => true,
        onCameraPanGesture: (previous, next) => {
          cameraPans.push({ next, previous })
          return true
        },
        onReturnToAutomaticTarget: () => true,
        onSelectTargetIndex: () => true,
        onTargetHeadingPlan: (x, y) => {
          plannedPoints.push({ x, y })
        },
        onTargetHeadingPlanCanceled: () => {
          canceledPlans.push(1)
        },
        onTargetHeadingPlanCommitted: () => {
          committedPlans.push(1)
          return true
        },
        onTargetStateChange: () => {},
        onThrustControlUiStateChange: () => {},
        onZoom: () => {},
      })
      document.body.append(controls.element)

      const dispatchTouch = (
        type: 'touchend' | 'touchmove' | 'touchstart',
        point: { x: number; y: number },
      ) => {
        const touch = new Touch({
          clientX: point.x,
          clientY: point.y,
          identifier: 31,
          target: controls.element,
        })
        controls.element.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            changedTouches: [touch],
            targetTouches: type === 'touchend' ? [] : [touch],
            touches: type === 'touchend' ? [] : [touch],
          }),
        )
      }

      return {
        cameraPans,
        canceledPlans,
        committedPlans,
        dispatchTouch,
        plannedPoints,
        remove: () => controls.element.remove(),
      }
    }

    const offscreen = createHarness(false)
    offscreen.dispatchTouch('touchstart', { x: 100, y: 120 })
    offscreen.dispatchTouch('touchmove', { x: 134, y: 150 })
    offscreen.dispatchTouch('touchend', { x: 134, y: 150 })
    const offscreenSummary = {
      canceledPlanCount: offscreen.canceledPlans.length,
      committedPlanCount: offscreen.committedPlans.length,
      panCount: offscreen.cameraPans.length,
      plannedPointCount: offscreen.plannedPoints.length,
    }
    offscreen.remove()

    const visible = createHarness(true)
    visible.dispatchTouch('touchstart', { x: 100, y: 120 })
    await new Promise((resolve) => window.setTimeout(resolve, 220))
    visible.dispatchTouch('touchmove', { x: 104, y: 122 })
    visible.dispatchTouch('touchend', { x: 104, y: 122 })
    const visibleSummary = {
      canceledPlanCount: visible.canceledPlans.length,
      committedPlanCount: visible.committedPlans.length,
      panCount: visible.cameraPans.length,
      plannedPointCount: visible.plannedPoints.length,
    }
    visible.remove()

    return {
      offscreen: offscreenSummary,
      visible: visibleSummary,
    }
  })

  expect(result).toEqual({
    offscreen: {
      canceledPlanCount: 0,
      committedPlanCount: 0,
      panCount: 1,
      plannedPointCount: 0,
    },
    visible: {
      canceledPlanCount: 0,
      committedPlanCount: 1,
      panCount: 0,
      plannedPointCount: 2,
    },
  })
})
