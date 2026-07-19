import { expect, type Page, type TestInfo, test } from '@playwright/test'

type TouchControlsModule =
  typeof import('../../src/ui/touchControls/createTouchControls')

const waitForGame = async (page: Page) => {
  await expect(page.locator('[data-boot-screen]')).toBeHidden()
  await expect(page.locator('.mobile-command-dock')).toBeVisible()
}

const isolateMobileControlLayer = async (page: Page) => {
  await page.addStyleTag({
    content: `
      html,
      body,
      #app {
        background:
          radial-gradient(circle at 50% 42%, rgba(14, 116, 144, 0.14), transparent 34%),
          #05070d !important;
      }

      canvas,
      .body-label,
      .bottom-pill-area,
      .heading-target-overlay,
      .in-game-controls-menu,
      .offscreen-indicator,
      .scenario-prompt-backdrop,
      .top-bar {
        visibility: hidden !important;
      }

      .mobile-command-dock {
        visibility: visible !important;
      }
    `,
  })
}

const captureDockState = async (options: {
  fileName: string
  open: boolean
  page: Page
  safeBottom: number
  testInfo: TestInfo
  viewport: { height: number; width: number }
}) => {
  await options.page.setViewportSize(options.viewport)
  await options.page.goto('/?scenario=earth-moon')
  await waitForGame(options.page)
  await isolateMobileControlLayer(options.page)

  if (options.safeBottom > 0) {
    await options.page
      .locator('.mobile-command-dock')
      .evaluate((element, safeBottom) => {
        element.style.setProperty(
          '--mobile-command-dock-safe-bottom',
          `${safeBottom}px`,
        )
      }, options.safeBottom)
    await options.page.locator('#app').evaluate((element, safeBottom) => {
      element.style.setProperty(
        '--mobile-command-dock-safe-bottom',
        `${safeBottom}px`,
      )
    }, options.safeBottom)
  }

  if (options.open) {
    await options.page.locator('#mobile-command-dock-flight-button').tap()
    await expect(
      options.page.locator('.mobile-command-dock-panel'),
    ).toBeVisible()
  }

  await options.page.screenshot({
    path: options.testInfo.outputPath(options.fileName),
  })
}

test('toggles the Flight panel and lets Escape close the active panel', async ({
  page,
}) => {
  await page.goto('/?scenario=earth-moon')
  await waitForGame(page)

  const flightButton = page.locator('#mobile-command-dock-flight-button')
  const flightPanel = page.locator('.mobile-command-dock-panel')

  await expect(flightButton).toHaveAttribute('aria-expanded', 'false')
  await expect(flightPanel).toBeHidden()

  await flightButton.tap()
  await expect(flightButton).toHaveAttribute('aria-expanded', 'true')
  await expect(flightPanel).toBeVisible()

  await flightButton.tap()
  await expect(flightButton).toHaveAttribute('aria-expanded', 'false')
  await expect(flightPanel).toBeHidden()

  await flightButton.tap()
  await page.keyboard.press('Escape')
  await expect(flightButton).toHaveAttribute('aria-expanded', 'false')
  await expect(flightPanel).toBeHidden()
  await expect(flightButton).toBeFocused()
})

