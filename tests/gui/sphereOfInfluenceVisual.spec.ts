import { expect, type Page, type TestInfo, test } from '@playwright/test'
import type {
  DevtoolsBridgeRequest,
  SpaceGameDevtoolsSnapshot,
} from '../../src/devtools/devtoolsBridge'
import { EARTH_MOON_VIEWPORT_SIZE } from '../../src/domain/viewportPresets'

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

const zoomOutToSystemViewport = async (
  page: Page,
): Promise<SpaceGameDevtoolsSnapshot> => {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const snapshot = await getSnapshot(page)
    if (snapshot.simulation.viewportSize === EARTH_MOON_VIEWPORT_SIZE) {
      return snapshot
    }

    await dispatchDevtoolsRequest(page, {
      action: 'zoomOut',
      type: 'dispatch-ui-action',
    })
  }

  throw new Error(
    `Viewport did not reach ${EARTH_MOON_VIEWPORT_SIZE} for SOI capture.`,
  )
}

const captureScreenshot = async (
  page: Page,
  testInfo: TestInfo,
  name: string,
) => {
  await page.waitForTimeout(200)
  const path = testInfo.outputPath(`${name}.png`)
  const screenshot = await page.screenshot({
    animations: 'disabled',
    fullPage: false,
    path,
  })
  await testInfo.attach(name, {
    contentType: 'image/png',
    path,
  })
  expect(screenshot.byteLength).toBeGreaterThan(5_000)
}

test('captures the base SOI field and four edge-gradient strengths', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ height: 844, width: 390 })

  for (const variant of [1, 2, 3, 4, 5]) {
    await page.goto(`/?scenario=earth-moon&devtools=1&soi=${variant}`)
    await expect(page.locator('[data-boot-screen]')).toBeHidden()
    await page.waitForFunction(() =>
      Boolean(window.__SPACE_WEB_GAME_DEVTOOLS__),
    )

    const snapshot = await zoomOutToSystemViewport(page)
    expect(snapshot.simulation.viewportSize).toBe(EARTH_MOON_VIEWPORT_SIZE)
    await expect(page.locator('canvas')).toBeVisible()
    await captureScreenshot(page, testInfo, `soi-${variant}-portrait`)

    if (variant === 1 || variant === 5) {
      for (let step = 0; step < 3; step += 1) {
        await dispatchDevtoolsRequest(page, {
          action: 'zoomIn',
          type: 'dispatch-ui-action',
        })
      }
      const nearSnapshot = await getSnapshot(page)
      expect(nearSnapshot.simulation.viewportSize).toBeLessThan(
        EARTH_MOON_VIEWPORT_SIZE,
      )
      await captureScreenshot(page, testInfo, `soi-${variant}-near-portrait`)
    }
  }
})
