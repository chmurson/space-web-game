import { expect, type Page, type TestInfo, test } from '@playwright/test'
import type {
  DevtoolsBridgeRequest,
  DevtoolsBridgeResponse,
  SpaceGameDevtoolsSnapshot,
} from '../../src/devtools/devtoolsBridge'

const debugSnapshotStorageKey = 'space-web-game.debugScenarioSnapshot.v1'
const userSettingsStorageKey = 'space-web-game.userSettings.v1'
const targetViewportSize = 1_000

type DevtoolsWindow = Window & {
  __SPACE_WEB_GAME_DEVTOOLS__?: {
    getSnapshot(): SpaceGameDevtoolsSnapshot
    handleRequest(request: DevtoolsBridgeRequest): DevtoolsBridgeResponse
  }
}

type ReplayStorageKeys = {
  debugSnapshotKey: string
  userSettingsKey: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const getScenarioPhase = (snapshot: SpaceGameDevtoolsSnapshot) => {
  const { state } = snapshot.scenario
  return isRecord(state) && typeof state.phase === 'string' ? state.phase : null
}

const waitForDevtoolsBridge = async (page: Page) => {
  await page.waitForFunction(() =>
    Boolean((window as DevtoolsWindow).__SPACE_WEB_GAME_DEVTOOLS__),
  )
}

const seedTutorialEscapeCheckpoint = async (page: Page) => {
  await page.goto('/?devtools=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const storageKeys: ReplayStorageKeys = {
    debugSnapshotKey: debugSnapshotStorageKey,
    userSettingsKey: userSettingsStorageKey,
  }

  await page.evaluate(async ({ debugSnapshotKey, userSettingsKey }) => {
    const tutorialModulePath =
      '/src/scenario/specific-scenarios/tutorial/tutorialScenario.ts'
    const constantsModulePath = '/src/simulation/constants.ts'
    const { registerTutorialScenario } = await import(tutorialModulePath)
    const { EARTH_RADIUS } = await import(constantsModulePath)
    const scenario = registerTutorialScenario().createScenario()
    const bodies = scenario.bodies as Array<{
      id: string
      position: { x: number; y: number }
      velocity: { x: number; y: number }
    }>
    const earth = bodies.find((body) => body.id === 'earth')
    const moonIndex = bodies.findIndex((body) => body.id === 'moon')

    if (!earth || moonIndex < 0) {
      throw new Error('Expected tutorial Earth-Moon bodies.')
    }

    const moonTransferVelocity = {
      x: earth.velocity.x,
      y: earth.velocity.y + 500,
    }
    const snapshot = {
      version: 2,
      savedAt: '2026-06-26T08:25:00.000Z',
      assistTargetIndex: moonIndex,
      assistTargetSelectionMode: 'manual',
      elapsed: 19_500,
      viewportSize: 100,
      coastPredictionHorizonHours: 2,
      bodies,
      runtimeScenario: {
        checkpoint: null,
        completed: false,
        promptUi: {
          activePromptId: null,
          replayPromptId: 'phase-one-objective',
        },
        scenarioId: 'tutorial',
        state: { phase: 'escape-earth' },
      },
      spacecraft: {
        ...scenario.spacecraft,
        position: {
          x: earth.position.x + EARTH_RADIUS * 5.2,
          y: earth.position.y,
        },
        velocity: moonTransferVelocity,
        heading: Math.atan2(moonTransferVelocity.y, moonTransferVelocity.x),
      },
    }

    window.localStorage.setItem(
      userSettingsKey,
      JSON.stringify({
        debugModeEnabled: true,
        touchBurnControlSide: 'right',
        touchTargetControlSide: 'left',
        touchTrajectoryControlSide: 'hidden',
        touchWarpControlSide: 'right',
      }),
    )
    window.localStorage.setItem(debugSnapshotKey, JSON.stringify(snapshot))
  }, storageKeys)
}

const getDevtoolsSnapshot = async (page: Page) =>
  page.evaluate(() => {
    const bridge = (window as DevtoolsWindow).__SPACE_WEB_GAME_DEVTOOLS__
    if (!bridge) {
      throw new Error('Missing space-web-game devtools bridge.')
    }
    return bridge.getSnapshot()
  })

const sendDevtoolsRequest = async (
  page: Page,
  request: DevtoolsBridgeRequest,
) => {
  const response = await page.evaluate((devtoolsRequest) => {
    const bridge = (window as DevtoolsWindow).__SPACE_WEB_GAME_DEVTOOLS__
    if (!bridge) {
      throw new Error('Missing space-web-game devtools bridge.')
    }
    return bridge.handleRequest(devtoolsRequest)
  }, request)

  if (!response.ok) {
    throw new Error(response.error)
  }

  return response.snapshot
}

const dismissActivePrompt = async (page: Page) => {
  const snapshot = await getDevtoolsSnapshot(page)
  if (!snapshot.scenario.promptUi.activePromptId) {
    return
  }

  await sendDevtoolsRequest(page, {
    action: 'promptConfirm',
    type: 'dispatch-ui-action',
  })

  await expect
    .poll(async () => (await getDevtoolsSnapshot(page)).scenario.promptUi)
    .toMatchObject({ activePromptId: null })
}

const selectMoonIfNeeded = async (page: Page) => {
  const initialSnapshot = await getDevtoolsSnapshot(page)
  const maxAttempts = initialSnapshot.simulation.bodies.length

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    const snapshot = await getDevtoolsSnapshot(page)
    if (snapshot.simulation.assistTarget?.id === 'moon') {
      return
    }

    await sendDevtoolsRequest(page, {
      action: 'cycleAssistTarget',
      type: 'dispatch-ui-action',
    })
  }

  throw new Error('Unable to select Moon as the assist target.')
}

