import { type Browser, expect, type TestInfo, test } from '@playwright/test'

const createDesktopPage = async (browser: Browser, testInfo: TestInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    colorScheme: 'dark',
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    reducedMotion: 'reduce',
    viewport: { height: 720, width: 1280 },
  })
  return { context, page: await context.newPage() }
}

test('keeps browser zoom keys separate while modified wheel zoom belongs to the game', async ({
  browser,
}, testInfo) => {
  const { context, page } = await createDesktopPage(browser, testInfo)

  try {
    await page.goto('/?scenario=earth-moon&devtools=1')
    await expect(page.locator('[data-boot-screen]')).toBeHidden()
    await page.waitForFunction(() =>
      Boolean(window.__SPACE_WEB_GAME_DEVTOOLS__),
    )

    const result = await page.evaluate(() => {
      const getViewportSize = () =>
        window.__SPACE_WEB_GAME_DEVTOOLS__?.getSnapshot().simulation
          .viewportSize ?? null
      const getPanOffset = () =>
        window.__SPACE_WEB_GAME_DEVTOOLS__?.getSnapshot().camera.panOffset ??
        null
      const dispatchKey = (options: {
        code: string
        ctrlKey?: boolean
        key: string
        metaKey?: boolean
      }) => {
        const keydownAllowed = window.dispatchEvent(
          new KeyboardEvent('keydown', {
            ...options,
            bubbles: true,
            cancelable: true,
          }),
        )
        window.dispatchEvent(
          new KeyboardEvent('keyup', {
            ...options,
            bubbles: true,
          }),
        )
        return keydownAllowed
      }
      const canvas = document.querySelector('canvas')
      if (!canvas) {
        throw new Error('Game canvas is missing')
      }
      const dispatchWheel = (options: {
        ctrlKey?: boolean
        metaKey?: boolean
      }) =>
        canvas.dispatchEvent(
          new WheelEvent('wheel', {
            ...options,
            bubbles: true,
            cancelable: true,
            deltaY: -120,
          }),
        )

      const initialViewportSize = getViewportSize()
      const initialPanOffset = getPanOffset()
      const browserKeyEventsAllowed = [
        dispatchKey({ code: 'Equal', ctrlKey: true, key: '+' }),
        dispatchKey({ code: 'Minus', key: '-', metaKey: true }),
      ]
      const viewportSizeAfterBrowserKeys = getViewportSize()
      const modifiedWheelEventsAllowed = [
        dispatchWheel({ ctrlKey: true }),
        dispatchWheel({ metaKey: true }),
      ]
      const viewportSizeAfterModifiedWheel = getViewportSize()

      dispatchKey({ code: 'Equal', key: '+' })

      return {
        browserKeyEventsAllowed,
        initialViewportSize,
        initialPanOffset,
        modifiedWheelEventsAllowed,
        panOffsetAfterModifiedWheel: getPanOffset(),
        viewportSizeAfterBrowserKeys,
        viewportSizeAfterModifiedWheel,
        viewportSizeAfterPlainGameZoom: getViewportSize(),
      }
    })

    expect(result.initialViewportSize).not.toBeNull()
    expect(result.browserKeyEventsAllowed).toEqual([true, true])
    expect(result.viewportSizeAfterBrowserKeys).toBe(result.initialViewportSize)
    expect(result.modifiedWheelEventsAllowed).toEqual([false, false])
    expect(result.viewportSizeAfterModifiedWheel).toBeLessThan(
      result.viewportSizeAfterBrowserKeys ?? 0,
    )
    expect(result.panOffsetAfterModifiedWheel).toEqual(result.initialPanOffset)
    expect(result.viewportSizeAfterPlainGameZoom).toBeLessThan(
      result.viewportSizeAfterModifiedWheel ?? 0,
    )
  } finally {
    await context.close()
  }
})

