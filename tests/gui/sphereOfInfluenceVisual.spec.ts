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

const zoomInToViewport = async (
  page: Page,
  maximumViewportSize: number,
): Promise<SpaceGameDevtoolsSnapshot> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const snapshot = await getSnapshot(page)
    if (snapshot.simulation.viewportSize <= maximumViewportSize) {
      return snapshot
    }

    await dispatchDevtoolsRequest(page, {
      action: 'zoomIn',
      type: 'dispatch-ui-action',
    })
  }

  throw new Error(
    `Viewport did not reach ${maximumViewportSize} for SOI capture.`,
  )
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

  const canvas = page.locator('canvas')
  const pointer = {
    button: 0,
    buttons: 1,
    isPrimary: true,
    pointerId: 41,
    pointerType: 'touch',
  }
  await canvas.dispatchEvent('pointerdown', {
    ...pointer,
    clientX: start.x,
    clientY: start.y,
  })
  await canvas.dispatchEvent('pointermove', {
    ...pointer,
    clientX: end.x,
    clientY: end.y,
  })
  await canvas.dispatchEvent('pointerup', {
    ...pointer,
    buttons: 0,
    clientX: end.x,
    clientY: end.y,
  })

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

test('captures four SOI variants with thin maximum-zoom edges', async ({
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

    const framingSnapshot = await zoomInToViewport(page, 2_000)
    await centerEarthSoiEdge(page, framingSnapshot)
    await captureScreenshot(page, testInfo, `soi-${variant}-middle-portrait`)

    const maxZoomSnapshot = await zoomInToMinimumViewport(page)
    expect(maxZoomSnapshot.simulation.viewportSize).toBeLessThan(
      framingSnapshot.simulation.viewportSize,
    )
    await captureScreenshot(page, testInfo, `soi-${variant}-max-portrait`)
  }
})

test('captures a compact SOI edge at desktop close zoom', async ({
  page,
}, testInfo) => {
  test.setTimeout(30_000)
  await page.setViewportSize({ height: 900, width: 1_440 })
  await page.goto('/?scenario=earth-moon&devtools=1&soi=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()
  await page.waitForFunction(() => Boolean(window.__SPACE_WEB_GAME_DEVTOOLS__))

  await zoomOutToSystemViewport(page)
  const closeSnapshot = await zoomInToViewport(page, 100)
  await centerEarthSoiEdge(page, closeSnapshot)
  await captureScreenshot(page, testInfo, 'soi-1-desktop-close')
})
