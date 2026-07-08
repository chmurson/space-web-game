import { expect, type Page, type TestInfo, test } from '@playwright/test'

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

  await attachScreenshot(page, testInfo, 'desktop-camera-mode-notice')
})
