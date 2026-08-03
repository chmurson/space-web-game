import { expect, type Page, type TestInfo, test } from '@playwright/test'

const getSnapshot = async (page: Page) =>
  page.evaluate(() => {
    const bridge = window.__SPACE_WEB_GAME_DEVTOOLS__
    if (!bridge) {
      throw new Error('Missing space-web-game devtools bridge.')
    }
    return bridge.getSnapshot()
  })

const runKeplerPlaytest = async (
  page: Page,
  testInfo: TestInfo,
  viewportName: 'desktop' | 'mobile',
) => {
  await page.goto(
    '/?scenario=earth-kepler-orbit-debug&devtools=1&engine=kepler&trajectoryPrediction=kepler',
  )
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

  const initialElapsed = (await getSnapshot(page)).simulation.elapsed
  await expect
    .poll(async () => (await getSnapshot(page)).simulation.elapsed)
    .toBeGreaterThan(initialElapsed)

  const snapshot = await getSnapshot(page)
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
  expect(new URL(page.url()).searchParams.get('trajectoryPrediction')).toBe(
    'kepler',
  )

  const screenshotPath = testInfo.outputPath(
    `${viewportName}-kepler-trajectory.png`,
  )
  const screenshot = await page.screenshot({
    animations: 'disabled',
    fullPage: false,
    path: screenshotPath,
  })
  await testInfo.attach(`${viewportName}-kepler-trajectory`, {
    contentType: 'image/png',
    path: screenshotPath,
  })
  expect(screenshot.byteLength).toBeGreaterThan(5_000)
}

test('keeps Kepler trajectory prediction active on desktop', async ({
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

test('keeps Kepler trajectory prediction active on mobile', async ({
  page,
}, testInfo) => {
  await runKeplerPlaytest(page, testInfo, 'mobile')
})
