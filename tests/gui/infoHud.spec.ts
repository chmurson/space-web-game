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

test('desktop Info keeps selections in one persistent popover', async ({
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

    const infoButton = page.getByRole('button', {
      name: 'Toggle Info panel (I)',
    })
    const popover = page.locator('#desktop-info-popover')
    const earthSwitch = popover.locator('[data-info-pin="body:earth"]')
    const earthPinStatus = earthSwitch.locator('.info-hud-pin-status')

    await expect(infoButton).toBeVisible()
    await expect(infoButton).toHaveAttribute('aria-expanded', 'false')
    await page.keyboard.press('KeyI')
    await expect(infoButton).toHaveAttribute('aria-expanded', 'true')
    await expect(popover).toBeVisible()
    await expect(popover.getByRole('switch')).toHaveCount(3)
    await expect(popover.locator('.target-body-sphere')).toHaveCount(2)
    await expect(
      popover.locator('[data-info-pin^="body:"] .info-hud-row-secondary'),
    ).toHaveText(['to spacecraft', 'to spacecraft'])
    await expect(popover.locator('[data-info-row="apsides"]')).toContainText(
      /Pe\s*·\s*.+\|\s*Ap\s*·\s*.+to (Earth|Moon)/,
    )
    await expect(earthSwitch).toHaveAttribute('aria-checked', 'false')
    await expect(earthPinStatus).toHaveText('○')
    const selectAllButton = popover.getByRole('button', {
      name: 'Select all',
    })
    await expect(selectAllButton).toBeEnabled()

    await earthSwitch.click()
    await expect(earthSwitch).toHaveAttribute('aria-checked', 'true')
    await expect(earthPinStatus).toHaveText('●')
    await captureScreenshot(page, testInfo, 'desktop-info-popover-pinned')

    await page.mouse.click(24, 260)
    await expect(popover).toBeVisible()
    await expect(infoButton).toHaveAttribute('aria-expanded', 'true')

    await selectAllButton.click()
    await expect(selectAllButton).toBeDisabled()
    await expect(page.locator('.info-hud-rail')).toHaveCount(0)
    await expect(infoButton.locator('[aria-label="3 selected"]')).toBeVisible()

    await page.keyboard.press('KeyI')
    await expect(popover).toBeHidden()

    await page.keyboard.press('Shift+KeyI')
    await expect(infoButton.locator('[aria-label$="selected"]')).toHaveCount(0)
  } finally {
    await context.close()
  }
})

test('mobile Info panel keeps selection inside the dock surface', async ({
  page,
}, testInfo) => {
  await page.goto('/?scenario=earth-moon')
  await waitForGame(page)

  const dock = page.locator('.mobile-command-dock')
  const infoButton = page.locator('#mobile-command-dock-info-button')
  const infoPanel = page.locator('#mobile-command-dock-info-panel')
  const flightButton = page.locator('#mobile-command-dock-flight-button')
  const flightPanel = page.locator('#mobile-command-dock-flight-panel')
  await expect(infoButton).toHaveAttribute('aria-expanded', 'false')
  await infoButton.tap()
  await expect(infoButton).toHaveAttribute('aria-expanded', 'true')
  await expect(infoPanel).toBeVisible()
  await expect(infoPanel.getByRole('switch')).toHaveCount(3)
  await expect(
    infoPanel.locator('[data-info-pin^="body:"] .info-hud-row-secondary'),
  ).toHaveText(['to spacecraft', 'to spacecraft'])
  await expect(dock).toHaveAttribute('data-open-panel', 'info')

  await infoPanel.locator('[data-info-pin="body:earth"]').tap()
  await expect(
    infoPanel.locator('[data-info-pin="body:earth"]'),
  ).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('.mobile-command-dock-info-rail-host')).toHaveCount(
    0,
  )
  await captureScreenshot(page, testInfo, 'mobile-info-panel-selected')

  await flightButton.tap()
  await expect(infoPanel).toBeHidden()
  await expect(flightPanel).toBeVisible()
  await expect(dock).toHaveAttribute('data-open-panel', 'flight')

  await page.keyboard.press('Shift+KeyI')
  await expect(page.locator('.info-hud-rail')).toHaveCount(0)
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
    host.append(desktopContainer, mobilePanelContainer)
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
        rows: [apsidesRow],
        selectedCount: 0,
      }
    }
    const infoHud = createInfoHud({
      desktopContainer,
      getMobileSurfaceActive: () => false,
      getView,
      mobilePanelContainer,
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
}) => {
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
  await expect(page.locator('.info-hud-rail')).toHaveCount(0)
})
