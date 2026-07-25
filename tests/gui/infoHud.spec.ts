import { expect, type Page, type TestInfo, test } from '@playwright/test'

type InfoHudModule = typeof import('../../src/ui/createInfoHud')

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

test('desktop Info creates persistent readouts while its popover is closed', async ({
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
    const popover = page.locator('#desktop-info-popover')
    const earthSwitch = popover.locator('[data-info-pin="body:earth"]')
    const moonSwitch = popover.locator('[data-info-pin="body:moon"]')
    const apsidesSwitch = popover.locator('[data-info-pin="apsides"]')
    const earthPinStatus = earthSwitch.locator('.info-hud-pin-status')
    const rail = page.locator('.desktop-info-rail')

    await expect(infoButton).toBeVisible()
    await expect(infoButton).toHaveAttribute('aria-expanded', 'false')
    await page.keyboard.press('KeyI')
    await expect(infoButton).toHaveAttribute('aria-expanded', 'true')
    await expect(popover).toBeVisible()
    await expect(popover.getByRole('switch')).toHaveCount(3)
    const targetRow = popover.locator('.info-hud-target-row-locked')
    await expect(targetRow).toHaveCount(1)
    await expect(popover.locator('.info-hud-target-row-context')).toHaveCount(0)
    await expect(popover.locator('.info-hud-target-row-telemetry')).toHaveCount(
      0,
    )
    await expect(popover.locator('[data-target-row-preview]')).toHaveCount(0)
    await expect(popover.locator('.target-body-sphere')).toHaveCount(2)
    await expect(
      popover.locator('[data-info-pin^="body:"] .info-hud-row-secondary'),
    ).toHaveText(['to spacecraft', 'to spacecraft'])
    await expect(popover.locator('[data-info-row="apsides"]')).toContainText(
      /Pe\s*·\s*.+\|\s*Ap\s*·\s*.+to (Earth|Moon)/,
    )
    await expect(popover.locator('.info-hud-row').first()).toHaveAttribute(
      'data-info-pin',
      'body:earth',
    )
    const targetStatus = earthSwitch.locator('.target-status-mark')
    await expect(targetStatus).toHaveClass(/target-status-mark-auto/)
    await expect(earthSwitch.locator('.info-hud-target-badge')).toHaveCount(0)
    await expect(earthSwitch).toHaveAttribute('aria-checked', 'true')
    await expect(earthSwitch).toBeDisabled()
    await expect(earthPinStatus).toHaveCount(0)
    await expect(targetRow.locator('.info-hud-pin-status')).toHaveCount(0)
    await expect(infoButton.locator('[role="status"]')).toHaveCount(0)
    await expect(
      popover.getByRole('button', { name: 'Select all' }),
    ).toHaveCount(0)

    const targetSelectorButton = page.getByRole('button', {
      name: 'Select target (T)',
    })
    const targetSelector = page.locator('.desktop-target-selector-popover')
    await targetSelectorButton.click()
    await targetSelector.getByRole('button', { name: /^Moon,/ }).click()
    await expect(moonSwitch).toHaveAttribute('aria-checked', 'true')
    await expect(moonSwitch).toBeDisabled()
    await expect(moonSwitch.locator('.target-status-mark')).toHaveClass(
      /target-status-mark-manual/,
    )
    await expect(earthSwitch).toHaveAttribute('aria-checked', 'false')
    await expect(earthSwitch).toBeEnabled()
    await expect(earthPinStatus).toHaveText('○')
    await captureScreenshot(
      page,
      testInfo,
      'desktop-info-target-row-locked-manual',
    )

    await targetSelectorButton.click()
    await targetSelector
      .getByRole('switch', { name: /^Automatic targeting off: Earth/ })
      .click()
    await expect(targetStatus).toHaveClass(/target-status-mark-auto/)
    await expect(earthSwitch).toHaveAttribute('aria-checked', 'true')
    await expect(earthSwitch).toBeDisabled()
    await expect(moonSwitch).toHaveAttribute('aria-checked', 'false')
    await expect(moonSwitch).toBeEnabled()
    await targetSelectorButton.click()

    await moonSwitch.click()
    await apsidesSwitch.click()
    await expect(earthSwitch).toHaveAttribute('aria-checked', 'true')
    await expect(earthPinStatus).toHaveCount(0)
    await expect(rail).toBeHidden()
    await captureScreenshot(page, testInfo, 'desktop-info-popover-selected')

    await page.mouse.click(24, 260)
    await expect(popover).toBeVisible()
    await expect(infoButton).toHaveAttribute('aria-expanded', 'true')

    await page.keyboard.press('KeyI')
    await expect(popover).toBeHidden()
    await expect(rail).toBeVisible()
    await expect(rail.locator('.info-hud-rail-card')).toHaveCount(2)
    await expect(rail.locator('[data-info-pin="body:earth"]')).toHaveCount(0)
    const moonReadoutSphere = rail.locator(
      '[data-info-pin="body:moon"] .target-body-sphere',
    )
    await expect(moonReadoutSphere).toBeVisible()
    await expect(
      rail.locator('[data-info-pin="apsides"] .target-body-sphere'),
    ).toHaveCount(0)
    const [moonRowColor, moonReadoutColor] = await Promise.all([
      moonSwitch
        .locator('.target-body-sphere')
        .evaluate((element) =>
          getComputedStyle(element)
            .getPropertyValue('--target-body-color')
            .trim(),
        ),
      moonReadoutSphere.evaluate((element) =>
        getComputedStyle(element)
          .getPropertyValue('--target-body-color')
          .trim(),
      ),
    ])
    expect(moonReadoutColor).toBe(moonRowColor)
    await expect(rail.locator('[data-info-pin="apsides"]')).toContainText(
      /^Pe\s*·\s*.+\|\s*Ap\s*·\s*.+$/,
    )
    const railPill = rail.locator('.info-hud-rail-pill').first()
    await expect(railPill).toHaveClass(/telemetry-pill/)
    await expect(
      rail.locator('[data-info-pin="apsides"] .info-hud-rail-distance').last(),
    ).toHaveText(/^\d+ km$/)
    const telemetryStyleComparison = await page.evaluate(() => {
      const targetPill = document.querySelector('.telemetry-pill-target')
      const railPill = document.querySelector('.info-hud-rail-pill')
      const targetValue = targetPill?.querySelector('strong')
      const railValue = railPill?.querySelector('strong')
      const targetSecondary = targetPill?.querySelector(
        '.telemetry-pill-secondary',
      )
      const railDistances = document.querySelectorAll(
        '.desktop-info-rail .info-hud-rail-distance',
      )
      if (
        !targetPill ||
        !railPill ||
        !targetValue ||
        !railValue ||
        !targetSecondary ||
        railDistances.length === 0
      ) {
        throw new Error('Target or rail telemetry pill is missing')
      }
      const readPillStyle = (element: Element) => {
        const style = getComputedStyle(element)
        return {
          backdropFilter: style.backdropFilter,
          backgroundColor: style.backgroundColor,
          borderRadius: style.borderRadius,
          borderTopWidth: style.borderTopWidth,
          paddingBottom: style.paddingBottom,
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
          paddingTop: style.paddingTop,
        }
      }
      const readValueStyle = (element: Element) => {
        const style = getComputedStyle(element)
        return {
          color: style.color,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          opacity: style.opacity,
          whiteSpace: style.whiteSpace,
        }
      }
      const targetSecondaryStyle = JSON.stringify(
        readValueStyle(targetSecondary),
      )
      return {
        pillMatches:
          JSON.stringify(readPillStyle(railPill)) ===
          JSON.stringify(readPillStyle(targetPill)),
        secondaryValuesMatch: [...railDistances].every(
          (distance) =>
            JSON.stringify(readValueStyle(distance)) === targetSecondaryStyle,
        ),
        valueMatches:
          JSON.stringify(readValueStyle(railValue)) ===
          JSON.stringify(readValueStyle(targetValue)),
      }
    })
    expect(telemetryStyleComparison).toEqual({
      pillMatches: true,
      secondaryValuesMatch: true,
      valueMatches: true,
    })
    await expect(rail).toHaveCSS('flex-direction', 'column')
    await expect(rail).toHaveCSS('overflow-y', 'auto')
    const railBounds = await rail.boundingBox()
    const lastReadoutBounds = await rail
      .locator('.info-hud-rail-card')
      .last()
      .boundingBox()
    if (!railBounds || !lastReadoutBounds) {
      throw new Error('Desktop Info rail or readout is missing')
    }
    const unusedRailHeight =
      railBounds.y +
      railBounds.height -
      (lastReadoutBounds.y + lastReadoutBounds.height)
    expect(unusedRailHeight).toBeLessThanOrEqual(6)
    await captureScreenshot(page, testInfo, 'desktop-info-readout-rail')

    await rail.locator('[data-info-pin="body:moon"]').click()
    await expect(rail.locator('[data-info-pin="body:moon"]')).toHaveCount(0)
    await page.keyboard.press('Shift+KeyI')
    await expect(rail).toBeHidden()
    await expect(infoButton.locator('[role="status"]')).toHaveCount(0)
  } finally {
    await context.close()
  }
})

