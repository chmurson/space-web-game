import { expect, type Page, type TestInfo, test } from '@playwright/test'

type TouchControlsModule =
  typeof import('../../src/ui/touchControls/createTouchControls')
type MobileCommandDockModule =
  typeof import('../../src/ui/touchControls/mobileCommandDock')

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

const dispatchControlTouch = async (options: {
  id: number
  page: Page
  selector: string
  type: 'touchend' | 'touchmove' | 'touchstart'
  x: number
  y: number
}) => {
  await options.page.locator(options.selector).evaluate(
    (target, touchOptions) => {
      const touch = new Touch({
        clientX: touchOptions.x,
        clientY: touchOptions.y,
        identifier: touchOptions.id,
        target,
      })
      const activeTouches = touchOptions.type === 'touchend' ? [] : [touch]
      target.dispatchEvent(
        new TouchEvent(touchOptions.type, {
          bubbles: true,
          cancelable: true,
          changedTouches: [touch],
          targetTouches: activeTouches,
          touches: activeTouches,
        }),
      )
    },
    {
      id: options.id,
      type: options.type,
      x: options.x,
      y: options.y,
    },
  )
}

const captureDockState = async (options: {
  fileName: string
  openPanel: 'flight' | 'info' | 'nav' | null
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

  if (options.openPanel) {
    await options.page
      .locator(`#mobile-command-dock-${options.openPanel}-button`)
      .tap()
    await expect(
      options.page.locator(`#mobile-command-dock-${options.openPanel}-panel`),
    ).toBeVisible()
  }

  await options.page.screenshot({
    path: options.testInfo.outputPath(options.fileName),
  })
}

test('keeps one panel open, collapses the active panel, and closes with Escape', async ({
  page,
}) => {
  await page.goto('/?scenario=earth-moon')
  await waitForGame(page)

  const flightButton = page.locator('#mobile-command-dock-flight-button')
  const infoButton = page.locator('#mobile-command-dock-info-button')
  const navButton = page.locator('#mobile-command-dock-nav-button')
  const flightPanel = page.locator('#mobile-command-dock-flight-panel')
  const infoPanel = page.locator('#mobile-command-dock-info-panel')
  const navPanel = page.locator('#mobile-command-dock-nav-panel')

  await expect(flightButton).toHaveAttribute('aria-expanded', 'false')
  await expect(flightPanel).toBeHidden()

  await flightButton.tap()
  await expect(flightButton).toHaveAttribute('aria-expanded', 'true')
  await expect(flightPanel).toBeVisible()

  await infoButton.tap()
  await expect(flightButton).toHaveAttribute('aria-expanded', 'false')
  await expect(flightPanel).toBeHidden()
  await expect(infoButton).toHaveAttribute('aria-expanded', 'true')
  await expect(infoPanel).toBeVisible()

  await navButton.tap()
  await expect(infoButton).toHaveAttribute('aria-expanded', 'false')
  await expect(infoPanel).toBeHidden()
  await expect(navButton).toHaveAttribute('aria-expanded', 'true')
  await expect(navPanel).toBeVisible()

  await navButton.tap()
  await expect(navButton).toHaveAttribute('aria-expanded', 'false')
  await expect(navPanel).toBeHidden()

  await navButton.tap()
  await page.keyboard.press('Escape')
  await expect(navButton).toHaveAttribute('aria-expanded', 'false')
  await expect(navPanel).toBeHidden()
  await expect(navButton).toBeFocused()
})

test('switches camera Follow and recenters from the mobile Nav panel', async ({
  page,
}) => {
  await page.goto('/?scenario=earth-moon')
  await waitForGame(page)
  await page.locator('#mobile-command-dock-nav-button').tap()

  const navPanel = page.locator('#mobile-command-dock-nav-panel')
  const spacecraft = navPanel.locator(
    '[data-camera-follow-option="spacecraft"]',
  )
  const target = navPanel.locator('[data-camera-follow-option="target"]')
  const recenter = navPanel.locator('[data-mobile-camera-action="recenter"]')

  await expect(spacecraft).toHaveAttribute('aria-pressed', 'true')
  await expect(recenter).toBeDisabled()
  await expect(recenter).toHaveAccessibleName(
    'Camera already centered on followed subject',
  )
  await expect(page.locator('[data-camera-view-option]')).toHaveCount(0)
  await target.tap()
  await expect(target).toHaveAttribute('aria-pressed', 'true')
  await expect(spacecraft).toHaveAttribute('aria-pressed', 'false')
  await expect(navPanel.locator('[data-mobile-camera-status]')).toHaveCount(0)
  await expect(recenter).toBeDisabled()
  await expect(target).toHaveAttribute('aria-pressed', 'true')
})

test('recenters selected target framing above Nav using the current playable viewport', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await page.goto('/?scenario=earth-moon&devtools=1')
  await waitForGame(page)
  await page.waitForFunction(() => Boolean(window.__SPACE_WEB_GAME_DEVTOOLS__))
  const infoButton = page.locator('#mobile-command-dock-info-button')
  await infoButton.tap()
  await page
    .locator('#mobile-command-dock-info-panel [data-info-pin="body:earth"]')
    .tap()
  await infoButton.tap()
  await page.evaluate(() => {
    const response = window.__SPACE_WEB_GAME_DEVTOOLS__?.handleRequest({
      follow: 'target',
      type: 'set-camera-follow',
    })
    if (!response?.ok) {
      throw new Error(response?.error ?? 'Devtools bridge is missing')
    }
  })
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.body-label')).some(
      (label) => getComputedStyle(label).display !== 'none',
    ),
  )

  const dock = page.locator('.mobile-command-dock')
  const targetLabel = page.locator('.body-label-active-target')
  await expect(targetLabel).toBeVisible()
  const collapsedDockBounds = await dock.boundingBox()
  const collapsedTargetBounds = await targetLabel.boundingBox()
  if (!collapsedDockBounds || !collapsedTargetBounds) {
    throw new Error('Collapsed camera framing elements are missing')
  }
  const collapsedTargetCenterY =
    collapsedTargetBounds.y + collapsedTargetBounds.height * 0.5

  await page.locator('#mobile-command-dock-nav-button').tap()
  await expect(page.locator('#mobile-command-dock-nav-panel')).toBeVisible()
  await expect
    .poll(async () =>
      page.evaluate(
        () => window.__SPACE_WEB_GAME_DEVTOOLS__?.getSnapshot().camera.follow,
      ),
    )
    .toBe('target')

  await expect
    .poll(async () => {
      const openDockBounds = await dock.boundingBox()
      const openTargetBounds = await targetLabel.boundingBox()
      if (!openDockBounds || !openTargetBounds) {
        throw new Error('Open camera framing elements are missing')
      }
      const openTargetCenterY =
        openTargetBounds.y + openTargetBounds.height * 0.5
      const expectedShift =
        (openDockBounds.height - collapsedDockBounds.height) * 0.5
      const actualShift = collapsedTargetCenterY - openTargetCenterY
      return Math.abs(expectedShift - actualShift)
    })
    .toBeLessThan(3)

  const openTargetBounds = await targetLabel.boundingBox()
  if (!openTargetBounds) {
    throw new Error('Open target camera framing is missing')
  }
  const openTargetCenterY = openTargetBounds.y + openTargetBounds.height * 0.5

  await page.screenshot({
    path: testInfo.outputPath('mobile-command-dock-locked-target-390.png'),
  })

  await page.evaluate(() => {
    const response = window.__SPACE_WEB_GAME_DEVTOOLS__?.handleRequest({
      type: 'recenter-camera',
    })
    if (!response?.ok) {
      throw new Error(response?.error ?? 'Devtools bridge is missing')
    }
  })
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          window.__SPACE_WEB_GAME_DEVTOOLS__?.getSnapshot().camera.panOffset,
      ),
    )
    .toEqual({ x: 0, y: 0 })
  await expect
    .poll(async () => {
      const recenteredTargetBounds = await targetLabel.boundingBox()
      if (!recenteredTargetBounds) {
        throw new Error('Recentered target camera framing is missing')
      }
      const recenteredTargetCenterY =
        recenteredTargetBounds.y + recenteredTargetBounds.height * 0.5
      return Math.abs(openTargetCenterY - recenteredTargetCenterY)
    })
    .toBeLessThan(3)

  await page.screenshot({
    path: testInfo.outputPath('mobile-command-dock-recentered-target-390.png'),
  })
})

