import { expect, type Page, type TestInfo, test } from '@playwright/test'

const screenshotCss = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }

  canvas,
  .body-label,
  .heading-target-dot,
  .heading-target-overlay,
  .offscreen-indicator,
  .spacecraft-callout,
  .spacecraft-icon-thrust {
    visibility: hidden !important;
  }
`

const attachMobileScreenshot = async (
  page: Page,
  testInfo: TestInfo,
  name: string,
) => {
  const screenshotPath = testInfo.outputPath(`${name}.png`)
  const screenshot = await page.screenshot({
    animations: 'disabled',
    fullPage: false,
    path: screenshotPath,
  })

  await testInfo.attach(name, {
    contentType: 'image/png',
    path: screenshotPath,
  })
  expect(screenshot.byteLength).toBeGreaterThan(5_000)
}

const expectWorldVisualsSuppressed = async (page: Page) => {
  await expect(page.locator('canvas')).toHaveCSS('visibility', 'hidden')
  await expect(page.locator('.spacecraft-callout')).toHaveCSS(
    'visibility',
    'hidden',
  )
}

const openReachMoonMainMenu = async (page: Page) => {
  await page.goto('/?reachmoon=1')
  await page.addStyleTag({ content: screenshotCss })

  await expect(page.locator('[data-boot-screen]')).toBeHidden()
  await expect(page.locator('.main-menu')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tutorial' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Reach the Moon' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Load Game' })).toBeDisabled()
  await expectWorldVisualsSuppressed(page)
}

const startReachMoonMission = async (page: Page) => {
  await openReachMoonMainMenu(page)

  await page.getByRole('button', { name: 'Reach the Moon' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(
    page.getByRole('heading', { name: 'Reach the Moon' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Start mission' }).click()
  await expect(page.locator('.scenario-prompt')).toBeHidden()
  await expect(page.locator('.touch-controls')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Mission Brief' }),
  ).toBeVisible()
  await expectWorldVisualsSuppressed(page)
}

test('captures the mobile main menu HUD with world visuals suppressed', async ({
  page,
}, testInfo) => {
  await openReachMoonMainMenu(page)

  await attachMobileScreenshot(page, testInfo, 'mobile-main-menu')
})

test('captures the mobile Reach the Moon menu transition', async ({
  page,
}, testInfo) => {
  await openReachMoonMainMenu(page)

  await page.getByRole('button', { name: 'Reach the Moon' }).click()
  await expect(page.locator('[data-main-menu-view="reach-moon"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Highscores' })).toBeVisible()

  await attachMobileScreenshot(page, testInfo, 'mobile-reach-moon-menu')

  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.locator('[data-main-menu-view="main"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tutorial' })).toBeVisible()
})

test('captures the mobile tutorial coach prompt transition', async ({
  page,
}, testInfo) => {
  await openReachMoonMainMenu(page)

  await page.getByRole('button', { name: 'Tutorial' }).click()
  await expect(page.locator('.main-menu')).toBeHidden()
  await expect(
    page.getByRole('heading', { name: 'Leave Earth Orbit' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Start' }).click()
  await expect(
    page.getByRole('heading', { name: 'Open Burn Control' }),
  ).toBeVisible()
  await expect(page.locator('.scenario-prompt-backdrop')).toHaveAttribute(
    'data-prompt-mode',
    'coach',
  )
  await expect(page.locator('.scenario-prompt')).toHaveAttribute(
    'data-anchor',
    'thrust-control',
  )

  await attachMobileScreenshot(page, testInfo, 'mobile-tutorial-coach-prompt')
})

test('captures the mobile Reach the Moon replay pill transition', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)
  await expect(page.locator('.scenario-prompt-pill')).toBeVisible()

  await attachMobileScreenshot(page, testInfo, 'mobile-reach-moon-replay-pill')
})

test('refreshes stale main menu load state when the snapshot disappears', async ({
  page,
}) => {
  await page.goto('/?reachmoon=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(async () => {
    const mainMenuModulePath = '/src/ui/createMainMenu.ts'
    const debugSnapshotModulePath = '/src/debugScenarioSnapshot.ts'
    const { createMainMenu } = await import(mainMenuModulePath)
    const { clearDebugScenarioSnapshot, writeDebugScenarioSnapshot } =
      await import(debugSnapshotModulePath)
    const app = document.createElement('div')
    const events: string[] = []

    document.body.append(app)
    writeDebugScenarioSnapshot({
      version: 1,
      savedAt: new Date(0).toISOString(),
      elapsed: 0,
      bodies: [],
      spacecraft: {},
    })

    const menu = createMainMenu({
      app,
      reachMoonFeatureEnabled: false,
      onFreeRoam: () => events.push('free-roam'),
      onLoadGame: () => events.push('load'),
      onReachMoon: () => events.push('reach-moon'),
      onTutorial: () => events.push('tutorial'),
    })
    const loadButton = menu.element.querySelector(
      '[data-main-menu-action="load"]',
    ) as HTMLButtonElement | null
    const initiallyDisabled = loadButton?.disabled

    clearDebugScenarioSnapshot()
    loadButton?.click()
    const refreshedLoadButton = menu.element.querySelector(
      '[data-main-menu-action="load"]',
    ) as HTMLButtonElement | null

    return {
      displayAfterStaleClick: menu.element.style.display,
      disabledAfterStaleClick: refreshedLoadButton?.disabled,
      events,
      initiallyDisabled,
    }
  })

  expect(result).toEqual({
    displayAfterStaleClick: 'flex',
    disabledAfterStaleClick: true,
    events: [],
    initiallyDisabled: false,
  })
})

test('keeps the crash menu adapter state, focus, and keyboard behavior', async ({
  page,
}) => {
  await page.goto('/?reachmoon=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(async () => {
    const crashMenuModulePath = '/src/ui/createCrashMenu.ts'
    const debugSnapshotModulePath = '/src/debugScenarioSnapshot.ts'
    const { createCrashMenu } = await import(crashMenuModulePath)
    const { clearDebugScenarioSnapshot, writeDebugScenarioSnapshot } =
      await import(debugSnapshotModulePath)
    const app = document.createElement('div')
    const beforeButton = document.createElement('button')
    const events: string[] = []

    beforeButton.textContent = 'Before crash'
    document.body.append(beforeButton, app)
    beforeButton.focus()
    writeDebugScenarioSnapshot({
      version: 1,
      savedAt: new Date(0).toISOString(),
      elapsed: 0,
      bodies: [],
      spacecraft: {},
    })

    const menu = createCrashMenu({
      app,
      onExit: () => events.push('exit'),
      onLoadGame: () => events.push('load'),
      onRestart: () => events.push('restart'),
      onRestartFromCheckpoint: () => events.push('checkpoint'),
    })
    const getAction = () =>
      document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.crashMenuAction
        : undefined
    const dispatchKey = (init: KeyboardEventInit) =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          ...init,
        }),
      )

    menu.syncState({ crashedBodyName: 'Moon', hasCheckpoint: true })
    menu.setVisible(true)
    const checkpointButton = menu.element.querySelector(
      '[data-crash-menu-action="checkpoint"]',
    ) as HTMLButtonElement | null
    const restartButton = menu.element.querySelector(
      '[data-crash-menu-action="restart"]',
    ) as HTMLButtonElement | null
    const loadButton = menu.element.querySelector(
      '[data-crash-menu-action="load"]',
    ) as HTMLButtonElement | null
    const exitButton = menu.element.querySelector(
      '[data-crash-menu-action="exit"]',
    ) as HTMLButtonElement | null
    const activeAfterShow = checkpointButton === document.activeElement
    const checkpointHidden = checkpointButton?.hidden
    const checkpointPrimary = checkpointButton?.classList.contains(
      'crash-menu-primary-action',
    )
    const loadHidden = loadButton?.hidden
    const restartPrimary = restartButton?.classList.contains(
      'crash-menu-primary-action',
    )
    const description = menu.element.querySelector(
      '#crash-menu-description',
    )?.textContent
    const title = menu.element.querySelector('#crash-menu-title')?.textContent

    loadButton?.click()
    clearDebugScenarioSnapshot()
    loadButton?.click()
    const loadHiddenAfterStaleClick = (
      menu.element.querySelector(
        '[data-crash-menu-action="load"]',
      ) as HTMLButtonElement | null
    )?.hidden
    dispatchKey({ code: 'KeyR', key: 'r' })
    exitButton?.focus()
    dispatchKey({ key: 'Tab' })
    const focusAfterForwardTrap = getAction()
    checkpointButton?.focus()
    dispatchKey({ key: 'Tab', shiftKey: true })
    const focusAfterBackwardTrap = getAction()
    dispatchKey({ key: 'Escape' })
    menu.setVisible(false)
    const restoredFocusText = document.activeElement?.textContent

    clearDebugScenarioSnapshot()
    menu.syncState({ crashedBodyName: null, hasCheckpoint: false })
    menu.setVisible(true)
    const activeAfterNoCheckpointShow = getAction()
    dispatchKey({ code: 'KeyR', key: 'r' })

    return {
      activeAfterNoCheckpointShow,
      activeAfterShow,
      checkpointHidden,
      checkpointPrimary,
      description,
      events,
      focusAfterBackwardTrap,
      focusAfterForwardTrap,
      loadHiddenAfterStaleClick,
      loadHidden,
      panelFound: Boolean(menu.element.querySelector('.crash-menu-panel')),
      restoredFocusText,
      restartPrimary,
      role: menu.element.getAttribute('role'),
      title,
    }
  })

  expect(result).toEqual({
    activeAfterNoCheckpointShow: 'restart',
    activeAfterShow: true,
    checkpointHidden: false,
    checkpointPrimary: true,
    description:
      'Impact with Moon ended this run. Restart to try the approach again.',
    events: ['load', 'checkpoint', 'exit', 'restart'],
    focusAfterBackwardTrap: 'exit',
    focusAfterForwardTrap: 'checkpoint',
    loadHiddenAfterStaleClick: true,
    loadHidden: false,
    panelFound: true,
    restoredFocusText: 'Before crash',
    restartPrimary: false,
    role: 'dialog',
    title: 'Crashed into Moon',
  })
})

test('keeps the top menu adapter state, focus, keyboard, and debug behavior', async ({
  page,
}) => {
  await page.goto('/?reachmoon=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(async () => {
    const topMenuModulePath = '/src/ui/createTopMenu.ts'
    const debugSnapshotModulePath = '/src/debugScenarioSnapshot.ts'
    const { createTopMenu } = await import(topMenuModulePath)
    const { clearDebugScenarioSnapshot, writeDebugScenarioSnapshot } =
      await import(debugSnapshotModulePath)
    const app = document.createElement('div')
    const topBar = document.createElement('div')
    const telemetry = document.createElement('div')
    const outsideButton = document.createElement('button')
    const events: string[] = []
    let debugModeEnabled = false
    let fpsIndicatorEnabled = false

    topBar.className = 'top-bar'
    telemetry.className = 'telemetry-strip'
    outsideButton.textContent = 'Outside'
    topBar.append(telemetry)
    app.append(topBar)
    document.body.append(app, outsideButton)
    clearDebugScenarioSnapshot()

    const menu = createTopMenu({
      app,
      getDebugModeEnabled: () => debugModeEnabled,
      getFpsIndicatorEnabled: () => fpsIndicatorEnabled,
      onAction: (action: string) => {
        events.push(action)
        if (action === 'toggleDebugMode') {
          debugModeEnabled = !debugModeEnabled
        }
        if (action === 'toggleFpsIndicator') {
          fpsIndicatorEnabled = !fpsIndicatorEnabled
        }
      },
    })
    const getButton = () =>
      menu.element.querySelector('.top-menu-button') as HTMLButtonElement | null
    const getDropdown = () =>
      menu.element.querySelector('.top-menu-dropdown') as HTMLDivElement | null
    const getActionButton = (action: string) =>
      menu.element.querySelector(
        `[data-menu-action="${action}"]`,
      ) as HTMLButtonElement | null
    const getActiveAction = () =>
      document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.menuAction
        : undefined
    const pressActiveKey = (key: string) =>
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key,
        }),
      )
    const pressDocumentKey = (key: string) =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key,
        }),
      )
    const openMenu = () => getButton()?.click()

    openMenu()
    const openAfterClick = !getDropdown()?.hidden
    const expandedAfterClick = getButton()?.getAttribute('aria-expanded')
    const activeAfterOpen = getActiveAction()
    const loadDisabledWithoutSnapshot =
      getActionButton('loadDebugSnapshot')?.disabled
    const debugLabelInitial = getActionButton('toggleDebugMode')?.textContent
    const debugCheckedInitial =
      getActionButton('toggleDebugMode')?.getAttribute('aria-checked')

    pressActiveKey('ArrowDown')
    const activeAfterArrowDown = getActiveAction()
    pressActiveKey('ArrowDown')
    const activeAfterSave = getActiveAction()
    pressActiveKey('ArrowDown')
    const activeAfterDisabledSkip = getActiveAction()
    pressActiveKey('End')
    const activeAfterEnd = getActiveAction()
    pressActiveKey('ArrowDown')
    const activeAfterWrap = getActiveAction()
    pressActiveKey('Home')
    const activeAfterHome = getActiveAction()

    getActionButton('resetScenario')?.click()
    const restartLabelAfterFirstClick =
      getActionButton('resetScenario')?.textContent
    getActionButton('resetScenario')?.click()
    const closedAfterRestart = getDropdown()?.hidden
    const focusAfterRestart = document.activeElement === getButton()

    openMenu()
    getActionButton('enterMainMenu')?.click()
    const exitLabelAfterFirstClick =
      getActionButton('enterMainMenu')?.textContent
    getActionButton('enterMainMenu')?.click()
    const closedAfterExit = getDropdown()?.hidden

    openMenu()
    getActionButton('toggleDebugMode')?.click()
    openMenu()
    const debugLabelAfterToggle =
      getActionButton('toggleDebugMode')?.textContent
    const debugCheckedAfterToggle =
      getActionButton('toggleDebugMode')?.getAttribute('aria-checked')
    getActionButton('toggleFpsIndicator')?.click()
    openMenu()
    const fpsLabelAfterToggle =
      getActionButton('toggleFpsIndicator')?.textContent
    const fpsCheckedAfterToggle =
      getActionButton('toggleFpsIndicator')?.getAttribute('aria-checked')

    menu.close()
    writeDebugScenarioSnapshot({
      version: 1,
      savedAt: new Date(0).toISOString(),
      elapsed: 0,
      bodies: [],
      spacecraft: {},
    })
    openMenu()
    const loadDisabledWithSnapshot =
      getActionButton('loadDebugSnapshot')?.disabled
    getActionButton('loadDebugSnapshot')?.click()

    openMenu()
    outsideButton.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true }),
    )
    const closedAfterOutsidePointer = getDropdown()?.hidden

    openMenu()
    pressDocumentKey('Escape')
    const closedAfterEscape = getDropdown()?.hidden
    const focusAfterEscape = document.activeElement === getButton()

    openMenu()
    pressActiveKey('Tab')
    const closedAfterTab = getDropdown()?.hidden

    return {
      activeAfterArrowDown,
      activeAfterDisabledSkip,
      activeAfterEnd,
      activeAfterHome,
      activeAfterOpen,
      activeAfterSave,
      activeAfterWrap,
      closedAfterEscape,
      closedAfterExit,
      closedAfterOutsidePointer,
      closedAfterRestart,
      closedAfterTab,
      debugCheckedAfterToggle,
      debugCheckedInitial,
      debugLabelAfterToggle,
      debugLabelInitial,
      events,
      expandedAfterClick,
      exitLabelAfterFirstClick,
      focusAfterEscape,
      focusAfterRestart,
      fpsCheckedAfterToggle,
      fpsLabelAfterToggle,
      loadDisabledWithSnapshot,
      loadDisabledWithoutSnapshot,
      openAfterClick,
      restartLabelAfterFirstClick,
    }
  })

  expect(result).toEqual({
    activeAfterArrowDown: 'toggleFpsIndicator',
    activeAfterDisabledSkip: 'resetScenario',
    activeAfterEnd: 'enterMainMenu',
    activeAfterHome: 'toggleDebugMode',
    activeAfterOpen: 'toggleDebugMode',
    activeAfterSave: 'saveDebugSnapshot',
    activeAfterWrap: 'toggleDebugMode',
    closedAfterEscape: true,
    closedAfterExit: true,
    closedAfterOutsidePointer: true,
    closedAfterRestart: true,
    closedAfterTab: true,
    debugCheckedAfterToggle: 'true',
    debugCheckedInitial: 'false',
    debugLabelAfterToggle: 'Hide debug window',
    debugLabelInitial: 'Show debug window',
    events: [
      'resetScenario',
      'enterMainMenu',
      'toggleDebugMode',
      'toggleFpsIndicator',
      'loadDebugSnapshot',
    ],
    expandedAfterClick: 'true',
    exitLabelAfterFirstClick: 'Confirm exit',
    focusAfterEscape: true,
    focusAfterRestart: true,
    fpsCheckedAfterToggle: 'true',
    fpsLabelAfterToggle: 'Hide FPS meter',
    loadDisabledWithSnapshot: false,
    loadDisabledWithoutSnapshot: true,
    openAfterClick: true,
    restartLabelAfterFirstClick: 'Confirm restart',
  })
})

test('captures the mobile top menu open over gameplay HUD', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page.getByLabel('Open menu').click()
  await expect(page.locator('.top-menu-dropdown')).toBeVisible()
  await expect(
    page.getByRole('menuitemcheckbox', { name: 'Show debug window' }),
  ).toBeVisible()

  await attachMobileScreenshot(page, testInfo, 'mobile-top-menu-open')
})

test('captures the mobile time warp touch control after reveal', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page.getByRole('button', { name: 'Reveal time warp control' }).click()
  const timeWarpReveal = page.locator('#touch-time-warp-reveal')
  await expect(timeWarpReveal).toHaveClass(/touch-edge-reveal-control-open/)
  await expect(
    timeWarpReveal.getByLabel('Time warp control', { exact: true }),
  ).toBeVisible()

  await attachMobileScreenshot(page, testInfo, 'mobile-time-warp-control')
})

test('captures the mobile target selector side panel after reveal', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page
    .getByRole('button', { name: /Reveal target body selector/ })
    .click()
  const targetReveal = page.locator('#touch-target-reveal')
  await expect(targetReveal).toHaveClass(/touch-edge-reveal-control-open/)
  await expect(
    targetReveal.getByLabel('Target body selector', { exact: true }),
  ).toBeVisible()

  await attachMobileScreenshot(page, testInfo, 'mobile-target-selector')
})

test('captures the mobile thrust touch control after reveal', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page.getByRole('button', { name: 'Reveal thrust control' }).click()
  const thrustReveal = page.locator('#touch-thrust-reveal')
  await expect(thrustReveal).toHaveClass(/touch-edge-reveal-control-open/)
  await expect(thrustReveal.locator('.touch-thrust-control')).toBeVisible()

  await attachMobileScreenshot(page, testInfo, 'mobile-thrust-control')
})
