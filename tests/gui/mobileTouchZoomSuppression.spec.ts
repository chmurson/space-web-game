import { expect, test } from '@playwright/test'

type NativeTouchZoomSuppressionModule =
  typeof import('../../src/ui/nativeTouchZoomSuppression')

test('suppresses native zoom defaults without swallowing app-owned touch events', async ({
  page,
}) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const nativeTouchZoomSuppressionModulePath =
      '/src/ui/nativeTouchZoomSuppression.ts'
    const { installNativeTouchZoomSuppression } = (await import(
      nativeTouchZoomSuppressionModulePath
    )) as NativeTouchZoomSuppressionModule
    const parent = document.createElement('div')
    const root = document.createElement('div')
    const button = document.createElement('button')
    const eventLog: string[] = []

    button.textContent = 'Guarded control'
    root.append(button)
    parent.append(root)
    document.body.append(parent)

    installNativeTouchZoomSuppression(root)

    button.addEventListener('touchstart', () => {
      eventLog.push('button-touchstart')
    })
    parent.addEventListener('touchstart', () => {
      eventLog.push('parent-touchstart')
    })

    const createTouch = (id: number, x: number, y: number) =>
      new Touch({
        clientX: x,
        clientY: y,
        identifier: id,
        target: button,
      })

    const dispatchTouch = (
      type: 'touchcancel' | 'touchend' | 'touchmove' | 'touchstart',
      points: Array<{ id: number; x: number; y: number }>,
    ) => {
      const touches = points.map((point) =>
        createTouch(point.id, point.x, point.y),
      )
      const activeTouches =
        type === 'touchcancel' || type === 'touchend' ? [] : touches
      const event = new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        changedTouches: touches,
        targetTouches: activeTouches,
        touches: activeTouches,
      })
      button.dispatchEvent(event)
      return event.defaultPrevented
    }

    const singleTouchStartPrevented = dispatchTouch('touchstart', [
      { id: 1, x: 20, y: 20 },
    ])
    const multiTouchStartPrevented = dispatchTouch('touchstart', [
      { id: 2, x: 20, y: 20 },
      { id: 3, x: 42, y: 20 },
    ])
    const multiTouchMovePrevented = dispatchTouch('touchmove', [
      { id: 2, x: 16, y: 20 },
      { id: 3, x: 48, y: 20 },
    ])
    const multiTouchEndPrevented = dispatchTouch('touchend', [
      { id: 2, x: 16, y: 20 },
      { id: 3, x: 48, y: 20 },
    ])

    const doubleClickEvent = new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
    })
    button.dispatchEvent(doubleClickEvent)

    const gestureStartEvent = new Event('gesturestart', {
      bubbles: true,
      cancelable: true,
    })
    button.dispatchEvent(gestureStartEvent)

    return {
      doubleClickPrevented: doubleClickEvent.defaultPrevented,
      eventLog,
      gestureStartPrevented: gestureStartEvent.defaultPrevented,
      guardAttribute: root.dataset.nativeTouchZoomSuppressed,
      multiTouchEndPrevented,
      multiTouchMovePrevented,
      multiTouchStartPrevented,
      singleTouchStartPrevented,
      touchAction: root.style.touchAction,
    }
  })

  expect(result).toEqual({
    doubleClickPrevented: true,
    eventLog: [
      'button-touchstart',
      'parent-touchstart',
      'button-touchstart',
      'parent-touchstart',
    ],
    gestureStartPrevented: true,
    guardAttribute: 'true',
    multiTouchEndPrevented: true,
    multiTouchMovePrevented: true,
    multiTouchStartPrevented: true,
    singleTouchStartPrevented: false,
    touchAction: 'none',
  })
})

test('installs scoped zoom suppression on gameplay HUD and overlay roots', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(() => {
    const selectors = {
      bottomHud: '.bottom-pill-area',
      inGameControls: '.in-game-controls-menu',
      scenarioPrompt: '.scenario-prompt-backdrop',
      topHud: '.top-bar',
      uiSettings: '.ui-settings-dialog',
    }

    return Object.fromEntries(
      Object.entries(selectors).map(([name, selector]) => {
        const element = document.querySelector<HTMLElement>(selector)
        if (!element) {
          throw new Error(`Missing ${selector}`)
        }

        return [
          name,
          {
            guardAttribute: element.dataset.nativeTouchZoomSuppressed,
            touchAction: element.style.touchAction,
          },
        ]
      }),
    )
  })

  expect(result).toEqual({
    bottomHud: { guardAttribute: 'true', touchAction: 'none' },
    inGameControls: { guardAttribute: 'true', touchAction: 'none' },
    scenarioPrompt: { guardAttribute: 'true', touchAction: 'none' },
    topHud: { guardAttribute: 'true', touchAction: 'none' },
    uiSettings: { guardAttribute: 'true', touchAction: 'none' },
  })

  await expect(page.locator('.touch-controls')).toHaveCSS(
    'touch-action',
    'none',
  )
})
