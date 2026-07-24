import { expect, test } from '@playwright/test'

type TouchControlsShellModule =
  typeof import('../../src/ui/touchControls/touchControlsShell')

test('renders the touch controls shell without legacy edge docks', async ({
  page,
}) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const touchControlsShellModulePath =
      '/src/ui/touchControls/touchControlsShell.ts'
    const { createTouchControlsShell } = (await import(
      touchControlsShellModulePath
    )) as TouchControlsShellModule
    const shell = createTouchControlsShell()
    document.body.append(shell.element)

    return {
      dockCount: shell.element.querySelectorAll('.touch-edge-reveal-dock')
        .length,
      rootClassName: shell.element.className,
      rootTagName: shell.element.tagName,
    }
  })

  expect(result).toEqual({
    dockCount: 0,
    rootClassName: 'touch-controls',
    rootTagName: 'SECTION',
  })
})
