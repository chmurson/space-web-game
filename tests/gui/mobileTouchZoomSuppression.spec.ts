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

test('prevents rapid repeated button taps while preserving button activation', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(
      '[data-in-game-action="increaseCoastHorizon"]',
    )
    if (!button || button.disabled) {
      throw new Error('Missing enabled prediction-horizon increase button')
    }

    let clickCount = 0
    let nextTouchIdentifier = 1
    button.addEventListener('click', () => {
      clickCount += 1
    })

    const createTouch = () =>
      new Touch({
        clientX: 40,
        clientY: 40,
        identifier: nextTouchIdentifier++,
        target: button,
      })

    const dispatchTouch = (
      type: 'touchend' | 'touchstart',
      activeTouches: Touch[],
      changedTouches: Touch[],
    ) => {
      const event = new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        changedTouches,
        targetTouches: activeTouches,
        touches: activeTouches,
      })
      button.dispatchEvent(event)
      return event.defaultPrevented
    }

    const dispatchSingleTap = () => {
      const touch = createTouch()
      const touchStartPrevented = dispatchTouch('touchstart', [touch], [touch])
      const touchEndPrevented = dispatchTouch('touchend', [], [touch])
      return { touchEndPrevented, touchStartPrevented }
    }

    const firstTap = dispatchSingleTap()
    button.click()
    const secondTap = dispatchSingleTap()
    const clickCountAfterDoubleTap = clickCount

    const multiTouches = [createTouch(), createTouch()]
    const multiTouchStartPrevented = dispatchTouch(
      'touchstart',
      multiTouches,
      multiTouches,
    )
    const multiTouchEndPrevented = dispatchTouch('touchend', [], multiTouches)

    const tapAfterMultiTouch = dispatchSingleTap()
    button.click()

    return {
      clickCountAfterDoubleTap,
      finalClickCount: clickCount,
      firstTap,
      multiTouchEndPrevented,
      multiTouchStartPrevented,
      secondTap,
      tapAfterMultiTouch,
      touchAction: getComputedStyle(button).touchAction,
    }
  })

  expect(result).toEqual({
    clickCountAfterDoubleTap: 2,
    finalClickCount: 3,
    firstTap: {
      touchEndPrevented: false,
      touchStartPrevented: false,
    },
    multiTouchEndPrevented: true,
    multiTouchStartPrevented: true,
    secondTap: {
      touchEndPrevented: true,
      touchStartPrevented: false,
    },
    tapAfterMultiTouch: {
      touchEndPrevented: false,
      touchStartPrevented: false,
    },
    touchAction: 'manipulation',
  })
})

test('prevents rapid repeated taps on non-interactable DOM without swallowing touch handlers', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(() => {
    const app = document.querySelector<HTMLElement>('#app')
    const staticSurface = document.querySelector<HTMLElement>(
      '[data-main-menu-view="main"] .main-menu-copy',
    )
    if (!app || !staticSurface) {
      throw new Error('Missing guarded app or static main-menu surface')
    }

    const input = document.createElement('input')
    input.type = 'text'
    app.appendChild(input)

    let nextTouchIdentifier = 1
    let staticTouchEndCount = 0
    let inputTouchEndCount = 0
    staticSurface.addEventListener('touchend', () => {
      staticTouchEndCount += 1
    })
    input.addEventListener('touchend', () => {
      inputTouchEndCount += 1
    })

    const dispatchSingleTap = (target: Element) => {
      const touch = new Touch({
        clientX: 40,
        clientY: 40,
        identifier: nextTouchIdentifier++,
        target,
      })
      const touchStart = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        changedTouches: [touch],
        targetTouches: [touch],
        touches: [touch],
      })
      target.dispatchEvent(touchStart)

      const touchEnd = new TouchEvent('touchend', {
        bubbles: true,
        cancelable: true,
        changedTouches: [touch],
        targetTouches: [],
        touches: [],
      })
      target.dispatchEvent(touchEnd)

      return {
        touchEndPrevented: touchEnd.defaultPrevented,
        touchStartPrevented: touchStart.defaultPrevented,
      }
    }

    const firstStaticTap = dispatchSingleTap(staticSurface)
    const secondStaticTap = dispatchSingleTap(staticSurface)
    const tapAfterCompletedDoubleTap = dispatchSingleTap(staticSurface)
    const firstInputTap = dispatchSingleTap(input)
    const secondInputTap = dispatchSingleTap(input)
    input.remove()

    return {
      firstInputTap,
      firstStaticTap,
      inputTouchEndCount,
      secondInputTap,
      secondStaticTap,
      staticTouchEndCount,
      tapAfterCompletedDoubleTap,
    }
  })

  expect(result).toEqual({
    firstInputTap: {
      touchEndPrevented: false,
      touchStartPrevented: false,
    },
    firstStaticTap: {
      touchEndPrevented: false,
      touchStartPrevented: false,
    },
    inputTouchEndCount: 2,
    secondInputTap: {
      touchEndPrevented: false,
      touchStartPrevented: false,
    },
    secondStaticTap: {
      touchEndPrevented: true,
      touchStartPrevented: false,
    },
    staticTouchEndCount: 3,
    tapAfterCompletedDoubleTap: {
      touchEndPrevented: false,
      touchStartPrevented: false,
    },
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
      bottomHud: '[data-visible="false"][role="status"]',
      crashMenu: '[data-crash-menu-action="restart"]',
      inGameControls: '[data-in-game-action="openUiSettings"]',
      mainMenu: '[data-main-menu-view="main"]',
      scenarioLoading: '[data-visible="false"] > [role="status"]',
      scenarioPrompt: '[data-prompt-mode="modal"]',
      topHud: '[data-menu-action="toggleDebugMode"]',
      touchControls: '.mobile-command-dock',
      uiSettings: '[data-dialog-close="true"]',
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
