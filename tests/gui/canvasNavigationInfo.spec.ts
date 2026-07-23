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
  const screenshot = await page.screenshot({ animations: 'disabled', path })
  await testInfo.attach(name, { contentType: 'image/png', path })
  expect(screenshot.byteLength).toBeGreaterThan(5_000)
}

test('connects desktop canvas navigation labels, pins, and physical offscreen distances', async ({
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
    await page.goto('/?scenario=earth-moon&devtools=1')
    await waitForGame(page)

    const earthLabel = page.locator('.body-label[data-info-pin="body:earth"]')
    await expect(earthLabel).toBeHidden()
    await page.keyboard.press('KeyI')
    const infoButton = page.getByRole('button', {
      name: 'Toggle Info panel (I)',
    })
    const infoPopover = page.locator('#desktop-info-popover')
    await expect(infoPopover).toBeVisible()
    const earthRow = infoPopover.locator('[data-info-pin="body:earth"]')
    const moonRow = infoPopover.locator('[data-info-pin="body:moon"]')
    const earthDistance =
      (await earthRow.locator('.info-hud-row-distance').textContent()) ?? ''
    const moonDistance =
      (await moonRow.locator('.info-hud-row-distance').textContent()) ?? ''

    await earthRow.click()
    await expect(earthLabel).toBeVisible()
    await expect(earthLabel).toHaveText(/^Earth · /)
    await expect(earthLabel).toHaveAttribute(
      'aria-label',
      /^Earth, altitude .+; unpin in Info$/,
    )
    await page.waitForTimeout(3_050)
    await expect(earthLabel).toHaveText(/^Earth · /)

    await earthLabel.dispatchEvent('click')
    await expect(earthLabel).toBeHidden()
    await expect(infoPopover).toBeVisible()
    await expect(earthRow).toHaveAttribute('aria-checked', 'false')
    await infoButton.click()

    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (
        await page
          .locator('[data-offscreen-target="__spacecraft__"]')
          .evaluate((element) => getComputedStyle(element).display !== 'none')
          .catch(() => false)
      ) {
        break
      }
      await page.mouse.move(760, 500)
      await page.mouse.down()
      await page.mouse.move(120, 500, { steps: 8 })
      await page.mouse.up()
    }

    const spacecraftIndicator = page.locator(
      '[data-offscreen-target="__spacecraft__"]',
    )
    const earthIndicator = page.locator('[data-offscreen-target="earth"]')
    const moonIndicator = page.locator('[data-offscreen-target="moon"]')
    await expect(spacecraftIndicator).toHaveClass(
      /offscreen-indicator-spacecraft/,
    )
    await expect(spacecraftIndicator.locator('.label')).toHaveText('Spacecraft')
    await expect(spacecraftIndicator.locator('.label')).not.toHaveText(/\d/)
    await expect(earthIndicator).toHaveClass(
      /offscreen-indicator-unpinned-body/,
    )
    await expect(earthIndicator).not.toHaveClass(
      /offscreen-indicator-active-target/,
    )
    await expect(earthIndicator.locator('.label')).toHaveText('')
    await expect(earthIndicator.locator('.pointer')).toHaveCSS('fill', 'none')
    await expect(moonIndicator).toHaveClass(/offscreen-indicator-unpinned-body/)

    await infoButton.click()
    await earthRow.click()
    await moonRow.click()
    await infoButton.click()

    await expect(earthIndicator).toHaveClass(
      /offscreen-indicator-active-target/,
    )
    await expect(earthIndicator.locator('.label')).toHaveText(
      `Earth · ${earthDistance}`,
    )
    await expect(moonIndicator).toHaveClass(/offscreen-indicator-pinned/)
    await expect(moonIndicator.locator('.label')).toHaveText(
      `Moon · ${moonDistance}`,
    )

    await captureScreenshot(
      page,
      testInfo,
      'desktop-canvas-navigation-selected-offscreen',
    )

    await infoButton.click()
    await infoPopover.getByRole('button', { name: 'Clear' }).click()
    await infoButton.click()
    await expect(earthIndicator).toHaveClass(
      /offscreen-indicator-unpinned-body/,
    )
    await expect(earthIndicator).not.toHaveClass(
      /offscreen-indicator-active-target/,
    )
    await expect(moonIndicator).toHaveClass(/offscreen-indicator-unpinned-body/)
    await expect(moonIndicator.locator('.label')).toHaveText('')
    await expect(moonIndicator.locator('.pointer')).toHaveCSS('fill', 'none')
  } finally {
    await context.close()
  }
})

test('gates mobile target and apsis tooltips on Info selection', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    colorScheme: 'dark',
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
    viewport: { height: 844, width: 390 },
  })
  const page = await context.newPage()

  try {
    await page.goto('/?scenario=earth-moon&devtools=1')
    await waitForGame(page)

    const activeTargetLabel = page.locator(
      '.body-label[data-info-pin="body:earth"]',
    )
    const infoButton = page.locator('#mobile-command-dock-info-button')
    const infoPanel = page.locator('#mobile-command-dock-info-panel')
    await expect(activeTargetLabel).toBeHidden()
    await infoButton.tap()
    await infoPanel.locator('[data-info-pin="body:earth"]').tap()
    await infoButton.tap()
    await expect(activeTargetLabel).toBeVisible()
    await expect(activeTargetLabel).toHaveText(/^Earth · /)

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const periapsisLabel = page.locator('.trajectory-event-label-periapsis')
      if (await periapsisLabel.isVisible()) {
        break
      }
      await page.locator('canvas').dispatchEvent('wheel', { deltaY: -500 })
    }
    const periapsisLabel = page.locator('.trajectory-event-label-periapsis')
    await expect(periapsisLabel).toBeVisible()
    await expect(periapsisLabel).toHaveText('Pe')
    await expect(periapsisLabel).toHaveAttribute('aria-pressed', 'false')
    expect(
      await periapsisLabel.evaluate(
        (element) => getComputedStyle(element, '::after').display,
      ),
    ).toBe('none')

    await infoButton.tap()
    await infoPanel.locator('[data-info-pin="periapsis"]').tap()
    await infoButton.tap()
    await expect(periapsisLabel).toHaveAttribute('aria-pressed', 'true')
    expect(
      await periapsisLabel.evaluate(
        (element) => getComputedStyle(element, '::after').display,
      ),
    ).toBe('block')
    await expect(periapsisLabel).toHaveAttribute(
      'data-tooltip',
      /^Pe · \d+(?:\.\d+)? (?:km|Mm)$/,
    )
    const visibleOrbitLabels = page.locator('.trajectory-event-label:visible')
    const orbitLabelTexts = await visibleOrbitLabels.allTextContents()
    expect(orbitLabelTexts.every((text) => /^(?:Pe|Ap)$/.test(text))).toBe(true)

    await captureScreenshot(
      page,
      testInfo,
      'mobile-canvas-navigation-active-target',
    )
  } finally {
    await context.close()
  }
})