test('routes Chromium trackpad pinch wheel events through every pan mode', async ({
  browser,
}, testInfo) => {
  const { context, page } = await createDesktopPage(browser, testInfo)

  try {
    await page.goto('/?scenario=earth-moon&devtools=1')
    await expect(page.locator('[data-boot-screen]')).toBeHidden()

    for (const panMode of ['wheel', 'drag', 'edge'] as const) {
      await page.evaluate((nextPanMode) => {
        const storageKey = 'space-web-game.userSettings.v1'
        const storedSettings = JSON.parse(
          window.localStorage.getItem(storageKey) ?? '{}',
        ) as Record<string, unknown>
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({
            ...storedSettings,
            desktopCameraPanMode: nextPanMode,
          }),
        )
      }, panMode)
      await page.reload()
      await expect(page.locator('[data-boot-screen]')).toBeHidden()
      await page.waitForFunction(() =>
        Boolean(window.__SPACE_WEB_GAME_DEVTOOLS__),
      )

      const result = await page.evaluate(() => {
        const getCameraState = () => {
          const snapshot = window.__SPACE_WEB_GAME_DEVTOOLS__?.getSnapshot()
          return {
            panOffset: snapshot?.camera.panOffset ?? null,
            viewportSize: snapshot?.simulation.viewportSize ?? null,
          }
        }
        const canvas = document.querySelector('canvas')
        if (!canvas) {
          throw new Error('Game canvas is missing')
        }

        const zoomInScale = 1.1
        const zoomOutScale = 1 / zoomInScale
        const initialState = getCameraState()
        const zoomInEventAllowed = canvas.dispatchEvent(
          new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
            deltaY: -100 * Math.log(zoomInScale),
          }),
        )
        const stateAfterZoomIn = getCameraState()
        const zoomOutEventAllowed = canvas.dispatchEvent(
          new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            ctrlKey: true,
            deltaY: -100 * Math.log(zoomOutScale),
          }),
        )

        return {
          eventAllowed: [zoomInEventAllowed, zoomOutEventAllowed],
          initialState,
          pinchZoomStrength: 2,
          stateAfterZoomIn,
          stateAfterZoomOut: getCameraState(),
          zoomInScale,
        }
      })

      expect(result.initialState.viewportSize, panMode).not.toBeNull()
      expect(result.eventAllowed, panMode).toEqual([false, false])
      expect(result.stateAfterZoomIn.viewportSize, panMode).toBeCloseTo(
        (result.initialState.viewportSize ?? 0) /
          result.zoomInScale ** result.pinchZoomStrength,
        8,
      )
      expect(result.stateAfterZoomOut.viewportSize, panMode).toBeCloseTo(
        result.initialState.viewportSize ?? 0,
        8,
      )
      expect(result.stateAfterZoomIn.panOffset, panMode).toEqual(
        result.initialState.panOffset,
      )
      expect(result.stateAfterZoomOut.panOffset, panMode).toEqual(
        result.initialState.panOffset,
      )
    }
  } finally {
    await context.close()
  }
})

