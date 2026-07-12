import { expect, test } from '@playwright/test'

type TouchControlsShellModule =
  typeof import('../../src/ui/touchControls/touchControlsShell')

test('renders the touch controls shell and dock host hooks through Preact', async ({
  page,
}) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const touchControlsShellModulePath =
      '/src/ui/touchControls/touchControlsShell.tsx'
    const { createTouchControlsShell } = (await import(
      touchControlsShellModulePath
    )) as TouchControlsShellModule
    const shell = createTouchControlsShell()
    document.body.append(shell.element)

    const dockSummaries = Object.entries(shell.docks).map(([dockId, dock]) => ({
      className: dock.className,
      dataDock: dock.dataset.touchControlDock,
      dockId,
      parentClassName: dock.parentElement?.className,
    }))

    return {
      dockCount: shell.element.querySelectorAll('.touch-edge-reveal-dock')
        .length,
      dockSummaries,
      rootClassName: shell.element.className,
      rootTagName: shell.element.tagName,
    }
  })

  expect(result).toEqual({
    dockCount: 5,
    dockSummaries: [
      {
        className: 'touch-edge-reveal-dock touch-time-warp-reveal-dock',
        dataDock: 'warp',
        dockId: 'warp',
        parentClassName: 'touch-controls',
      },
      {
        className:
          'touch-edge-reveal-dock touch-time-warp-prototype-reveal-dock',
        dataDock: 'warpPrototype',
        dockId: 'warpPrototype',
        parentClassName: 'touch-controls',
      },
      {
        className:
          'touch-edge-reveal-dock touch-trajectory-horizon-reveal-dock',
        dataDock: 'trajectory',
        dockId: 'trajectory',
        parentClassName: 'touch-controls',
      },
      {
        className: 'touch-edge-reveal-dock touch-target-reveal-dock',
        dataDock: 'target',
        dockId: 'target',
        parentClassName: 'touch-controls',
      },
      {
        className: 'touch-edge-reveal-dock touch-thrust-reveal-dock',
        dataDock: 'burn',
        dockId: 'burn',
        parentClassName: 'touch-controls',
      },
    ],
    rootClassName: 'touch-controls',
    rootTagName: 'SECTION',
  })
})