test('keeps Time Warp and camera controls together in Nav', async ({
  page,
}) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const modulePath = '/src/ui/touchControls/mobileCommandDock.tsx'
    const { createMobileCommandDock } = (await import(
      modulePath
    )) as MobileCommandDockModule
    const app = document.createElement('div')
    const container = document.createElement('div')
    const cameraActions: string[] = []
    let cameraCanRecenter = false
    let cameraControlsLocked = false
    let cameraFollow: 'spacecraft' | 'target' = 'spacecraft'
    document.body.append(app, container)

    const dock = createMobileCommandDock({
      app,
      container,
      getCameraCanRecenter: () => cameraCanRecenter,
      getCameraControlsLocked: () => cameraControlsLocked,
      getCameraFollow: () => cameraFollow,
      onCameraFollowSelect: (follow) => {
        cameraFollow = follow
        cameraActions.push(`follow:${follow}`)
      },
      onCameraRecenter: () => cameraActions.push('recenter'),
    })
    dock.setTimeWarpState({
      reason: null,
      status: '',
      tone: 'available',
    })
    dock.setOpenPanel('nav')
    dock.setTutorialFocused('warp')
    const tutorialFocusWhileAlreadyOpen = dock.element.dataset.tutorialFocused
    dock.setControlAvailability({
      rcsYaw: true,
      thrust: true,
      timeWarp: false,
    })
    dock.setControlAvailability({
      rcsYaw: true,
      thrust: true,
      timeWarp: true,
    })
    const timeWarpAvailableAfterRestore = dock.element
      .querySelector('.mobile-command-dock-nav-time-warp')
      ?.getAttribute('data-available')

    dock.setOpenPanel(null)
    dock.setTutorialFocused('warp')
    const targetButton = dock.element.querySelector<HTMLButtonElement>(
      '[data-camera-follow-option="target"]',
    )
    const recenterButton = dock.element.querySelector<HTMLButtonElement>(
      '[data-mobile-camera-action="recenter"]',
    )
    const recenterDisabledInitial = recenterButton?.disabled
    const recenterAriaLabelInitial = recenterButton?.getAttribute('aria-label')
    cameraCanRecenter = true
    dock.syncState()
    const recenterButtonAfterPan =
      dock.element.querySelector<HTMLButtonElement>(
        '[data-mobile-camera-action="recenter"]',
      )
    const recenterDisabledAfterPan = recenterButtonAfterPan?.disabled
    const recenterPressableAfterPan =
      recenterButtonAfterPan?.classList.contains('ui-pressable-strong')
    targetButton?.click()
    recenterButtonAfterPan?.click()
    cameraControlsLocked = true
    dock.syncState()

    return {
      cameraActions,
      cameraControlCount: dock.element.querySelectorAll(
        '[data-camera-follow-option]',
      ).length,
      cameraFollow: dock.element.dataset.cameraFollow,
      recenterDisabled: (
        dock.element.querySelector(
          '[data-mobile-camera-action="recenter"]',
        ) as HTMLButtonElement | null
      )?.disabled,
      recenterAriaLabelInitial,
      recenterDisabledAfterPan,
      recenterDisabledInitial,
      recenterPressableAfterPan,
      openPanel: app.dataset.mobileCommandDockPanel,
      timeWarpAvailableAfterRestore,
      timeWarpStatus: dock.element.querySelector(
        '.mobile-command-dock-time-warp-status',
      )?.textContent,
      tutorialFocus: dock.element.dataset.tutorialFocused,
      tutorialFocusWhileAlreadyOpen,
    }
  })

  expect(result).toEqual({
    cameraActions: ['follow:target', 'recenter'],
    cameraControlCount: 2,
    cameraFollow: 'target',
    recenterAriaLabelInitial: 'Camera already centered on followed subject',
    recenterDisabledAfterPan: false,
    recenterDisabledInitial: true,
    recenterDisabled: true,
    recenterPressableAfterPan: true,
    openPanel: 'nav',
    timeWarpAvailableAfterRestore: 'true',
    timeWarpStatus: '',
    tutorialFocus: 'warp',
    tutorialFocusWhileAlreadyOpen: 'warp',
  })
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
      getCameraCanRecenter: () => true,
      getCameraControlsLocked: () => false,
      getCameraFollow: () => 'spacecraft',
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
      initialTargetControlSide: 'left',
      initialTrajectoryControlSide: 'hidden',
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
      onCameraPanGesture: () => {
        cameraPans.push(1)
        return true
      },
      onCameraFollowSelect: () => {},
      onCameraRecenter: () => {},
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
    const navButton = controls.element.querySelector<HTMLButtonElement>(
      '#mobile-command-dock-nav-button',
    )
    const navPanel = controls.element.querySelector<HTMLElement>(
      '#mobile-command-dock-nav-panel',
    )
    if (!flightButton || !navButton || !navPanel) {
      throw new Error('Missing dock interaction targets')
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

    navButton.click()
    dispatchTouch({
      id: 35,
      target: navPanel,
      type: 'touchstart',
      x: 260,
      y: 650,
    })
    dispatchTouch({
      id: 35,
      target: navPanel,
      type: 'touchmove',
      x: 286,
      y: 676,
    })
    dispatchTouch({
      id: 35,
      target: navPanel,
      type: 'touchend',
      x: 286,
      y: 676,
    })
    const cameraPanCountAfterNavTouch = cameraPans.length

    startTargetHeadingByDrag = true
    dispatchTouch({
      id: 33,
      target: navPanel,
      type: 'touchstart',
      x: 195,
      y: 650,
    })
    await new Promise((resolve) => window.setTimeout(resolve, 400))
    const plannedHeadingCountAfterDockTouch = plannedHeadings.length
    dispatchTouch({
      id: 33,
      target: navPanel,
      type: 'touchend',
      x: 195,
      y: 650,
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
      cameraPanCountAfterNavTouch,
      cameraPanCountAfterPlayfieldTouch: cameraPans.length,
      flightPanelOpen: flightButton.getAttribute('aria-expanded'),
      navPanelOpen: navButton.getAttribute('aria-expanded'),
      plannedHeadingCountAfterDockTouch,
      plannedHeadingCountAfterPlayfieldTouch,
    }
  })

  expect(result.cameraPanCountAfterDockTouch).toBe(0)
  expect(result.cameraPanCountAfterNavTouch).toBe(1)
  expect(result.cameraPanCountAfterPlayfieldTouch).toBe(1)
  expect(result.flightPanelOpen).toBe('false')
  expect(result.navPanelOpen).toBe('true')
  expect(result.plannedHeadingCountAfterDockTouch).toBe(0)
  expect(result.plannedHeadingCountAfterPlayfieldTouch).toBeGreaterThan(0)
})

