import { expect, test } from '@playwright/test'

test('keeps the scenario loading overlay adapter state and delayed hide behavior', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(async () => {
    const modulePath = '/src/ui/createScenarioLoadingOverlay.ts'
    const { createScenarioLoadingOverlay } = await import(modulePath)
    const app = document.createElement('div')
    document.body.append(app)

    const overlay = createScenarioLoadingOverlay({ app })
    const root = app.querySelector(
      '.scenario-loading-overlay',
    ) as HTMLElement | null
    const panel = root?.querySelector(
      '.scenario-loading-panel',
    ) as HTMLElement | null
    const spinner = root?.querySelector(
      '.scenario-loading-spinner',
    ) as HTMLElement | null
    const label = root?.querySelector(
      '.scenario-loading-label',
    ) as HTMLElement | null

    const readState = () => ({
      ariaHidden: root?.getAttribute('aria-hidden'),
      dataVisible: root?.dataset.visible,
      hidden: root?.hidden,
      label: label?.textContent,
    })

    const initial = readState()
    overlay.setVisible(false)
    const redundantHidden = readState()
    overlay.setVisible(true, 'Preparing Moon')
    const visible = readState()
    overlay.setVisible(false)
    const hiding = readState()
    await new Promise((resolve) => window.setTimeout(resolve, 180))
    const delayedHidden = readState()
    overlay.setVisible(true)
    const defaultVisible = readState()
    overlay.setVisible(false)
    overlay.setVisible(true, 'Still loading')
    await new Promise((resolve) => window.setTimeout(resolve, 180))
    const visibleAfterCanceledHide = readState()

    return {
      defaultVisible,
      delayedHidden,
      hiding,
      initial,
      panelAriaLive: panel?.getAttribute('aria-live'),
      panelRole: panel?.getAttribute('role'),
      redundantHidden,
      spinnerAriaHidden: spinner?.getAttribute('aria-hidden'),
      visible,
      visibleAfterCanceledHide,
    }
  })

  expect(result).toEqual({
    defaultVisible: {
      ariaHidden: 'false',
      dataVisible: 'true',
      hidden: false,
      label: 'Loading scenario',
    },
    delayedHidden: {
      ariaHidden: 'true',
      dataVisible: 'false',
      hidden: true,
      label: 'Loading scenario',
    },
    hiding: {
      ariaHidden: 'true',
      dataVisible: 'false',
      hidden: false,
      label: 'Loading scenario',
    },
    initial: {
      ariaHidden: 'true',
      dataVisible: 'false',
      hidden: true,
      label: 'Loading scenario',
    },
    panelAriaLive: 'polite',
    panelRole: 'status',
    redundantHidden: {
      ariaHidden: 'true',
      dataVisible: 'false',
      hidden: true,
      label: 'Loading scenario',
    },
    spinnerAriaHidden: 'true',
    visible: {
      ariaHidden: 'false',
      dataVisible: 'true',
      hidden: false,
      label: 'Preparing Moon',
    },
    visibleAfterCanceledHide: {
      ariaHidden: 'false',
      dataVisible: 'true',
      hidden: false,
      label: 'Still loading',
    },
  })
})
