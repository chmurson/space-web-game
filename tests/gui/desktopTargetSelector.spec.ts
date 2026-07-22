import { expect, type Page, type TestInfo, test } from '@playwright/test'

const startEarthMoonGame = async (page: Page) => {
  await page.goto('/?scenario=earth-moon&devtools=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()
  await expect(page.locator('.telemetry-pill-target')).toBeVisible()
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

test('opens the desktop target selector from the target telemetry button and T shortcut', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 720 })
  await startEarthMoonGame(page)

  const button = page.getByRole('button', { name: 'Select target (T)' })
  const popover = page.locator('.desktop-target-selector-popover')
  const selector = popover.getByLabel('Target body selector', { exact: true })

  await expect(button).toBeVisible()
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(selector).toBeHidden()

  await button.click()

  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await expect(selector).toBeVisible()
  await expect(popover.getByRole('button', { name: /Moon/ })).toBeVisible()
  await attachScreenshot(page, testInfo, 'desktop-target-selector-open')

  await page.keyboard.press('KeyT')
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(selector).toBeHidden()

  await page.keyboard.press('KeyT')
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await expect(selector).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(selector).toBeHidden()

  await button.click()
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await expect(selector).toBeVisible()

  await page.mouse.click(24, 140)
  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(selector).toBeHidden()
})

test('uses Nav instead of the desktop selector or an edge entry on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await startEarthMoonGame(page)

  await expect(
    page.getByRole('button', { name: 'Select target (T)' }),
  ).toBeHidden()
  await expect(page.locator('#touch-target-reveal')).toHaveCount(0)
  await page.getByRole('button', { name: 'Open Nav panel' }).click()
  await expect(
    page
      .getByRole('region', { name: 'Target' })
      .getByLabel('Target body selector'),
  ).toBeVisible()
})