test('keeps dock touches out of camera and heading input while the playfield remains interactive', async ({
  page,
}) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const app = document.querySelector<HTMLElement>('#app')
    if (!app) {
      throw new Error('Missing app root')
    }

    app.replaceChildren()
    app.classList.remove('app-main-menu', 'app-crashed')
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
    const cameraPans: number[] = []
    const plannedHeadings: number[] = []
    let startTargetHeadingByDrag = false
    const controls = createTouchControls({
      app,
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
      getMobileManeuverStartByDrag: () => startTargetHeadingByDrag,
      getSpacecraftVisible: () => true,
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
        setVirtualTurn: () => {},
      },
      onCameraModeSelected: () => true,
      onCameraPanGesture: () => {
        cameraPans.push(1)
        return true
      },
      onReturnToAutomaticTarget: () => true,
      onSelectTargetIndex: () => true,
      onTargetHeadingPlan: () => {
        plannedHeadings.push(1)
      },
      onTargetHeadingPlanCanceled: () => {},
      onTargetHeadingPlanCommitted: () => true,
      onThrustControlUiStateChange: () => {},
      onZoom: () => {},
    })

    const flightButton = controls.element.querySelector<HTMLButtonElement>(
      '.mobile-command-dock-item',
    )
    if (!flightButton) {
      throw new Error('Missing Flight dock button')
    }

    const dispatchTouch = (options: {
      id: number
      target: HTMLElement
      type: 'touchend' | 'touchmove' | 'touchstart'
      x: number
      y: number
    }) => {
      const touch = new Touch({
        clientX: options.x,
        clientY: options.y,
        identifier: options.id,
        target: options.target,
      })
      options.target.dispatchEvent(
        new TouchEvent(options.type, {
          bubbles: true,
          cancelable: true,
          changedTouches: [touch],
          targetTouches: options.type === 'touchend' ? [] : [touch],
          touches: options.type === 'touchend' ? [] : [touch],
        }),
      )
    }

    dispatchTouch({
      id: 31,
      target: flightButton,
      type: 'touchstart',
      x: 195,
      y: 806,
    })
    dispatchTouch({
      id: 31,
      target: flightButton,
      type: 'touchmove',
      x: 218,
      y: 784,
    })
    dispatchTouch({
      id: 31,
      target: flightButton,
      type: 'touchend',
      x: 218,
      y: 784,
    })
    const cameraPanCountAfterDockTouch = cameraPans.length
    flightButton.click()

    dispatchTouch({
      id: 32,
      target: controls.element,
      type: 'touchstart',
      x: 260,
      y: 240,
    })
    dispatchTouch({
      id: 32,
      target: controls.element,
      type: 'touchmove',
      x: 286,
      y: 266,
    })
    dispatchTouch({
      id: 32,
      target: controls.element,
      type: 'touchend',
      x: 286,
      y: 266,
    })

    startTargetHeadingByDrag = true
    dispatchTouch({
      id: 33,
      target: flightButton,
      type: 'touchstart',
      x: 195,
      y: 806,
    })
    await new Promise((resolve) => window.setTimeout(resolve, 400))
    const plannedHeadingCountAfterDockTouch = plannedHeadings.length
    dispatchTouch({
      id: 33,
      target: flightButton,
      type: 'touchend',
      x: 195,
      y: 806,
    })

    dispatchTouch({
      id: 34,
      target: controls.element,
      type: 'touchstart',
      x: 260,
      y: 240,
    })
    await new Promise((resolve) => window.setTimeout(resolve, 400))
    const plannedHeadingCountAfterPlayfieldTouch = plannedHeadings.length
    dispatchTouch({
      id: 34,
      target: controls.element,
      type: 'touchend',
      x: 260,
      y: 240,
    })

    return {
      cameraPanCountAfterDockTouch,
      cameraPanCountAfterPlayfieldTouch: cameraPans.length,
      flightPanelOpen: flightButton.getAttribute('aria-expanded'),
      plannedHeadingCountAfterDockTouch,
      plannedHeadingCountAfterPlayfieldTouch,
    }
  })

  expect(result.cameraPanCountAfterDockTouch).toBe(0)
  expect(result.cameraPanCountAfterPlayfieldTouch).toBe(1)
  expect(result.flightPanelOpen).toBe('true')
  expect(result.plannedHeadingCountAfterDockTouch).toBe(0)
  expect(result.plannedHeadingCountAfterPlayfieldTouch).toBeGreaterThan(0)
})

test('ships all dock items with only Flight enabled and its glass panel', async ({
  page,
}) => {
  await page.goto('/?scenario=earth-moon')
  await waitForGame(page)

  const dock = page.locator('.mobile-command-dock')
  const dockItems = page.locator('.mobile-command-dock-item')
  await expect(dock).toHaveAttribute('data-panel-treatment', 'glass')
  await expect(dock).toHaveAttribute('data-open', 'false')
  await expect(dockItems).toHaveCount(5)
  await expect(dockItems).toHaveText([
    'Flight',
    'Nav',
    'Mission',
    'Ship',
    'Settings',
  ])
  await expect(page.locator('.mobile-command-dock-item:disabled')).toHaveCount(
    4,
  )
  await expect(
    page.locator('.mobile-command-dock-item:not(:disabled)'),
  ).toHaveCount(1)

  const flightButton = page.locator('#mobile-command-dock-flight-button')
  await flightButton.tap()
  await expect(flightButton).toHaveAttribute('aria-expanded', 'true')
  await expect(dock).toHaveAttribute('data-open', 'true')
  await expect(page.locator('.mobile-command-dock-panel')).toBeVisible()
})

