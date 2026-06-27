import { expect, type Page, type TestInfo, test } from '@playwright/test'
import type { UIUserAction } from '../../src/input/uiUserActions'

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
    menu.syncState()
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

test('keeps the in-game controls menu adapter state and actions', async ({
  page,
}) => {
  await page.goto('/?reachmoon=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(async () => {
    const controlsMenuModulePath = '/src/ui/createInGameControlsMenu.ts'
    const { createInGameControlsMenu } = await import(controlsMenuModulePath)
    const app = document.createElement('div')
    const outsideButton = document.createElement('button')
    const events: string[] = []
    let cameraMode: 'centered' | 'unlocked' = 'centered'
    let cameraModeChangesLocked = false
    let coastHorizonHours = 6
    let settingsOpened = false

    outsideButton.textContent = 'Outside controls'
    document.body.append(app, outsideButton)

    const menu = createInGameControlsMenu({
      app,
      getCameraMode: () => cameraMode,
      getCameraModeChangesLocked: () => cameraModeChangesLocked,
      getCoastPredictionHorizonHours: () => coastHorizonHours,
      getMaxCoastPredictionHorizonHours: () => 8,
      getMinCoastPredictionHorizonHours: () => 2,
      onAction: (action: UIUserAction) => {
        events.push(action)
        if (action === 'setCameraUnlocked') {
          cameraMode = 'unlocked'
        }
        if (action === 'setCameraCentered') {
          cameraMode = 'centered'
        }
        if (action === 'decreaseCoastHorizon') {
          coastHorizonHours = Math.max(2, coastHorizonHours - 2)
        }
        if (action === 'increaseCoastHorizon') {
          coastHorizonHours = Math.min(8, coastHorizonHours + 2)
        }
      },
      onOpenUiSettings: () => {
        settingsOpened = true
      },
    })
    const getMenuButton = () =>
      menu.element.querySelector(
        '.in-game-controls-menu-button',
      ) as HTMLButtonElement | null
    const getPopover = () =>
      menu.element.querySelector(
        '.in-game-controls-menu-popover',
      ) as HTMLDivElement | null
    const getActionButton = (action: string) =>
      menu.element.querySelector(
        `[data-in-game-action="${action}"]`,
      ) as HTMLButtonElement | null
    const getCameraStatus = () =>
      menu.element.querySelector('[data-in-game-camera-status]')?.textContent
    const getCoastHorizon = () =>
      menu.element.querySelector('[data-in-game-coast-horizon]')?.textContent
    const pressDocumentKey = (key: string) =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key,
        }),
      )
    const openMenu = () => getMenuButton()?.click()

    openMenu()
    const openAfterClick = !getPopover()?.hidden
    const expandedAfterClick = getMenuButton()?.getAttribute('aria-expanded')
    const menuButtonLabelAfterClick =
      getMenuButton()?.getAttribute('aria-label')
    const cameraModeDataInitial = menu.element.dataset.cameraMode
    const cameraStatusInitial = getCameraStatus()
    const cameraCheckedInitial =
      getActionButton('toggleCameraMode')?.getAttribute('aria-checked')
    const cameraLabelInitial =
      getActionButton('toggleCameraMode')?.getAttribute('aria-label')
    const coastHorizonInitial = getCoastHorizon()

    getActionButton('toggleCameraMode')?.click()
    const cameraModeDataAfterToggle = menu.element.dataset.cameraMode
    const cameraStatusAfterToggle = getCameraStatus()
    const cameraCheckedAfterToggle =
      getActionButton('toggleCameraMode')?.getAttribute('aria-checked')
    const cameraLabelAfterToggle =
      getActionButton('toggleCameraMode')?.getAttribute('aria-label')

    cameraModeChangesLocked = true
    menu.syncState()
    const switchDisabledWhenLocked =
      getActionButton('toggleCameraMode')?.disabled
    const switchLabelWhenLocked =
      getActionButton('toggleCameraMode')?.getAttribute('aria-label')
    getActionButton('toggleCameraMode')?.click()
    const eventCountAfterLockedClick = events.length

    getActionButton('decreaseCoastHorizon')?.click()
    getActionButton('decreaseCoastHorizon')?.click()
    const coastHorizonAtMin = getCoastHorizon()
    const decreaseDisabledAtMin = getActionButton(
      'decreaseCoastHorizon',
    )?.disabled
    getActionButton('decreaseCoastHorizon')?.click()
    const eventCountAfterDisabledDecrease = events.length

    getActionButton('increaseCoastHorizon')?.click()
    getActionButton('increaseCoastHorizon')?.click()
    getActionButton('increaseCoastHorizon')?.click()
    const coastHorizonAtMax = getCoastHorizon()
    const increaseDisabledAtMax = getActionButton(
      'increaseCoastHorizon',
    )?.disabled

    getActionButton('openUiSettings')?.click()
    const closedAfterSettings = getPopover()?.hidden

    openMenu()
    outsideButton.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true }),
    )
    const closedAfterOutsidePointer = getPopover()?.hidden

    openMenu()
    pressDocumentKey('Escape')
    const closedAfterEscape = getPopover()?.hidden
    const focusAfterEscape = document.activeElement === getMenuButton()
    const menuButtonLabelAfterEscape =
      getMenuButton()?.getAttribute('aria-label')

    menu.close()
    const closedAfterClose = getPopover()?.hidden

    return {
      cameraCheckedAfterToggle,
      cameraCheckedInitial,
      cameraLabelAfterToggle,
      cameraLabelInitial,
      cameraModeDataAfterToggle,
      cameraModeDataInitial,
      cameraStatusAfterToggle,
      cameraStatusInitial,
      closedAfterClose,
      closedAfterEscape,
      closedAfterOutsidePointer,
      closedAfterSettings,
      coastHorizonAtMax,
      coastHorizonAtMin,
      coastHorizonInitial,
      decreaseDisabledAtMin,
      eventCountAfterDisabledDecrease,
      eventCountAfterLockedClick,
      events,
      expandedAfterClick,
      focusAfterEscape,
      increaseDisabledAtMax,
      menuButtonLabelAfterClick,
      menuButtonLabelAfterEscape,
      openAfterClick,
      settingsOpened,
      switchDisabledWhenLocked,
      switchLabelWhenLocked,
    }
  })

  expect(result).toEqual({
    cameraCheckedAfterToggle: 'false',
    cameraCheckedInitial: 'true',
    cameraLabelAfterToggle: 'Camera locked off: Free roam',
    cameraLabelInitial: 'Camera locked on: On spacecraft',
    cameraModeDataAfterToggle: 'unlocked',
    cameraModeDataInitial: 'centered',
    cameraStatusAfterToggle: 'Free roam',
    cameraStatusInitial: 'On spacecraft',
    closedAfterClose: true,
    closedAfterEscape: true,
    closedAfterOutsidePointer: true,
    closedAfterSettings: true,
    coastHorizonAtMax: '8h',
    coastHorizonAtMin: '2h',
    coastHorizonInitial: '6h',
    decreaseDisabledAtMin: true,
    eventCountAfterDisabledDecrease: 3,
    eventCountAfterLockedClick: 1,
    events: [
      'setCameraUnlocked',
      'decreaseCoastHorizon',
      'decreaseCoastHorizon',
      'increaseCoastHorizon',
      'increaseCoastHorizon',
      'increaseCoastHorizon',
    ],
    expandedAfterClick: 'true',
    focusAfterEscape: true,
    increaseDisabledAtMax: true,
    menuButtonLabelAfterClick: 'Close in-game controls',
    menuButtonLabelAfterEscape: 'Open in-game controls',
    openAfterClick: true,
    settingsOpened: true,
    switchDisabledWhenLocked: true,
    switchLabelWhenLocked: 'Camera locked changes unavailable: Free roam',
  })
})

