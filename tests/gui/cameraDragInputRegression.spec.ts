import { expect, test } from '@playwright/test'

type PointerCameraInputModule =
  typeof import('../../src/input/pointerCameraInput')
type ThreeModule = typeof import('three')
type TouchControlsModule =
  typeof import('../../src/ui/touchControls/createTouchControls')

test('starts mobile panning on the first touch movement', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const touchControlsModulePath =
      '/src/ui/touchControls/createTouchControls.ts'
    const { createTouchControls } = (await import(
      touchControlsModulePath
    )) as TouchControlsModule
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
      getCameraCanRecenter: () => true,
      getCameraControlsLocked: () => false,
      getCameraFollow: () => 'spacecraft',
      getCurrentTimeWarp: () => 1,
      getCurrentTrajectoryHorizonHours: () => 1,
      getInteractionsEnabled: () => true,
      getTargetControlRows: () => [],
      getTimeWarpPreview: () => ({
        canCommit: true,
        reason: null,
        value: 1,
      }),
      getTimeWarpPreviews: () => [],
      getTrajectoryHorizonPreviews: () => [],
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
        setVirtualTurn: () => {},
      },
      onCameraPanGesture: (previous, next) => {
        cameraPans.push({ next, previous })
        return true
      },
      onCameraFollowSelect: () => {},
      onCameraRecenter: () => {},
      onReturnToAutomaticTarget: () => true,
      onSelectTargetIndex: () => true,
      onThrustControlUiStateChange: () => {},
      onZoom: () => {},
    })
    document.body.append(controls.element)

    const dispatchTouch = (
      type: 'touchmove' | 'touchstart',
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
          targetTouches: [touch],
          touches: [touch],
        }),
      )
    }

    dispatchTouch('touchstart', { x: 20, y: 100 })
    dispatchTouch('touchmove', { x: 230, y: 100 })
    const panCountOnFirstMove = cameraPans.length
    dispatchTouch('touchmove', { x: 250, y: 100 })

    controls.element.remove()
    return {
      cameraPans,
      panCountOnFirstMove,
    }
  })

  expect(result.panCountOnFirstMove).toBe(1)
  expect(result.cameraPans).toEqual([
    {
      next: { x: 230, y: 100 },
      previous: { x: 20, y: 100 },
    },
    {
      next: { x: 250, y: 100 },
      previous: { x: 230, y: 100 },
    },
  ])
})

test('keeps desktop edge-scroll panning active at the viewport edge', async ({
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

    const runEdgeScroll = () => {
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

      const pans: { x: number; y: number }[] = []

      const pointerInput = bindPointerCameraInput({
        camera,
        getDesktopCameraInputEnabled: () => true,
        getDesktopCameraInteractionsEnabled: () => true,
        getDesktopCameraPanMode: () => 'edge',
        getDesktopEdgePanSpeedPixelsPerSecond: () => 420,
        getCameraControlsLocked: () => false,
        getInteractionsEnabled: () => true,
        onCameraPan: (delta) => {
          pans.push(delta)
          return true
        },
        onResize: () => {},
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

      return pans.length
    }

    return runEdgeScroll()
  })

  expect(result).toBe(1)
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