test('mobile Info keeps compact readouts at the top right', async ({
  page,
}, testInfo) => {
  await page.goto('/?scenario=earth-moon')
  await waitForGame(page)

  const dock = page.locator('.mobile-command-dock')
  const infoButton = page.locator('#mobile-command-dock-info-button')
  const infoPanel = page.locator('#mobile-command-dock-info-panel')
  const flightButton = page.locator('#mobile-command-dock-flight-button')
  const flightPanel = page.locator('#mobile-command-dock-flight-panel')
  const rail = page.locator('.mobile-info-rail')
  await expect(infoButton).toHaveAttribute('aria-expanded', 'false')
  await infoButton.tap()
  await expect(infoButton).toHaveAttribute('aria-expanded', 'true')
  await expect(infoPanel).toBeVisible()
  await expect(infoPanel.getByRole('switch')).toHaveCount(3)
  await expect(infoPanel.locator('.info-hud-target-row-locked')).toHaveCount(1)
  await expect(infoPanel.locator('[data-target-row-preview]')).toHaveCount(0)
  await expect(
    infoPanel.locator('[data-info-pin^="body:"] .info-hud-row-secondary'),
  ).toHaveText(['to spacecraft', 'to spacecraft'])
  await expect(dock).toHaveAttribute('data-open-panel', 'info')

  const earthSwitch = infoPanel.locator('[data-info-pin="body:earth"]')
  await expect(earthSwitch).toHaveAttribute('aria-checked', 'true')
  await expect(earthSwitch).toBeDisabled()
  await expect(earthSwitch.locator('.info-hud-pin-status')).toHaveCount(0)
  await infoPanel.locator('[data-info-pin="apsides"]').tap()
  await expect(rail).toBeVisible()
  await expect(rail.locator('.info-hud-rail-card')).toHaveCount(1)
  const openPanelRailBounds = await rail.boundingBox()
  const openInfoPanelBounds = await infoPanel.boundingBox()
  if (!openPanelRailBounds || !openInfoPanelBounds) {
    throw new Error('Mobile Info rail or open panel is missing')
  }
  expect(
    openPanelRailBounds.y + openPanelRailBounds.height,
  ).toBeLessThanOrEqual(openInfoPanelBounds.y)
  await captureScreenshot(
    page,
    testInfo,
    'mobile-info-panel-selected-with-readout',
  )

  await infoButton.tap()
  await expect(infoPanel).toBeHidden()
  await expect(rail).toBeVisible()
  await expect(rail.locator('.info-hud-rail-card')).toHaveCount(1)
  await expect(rail.locator('[data-info-pin="body:earth"]')).toHaveCount(0)
  await expect(rail).toHaveCSS('flex-direction', 'column')
  await expect(rail).toHaveCSS('overflow-y', 'auto')
  const readoutSize = await rail
    .locator('[data-info-pin="apsides"]')
    .evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const pill = element.querySelector('.info-hud-rail-pill')
      if (!(pill instanceof HTMLElement)) {
        throw new Error('Mobile Info readout pill is missing')
      }
      return {
        height: bounds.height,
        pillHeight: pill.getBoundingClientRect().height,
        width: bounds.width,
      }
    })
  expect(readoutSize.height).toBeCloseTo(readoutSize.pillHeight)
  expect(readoutSize.height).toBeLessThan(42)
  expect(readoutSize.width).toBeGreaterThanOrEqual(42)
  const railBounds = await rail.boundingBox()
  const firstPillBounds = await rail
    .locator('.info-hud-rail-pill')
    .first()
    .boundingBox()
  const topBarBounds = await page.locator('.top-bar').boundingBox()
  const viewport = page.viewportSize()
  if (!railBounds || !firstPillBounds || !topBarBounds || !viewport) {
    throw new Error('Mobile Info rail, pill, top bar, or viewport is missing')
  }
  expect(railBounds.x).toBeGreaterThan(viewport.width / 2)
  expect(railBounds.x + railBounds.width).toBeLessThanOrEqual(
    viewport.width - 8,
  )
  const topBarBottom = topBarBounds.y + topBarBounds.height
  expect(firstPillBounds.y).toBeGreaterThanOrEqual(topBarBottom)
  expect(firstPillBounds.y - topBarBottom).toBeLessThanOrEqual(12)
  await captureScreenshot(page, testInfo, 'mobile-info-readout-rail')

  await flightButton.tap()
  await expect(flightPanel).toBeVisible()
  await expect(dock).toHaveAttribute('data-open-panel', 'flight')
  await expect(rail).toBeVisible()
  const railWithFlightBounds = await rail.boundingBox()
  const flightPanelBounds = await flightPanel.boundingBox()
  if (!railWithFlightBounds || !flightPanelBounds) {
    throw new Error('Mobile Info rail or Flight panel is missing')
  }
  expect(
    railWithFlightBounds.y + railWithFlightBounds.height,
  ).toBeLessThanOrEqual(flightPanelBounds.y)

  await rail.locator('[data-info-pin="apsides"]').tap()
  await expect(rail).toBeHidden()
  await page.keyboard.press('Shift+KeyI')
  await expect(rail).toBeHidden()
})