test('keeps the in-game controls popover clear of the collapsed dock', async ({
  page,
}) => {
  await page.goto('/?scenario=earth-moon')
  await waitForGame(page)
  await page.locator('.in-game-controls-menu-button').tap()

  const popoverBounds = await page
    .locator('.in-game-controls-menu-popover')
    .boundingBox()
  const dockBounds = await page
    .locator('.mobile-command-dock-bar')
    .boundingBox()
  expect(popoverBounds).not.toBeNull()
  expect(dockBounds).not.toBeNull()
  expect(
    (popoverBounds?.y ?? 0) + (popoverBounds?.height ?? 0),
  ).toBeLessThanOrEqual(dockBounds?.y ?? 0)
})

test('captures the shipped dock across portrait widths and safe areas', async ({
  page,
}, testInfo) => {
  await captureDockState({
    fileName: 'mobile-command-dock-collapsed-320.png',
    open: false,
    page,
    safeBottom: 0,
    testInfo,
    viewport: { height: 720, width: 320 },
  })

  const barBounds = await page.locator('.mobile-command-dock-bar').boundingBox()
  const itemBounds = await page
    .locator('.mobile-command-dock-item')
    .evaluateAll((items) =>
      items.map((item) => {
        const bounds = item.getBoundingClientRect()
        return { left: bounds.left, right: bounds.right }
      }),
    )
  expect(barBounds).not.toBeNull()
  expect(itemBounds).toHaveLength(5)
  expect(itemBounds[0]?.left).toBeGreaterThanOrEqual(barBounds?.x ?? 0)
  expect(itemBounds.at(-1)?.right).toBeLessThanOrEqual(
    (barBounds?.x ?? 0) + (barBounds?.width ?? 0),
  )

  await captureDockState({
    fileName: 'mobile-command-dock-flight-glass-open-safe-area-390.png',
    open: true,
    page,
    safeBottom: 24,
    testInfo,
    viewport: { height: 844, width: 390 },
  })

  await captureDockState({
    fileName: 'mobile-command-dock-flight-glass-open-safe-area-430.png',
    open: true,
    page,
    safeBottom: 34,
    testInfo,
    viewport: { height: 932, width: 430 },
  })

  const flightPanelBounds = await page
    .locator('.mobile-command-dock-panel')
    .boundingBox()
  const rcsTabBounds = await page
    .locator('#touch-rcs-yaw-reveal .touch-edge-reveal-tab')
    .boundingBox()
  const burnTabBounds = await page
    .locator('#touch-thrust-reveal .touch-edge-reveal-tab')
    .boundingBox()
  expect(flightPanelBounds).not.toBeNull()
  expect(rcsTabBounds).not.toBeNull()
  expect(burnTabBounds).not.toBeNull()
  expect((rcsTabBounds?.y ?? 0) + (rcsTabBounds?.height ?? 0)).toBeLessThan(
    flightPanelBounds?.y ?? 0,
  )
  expect((burnTabBounds?.y ?? 0) + (burnTabBounds?.height ?? 0)).toBeLessThan(
    flightPanelBounds?.y ?? 0,
  )
})

test('does not change the fine-pointer desktop layout', async ({
  baseURL,
  browser,
}) => {
  if (!baseURL) {
    throw new Error('Playwright base URL is not configured')
  }

  const context = await browser.newContext({
    baseURL,
    hasTouch: false,
    isMobile: false,
    viewport: { height: 800, width: 1280 },
  })
  const page = await context.newPage()

  try {
    await page.goto('/?scenario=earth-moon')
    await expect(page.locator('[data-boot-screen]')).toBeHidden()
    await expect(page.locator('.mobile-command-dock')).toHaveCSS(
      'display',
      'none',
    )
  } finally {
    await context.close()
  }
})
