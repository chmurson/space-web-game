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

const expectFinePointerHud = async (page: Page) => {
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--desktop-hud-overlay-scale')
          .trim(),
      ),
    )
    .toBe('1.25')
  await expect(page.locator('.top-menu')).toHaveCSS('zoom', '1.25')
  await expect(page.locator('.telemetry-strip')).toHaveCSS('zoom', '1.25')
  await expect(page.locator('.touch-controls')).toBeHidden()
  await expect(
    page.getByRole('button', { name: 'Select target (T)' }),
  ).toBeVisible()
}

const expectPopoverInsideViewport = async (page: Page) => {
  const popover = page.locator('.desktop-target-selector-popover')
  const [bounds, viewport] = await Promise.all([
    popover.boundingBox(),
    page.evaluate(() => ({
      height: window.innerHeight,
      width: window.innerWidth,
    })),
  ])

  expect(bounds).not.toBeNull()
  if (!bounds) {
    return
  }

  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height)
}

test.describe('fine-pointer target selector', () => {
  test.use({
    hasTouch: false,
    isMobile: false,
    viewport: { width: 1024, height: 720 },
  })

  test('opens from the target telemetry button and T shortcut', async ({
    page,
  }, testInfo) => {
    await startEarthMoonGame(page)

    const button = page.getByRole('button', { name: 'Select target (T)' })
    const popover = page.locator('.desktop-target-selector-popover')
    const selector = popover.getByLabel('Target body selector', { exact: true })

    await expectFinePointerHud(page)
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

  test('keeps Normal scale and target selection across zoom-equivalent effective widths', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 800, height: 450 })
    await startEarthMoonGame(page)

    const button = page.getByRole('button', { name: 'Select target (T)' })
    const popover = page.locator('.desktop-target-selector-popover')
    const targetName = page.locator('[data-stat="target"]')

    await expectFinePointerHud(page)
    await expect(targetName).not.toHaveCSS('position', 'absolute')
    await button.click()
    await expectPopoverInsideViewport(page)
    await attachScreenshot(
      page,
      testInfo,
      'fine-pointer-target-selector-800x450',
    )
    await page.keyboard.press('Escape')

    // A 1280-pixel browser viewport at 200% zoom has a 640-pixel effective
    // CSS width. Resizing to that effective size exercises the same breakpoint.
    await page.setViewportSize({ width: 640, height: 360 })
    await expectFinePointerHud(page)
    await expect(targetName).toHaveCSS('position', 'absolute')

    await button.click()
    await expect(popover).toBeVisible()
    await expectPopoverInsideViewport(page)
    await attachScreenshot(
      page,
      testInfo,
      'fine-pointer-target-selector-640x360',
    )

    await popover.getByRole('button', { name: /Moon/ }).click()
    await expect(popover).toBeHidden()
    await expect(targetName).toHaveText('Moon')

    await page.setViewportSize({ width: 800, height: 450 })
    await expectFinePointerHud(page)
    await expect(targetName).not.toHaveCSS('position', 'absolute')
    await expect(targetName).toHaveText('Moon')
  })
})

test.describe('touch/coarse target selector', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  })

  test('uses Nav instead of the desktop selector or an edge entry', async ({
    page,
  }) => {
    await startEarthMoonGame(page)

    await expect(
      page.getByRole('button', { name: 'Select target (T)' }),
    ).toBeHidden()
    await expect(page.locator('#touch-target-reveal')).toHaveCount(0)
    await page.getByRole('button', { name: 'Open Nav panel' }).click()
    const navPanel = page.locator('#mobile-command-dock-nav-panel')
    const targetButton = navPanel.locator('#mobile-command-dock-target-button')
    const targetSelector = navPanel.getByLabel('Target body selector')
    await expect(targetButton).toHaveAttribute('aria-expanded', 'false')
    await expect(targetSelector).toBeHidden()
    await targetButton.click()
    await expect(targetButton).toHaveAttribute('aria-expanded', 'true')
    await expect(targetSelector).toBeVisible()
  })
})