const zoomOutToTargetViewport = async (page: Page) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { viewportSize } = (await getDevtoolsSnapshot(page)).simulation
    if (viewportSize === targetViewportSize) {
      return
    }
    if (viewportSize > targetViewportSize) {
      throw new Error(
        `Viewport exceeded ${targetViewportSize}: ${viewportSize}`,
      )
    }

    await sendDevtoolsRequest(page, {
      action: 'zoomOut',
      type: 'dispatch-ui-action',
    })
  }

  throw new Error(`Viewport did not reach ${targetViewportSize}.`)
}

const setFastestAllowedTimeWarp = async (page: Page) => {
  const snapshot = await getDevtoolsSnapshot(page)
  await sendDevtoolsRequest(page, {
    index: snapshot.simulation.timeWarps.length - 1,
    type: 'set-time-warp-index',
  })
}

const getDebugPanelText = async (page: Page) =>
  page.locator('.debug-panel-content > .debug-panel-text').first().textContent()

const getRenderedTrailSliceCount = (debugText: string | null) => {
  const match = debugText?.match(/trail detail: .*\| slices (\d+) \|/)
  return match ? Number(match[1]) : 0
}

const expectWebglCanvasNonblank = async (page: Page) => {
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#app > canvas')
    if (!(canvas instanceof HTMLCanvasElement)) {
      return false
    }
    if (canvas.width <= 0 || canvas.height <= 0) {
      return false
    }

    const sampleCanvas = document.createElement('canvas')
    sampleCanvas.width = Math.min(64, canvas.width)
    sampleCanvas.height = Math.min(64, canvas.height)

    const context = sampleCanvas.getContext('2d', {
      willReadFrequently: true,
    })
    if (!context) {
      return false
    }

    context.drawImage(
      canvas,
      0,
      0,
      canvas.width,
      canvas.height,
      0,
      0,
      sampleCanvas.width,
      sampleCanvas.height,
    )

    const pixels = context.getImageData(
      0,
      0,
      sampleCanvas.width,
      sampleCanvas.height,
    ).data
    let nonblankPixels = 0

    for (let index = 0; index < pixels.length; index += 4) {
      if (
        pixels[index + 3] > 0 &&
        (pixels[index] > 8 || pixels[index + 1] > 8 || pixels[index + 2] > 8)
      ) {
        nonblankPixels += 1
      }
    }

    return nonblankPixels > 10
  })
}

const attachReplayScreenshot = async (
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

test('replays tutorial transfer trail debug state from a fixed checkpoint', async ({
  page,
}, testInfo) => {
  await seedTutorialEscapeCheckpoint(page)
  await page.goto('/?scenario=last-debug-snapshot&devtools=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()
  await waitForDevtoolsBridge(page)

  await expect
    .poll(async () => getScenarioPhase(await getDevtoolsSnapshot(page)))
    .toBe('reach-moon')

  await dismissActivePrompt(page)
  await selectMoonIfNeeded(page)
  await zoomOutToTargetViewport(page)
  await setFastestAllowedTimeWarp(page)

  await expect
    .poll(async () => getRenderedTrailSliceCount(await getDebugPanelText(page)))
    .toBeGreaterThan(0)
  await expectWebglCanvasNonblank(page)

  const snapshot = await getDevtoolsSnapshot(page)
  const debugText = await getDebugPanelText(page)
  const renderedTrailSliceCount = getRenderedTrailSliceCount(debugText)

  expect(snapshot.scenario.scenarioId).toBe('tutorial')
  expect(getScenarioPhase(snapshot)).toBe('reach-moon')
  expect(snapshot.simulation.assistTarget?.id).toBe('moon')
  expect(snapshot.simulation.assistTarget?.name).toBe('Moon')
  expect(snapshot.simulation.viewportSize).toBe(targetViewportSize)
  expect(snapshot.debug.debugModeEnabled).toBe(true)
  expect(renderedTrailSliceCount).toBeGreaterThan(0)
  expect(debugText).toContain('assist target: Moon')
  expect(debugText).toContain('viewport: 1000.00')
  expect(debugText).toContain('trail frame: inertial')

  await attachReplayScreenshot(page, testInfo, 'tutorial-trail-debug-replay')
})