test('ships Flight, Info, and Nav as available dock panels', async ({
  page,
}) => {
  await page.goto('/?scenario=earth-moon')
  await waitForGame(page)

  const dock = page.locator('.mobile-command-dock')
  const dockItems = page.locator('.mobile-command-dock-item')
  await expect(dock).toHaveAttribute('data-open', 'false')
  await expect(dockItems).toHaveCount(5)
  await expect(dockItems).toHaveText([
    'Flight',
    'Info',
    'Nav',
    'Ship',
    'Settings',
  ])
  await expect(page.locator('.mobile-command-dock-item:disabled')).toHaveCount(
    2,
  )
  await expect(
    page.locator('.mobile-command-dock-item:not(:disabled)'),
  ).toHaveCount(3)

  const flightButton = page.locator('#mobile-command-dock-flight-button')
  await flightButton.tap()
  await expect(flightButton).toHaveAttribute('aria-expanded', 'true')
  await expect(dock).toHaveAttribute('data-open', 'true')
  const flightPanel = page.locator('#mobile-command-dock-flight-panel')
  await expect(flightPanel).toBeVisible()
  await expect(flightPanel).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(flightPanel).toHaveCSS('box-shadow', 'none')
  await expect(
    flightPanel.locator(
      '.mobile-command-dock-panel-heading, .mobile-command-dock-flight-control-label, .touch-rcs-yaw-control-header, .touch-rcs-yaw-control-close',
    ),
  ).toHaveCount(0)

  const navButton = page.locator('#mobile-command-dock-nav-button')
  await navButton.tap()
  const navPanel = page.locator('#mobile-command-dock-nav-panel')
  await expect(flightPanel).toBeHidden()
  await expect(navPanel).toBeVisible()
  await expect(navPanel.getByLabel('Time Warp', { exact: true })).toBeVisible()
  await expect(navPanel.getByRole('group', { name: 'Follow' })).toBeVisible()
  await expect(navPanel.locator('[data-camera-follow-option]')).toHaveCount(2)
  await expect(
    navPanel.getByRole('button', {
      name: 'Camera already centered on followed subject',
    }),
  ).toBeVisible()
  await expect(navPanel.locator('[data-camera-view-option]')).toHaveCount(0)
  await expect(navPanel).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(
    page.locator('#touch-time-warp-reveal, #touch-time-warp-prototype-reveal'),
  ).toHaveCount(0)
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
    openPanel: null,
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
    fileName: 'mobile-command-dock-flight-open-320.png',
    openPanel: 'flight',
    page,
    safeBottom: 0,
    testInfo,
    viewport: { height: 720, width: 320 },
  })

  await captureDockState({
    fileName: 'mobile-command-dock-flight-open-safe-area-390.png',
    openPanel: 'flight',
    page,
    safeBottom: 24,
    testInfo,
    viewport: { height: 844, width: 390 },
  })

  await captureDockState({
    fileName: 'mobile-command-dock-flight-open-safe-area-430.png',
    openPanel: 'flight',
    page,
    safeBottom: 34,
    testInfo,
    viewport: { height: 932, width: 430 },
  })

  const flightPanelBounds = await page
    .locator('#mobile-command-dock-flight-panel')
    .boundingBox()
  const rcsControlBounds = await page
    .locator('#mobile-command-dock-flight-panel .touch-rcs-yaw-control')
    .boundingBox()
  const thrustControlBounds = await page
    .locator('#mobile-command-dock-flight-panel .touch-thrust-control')
    .boundingBox()
  const rcsTrackBounds = await page
    .locator('#mobile-command-dock-flight-panel .touch-rcs-yaw-control-track')
    .boundingBox()
  const thrustTrackBounds = await page
    .locator('#mobile-command-dock-flight-panel .touch-thrust-control-track')
    .boundingBox()
  expect(flightPanelBounds).not.toBeNull()
  expect(rcsControlBounds).not.toBeNull()
  expect(thrustControlBounds).not.toBeNull()
  expect(rcsTrackBounds).not.toBeNull()
  expect(thrustTrackBounds).not.toBeNull()
  const leftInset = (rcsControlBounds?.x ?? 0) - (flightPanelBounds?.x ?? 0)
  const rightInset =
    (flightPanelBounds?.x ?? 0) +
    (flightPanelBounds?.width ?? 0) -
    ((thrustControlBounds?.x ?? 0) + (thrustControlBounds?.width ?? 0))
  expect(leftInset).toBeGreaterThanOrEqual(8)
  expect(leftInset).toBeLessThanOrEqual(16)
  expect(Math.abs(leftInset - rightInset)).toBeLessThanOrEqual(1)
  expect(rcsTrackBounds?.width ?? 0).toBeGreaterThanOrEqual(160)
  expect(rcsTrackBounds?.width ?? 0).toBeLessThanOrEqual(168)
  expect(thrustTrackBounds?.height ?? 0).toBeGreaterThanOrEqual(114)
  expect(thrustTrackBounds?.height ?? 0).toBeLessThanOrEqual(120)
  expect(
    Math.abs((rcsTrackBounds?.width ?? 0) - (thrustTrackBounds?.height ?? 0)),
  ).toBeLessThanOrEqual(52)
  expect(rcsControlBounds?.x ?? 0).toBeGreaterThanOrEqual(
    flightPanelBounds?.x ?? 0,
  )
  expect(
    (rcsControlBounds?.x ?? 0) + (rcsControlBounds?.width ?? 0),
  ).toBeLessThanOrEqual(thrustControlBounds?.x ?? 0)
  expect(
    (thrustControlBounds?.x ?? 0) + (thrustControlBounds?.width ?? 0),
  ).toBeLessThanOrEqual(
    (flightPanelBounds?.x ?? 0) + (flightPanelBounds?.width ?? 0),
  )
  const trackMaterials = await page
    .locator(
      '#mobile-command-dock-flight-panel .touch-rcs-yaw-control-track, #mobile-command-dock-flight-panel .touch-thrust-control-track',
    )
    .evaluateAll((tracks) =>
      tracks.map((track) => {
        const style = getComputedStyle(track)
        return {
          backdropFilter: style.backdropFilter,
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          borderColor: style.borderColor,
          boxShadow: style.boxShadow,
        }
      }),
    )
  expect(trackMaterials).toHaveLength(2)
  expect(trackMaterials[0]).toEqual(trackMaterials[1])
  expect(trackMaterials[0]?.backgroundColor).toBe('rgba(8, 13, 24, 0.46)')
  await expect(
    page.locator('#touch-rcs-yaw-reveal, #touch-thrust-reveal'),
  ).toHaveCount(0)

  await captureDockState({
    fileName: 'mobile-command-dock-nav-open-320.png',
    openPanel: 'nav',
    page,
    safeBottom: 0,
    testInfo,
    viewport: { height: 720, width: 320 },
  })
  await captureDockState({
    fileName: 'mobile-command-dock-nav-open-safe-area-390.png',
    openPanel: 'nav',
    page,
    safeBottom: 24,
    testInfo,
    viewport: { height: 844, width: 390 },
  })
  await captureDockState({
    fileName: 'mobile-command-dock-nav-open-safe-area-430.png',
    openPanel: 'nav',
    page,
    safeBottom: 34,
    testInfo,
    viewport: { height: 932, width: 430 },
  })

  const navPanelBounds = await page
    .locator('#mobile-command-dock-nav-panel')
    .boundingBox()
  const timeWarpBounds = await page.getByLabel('Time Warp').boundingBox()
  expect(navPanelBounds).not.toBeNull()
  expect(timeWarpBounds).not.toBeNull()
  expect(timeWarpBounds?.x ?? 0).toBeGreaterThanOrEqual(navPanelBounds?.x ?? 0)
  expect(
    (timeWarpBounds?.y ?? 0) + (timeWarpBounds?.height ?? 0),
  ).toBeLessThanOrEqual(
    (navPanelBounds?.y ?? 0) + (navPanelBounds?.height ?? 0),
  )
  await expect(page.locator('.mobile-command-dock-nav-camera')).toBeVisible()
})