test('keeps a modifier-release wheel tail in zoom until the gesture is idle', async ({
  browser,
}, testInfo) => {
  const { context, page } = await createDesktopPage(browser, testInfo)

  try {
    await page.goto('/?scenario=earth-moon&devtools=1')
    await expect(page.locator('[data-boot-screen]')).toBeHidden()
    await page.waitForFunction(() =>
      Boolean(window.__SPACE_WEB_GAME_DEVTOOLS__),
    )

    const result = await page.evaluate(async () => {
      const canvas = document.querySelector('canvas')
      if (!canvas) {
        throw new Error('Game canvas is missing')
      }
      const getCameraState = () => {
        const snapshot = window.__SPACE_WEB_GAME_DEVTOOLS__?.getSnapshot()
        return {
          panOffset: snapshot?.camera.panOffset ?? null,
          viewportSize: snapshot?.simulation.viewportSize ?? null,
        }
      }
      const dispatchWheel = (ctrlKey: boolean, deltaY: number) =>
        canvas.dispatchEvent(
          new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            ctrlKey,
            deltaY,
          }),
        )

      const initialState = getCameraState()
      const modifiedWheelAllowed = dispatchWheel(true, -120)
      const tailWheelAllowed = dispatchWheel(false, -80)
      const stateAfterTail = getCameraState()

      await new Promise((resolve) => setTimeout(resolve, 150))
      const postIdleWheelAllowed = dispatchWheel(false, 40)

      return {
        initialState,
        modifiedWheelAllowed,
        postIdleWheelAllowed,
        stateAfterIdlePan: getCameraState(),
        stateAfterTail,
        tailWheelAllowed,
      }
    })

    expect(result.modifiedWheelAllowed).toBe(false)
    expect(result.tailWheelAllowed).toBe(false)
    expect(result.stateAfterTail.viewportSize).toBeLessThan(
      result.initialState.viewportSize ?? 0,
    )
    expect(result.stateAfterTail.panOffset).toEqual(
      result.initialState.panOffset,
    )
    expect(result.postIdleWheelAllowed).toBe(false)
    expect(result.stateAfterIdlePan.viewportSize).toBe(
      result.stateAfterTail.viewportSize,
    )
    expect(result.stateAfterIdlePan.panOffset).not.toEqual(
      result.stateAfterTail.panOffset,
    )
  } finally {
    await context.close()
  }
})

test('routes diagonal wheel pan only while the desktop game surface owns input', async ({
  browser,
}, testInfo) => {
  const { context, page } = await createDesktopPage(browser, testInfo)

  try {
    await page.goto('/?scenario=earth-moon&devtools=1')
    await expect(page.locator('[data-boot-screen]')).toBeHidden()
    await page.waitForFunction(() =>
      Boolean(window.__SPACE_WEB_GAME_DEVTOOLS__),
    )

    const getCameraState = () =>
      page.evaluate(() => {
        const snapshot = window.__SPACE_WEB_GAME_DEVTOOLS__?.getSnapshot()
        return {
          panOffset: snapshot?.camera.panOffset ?? null,
          viewportSize: snapshot?.simulation.viewportSize ?? null,
        }
      })
    const dispatchWheel = (
      locator: ReturnType<typeof page.locator>,
      deltaX: number,
      deltaY: number,
    ) =>
      locator.evaluate(
        (element, delta) =>
          element.dispatchEvent(
            new WheelEvent('wheel', {
              bubbles: true,
              cancelable: true,
              deltaX: delta.x,
              deltaY: delta.y,
            }),
          ),
        { x: deltaX, y: deltaY },
      )

    const canvas = page.locator('canvas')
    const initialState = await getCameraState()
    const canvasWheelAllowed = await dispatchWheel(canvas, 64, 48)
    const stateAfterCanvasWheel = await getCameraState()

    expect(canvasWheelAllowed).toBe(false)
    expect(stateAfterCanvasWheel.viewportSize).toBe(initialState.viewportSize)
    expect(stateAfterCanvasWheel.panOffset?.x).not.toBe(
      initialState.panOffset?.x,
    )
    expect(stateAfterCanvasWheel.panOffset?.y).not.toBe(
      initialState.panOffset?.y,
    )

    await page.getByRole('button', { name: 'Open in-game controls' }).click()
    const controlsMenu = page.getByRole('dialog', {
      name: 'In-game controls',
    })
    await expect(controlsMenu).toBeVisible()

    const gatedCanvasWheelAllowed = await dispatchWheel(canvas, 80, 80)
    const scrollableMenuWheelAllowed = await dispatchWheel(controlsMenu, 0, 80)
    const stateWithControlsOpen = await getCameraState()

    expect(gatedCanvasWheelAllowed).toBe(true)
    expect(scrollableMenuWheelAllowed).toBe(true)
    expect(stateWithControlsOpen).toEqual(stateAfterCanvasWheel)

    await page.getByRole('button', { name: 'UI settings' }).click()
    const uiSettingsDialog = page.getByRole('dialog', { name: 'UI settings' })
    await expect(uiSettingsDialog).toBeVisible()

    const dialogWheelAllowed = await dispatchWheel(uiSettingsDialog, 40, 40)
    const dialogGatedCanvasWheelAllowed = await dispatchWheel(canvas, 40, 40)

    expect(dialogWheelAllowed).toBe(true)
    expect(dialogGatedCanvasWheelAllowed).toBe(true)
    expect(await getCameraState()).toEqual(stateAfterCanvasWheel)
  } finally {
    await context.close()
  }
})

