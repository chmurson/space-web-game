import { expect, type Page, type TestInfo, test } from '@playwright/test'

const gravitationalConstant = 6.6743e-11

const getSnapshot = async (page: Page) =>
  page.evaluate(() => {
    const bridge = window.__SPACE_WEB_GAME_DEVTOOLS__
    if (!bridge) {
      throw new Error('Missing space-web-game devtools bridge.')
    }
    return bridge.getSnapshot()
  })

const getRelativeVector = (
  object: { position: { x: number; y: number } },
  body: { position: { x: number; y: number } },
) => ({
  x: object.position.x - body.position.x,
  y: object.position.y - body.position.y,
})

const getRelativeVelocity = (
  object: { velocity: { x: number; y: number } },
  body: { velocity: { x: number; y: number } },
) => ({
  x: object.velocity.x - body.velocity.x,
  y: object.velocity.y - body.velocity.y,
})

const magnitude = (vector: { x: number; y: number }) =>
  Math.hypot(vector.x, vector.y)

const runKeplerPlaytest = async (
  page: Page,
  testInfo: TestInfo,
  viewportName: 'desktop' | 'mobile',
) => {
  await page.goto('/?scenario=earth-kepler-orbit-debug&engine=kepler')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()
  await page.waitForFunction(() => Boolean(window.__SPACE_WEB_GAME_DEVTOOLS__))
  await expect(page.locator('canvas')).toBeVisible()
  await expect
    .poll(
      async () =>
        (await getSnapshot(page)).simulation.trajectoryPrediction
          .visiblePointCount,
    )
    .toBeGreaterThan(20)

  const initialSnapshot = await getSnapshot(page)
  const initialBody = initialSnapshot.simulation.bodies[0]
  if (!initialBody) {
    throw new Error('Missing Earth in the one-body Kepler playtest.')
  }
  const initialRelativePosition = getRelativeVector(
    initialSnapshot.simulation.spacecraft,
    initialBody,
  )
  const initialRelativeVelocity = getRelativeVelocity(
    initialSnapshot.simulation.spacecraft,
    initialBody,
  )
  const orbitRadius = magnitude(initialRelativePosition)
  const orbitalPeriod =
    2 *
    Math.PI *
    Math.sqrt(orbitRadius ** 3 / (gravitationalConstant * initialBody.mass))
  const orbitDirection = Math.sign(
    initialRelativePosition.x * initialRelativeVelocity.y -
      initialRelativePosition.y * initialRelativeVelocity.x,
  )
  const maxWarpIndex = initialSnapshot.simulation.timeWarps.indexOf(1_800)
  expect(maxWarpIndex).toBeGreaterThanOrEqual(0)
  const warpResponse = await page.evaluate((index) => {
    return window.__SPACE_WEB_GAME_DEVTOOLS__?.handleRequest({
      type: 'set-time-warp-index',
      index,
    })
  }, maxWarpIndex)
  expect(warpResponse?.ok).toBe(true)
  await expect
    .poll(async () => (await getSnapshot(page)).simulation.timeWarp)
    .toBe(1_800)

  const targetElapsed = initialSnapshot.simulation.elapsed + orbitalPeriod
  await expect
    .poll(async () => (await getSnapshot(page)).simulation.elapsed, {
      timeout: 30_000,
    })
    .toBeGreaterThanOrEqual(targetElapsed)

  const snapshot = await getSnapshot(page)
  const finalBody = snapshot.simulation.bodies[0]
  if (!finalBody) {
    throw new Error('Missing Earth after the one-body Kepler playtest.')
  }
  const elapsedDelta =
    snapshot.simulation.elapsed - initialSnapshot.simulation.elapsed
  const expectedAngle =
    orbitDirection * ((2 * Math.PI * elapsedDelta) / orbitalPeriod)
  const expectedRelativePosition = {
    x:
      initialRelativePosition.x * Math.cos(expectedAngle) -
      initialRelativePosition.y * Math.sin(expectedAngle),
    y:
      initialRelativePosition.x * Math.sin(expectedAngle) +
      initialRelativePosition.y * Math.cos(expectedAngle),
  }
  const finalRelativePosition = getRelativeVector(
    snapshot.simulation.spacecraft,
    finalBody,
  )
  const finalRelativeVelocity = getRelativeVelocity(
    snapshot.simulation.spacecraft,
    finalBody,
  )
  const positionMismatch = magnitude({
    x: finalRelativePosition.x - expectedRelativePosition.x,
    y: finalRelativePosition.y - expectedRelativePosition.y,
  })
  const radialDrift = Math.abs(magnitude(finalRelativePosition) - orbitRadius)
  const speedDrift = Math.abs(
    magnitude(finalRelativeVelocity) - magnitude(initialRelativeVelocity),
  )

  expect(snapshot.appMode).toBe('game')
  expect(snapshot.simulation.assistTarget).toEqual({
    id: 'earth',
    name: 'Earth',
  })
  expect(
    snapshot.simulation.trajectoryPrediction.visiblePointCount,
  ).toBeGreaterThan(20)
  expect(
    snapshot.simulation.trajectoryPrediction.predictionTerminationReason,
  ).toBe('closed-orbit')
  expect(snapshot.simulation.crashedBodyName).toBeNull()
  expect(elapsedDelta).toBeGreaterThanOrEqual(orbitalPeriod)
  expect(positionMismatch).toBeLessThan(100)
  expect(radialDrift).toBeLessThan(10)
  expect(speedDrift).toBeLessThan(0.02)
  expect(new URL(page.url()).searchParams.get('engine')).toBe('kepler')

  const resetWarpResponse = await page.evaluate(() =>
    window.__SPACE_WEB_GAME_DEVTOOLS__?.handleRequest({
      type: 'set-time-warp-index',
      index: 0,
    }),
  )
  expect(resetWarpResponse?.ok).toBe(true)
  await expect
    .poll(async () => (await getSnapshot(page)).simulation.timeWarp)
    .toBe(1)

  const screenshotPath = testInfo.outputPath(
    `${viewportName}-kepler-live-orbit-after-one-period.png`,
  )
  const screenshot = await page.screenshot({
    animations: 'disabled',
    fullPage: false,
    path: screenshotPath,
  })
  await testInfo.attach(`${viewportName}-kepler-live-orbit-after-one-period`, {
    contentType: 'image/png',
    path: screenshotPath,
  })
  expect(screenshot.byteLength).toBeGreaterThan(5_000)
}

