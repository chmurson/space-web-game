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

test('owns right-button fallback cursor and context menu only for accepted wheel-mode pan', async ({
  browser,
}, testInfo) => {
  const { context, page } = await createDesktopPage(browser, testInfo)

  try {
    await page.goto('/?scenario=earth-moon&devtools=1')
    await expect(page.locator('[data-boot-screen]')).toBeHidden()

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
      const dispatchBodyContextMenu = () => {
        const event = new PointerEvent('contextmenu', {
          bubbles: true,
          button: 2,
          cancelable: true,
          pointerType: 'mouse',
        })
        document.body.dispatchEvent(event)
        return !event.defaultPrevented
      }

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
      const handledDragContextMenuAllowed = dispatchBodyContextMenu()
      const laterContextMenuAllowed = dispatchBodyContextMenu()

      dispatchPointer('pointerdown', {
        button: 2,
        clientX: 640,
        clientY: 400,
      })
      dispatchPointer('pointerup', {
        button: 2,
        clientX: 640,
        clientY: 400,
      })
      const stationaryContextMenuAllowed = dispatchBodyContextMenu()

      return {
        cursorAfterRelease,
        cursorWhileHeld,
        cursorWhilePanning,
        handledDragContextMenuAllowed,
        laterContextMenuAllowed,
        stationaryContextMenuAllowed,
      }
    })

    expect(result).toEqual({
      cursorAfterRelease: 'auto',
      cursorWhileHeld: 'move',
      cursorWhilePanning: 'move',
      handledDragContextMenuAllowed: false,
      laterContextMenuAllowed: true,
      stationaryContextMenuAllowed: true,
    })
  } finally {
    await context.close()
  }
})
