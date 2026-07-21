import { expect, type Page, type TestInfo, test } from '@playwright/test'

test.use({
  hasTouch: false,
  isMobile: false,
  viewport: { width: 1280, height: 720 },
})

const startReachMoonMission = async (page: Page) => {
  await page.goto('/')

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

test('names the centered target for desktop keyboard camera actions', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  const notice = page.locator('.hud-notice-transient')
  await page.keyboard.press('KeyC')
  await expect(notice).toBeVisible()
  await expect(notice.locator('.hud-notice-title')).toHaveText(
    'Camera centered',
  )
  await expect(notice.locator('.hud-notice-body')).toHaveText('Earth')

  await page.keyboard.press('KeyC')
  await expect(notice.locator('.hud-notice-body')).toHaveText('Spacecraft')

  await page.keyboard.press('Shift+KeyC')
  await expect(notice.locator('.hud-notice-body')).toHaveText('Spacecraft')
  await attachScreenshot(page, testInfo, 'desktop-camera-centered-notice')
})

test('does not show camera notices for unassigned L or pointer drag', async ({
  page,
}) => {
  await startReachMoonMission(page)

  await page.keyboard.press('KeyL')

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

  await expect(page.locator('.hud-notice-transient')).toBeHidden()
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