const zoomOutToViewportCap = async (page: Page, expectedCap: number) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const snapshot = await getSnapshot(page)
    if (snapshot.simulation.viewportSize === expectedCap) {
      const cappedResponse = await page.evaluate(() =>
        window.__SPACE_WEB_GAME_DEVTOOLS__?.handleRequest({
          action: 'zoomOut',
          type: 'dispatch-ui-action',
        }),
      )
      expect(cappedResponse?.ok).toBe(true)
      expect((await getSnapshot(page)).simulation.viewportSize).toBe(
        expectedCap,
      )
      return snapshot
    }

    expect(snapshot.simulation.viewportSize).toBeLessThan(expectedCap)
    const response = await page.evaluate(() =>
      window.__SPACE_WEB_GAME_DEVTOOLS__?.handleRequest({
        action: 'zoomOut',
        type: 'dispatch-ui-action',
      }),
    )
    expect(response?.ok).toBe(true)
  }

  throw new Error(`Viewport did not reach zoom-out cap ${expectedCap}.`)
}

test('runs a live closed Kepler orbit for one period on desktop', async ({
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
    await runKeplerPlaytest(page, testInfo, 'desktop')
  } finally {
    await context.close()
  }
})

test('runs a live closed Kepler orbit for one period on mobile', async ({
  page,
}, testInfo) => {
  await runKeplerPlaytest(page, testInfo, 'mobile')
})