test('keeps the UI settings dialog adapter state, focus, and change behavior', async ({
  page,
}) => {
  await page.goto('/?reachmoon=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(async () => {
    const uiSettingsDialogModulePath = '/src/ui/createUiSettingsDialog.ts'
    const { createUiSettingsDialog } = await import(uiSettingsDialogModulePath)
    const app = document.createElement('div')
    const beforeButton = document.createElement('button')
    const events: string[] = []
    const openEvents: boolean[] = []
    let burnSide: 'left' | 'right' = 'right'
    let targetSide: 'left' | 'right' = 'right'
    let trajectorySide: 'left' | 'right' | 'hidden' = 'hidden'
    let warpSide: 'left' | 'right' = 'left'

    beforeButton.textContent = 'Before settings'
    document.body.append(beforeButton, app)
    beforeButton.focus()

    const dialog = createUiSettingsDialog({
      app,
      getTouchBurnControlSide: () => burnSide,
      getTouchTargetControlSide: () => targetSide,
      getTouchTrajectoryControlSide: () => trajectorySide,
      getTouchWarpControlSide: () => warpSide,
      onOpenChange: (open: boolean) => openEvents.push(open),
      onTouchBurnControlSideChange: (side: 'left' | 'right') => {
        events.push(`burn:${side}`)
        burnSide = side
      },
      onTouchTargetControlSideChange: (side: 'left' | 'right') => {
        events.push(`target:${side}`)
        targetSide = side
      },
      onTouchTrajectoryControlSideChange: (
        side: 'left' | 'right' | 'hidden',
      ) => {
        events.push(`trajectory:${side}`)
        trajectorySide = side
      },
      onTouchWarpControlSideChange: (side: 'left' | 'right') => {
        events.push(`warp:${side}`)
        warpSide = side
      },
    })
    const getCloseButton = () =>
      dialog.element.querySelector(
        '.app-dialog-close',
      ) as HTMLButtonElement | null
    const getControlButton = (ariaLabel: string, value: string) =>
      dialog.element.querySelector(
        `[aria-label="${ariaLabel}"] [data-segmented-control-value="${value}"]`,
      ) as HTMLButtonElement | null
    const getSelectedValue = (ariaLabel: string) =>
      dialog.element
        .querySelector(
          `[aria-label="${ariaLabel}"] .segmented-control-option-selected`,
        )
        ?.getAttribute('data-segmented-control-value')
    const getFocusableButtons = (): HTMLButtonElement[] =>
      Array.from(
        (dialog.element as HTMLElement).querySelectorAll('button'),
      ) as HTMLButtonElement[]
    const pressDocumentKey = (
      key: string,
      init: Omit<KeyboardEventInit, 'key'> = {},
    ) =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key,
          ...init,
        }),
      )

    dialog.open()
    const activeAfterOpen = document.activeElement === getCloseButton()
    const openAfterOpen = !dialog.element.hidden
    const role = dialog.element
      .querySelector('.app-dialog-panel')
      ?.getAttribute('role')
    const className = dialog.element.className
    const selectedAfterOpen = {
      burn: getSelectedValue('Burn control side'),
      target: getSelectedValue('Target control side'),
      trajectory: getSelectedValue('Trajectory control side'),
      warp: getSelectedValue('Warp control side'),
    }

    getControlButton('Burn control side', 'left')?.click()
    getControlButton('Target control side', 'left')?.click()
    getControlButton('Trajectory control side', 'right')?.click()
    getControlButton('Warp control side', 'right')?.click()
    dialog.syncState()
    const selectedAfterChanges = {
      burn: getSelectedValue('Burn control side'),
      target: getSelectedValue('Target control side'),
      trajectory: getSelectedValue('Trajectory control side'),
      warp: getSelectedValue('Warp control side'),
    }
    const burnLeftPressed = getControlButton(
      'Burn control side',
      'left',
    )?.getAttribute('aria-pressed')
    const burnRightPressed = getControlButton(
      'Burn control side',
      'right',
    )?.getAttribute('aria-pressed')

    getFocusableButtons().at(-1)?.focus()
    pressDocumentKey('Tab')
    const focusAfterForwardTrap = document.activeElement === getCloseButton()
    getCloseButton()?.focus()
    pressDocumentKey('Tab', { shiftKey: true })
    const focusAfterBackwardTrap =
      document.activeElement === getFocusableButtons().at(-1)

    pressDocumentKey('Escape')
    const hiddenAfterEscape = dialog.element.hidden
    const focusRestoredAfterEscape = document.activeElement === beforeButton

    targetSide = 'left'
    beforeButton.focus()
    dialog.open()
    const targetSyncedOnOpen = getSelectedValue('Target control side')
    dialog.element
      .querySelector('.app-dialog-backdrop')
      ?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
    const hiddenAfterBackdrop = dialog.element.hidden
    const focusRestoredAfterBackdrop = document.activeElement === beforeButton

    beforeButton.focus()
    dialog.open()
    getCloseButton()?.click()
    const hiddenAfterCloseButton = dialog.element.hidden
    const focusRestoredAfterCloseButton =
      document.activeElement === beforeButton

    const hiddenTriggerWrapper = document.createElement('div')
    const hiddenTriggerButton = document.createElement('button')
    hiddenTriggerButton.textContent = 'Hidden settings trigger'
    hiddenTriggerWrapper.append(hiddenTriggerButton)
    document.body.append(hiddenTriggerWrapper)
    hiddenTriggerButton.focus()
    hiddenTriggerWrapper.hidden = true
    const hiddenTriggerWasActiveBeforeOpen =
      document.activeElement === hiddenTriggerButton
    dialog.open()
    getCloseButton()?.click()
    const focusSkippedHiddenTrigger =
      document.activeElement !== hiddenTriggerButton

    return {
      activeAfterOpen,
      burnLeftPressed,
      burnRightPressed,
      className,
      events,
      focusAfterBackwardTrap,
      focusAfterForwardTrap,
      focusRestoredAfterBackdrop,
      focusRestoredAfterCloseButton,
      focusRestoredAfterEscape,
      focusSkippedHiddenTrigger,
      hiddenAfterBackdrop,
      hiddenAfterCloseButton,
      hiddenAfterEscape,
      hiddenTriggerWasActiveBeforeOpen,
      openAfterOpen,
      openEvents,
      role,
      selectedAfterChanges,
      selectedAfterOpen,
      targetSyncedOnOpen,
    }
  })

  expect(result).toEqual({
    activeAfterOpen: true,
    burnLeftPressed: 'true',
    burnRightPressed: 'false',
    className: 'app-dialog ui-settings-dialog',
    events: ['burn:left', 'target:left', 'trajectory:right', 'warp:right'],
    focusAfterBackwardTrap: true,
    focusAfterForwardTrap: true,
    focusRestoredAfterBackdrop: true,
    focusRestoredAfterCloseButton: true,
    focusRestoredAfterEscape: true,
    focusSkippedHiddenTrigger: true,
    hiddenAfterBackdrop: true,
    hiddenAfterCloseButton: true,
    hiddenAfterEscape: true,
    hiddenTriggerWasActiveBeforeOpen: true,
    openAfterOpen: true,
    openEvents: [true, false, true, false, true, false, true, false],
    role: 'dialog',
    selectedAfterChanges: {
      burn: 'left',
      target: 'left',
      trajectory: 'right',
      warp: 'right',
    },
    selectedAfterOpen: {
      burn: 'right',
      target: 'right',
      trajectory: 'hidden',
      warp: 'left',
    },
    targetSyncedOnOpen: 'left',
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

test('captures the mobile in-game controls menu open over gameplay HUD', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page.getByRole('button', { name: 'Open in-game controls' }).click()
  await expect(
    page.getByRole('dialog', { name: 'In-game controls' }),
  ).toBeVisible()
  await expect(page.getByText('Prediction horizon')).toBeVisible()

  await attachMobileScreenshot(page, testInfo, 'mobile-in-game-controls-menu')
})

test('captures the mobile UI settings dialog opened from in-game controls', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page.getByRole('button', { name: 'Open in-game controls' }).click()
  await page.getByRole('button', { name: 'UI settings' }).click()
  await expect(page.getByRole('dialog', { name: 'UI settings' })).toBeVisible()
  await expect(page.getByText('Burn side')).toBeVisible()
  await expect(page.getByText('Trajectory side')).toBeVisible()

  await attachMobileScreenshot(page, testInfo, 'mobile-ui-settings-dialog')
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
