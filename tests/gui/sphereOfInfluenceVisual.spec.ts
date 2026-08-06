import { expect, type Page, type TestInfo, test } from '@playwright/test'
import type {
  DevtoolsBridgeRequest,
  SpaceGameDevtoolsSnapshot,
} from '../../src/devtools/devtoolsBridge'
import { EARTH_MOON_VIEWPORT_SIZE } from '../../src/domain/viewportPresets'
import { RENDER_SCALE } from '../../src/simulation/constants'
import { createEarthMoonScenario } from '../../src/simulation/scenarios/earthMoon'

const earthSphereOfInfluenceRadius =
  createEarthMoonScenario().bodies.find((body) => body.id === 'earth')
    ?.sphereOfInfluenceRadius ?? 0

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

const zoomInToFramingViewport = async (
  page: Page,
): Promise<SpaceGameDevtoolsSnapshot> => {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const snapshot = await getSnapshot(page)
    if (snapshot.simulation.viewportSize <= 2_000) {
      return snapshot
    }

    await dispatchDevtoolsRequest(page, {
      action: 'zoomIn',
      type: 'dispatch-ui-action',
    })
  }

  throw new Error('Viewport did not reach the SOI edge-framing range.')
}

const zoomInToMinimumViewport = async (
  page: Page,
): Promise<SpaceGameDevtoolsSnapshot> => {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const before = await getSnapshot(page)
    const after = await dispatchDevtoolsRequest(page, {
      action: 'zoomIn',
      type: 'dispatch-ui-action',
    })
    if (after.simulation.viewportSize === before.simulation.viewportSize) {
      return after
    }
  }

  throw new Error('Viewport did not reach maximum zoom-in.')
}

const centerEarthSoiEdge = async (
  page: Page,
  snapshot: SpaceGameDevtoolsSnapshot,
) => {
  const earth = snapshot.simulation.bodies.find((body) => body.id === 'earth')
  if (!earth || earthSphereOfInfluenceRadius <= 0) {
    throw new Error('Missing Earth SOI data for screenshot framing.')
  }

  const spacecraftRelativeX =
    snapshot.simulation.spacecraft.position.x - earth.position.x
  const spacecraftRelativeY =
    snapshot.simulation.spacecraft.position.y - earth.position.y
  const screenRight = Math.SQRT1_2
  const relativeScreenRight =
    (spacecraftRelativeX - spacecraftRelativeY) * screenRight
  const relativeScreenForward =
    (spacecraftRelativeX + spacecraftRelativeY) * screenRight
  const edgeScreenRight = Math.sqrt(
    Math.max(0, earthSphereOfInfluenceRadius ** 2 - relativeScreenForward ** 2),
  )
  const viewport = page.viewportSize()
  if (!viewport) {
    throw new Error('Missing browser viewport for SOI screenshot framing.')
  }

  const panDistancePixels =
    ((edgeScreenRight - relativeScreenRight) * RENDER_SCALE * viewport.height) /
    snapshot.simulation.viewportSize
  const start = { x: viewport.width / 2, y: viewport.height / 2 }
  const end = { x: start.x - panDistancePixels, y: start.y }

  await page.locator('.touch-controls').evaluate(
    (target, gesture) => {
      const dispatchTouch = (
        type: 'touchend' | 'touchmove' | 'touchstart',
        point: { x: number; y: number },
      ) => {
        const touch = new Touch({
          clientX: point.x,
          clientY: point.y,
          identifier: 41,
          target,
        })
        const activeTouches = type === 'touchend' ? [] : [touch]
        target.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            changedTouches: [touch],
            targetTouches: activeTouches,
            touches: activeTouches,
          }),
        )
      }

      dispatchTouch('touchstart', gesture.start)
      dispatchTouch('touchmove', gesture.end)
      dispatchTouch('touchend', gesture.end)
    },
    { end, start },
  )

  const framedSnapshot = await getSnapshot(page)
  expect(framedSnapshot.camera.panOffset).not.toEqual({ x: 0, y: 0 })
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

test('captures four current-soi-5 variants with thin maximum-zoom edges', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ height: 844, width: 390 })

  for (const variant of [1, 2, 3, 4]) {
    await page.goto(`/?scenario=earth-moon&devtools=1&soi=${variant}`)
    await expect(page.locator('[data-boot-screen]')).toBeHidden()
    await page.waitForFunction(() =>
      Boolean(window.__SPACE_WEB_GAME_DEVTOOLS__),
    )

    const wideSnapshot = await zoomOutToSystemViewport(page)
    expect(wideSnapshot.simulation.viewportSize).toBe(EARTH_MOON_VIEWPORT_SIZE)
    await expect(page.locator('canvas')).toBeVisible()
    await captureScreenshot(page, testInfo, `soi-${variant}-wide-portrait`)

    const framingSnapshot = await zoomInToFramingViewport(page)
    await centerEarthSoiEdge(page, framingSnapshot)
    await captureScreenshot(page, testInfo, `soi-${variant}-middle-portrait`)

    const maxZoomSnapshot = await zoomInToMinimumViewport(page)
    expect(maxZoomSnapshot.simulation.viewportSize).toBeLessThan(
      framingSnapshot.simulation.viewportSize,
    )
    await captureScreenshot(page, testInfo, `soi-${variant}-max-portrait`)
  }
})