test('captures active RCS and hit-tested Main Thrust inside Flight', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await page.goto('/?scenario=earth-moon')
  await waitForGame(page)
  await isolateMobileControlLayer(page)
  await page.locator('#mobile-command-dock-flight-button').tap()

  const rcsSelector = '.touch-rcs-yaw-control-track'
  const rcsBounds = await page.locator(rcsSelector).boundingBox()
  if (!rcsBounds) {
    throw new Error('Missing docked RCS bounds')
  }
  const rcsStartX = rcsBounds.x + rcsBounds.width / 2
  const rcsY = rcsBounds.y + rcsBounds.height / 2
  await dispatchControlTouch({
    id: 71,
    page,
    selector: rcsSelector,
    type: 'touchstart',
    x: rcsStartX,
    y: rcsY,
  })
  await dispatchControlTouch({
    id: 71,
    page,
    selector: rcsSelector,
    type: 'touchmove',
    x: rcsStartX + 46,
    y: rcsY,
  })
  await expect(page.locator('.touch-rcs-yaw-control')).toHaveClass(
    /touch-rcs-yaw-control-active/,
  )
  await page.screenshot({
    path: testInfo.outputPath('mobile-command-dock-rcs-active-390.png'),
  })
  await dispatchControlTouch({
    id: 71,
    page,
    selector: rcsSelector,
    type: 'touchend',
    x: rcsStartX + 46,
    y: rcsY,
  })

  const thrustSelector = '.touch-thrust-control-thumb'
  const thrustBounds = await page.locator(thrustSelector).boundingBox()
  if (!thrustBounds) {
    throw new Error('Missing docked Main Thrust bounds')
  }
  const thrustX = thrustBounds.x + thrustBounds.width / 2
  const thrustStartY = thrustBounds.y + thrustBounds.height / 2
  const thrustReceivesHitTesting = await page.evaluate(
    ({ x, y }) =>
      document.elementFromPoint(x, y)?.closest('.touch-thrust-control') !==
      null,
    { x: thrustX, y: thrustStartY },
  )
  expect(thrustReceivesHitTesting).toBe(true)

  const cdpSession = await page.context().newCDPSession(page)
  await cdpSession.send('Input.dispatchTouchEvent', {
    touchPoints: [{ id: 72, x: thrustX, y: thrustStartY }],
    type: 'touchStart',
  })
  for (const step of [1, 2, 3, 4]) {
    await cdpSession.send('Input.dispatchTouchEvent', {
      touchPoints: [
        {
          id: 72,
          x: thrustX,
          y: thrustStartY - (56 * step) / 4,
        },
      ],
      type: 'touchMove',
    })
  }
  await expect(page.locator('.touch-thrust-control')).toHaveClass(
    /touch-thrust-control-on/,
  )
  await cdpSession.send('Input.dispatchTouchEvent', {
    touchPoints: [],
    type: 'touchEnd',
  })
  await cdpSession.detach()
  await page.screenshot({
    path: testInfo.outputPath('mobile-command-dock-main-thrust-active-390.png'),
  })

  await page.locator('#mobile-command-dock-flight-button').tap()
  await expect(page.locator('.touch-thrust-control')).not.toHaveClass(
    /touch-thrust-control-on/,
  )
})

