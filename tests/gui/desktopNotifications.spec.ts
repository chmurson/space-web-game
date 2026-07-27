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

test('distinguishes desktop camera following and centering actions', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000)
  await startReachMoonMission(page)

  const notice = page.locator('.hud-notice-transient')
  await page.keyboard.press('KeyC')
  await expect(notice).toBeVisible()
  await expect(notice.locator('.hud-notice-title')).toHaveText(
    'Camera following',
  )
  await expect(notice.locator('.hud-notice-body')).toHaveText(
    'Current target · Earth',
  )

  await page.keyboard.press('KeyC')
  await expect(notice.locator('.hud-notice-title')).toHaveText(
    'Camera following',
  )
  await expect(notice.locator('.hud-notice-body')).toHaveText('Spacecraft')

  await page.keyboard.press('Shift+KeyC')
  await expect(notice.locator('.hud-notice-title')).toHaveText(
    'Camera centered',
  )
  await expect(notice.locator('.hud-notice-body')).toHaveText('Spacecraft')

  await page.keyboard.press('KeyC')
  const targetSelectorButton = page.getByRole('button', {
    name: 'Select target (T)',
  })
  await targetSelectorButton.click()
  const targetSelector = page.locator('.desktop-target-selector-popover')
  await targetSelector.getByRole('button', { name: /Moon/ }).click()

  await expect(notice.locator('.hud-notice-title')).toHaveText(
    'Camera following',
  )
  await expect(notice.locator('.hud-notice-body')).toHaveText(
    'Current target · Moon',
  )
  await expect
    .poll(async () =>
      notice
        .locator('.hud-notice-title')
        .evaluate((element) =>
          Math.ceil(element.scrollWidth - element.clientWidth),
        ),
    )
    .toBe(0)
  await attachScreenshot(page, testInfo, 'desktop-camera-following-target')

  await page.keyboard.press('Shift+KeyC')
  await expect(notice.locator('.hud-notice-title')).toHaveText(
    'Camera centered',
  )
  await expect(notice.locator('.hud-notice-body')).toHaveText(
    'Current target · Moon',
  )
  await attachScreenshot(page, testInfo, 'desktop-camera-centered-target')

  await page.keyboard.press('KeyC')
  await targetSelectorButton.click()
  await targetSelector.getByRole('button', { name: /Earth/ }).click()
  await expect(notice.locator('.hud-notice-title')).toHaveText(
    'Camera following',
  )
  await expect(notice.locator('.hud-notice-body')).toHaveText('Spacecraft')
})

test('does not show camera notices for modified C, unassigned L, or pointer drag', async ({
  page,
}) => {
  await startReachMoonMission(page)

  for (const shortcut of [
    'Alt+KeyC',
    'Control+KeyC',
    'Meta+KeyC',
    'Alt+Shift+KeyC',
    'Control+Shift+KeyC',
    'Meta+Shift+KeyC',
  ]) {
    await page.keyboard.press(shortcut)
  }
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

test('shows only Camera settings in desktop UI settings', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page.getByRole('button', { name: 'Open in-game controls' }).click()
  await page.getByRole('button', { name: 'UI settings' }).click()

  const uiSettingsDialog = page.getByRole('dialog', { name: 'UI settings' })
  const cameraSettingsButton = uiSettingsDialog.getByRole('button', {
    name: 'Camera settings: Camera preferences',
  })
  await expect(uiSettingsDialog).toBeVisible()
  await expect(cameraSettingsButton).toBeVisible()
  await expect(
    uiSettingsDialog.getByRole('button', {
      name: /Spacecraft controls settings/,
    }),
  ).toHaveCount(0)
  await expect(
    uiSettingsDialog.getByRole('button', { name: /Orbit point display/ }),
  ).toHaveCount(0)

  await cameraSettingsButton.click()
  const dialog = page.getByRole('dialog', { name: 'Camera settings' })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole('group', { name: 'Camera', exact: true }),
  ).toBeVisible()
  const panCameraGroup = dialog.getByRole('group', { name: 'Pan camera' })
  await expect(panCameraGroup.getByRole('radio')).toHaveCount(3)
  await expect(
    panCameraGroup.getByRole('radio', {
      name: 'Wheel / trackpad',
      exact: true,
    }),
  ).toBeChecked()
  await expect(dialog.getByText('Wheel / trackpad pan speed')).toBeVisible()
  await expect(
    dialog.getByRole('switch', { name: 'Turn on scrolling by edge pan' }),
  ).toHaveCount(0)
  await expect(
    dialog.getByRole('group', { name: 'Control sides' }),
  ).toHaveCount(0)
  await expect(dialog.getByRole('group', { name: 'Maneuvers' })).toHaveCount(0)
  await expect(dialog.getByText('Starts by drag or tap')).toHaveCount(0)
  await expect(dialog.getByText('Show closest/farthest markers')).toHaveCount(0)

  await attachScreenshot(page, testInfo, 'desktop-camera-settings-dialog')
})