test('keeps wheel-mode context-menu ownership on the canvas', async ({
  browser,
}, testInfo) => {
  const { context, page } = await createDesktopPage(browser, testInfo)

  try {
    await page.goto('/?scenario=earth-moon&devtools=1')
    await expect(page.locator('[data-boot-screen]')).toBeHidden()

    const canvas = page.locator('canvas')
    const hudButton = page.getByRole('button', {
      name: 'Open in-game controls',
    })
    await page.evaluate(() => {
      document.documentElement.dataset.contextMenuDefaultPrevented = '[]'
      window.addEventListener('contextmenu', (event) => {
        const results = JSON.parse(
          document.documentElement.dataset.contextMenuDefaultPrevented ?? '[]',
        ) as boolean[]
        results.push(event.defaultPrevented)
        document.documentElement.dataset.contextMenuDefaultPrevented =
          JSON.stringify(results)
      })
    })
    await canvas.click({
      button: 'right',
      position: { x: 640, y: 400 },
    })
    await hudButton.click({ button: 'right' })
    const stationaryContextMenusPrevented = await page.evaluate(
      () =>
        JSON.parse(
          document.documentElement.dataset.contextMenuDefaultPrevented ?? '[]',
        ) as boolean[],
    )

    const result = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      if (!canvas) {
        throw new Error('Game canvas is missing')
      }

      const dispatchPointer = (
        type: string,
        options: { button: number; clientX: number; clientY: number },
      ) =>
        canvas.dispatchEvent(
          new PointerEvent(type, {
            ...options,
            bubbles: true,
            cancelable: true,
            isPrimary: true,
            pointerId: 41,
            pointerType: 'mouse',
          }),
        )
      const dispatchContextMenu = (target: EventTarget, button = 2) => {
        const event = new PointerEvent('contextmenu', {
          bubbles: true,
          button,
          cancelable: true,
          pointerType: 'mouse',
        })
        target.dispatchEvent(event)
        return !event.defaultPrevented
      }
      const hudButton = document.querySelector(
        'button[aria-label="Open in-game controls"]',
      )
      if (!hudButton) {
        throw new Error('In-game controls button is missing')
      }

      const keyboardContextMenuAllowed = dispatchContextMenu(hudButton, 0)

      dispatchPointer('pointerdown', {
        button: 2,
        clientX: 640,
        clientY: 400,
      })
      const cursorWhileHeld = getComputedStyle(canvas).cursor
      dispatchPointer('pointermove', {
        button: 2,
        clientX: 680,
        clientY: 400,
      })
      const cursorWhilePanning = getComputedStyle(canvas).cursor
      dispatchPointer('pointerup', {
        button: 2,
        clientX: 680,
        clientY: 400,
      })
      const cursorAfterRelease = getComputedStyle(canvas).cursor
      const handledDragContextMenuAllowed = dispatchContextMenu(canvas)
      const bodyContextMenuAllowed = dispatchContextMenu(document.body)

      return {
        bodyContextMenuAllowed,
        cursorAfterRelease,
        cursorWhileHeld,
        cursorWhilePanning,
        handledDragContextMenuAllowed,
        keyboardContextMenuAllowed,
      }
    })

    expect(stationaryContextMenusPrevented).toEqual([true, false])
    expect(result).toEqual({
      bodyContextMenuAllowed: true,
      cursorAfterRelease: 'auto',
      cursorWhileHeld: 'move',
      cursorWhilePanning: 'move',
      handledDragContextMenuAllowed: false,
      keyboardContextMenuAllowed: true,
    })
  } finally {
    await context.close()
  }
})