test('refreshes target context when unavailable apsis values stay unchanged', async ({
  page,
}) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const modulePath = '/src/ui/createInfoHud.tsx'
    const { createInfoHud } = (await import(modulePath)) as InfoHudModule
    const host = document.createElement('div')
    const desktopContainer = document.createElement('div')
    const mobilePanelContainer = document.createElement('div')
    const mobileRailContainer = document.createElement('div')
    host.append(desktopContainer, mobilePanelContainer, mobileRailContainer)
    document.body.append(host)

    let targetName = 'Earth'
    const getView = () => {
      const apsidesRow = {
        accessibleLabel: `Pe, altitude over ${targetName} —; Ap, altitude over ${targetName} —`,
        distanceLabel: '— | —',
        key: 'apsides',
        label: 'Pe / Ap',
        pin: { apsis: 'periapsis', kind: 'apsis' } as const,
        pinned: false,
        scenarioOwned: false,
        secondaryLabel: `to ${targetName}`,
      }

      return {
        clearAvailable: false,
        entries: [
          {
            key: 'apsides' as const,
            kind: 'apsides' as const,
            points: [
              { distanceLabel: '—', label: 'Pe' },
              { distanceLabel: '—', label: 'Ap' },
            ] as const,
            row: apsidesRow,
            secondaryLabel: `to ${targetName}`,
          },
        ],
        targetMode: 'manual' as const,
      }
    }
    const infoHud = createInfoHud({
      desktopContainer,
      getMobileSurfaceActive: () => false,
      getView,
      mobilePanelContainer,
      mobileRailContainer,
      onClear: () => undefined,
      onTogglePin: () => undefined,
      toggleMobileInfoPanel: () => undefined,
    })
    const readRow = () => {
      const row = mobilePanelContainer.querySelector(
        '[data-info-pin="apsides"]',
      )
      return {
        accessibleLabel: row?.getAttribute('aria-label'),
        secondaryLabel: mobilePanelContainer.querySelector(
          '.info-hud-apsis-row > .info-hud-row-secondary',
        )?.textContent,
      }
    }

    const before = readRow()
    targetName = 'Moon'
    infoHud.sync()
    const after = readRow()
    host.remove()

    return { after, before }
  })

  expect(result).toEqual({
    after: {
      accessibleLabel:
        'Pe, altitude over Moon —; Ap, altitude over Moon —, not selected',
      secondaryLabel: 'to Moon',
    },
    before: {
      accessibleLabel:
        'Pe, altitude over Earth —; Ap, altitude over Earth —, not selected',
      secondaryLabel: 'to Earth',
    },
  })
})

test('scenario-owned pins are exposed as checked, immutable switches', async ({
  page,
}, testInfo) => {
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
  await expect(moonSwitch.locator('.info-hud-pin-status')).toHaveText('◆')
  const rail = page.locator('.mobile-info-rail')
  await expect(rail).toBeVisible()

  await page.locator('#mobile-command-dock-info-button').tap()
  const moonReadout = rail.locator('[data-info-pin="body:moon"]')
  await expect(rail).toBeVisible()
  await expect(moonReadout).toBeDisabled()
  await expect(moonReadout).toContainText('Scenario')
  await expect(moonReadout.locator('.target-body-sphere')).toBeVisible()
  await captureScreenshot(page, testInfo, 'mobile-scenario-body-readout')
  await page.keyboard.press('Shift+KeyI')
  await expect(moonReadout).toBeVisible()
})
