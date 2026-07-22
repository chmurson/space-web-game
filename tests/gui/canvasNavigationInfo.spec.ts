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

    const activeTargetLabel = page.locator('.body-label-active-target')
    await expect(activeTargetLabel).toBeVisible()
    await expect(activeTargetLabel).toHaveText(/^Earth · /)
    await expect(activeTargetLabel).toHaveAttribute(
      'aria-label',
      /^Earth, altitude .+; pin in Info$/,
    )

    await page.waitForTimeout(3_050)
    await expect(activeTargetLabel).toHaveText(/^\d+(?:\.\d+)? (?:km|Mm)$/)
    await expect(activeTargetLabel).toHaveAttribute(
      'aria-label',
      /^Earth, altitude /,
    )

    const targetSelectorButton = page.getByRole('button', {
      name: 'Select target (T)',
    })
    const targetSelectorPopover = page.locator(
      '.desktop-target-selector-popover',
    )
    await page.evaluate(() => {
      const bridge = window.__SPACE_WEB_GAME_DEVTOOLS__
      const followResponse = bridge?.handleRequest({
        follow: 'target',
        type: 'set-camera-follow',
      })
      const recenterResponse = bridge?.handleRequest({
        type: 'recenter-camera',
      })
      if (!followResponse?.ok || !recenterResponse?.ok) {
        throw new Error('Failed to follow and recenter the active target')
      }
    })
    await targetSelectorButton.click()
    await targetSelectorPopover.getByRole('button', { name: /Moon/ }).click()
    await expect(activeTargetLabel).toHaveText(/^Moon · /)
    await targetSelectorButton.click()
    await targetSelectorPopover.getByRole('button', { name: /Earth/ }).click()
    await expect(activeTargetLabel).toHaveText(/^Earth · /)

    await activeTargetLabel.click()
    await expect(activeTargetLabel).toHaveAttribute('aria-pressed', 'true')
    await activeTargetLabel.click()
    await expect(activeTargetLabel).toHaveAttribute('aria-pressed', 'false')

    const activeTargetBounds = await activeTargetLabel.boundingBox()
    expect(activeTargetBounds).not.toBeNull()
    if (!activeTargetBounds) {
      throw new Error('Active target label has no bounds')
    }
    await page.mouse.click(
      activeTargetBounds.x - 10,
      activeTargetBounds.y + activeTargetBounds.height * 0.5,
    )
    await expect(activeTargetLabel).toHaveAttribute('aria-pressed', 'true')

    await page.keyboard.press('KeyI')
    const infoPopover = page.locator('#desktop-info-popover')
    await expect(infoPopover).toBeVisible()
    const earthRow = infoPopover.locator('[data-info-pin="body:earth"]')
    const moonRow = infoPopover.locator('[data-info-pin="body:moon"]')
    const earthDistance =
      (await earthRow.locator('.info-hud-row-distance').textContent()) ?? ''
    const moonDistance =
      (await moonRow.locator('.info-hud-row-distance').textContent()) ?? ''
    await moonRow.click()
    await expect(moonRow).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('KeyI')

    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (
        await page
          .locator('.offscreen-indicator-spacecraft')
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
      'desktop-canvas-navigation-offscreen-pins',
    )

    await page.keyboard.press('Shift+KeyI')
    await expect(moonIndicator).toHaveClass(/offscreen-indicator-unpinned-body/)
    await expect(moonIndicator.locator('.label')).toHaveText('')
    await expect(moonIndicator.locator('.pointer')).toHaveCSS('fill', 'none')
  } finally {
    await context.close()
  }
})

test('keeps mobile target labels tappable without exposing numeric Pe/Ap canvas labels', async ({
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

    const activeTargetLabel = page.locator('.body-label-active-target')
    await expect(activeTargetLabel).toBeVisible()
    await expect(activeTargetLabel).toHaveText(/^Earth · /)
    await activeTargetLabel.dispatchEvent('click')
    await expect(activeTargetLabel).toHaveAttribute('aria-pressed', 'true')

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
    await periapsisLabel.dispatchEvent('click')
    await expect(periapsisLabel).toHaveAttribute('aria-pressed', 'true')
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
