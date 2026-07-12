import { expect, test } from '@playwright/test'

type PointerCameraInputModule =
  typeof import('../../src/input/pointerCameraInput')
type ThreeModule = typeof import('three')
type TouchControlsModule =
  typeof import('../../src/ui/touchControls/createTouchControls')

test('keeps desktop edge-scroll panning independent of heading planning visibility', async ({
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

    const runEdgeScroll = (spacecraftVisible: boolean) => {
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

      const canceledPlans: number[] = []
      const committedPlans: number[] = []
      const pans: { x: number; y: number }[] = []
      const plannedHeadings: number[] = []

      const pointerInput = bindPointerCameraInput({
        camera,
        getDesktopEdgePanSpeedPixelsPerSecond: () => 420,
        getCameraMode: () => 'unlocked',
        getCameraModeChangesLocked: () => false,
        getEdgeScrollEnabled: () => true,
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

      canvas.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          button: -1,
          buttons: 0,
          cancelable: true,
          clientX: 399,
          clientY: 200,
          isPrimary: true,
          pointerId: 17,
          pointerType: 'mouse',
        }),
      )
      pointerInput.updateEdgeScroll(100, 0.1)
      canvas.remove()

      return {
        canceledPlanCount: canceledPlans.length,
        committedPlanCount: committedPlans.length,
        panCount: pans.length,
        plannedHeadingCount: plannedHeadings.length,
      }
    }

    return {
      offscreen: runEdgeScroll(false),
      visible: runEdgeScroll(true),
    }
  })

  expect(result).toEqual({
    offscreen: {
      canceledPlanCount: 0,
      committedPlanCount: 0,
      panCount: 1,
      plannedHeadingCount: 0,
    },
    visible: {
      canceledPlanCount: 0,
      committedPlanCount: 0,
      panCount: 1,
      plannedHeadingCount: 0,
    },
  })
})

test('lets passive top HUD space hit-test to canvas while keeping the top menu interactive', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('/')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const hitTest = await page.evaluate(() => {
    const app = document.querySelector<HTMLElement>('#app')
    if (!app) {
      throw new Error('Missing app root')
    }

    app.replaceChildren()
    app.classList.remove('app-main-menu', 'app-crashed')

    const canvas = document.createElement('canvas')
    canvas.style.position = 'fixed'
    canvas.style.inset = '0'
    canvas.style.width = '100vw'
    canvas.style.height = '100vh'

    const topBar = document.createElement('div')
    topBar.className = 'top-bar'

    const topMenu = document.createElement('div')
    topMenu.className = 'top-menu'
    const topMenuButton = document.createElement('button')
    topMenuButton.type = 'button'
    topMenuButton.textContent = 'Open menu'
    topMenu.append(topMenuButton)

    const telemetry = document.createElement('div')
    telemetry.className = 'telemetry-strip'
    telemetry.textContent = 'Telemetry'

    topBar.append(topMenu, telemetry)
    app.append(canvas, topBar)

    const passiveTopTarget = document.elementFromPoint(
      window.innerWidth * 0.5,
      2,
    )
    const menuBounds = topMenuButton.getBoundingClientRect()
    const menuTarget = document.elementFromPoint(
      menuBounds.left + menuBounds.width * 0.5,
      menuBounds.top + menuBounds.height * 0.5,
    )

    return {
      menuTargetText: menuTarget?.textContent ?? '',
      menuTargetTagName: menuTarget?.tagName ?? '',
      passiveTopClassName:
        passiveTopTarget instanceof HTMLElement
          ? passiveTopTarget.className.toString()
          : '',
      passiveTopTagName: passiveTopTarget?.tagName ?? '',
    }
  })

  expect(hitTest).toEqual({
    menuTargetTagName: 'BUTTON',
    menuTargetText: 'Open menu',
    passiveTopClassName: '',
    passiveTopTagName: 'CANVAS',
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
    await new Promise((resolve) => window.setTimeout(resolve, 360))
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
