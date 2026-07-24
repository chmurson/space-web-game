import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
  test,
} from '@playwright/test'

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

const expectReceivesPointerEvents = async (locator: Locator) => {
  // World-space labels move every frame, so verify hit-testing explicitly
  // before skipping Playwright's stability wait.
  const receivesPointerEvents = await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const target = document.elementFromPoint(
      bounds.x + bounds.width * 0.5,
      bounds.y + bounds.height * 0.5,
    )
    return target === element || (target !== null && element.contains(target))
  })
  expect(receivesPointerEvents).toBe(true)
}

test('keeps selected distances in the rail while offscreen arrows stay unlabeled', async ({
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

    const infoButton = page.getByRole('button', {
      name: 'Toggle Info panel (I)',
    })
    const infoPopover = page.locator('#desktop-info-popover')
    await infoButton.click()
    await infoPopover.locator('[data-info-pin="body:moon"]').click()
    await infoPopover.locator('[data-info-pin="apsides"]').click()
    await infoButton.click()

    const rail = page.locator('.desktop-info-rail')
    await expect(rail).toBeVisible()
    await expect(rail.locator('.info-hud-rail-card')).toHaveCount(2)

    const canvas = page.locator('canvas')
    const spacecraftIndicator = page.locator(
      '[data-offscreen-target="__spacecraft__"]',
    )
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (
        await spacecraftIndicator
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

    const earthIndicator = page.locator('[data-offscreen-target="earth"]')
    const moonIndicator = page.locator('[data-offscreen-target="moon"]')
    const bodyIndicators = page.locator(
      '[data-offscreen-target="earth"], [data-offscreen-target="moon"]',
    )

    await expect(spacecraftIndicator).toHaveClass(
      /offscreen-indicator-spacecraft/,
    )
    await expect(spacecraftIndicator).toHaveClass(
      /offscreen-indicator-unlabeled/,
    )
    await expect(spacecraftIndicator).toHaveAttribute(
      'aria-label',
      'Spacecraft, off screen',
    )
    await expect(spacecraftIndicator.locator('.label')).toHaveText('')
    await expect(spacecraftIndicator.locator('.pointer')).toHaveCSS(
      'fill',
      'rgb(244, 247, 251)',
    )

    for (const indicator of [earthIndicator, moonIndicator]) {
      await expect(indicator).toHaveClass(/offscreen-indicator-body/)
      await expect(indicator).toHaveClass(/offscreen-indicator-unlabeled/)
      await expect(indicator.locator('.label')).toHaveText('')
      await expect(indicator.locator('.pointer')).toHaveCSS('fill', 'none')
    }
    await expect(bodyIndicators).toHaveCount(2)
    const activeTarget = page.locator(
      '.offscreen-indicator-body.offscreen-indicator-active-target',
    )
    await expect(activeTarget).toHaveCount(1)
    const activeTargetId = await activeTarget.getAttribute(
      'data-offscreen-target',
    )
    expect(activeTargetId).toMatch(/^(?:earth|moon)$/)

    await captureScreenshot(
      page,
      testInfo,
      'desktop-selected-readouts-unlabeled-offscreen',
    )

    await page.keyboard.press('Shift+KeyI')
    await expect(rail).toBeHidden()
    await expect(
      page.locator(`[data-offscreen-target="${activeTargetId ?? 'missing'}"]`),
    ).toHaveClass(/offscreen-indicator-active-target/)
    await expect(earthIndicator.locator('.pointer')).toHaveCSS('fill', 'none')
    await expect(moonIndicator.locator('.pointer')).toHaveCSS('fill', 'none')
    await expect(canvas).toBeVisible()
  } finally {
    await context.close()
  }
})

test('uses viewport-entry timing and small-body size independently of selection', async ({
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

    const earthLabel = page.locator('.body-label[data-info-pin="body:earth"]')
    await expect(earthLabel).toBeVisible()
    await expect(earthLabel).toHaveText('Earth')
    await expect(earthLabel).not.toHaveAttribute('title')
    await expect(earthLabel).toHaveAttribute(
      'aria-label',
      'Earth; select in Info',
    )
    await page.waitForTimeout(3_050)
    await expect(earthLabel).toBeHidden()

    const infoButton = page.getByRole('button', {
      name: 'Toggle Info panel (I)',
    })
    const targetSelectorButton = page.getByRole('button', {
      name: 'Select target (T)',
    })
    const targetSelector = page.locator('.desktop-target-selector-popover')
    await targetSelectorButton.click()
    await targetSelector.getByRole('button', { name: /^Moon,/ }).click()
    await infoButton.click()
    await page
      .locator('#desktop-info-popover [data-info-pin="body:earth"]')
      .click()
    await infoButton.click()
    await expect(
      page.locator('.desktop-info-rail [data-info-pin="body:earth"]'),
    ).toBeVisible()
    await expect(earthLabel).toBeHidden()

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await page.locator('canvas').dispatchEvent('wheel', { deltaY: 500 })
      if (await earthLabel.isVisible()) {
        break
      }
    }
    await expect(earthLabel).toBeVisible()
    await expect(earthLabel).toHaveText('Earth')
    await expectReceivesPointerEvents(earthLabel)
    await earthLabel.click({ force: true })
    await expect(
      page.locator('.desktop-info-rail [data-info-pin="body:earth"]'),
    ).toHaveCount(0)
  } finally {
    await context.close()
  }
})

