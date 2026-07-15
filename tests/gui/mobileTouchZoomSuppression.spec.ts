import { expect, test } from '@playwright/test'

test('suppresses browser zoom from DOM game UI without swallowing app events', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(() => {
    const app = document.querySelector<HTMLElement>('#app')
    const button = app?.querySelector<HTMLButtonElement>('.main-menu button')
    if (!app || !button) {
      throw new Error('Missing guarded app or main-menu button')
    }

    const eventLog: string[] = []
    button.addEventListener('touchstart', (event) => {
      eventLog.push(`button:${event.touches.length}`)
    })
    app.addEventListener('touchstart', (event) => {
      eventLog.push(`app:${event.touches.length}`)
    })

    const dispatchTouch = (
      type: 'touchend' | 'touchmove' | 'touchstart',
      count: number,
    ) => {
      const touches = Array.from(
        { length: count },
        (_, index) =>
          new Touch({
            clientX: 20 + index * 22,
            clientY: 20,
            identifier: index,
            target: button,
          }),
      )
      const activeTouches = type === 'touchend' ? [] : touches
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

    const singleTouchStartPrevented = dispatchTouch('touchstart', 1)
    const multiTouchStartPrevented = dispatchTouch('touchstart', 2)
    const multiTouchMovePrevented = dispatchTouch('touchmove', 2)
    const multiTouchEndPrevented = dispatchTouch('touchend', 2)

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
      guardAttribute: app.dataset.nativeTouchZoomSuppressed,
      multiTouchEndPrevented,
      multiTouchMovePrevented,
      multiTouchStartPrevented,
      singleTouchStartPrevented,
      touchAction: app.style.touchAction,
    }
  })

  expect(result).toEqual({
    doubleClickPrevented: true,
    eventLog: ['button:1', 'app:1', 'button:2', 'app:2'],
    gestureStartPrevented: true,
    guardAttribute: 'true',
    multiTouchEndPrevented: true,
    multiTouchMovePrevented: true,
    multiTouchStartPrevented: true,
    singleTouchStartPrevented: false,
    touchAction: 'none',
  })
})

test('covers all DOM game surfaces with one top-level guard', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(() => {
    const app = document.querySelector<HTMLElement>('#app')
    const canvas = app?.querySelector('canvas')
    const viewport = document.querySelector<HTMLMetaElement>(
      'meta[name="viewport"]',
    )
    if (!app || !canvas || !viewport) {
      throw new Error('Missing app, canvas, or viewport policy')
    }

    const selectors = {
      bottomHud: '.bottom-pill-area',
      crashMenu: '.crash-menu',
      inGameControls: '.in-game-controls-menu',
      mainMenu: '.main-menu',
      scenarioLoading: '.scenario-loading-overlay',
      scenarioPrompt: '.scenario-prompt-backdrop',
      topHud: '.top-bar',
      touchControls: '.touch-controls',
      uiSettings: '.ui-settings-dialog',
    }

    const surfacesInsideGuard = Object.fromEntries(
      Object.entries(selectors).map(([name, selector]) => {
        const element = document.querySelector<HTMLElement>(selector)
        if (!element) {
          throw new Error(`Missing ${selector}`)
        }
        return [name, app.contains(element)]
      }),
    )

    return {
      canvasTouchAction: getComputedStyle(canvas).touchAction,
      surfacesInsideGuard,
      viewportContent: viewport.content,
    }
  })

  expect(result.surfacesInsideGuard).toEqual({
    bottomHud: true,
    crashMenu: true,
    inGameControls: true,
    mainMenu: true,
    scenarioLoading: true,
    scenarioPrompt: true,
    topHud: true,
    touchControls: true,
    uiSettings: true,
  })
  expect(result.canvasTouchAction).toBe('none')
  expect(result.viewportContent).toContain('maximum-scale=1.0')
  expect(result.viewportContent).toContain('user-scalable=no')
})
