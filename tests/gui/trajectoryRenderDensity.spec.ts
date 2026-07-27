import { expect, type Page, type TestInfo, test } from '@playwright/test'
import type {
  DevtoolsBridgeRequest,
  SpaceGameDevtoolsSnapshot,
} from '../../src/devtools/devtoolsBridge'

const getSnapshot = async (page: Page) =>
  page.evaluate(() => {
    const bridge = window.__SPACE_WEB_GAME_DEVTOOLS__
    if (!bridge) {
      throw new Error('Missing space-web-game devtools bridge.')
    }
    return bridge.getSnapshot()
  })

const dispatchDevtoolsRequest = async (
  page: Page,
  request: DevtoolsBridgeRequest,
) => {
  const response = await page.evaluate((devtoolsRequest) => {
    const bridge = window.__SPACE_WEB_GAME_DEVTOOLS__
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

const waitForTrajectory = async (page: Page) => {
  await expect
    .poll(
      async () =>
        (await getSnapshot(page)).simulation.trajectoryPrediction
          .visiblePointCount,
    )
    .toBeGreaterThan(20)
}

const zoomUntil = async (
  page: Page,
  options: {
    action: 'zoomIn' | 'zoomOut'
    reached: (viewportSize: number) => boolean
  },
) => {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const snapshot = await getSnapshot(page)
    if (options.reached(snapshot.simulation.viewportSize)) {
      return snapshot
    }

    await dispatchDevtoolsRequest(page, {
      action: options.action,
      type: 'dispatch-ui-action',
    })
  }

  throw new Error(`Unable to reach trajectory ${options.action} viewport.`)
}

const captureScreenshot = async (
  page: Page,
  testInfo: TestInfo,
  name: string,
) => {
  await page.waitForTimeout(200)
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

const captureTrajectoryZoomLevels = async (
  page: Page,
  testInfo: TestInfo,
  prefix: string,
) => {
  await page.goto('/?scenario=earth-moon&devtools=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()
  await page.waitForFunction(() => Boolean(window.__SPACE_WEB_GAME_DEVTOOLS__))
  await waitForTrajectory(page)
  await expect(page.locator('canvas')).toBeVisible()

  const orbitSnapshot = await getSnapshot(page)
  expect(orbitSnapshot.simulation.viewportSize).toBe(100)
  await captureScreenshot(page, testInfo, `${prefix}-trajectory-orbit`)

  const systemSnapshot = await zoomUntil(page, {
    action: 'zoomOut',
    reached: (viewportSize) => viewportSize >= 900,
  })
  expect(systemSnapshot.simulation.viewportSize).toBeLessThanOrEqual(1_200)
  await waitForTrajectory(page)
  await captureScreenshot(page, testInfo, `${prefix}-trajectory-system`)

  const closeSnapshot = await zoomUntil(page, {
    action: 'zoomIn',
    reached: (viewportSize) => viewportSize <= 50,
  })
  expect(closeSnapshot.simulation.viewportSize).toBeGreaterThanOrEqual(35)
  await waitForTrajectory(page)
  await captureScreenshot(page, testInfo, `${prefix}-trajectory-close`)

  return {
    close: closeSnapshot,
    orbit: orbitSnapshot,
    system: systemSnapshot,
  } satisfies Record<string, SpaceGameDevtoolsSnapshot>
}

test('keeps the decimated trajectory coherent across desktop zoom levels', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    colorScheme: 'dark',
    hasTouch: false,
    isMobile: false,
    reducedMotion: 'reduce',
    viewport: { height: 720, width: 1_024 },
  })
  const page = await context.newPage()

  try {
    const snapshots = await captureTrajectoryZoomLevels(
      page,
      testInfo,
      'desktop',
    )
    expect(snapshots.close.simulation.assistTarget?.id).toBe('earth')
    expect(snapshots.orbit.simulation.assistTarget?.id).toBe('earth')
    expect(snapshots.system.simulation.assistTarget?.id).toBe('earth')
  } finally {
    await context.close()
  }
})

test('keeps the decimated trajectory coherent across mobile zoom levels', async ({
  page,
}, testInfo) => {
  const snapshots = await captureTrajectoryZoomLevels(page, testInfo, 'mobile')

  expect(snapshots.close.simulation.assistTarget?.id).toBe('earth')
  expect(snapshots.orbit.simulation.assistTarget?.id).toBe('earth')
  expect(snapshots.system.simulation.assistTarget?.id).toBe('earth')
})
