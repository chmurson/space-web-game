import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
  test,
} from '@playwright/test'

test.use({
  hasTouch: false,
  isMobile: false,
  viewport: { width: 1280, height: 720 },
})

const startReachMoonMission = async (page: Page) => {
  await page.goto('/?reachmoon=1')

  await expect(page.locator('[data-boot-screen]')).toBeHidden()
  await expect(page.locator('.main-menu')).toBeVisible()
  await page.getByRole('button', { name: 'Reach the Moon' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(
    page.getByRole('heading', { name: 'Reach the Moon' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Start mission' }).click()
  await expect(page.locator('.scenario-prompt')).toBeHidden()
  await expect(page.locator('.touch-controls')).toBeHidden()
}

const attachScreenshot = async (
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

const expectNoticeInsideViewport = async (notice: Locator) => {
  await expect(notice).toHaveCSS('opacity', '1')

  const metrics = await notice.evaluate((noticeElement) => {
    const rect = noticeElement.getBoundingClientRect()
    const style = getComputedStyle(noticeElement)

    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      opacity: style.opacity,
      right: rect.right,
      top: rect.top,
      visibility: style.visibility,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      width: rect.width,
    }
  })

  expect(metrics.width).toBeGreaterThan(0)
  expect(metrics.height).toBeGreaterThan(0)
  expect(metrics.top).toBeGreaterThanOrEqual(0)
  expect(metrics.left).toBeGreaterThanOrEqual(0)
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth)
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.viewportHeight)
  expect(metrics.opacity).toBe('1')
  expect(metrics.visibility).toBe('visible')
}

test('shows transient bottom notices on desktop', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page.keyboard.press('KeyC')

  const notice = page.locator('.hud-notice-transient')
  await expect(notice).toBeVisible()
  await expect(notice.locator('.hud-notice-title')).toHaveText('Camera mode')
  await expect(notice.locator('.hud-notice-body')).toHaveText('Target')
  await expect(notice).toHaveAttribute('aria-label', 'Camera mode: Target')

  await expectNoticeInsideViewport(notice)

  await attachScreenshot(page, testInfo, 'desktop-camera-mode-notice')
})

test('shows camera unlock notice when desktop drag unlocks follow camera', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  const canvasBox = await canvas.boundingBox()
  if (!canvasBox) {
    throw new Error('Expected game canvas to have a visible bounding box')
  }

  const startX = canvasBox.x + 120
  const startY = canvasBox.y + canvasBox.height / 2
  const endX = canvasBox.x + canvasBox.width - 120
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(endX, startY, { steps: 8 })
  await page.mouse.up()

  const notice = page.locator('.hud-notice-transient')
  await expect(notice).toBeVisible()
  await expect(notice.locator('.hud-notice-title')).toHaveText(
    'Camera unlocked',
  )
  await expect(notice.locator('.hud-notice-body')).toHaveText('')
  await expect(notice).toHaveAttribute(
    'aria-label',
    'Camera unlocked. Drag anywhere to pan.',
  )
  await expectNoticeInsideViewport(notice)

  await attachScreenshot(page, testInfo, 'desktop-camera-drag-unlock-notice')
})

test('hides mobile-only spacecraft settings in desktop UI settings', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page.getByRole('button', { name: 'Open in-game controls' }).click()
  await page.getByRole('button', { name: 'UI settings' }).click()

  const spacecraftSettingsButton = page.getByRole('button', {
    name: /Spacecraft controls settings/,
  })
  await expect(spacecraftSettingsButton).toBeVisible()
  await expect(spacecraftSettingsButton).toHaveAccessibleName(
    'Spacecraft controls settings: Keyboard and mouse active',
  )
  await expect(spacecraftSettingsButton).not.toContainText('Burn')
  await expect(spacecraftSettingsButton).not.toContainText('warp')
  await expect(spacecraftSettingsButton).not.toContainText('target')
  await expect(spacecraftSettingsButton).not.toContainText('trajectory')
  await expect(spacecraftSettingsButton).not.toContainText('maneuver')

  await spacecraftSettingsButton.click()
  const dialog = page.getByRole('dialog', {
    name: 'Spacecraft controls settings',
  })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Keyboard and mouse active')).toBeVisible()
  await expect(
    dialog.getByRole('group', { name: 'Control sides' }),
  ).toBeHidden()
  await expect(dialog.getByRole('group', { name: 'Maneuvers' })).toBeHidden()
  await expect(dialog.getByText('Burn side')).toBeHidden()
  await expect(dialog.getByText('Trajectory side')).toBeHidden()
  await expect(dialog.getByText('Starts by drag or tap')).toBeHidden()

  await attachScreenshot(
    page,
    testInfo,
    'desktop-spacecraft-controls-settings-dialog',
  )
})