test('captures normal, capped, and blocked Time Warp feedback in Nav', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await page.goto('/?scenario=earth-moon')
  await waitForGame(page)
  await isolateMobileControlLayer(page)
  await page.locator('#mobile-command-dock-nav-button').tap()

  const status = page.locator('.mobile-command-dock-time-warp-status')
  const timeWarp = page.getByLabel('Time Warp', { exact: true })
  await expect(status).toHaveText('Minimum rate reached')
  await expect(status).toHaveClass(/mobile-command-dock-visually-hidden/)
  await expect(page.locator('[data-mobile-time-warp-current]')).toHaveCount(0)
  await page.screenshot({
    path: testInfo.outputPath('mobile-command-dock-nav-warp-capped-390.png'),
  })

  const bounds = await timeWarp.boundingBox()
  if (!bounds) {
    throw new Error('Missing Time Warp bounds')
  }
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  await page.mouse.move(centerX, centerY)
  await page.mouse.down()
  await page.mouse.move(centerX - 56, centerY, { steps: 4 })
  await page.waitForTimeout(80)
  await page.mouse.up()
  await expect(status).toBeEmpty()
  await page.screenshot({
    path: testInfo.outputPath('mobile-command-dock-nav-warp-normal-390.png'),
  })

  const currentTimeWarp = page.locator(
    '.touch-step-selector-horizontal-step.touch-step-selector-current .touch-step-selector-value',
  )
  for (let step = 0; step < 8; step += 1) {
    if ((await currentTimeWarp.textContent()) === 'x1m') {
      break
    }
    await page.mouse.move(centerX, centerY)
    await page.mouse.down()
    await page.mouse.move(centerX - 56, centerY, { steps: 4 })
    await page.waitForTimeout(80)
    await page.mouse.up()
  }
  await expect(currentTimeWarp).toHaveText('x1m')

  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        code: 'KeyW',
        key: 'w',
      }),
    )
  })
  await expect(status).toHaveText('Main thrust blocks faster rates')
  await page.screenshot({
    path: testInfo.outputPath('mobile-command-dock-nav-warp-blocked-390.png'),
  })
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent('keyup', {
        bubbles: true,
        code: 'KeyW',
        key: 'w',
      }),
    )
  })
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
    await page.getByRole('button', { name: 'Open in-game controls' }).click()
    const controlsDialog = page.getByRole('dialog', {
      name: 'In-game controls',
    })
    await expect(
      controlsDialog.getByRole('group', { name: 'Follow' }),
    ).toBeVisible()
    await expect(
      controlsDialog.getByRole('button', {
        name: 'Camera already centered on followed subject',
      }),
    ).toBeVisible()
  } finally {
    await context.close()
  }
})
