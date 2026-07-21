import { expect, type Page, type TestInfo, test } from '@playwright/test'

const waitForGame = async (page: Page) => {
  await expect(page.locator('[data-boot-screen]')).toBeHidden()
}

const captureScreenshot = async (
  page: Page,
  testInfo: TestInfo,
  name: string,
) => {
  const path = testInfo.outputPath(`${name}.png`)
  const screenshot = await page.screenshot({
    animations: 'disabled',
    path,
  })
  await testInfo.attach(name, { contentType: 'image/png', path })
  expect(screenshot.byteLength).toBeGreaterThan(5_000)
}

test('desktop Info popover manages player pins and leaves the rail persistent', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    colorScheme: 'dark',
    hasTouch: false,
    isMobile: false,
    reducedMotion: 'reduce',
    viewport: { height: 720, width: 1024 },
  })
  const page = await context.newPage()

  try {
    await page.goto('/?scenario=earth-moon')
    await waitForGame(page)

    const infoButton = page.getByRole('button', {
      name: 'Toggle Info panel (I)',
    })
    const popover = page.locator('#desktop-info-popover')
    const earthSwitch = popover.locator('[data-info-pin="body:earth"]')

    await expect(infoButton).toBeVisible()
    await expect(infoButton).toHaveAttribute('aria-expanded', 'false')
    await page.keyboard.press('KeyI')
    await expect(infoButton).toHaveAttribute('aria-expanded', 'true')
    await expect(popover).toBeVisible()
    await expect(popover.getByRole('switch')).toHaveCount(4)
    await expect(earthSwitch).toHaveAttribute('aria-checked', 'false')

    await earthSwitch.click()
    await expect(earthSwitch).toHaveAttribute('aria-checked', 'true')
    await captureScreenshot(page, testInfo, 'desktop-info-popover-pinned')

    await page.keyboard.press('KeyI')
    await expect(popover).toBeHidden()
    await expect(
      page.locator('.desktop-info-rail [data-info-pin="body:earth"]'),
    ).toBeVisible()

    await page.keyboard.press('Shift+KeyI')
    await expect(page.locator('.desktop-info-rail')).toBeHidden()
  } finally {
    await context.close()
  }
})

test('mobile Info panel is one-open-at-a-time and keeps pins above the dock', async ({
  page,
}, testInfo) => {
  await page.goto('/?scenario=earth-moon')
  await waitForGame(page)

  const dock = page.locator('.mobile-command-dock')
  const infoButton = page.locator('#mobile-command-dock-info-button')
  const infoPanel = page.locator('#mobile-command-dock-info-panel')
  const flightButton = page.locator('#mobile-command-dock-flight-button')
  const flightPanel = page.locator('#mobile-command-dock-flight-panel')

  await expect(infoButton).toHaveAttribute('aria-expanded', 'false')
  await infoButton.tap()
  await expect(infoButton).toHaveAttribute('aria-expanded', 'true')
  await expect(infoPanel).toBeVisible()
  await expect(infoPanel.getByRole('switch')).toHaveCount(4)
  await expect(dock).toHaveAttribute('data-open-panel', 'info')

  await infoPanel.locator('[data-info-pin="body:earth"]').tap()
  const railCard = page.locator(
    '.mobile-info-rail [data-info-pin="body:earth"]',
  )
  await expect(railCard).toBeVisible()

  const [railBounds, dockBounds] = await Promise.all([
    railCard.boundingBox(),
    page.locator('.mobile-command-dock-bar').boundingBox(),
  ])
  expect(railBounds).not.toBeNull()
  expect(dockBounds).not.toBeNull()
  expect((railBounds?.y ?? 0) + (railBounds?.height ?? 0)).toBeLessThanOrEqual(
    dockBounds?.y ?? 0,
  )
  await captureScreenshot(page, testInfo, 'mobile-info-panel-pinned')

  await flightButton.tap()
  await expect(infoPanel).toBeHidden()
  await expect(flightPanel).toBeVisible()
  await expect(dock).toHaveAttribute('data-open-panel', 'flight')
  await expect(railCard).toBeVisible()

  await page.keyboard.press('Shift+KeyI')
  await expect(page.locator('.mobile-info-rail')).toBeHidden()
})

test('scenario-owned pins are exposed as checked, immutable switches', async ({
  page,
}) => {
  await page.goto('/?scenario=reach-moon')
  await waitForGame(page)

  const confirmButton = page.locator('[data-role="confirm"]')
  if (await confirmButton.isVisible()) {
    await confirmButton.tap()
  }

  await page.locator('#mobile-command-dock-info-button').tap()
  const moonSwitch = page
    .locator('#mobile-command-dock-info-panel')
    .locator('[data-info-pin="body:moon"]')

  await expect(moonSwitch).toHaveAttribute('role', 'switch')
  await expect(moonSwitch).toHaveAttribute('aria-checked', 'true')
  await expect(moonSwitch).toBeDisabled()
  await expect(moonSwitch).toContainText('Scenario')
  await expect(
    page.locator('.mobile-info-rail [data-info-pin="body:moon"]'),
  ).toBeDisabled()
})