test('matches the earth-moon zoom-out range at the same desktop viewport', async ({
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
  const expectedCap = 1_000

  const inspectScenario = async (url: string, screenshotName: string) => {
    await page.goto(url)
    await expect(page.locator('[data-boot-screen]')).toBeHidden()
    await page.waitForFunction(() =>
      Boolean(window.__SPACE_WEB_GAME_DEVTOOLS__),
    )
    await expect(page.locator('canvas')).toBeVisible()

    const initialSnapshot = await getSnapshot(page)
    const earth = initialSnapshot.simulation.bodies.find(
      (body) => body.id === 'earth',
    )
    if (!earth) {
      throw new Error('Missing Earth while comparing camera zoom ranges.')
    }
    const relativePosition = getRelativeVector(
      initialSnapshot.simulation.spacecraft,
      earth,
    )
    const relativeVelocity = getRelativeVelocity(
      initialSnapshot.simulation.spacecraft,
      earth,
    )

    expect(initialSnapshot.scenario.directives.maxViewportSize).toBe(
      expectedCap,
    )
    const cappedSnapshot = await zoomOutToViewportCap(page, expectedCap)

    const screenshotPath = testInfo.outputPath(`${screenshotName}.png`)
    const screenshot = await page.screenshot({
      animations: 'disabled',
      fullPage: false,
      path: screenshotPath,
    })
    await testInfo.attach(screenshotName, {
      contentType: 'image/png',
      path: screenshotPath,
    })
    expect(screenshot.byteLength).toBeGreaterThan(5_000)

    return {
      heading: initialSnapshot.simulation.spacecraft.heading,
      orbitRadius: magnitude(relativePosition),
      orbitSpeed: magnitude(relativeVelocity),
      viewportSize: cappedSnapshot.simulation.viewportSize,
    }
  }

  try {
    const earthMoon = await inspectScenario(
      '/?scenario=earth-moon',
      'desktop-earth-moon-zoom-out-cap',
    )
    const kepler = await inspectScenario(
      '/?scenario=earth-kepler-orbit-debug&engine=kepler',
      'desktop-kepler-zoom-out-cap',
    )

    expect(earthMoon.viewportSize).toBe(expectedCap)
    expect(kepler.viewportSize).toBe(earthMoon.viewportSize)
    expect(Math.abs(kepler.orbitRadius - earthMoon.orbitRadius)).toBeLessThan(
      5_000,
    )
    expect(Math.abs(kepler.orbitSpeed - earthMoon.orbitSpeed)).toBeLessThan(10)
    expect(Math.abs(kepler.heading - earthMoon.heading)).toBeLessThan(0.01)
  } finally {
    await context.close()
  }
})

test('boots the Kepler main menu with a one-body background', async ({
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
    await page.goto('/?engine=kepler')
    await expect(page.locator('[data-boot-screen]')).toBeHidden()
    await expect(page.locator('.main-menu')).toBeVisible()
    await page.waitForFunction(() =>
      Boolean(window.__SPACE_WEB_GAME_DEVTOOLS__),
    )

    const snapshot = await getSnapshot(page)
    expect(snapshot.appMode).toBe('menu')
    expect(snapshot.scenario.scenarioId).toBe('menu-background-kepler')
    expect(snapshot.simulation.bodies.map((body) => body.id)).toEqual(['earth'])

    const screenshotPath = testInfo.outputPath(
      'desktop-kepler-one-body-main-menu.png',
    )
    await page.screenshot({
      animations: 'disabled',
      fullPage: false,
      path: screenshotPath,
    })
    await testInfo.attach('desktop-kepler-one-body-main-menu', {
      contentType: 'image/png',
      path: screenshotPath,
    })
  } finally {
    await context.close()
  }
})

test('removes the retired trajectory model from developer flags', async ({
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
    await page.goto('/?devtools=1&trajectoryPrediction=kepler')
    await expect(page.locator('[data-boot-screen]')).toBeHidden()
    await page.getByRole('button', { name: 'Developer flags' }).click()
    await expect(
      page.getByLabel('Trajectory prediction implementation'),
    ).toHaveCount(0)
    await expect(page.getByLabel('Trajectory horizon')).toBeVisible()

    const screenshotPath = testInfo.outputPath(
      'desktop-developer-flags-without-trajectory-model.png',
    )
    await page.screenshot({
      animations: 'disabled',
      fullPage: false,
      path: screenshotPath,
    })
    await testInfo.attach('desktop-developer-flags-without-trajectory-model', {
      contentType: 'image/png',
      path: screenshotPath,
    })

    await page.getByRole('button', { name: 'Apply' }).click()
    await page.waitForURL(
      (url) => !url.searchParams.has('trajectoryPrediction'),
    )
  } finally {
    await context.close()
  }
})