test('shows selected Pe and Ap as label-only markers with one mobile readout', async ({
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

    const infoButton = page.locator('#mobile-command-dock-info-button')
    const infoPanel = page.locator('#mobile-command-dock-info-panel')
    const periapsisLabel = page.locator('.trajectory-event-label-periapsis')
    const apoapsisLabel = page.locator('.trajectory-event-label-apoapsis')
    const rail = page.locator('.mobile-info-rail')

    await expect(periapsisLabel).toBeHidden()
    await expect(apoapsisLabel).toBeHidden()
    await infoButton.tap()
    const apsidesRow = infoPanel.locator('[data-info-pin="apsides"]')
    await apsidesRow.tap()
    await expect(apsidesRow).toHaveAttribute('aria-checked', 'true')
    await expect(rail).toBeVisible()
    await infoButton.tap()

    await expect(rail).toBeVisible()
    await expect(rail.locator('.info-hud-rail-card')).toHaveCount(1)
    await expect(rail.locator('[data-info-pin="apsides"]')).toContainText(
      /^Pe\s*·\s*.+\|\s*Ap\s*·\s*.+$/,
    )

    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (await periapsisLabel.isVisible()) {
        break
      }
      await page.locator('canvas').dispatchEvent('wheel', { deltaY: -500 })
    }
    await expect(periapsisLabel).toBeVisible()
    await expect(periapsisLabel).toHaveText('Pe')
    await expect(periapsisLabel).toHaveAttribute('aria-pressed', 'true')
    await expect(periapsisLabel).not.toHaveAttribute('data-tooltip')
    await expect(periapsisLabel).not.toHaveAttribute('title')
    await expect(periapsisLabel).toHaveAccessibleName(
      'Periapsis; unselect Pe and Ap in Info',
    )
    const orbitLabelTexts = await page
      .locator('.trajectory-event-label:visible')
      .allTextContents()
    expect(orbitLabelTexts.length).toBeGreaterThan(0)
    expect(orbitLabelTexts.every((text) => /^(?:Pe|Ap)$/.test(text))).toBe(true)

    await captureScreenshot(
      page,
      testInfo,
      'mobile-selected-apsides-readout-and-markers',
    )

    await expectReceivesPointerEvents(periapsisLabel)
    await periapsisLabel.tap({ force: true })
    await expect(periapsisLabel).toBeHidden()
    await expect(apoapsisLabel).toBeHidden()
    await expect(rail).toBeHidden()
    await infoButton.tap()
    await expect(apsidesRow).toHaveAttribute('aria-checked', 'false')
  } finally {
    await context.close()
  }
})
