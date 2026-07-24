import { expect, test } from '@playwright/test'

test('leaves browser zoom gestures separate from game camera zoom', async ({
  page,
}) => {
  await page.goto('/?scenario=earth-moon&devtools=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()
  await page.waitForFunction(() => Boolean(window.__SPACE_WEB_GAME_DEVTOOLS__))

  const result = await page.evaluate(() => {
    const getViewportSize = () =>
      window.__SPACE_WEB_GAME_DEVTOOLS__?.getSnapshot().simulation
        .viewportSize ?? null
    const dispatchKey = (options: {
      code: string
      ctrlKey?: boolean
      key: string
      metaKey?: boolean
    }) => {
      const keydownAllowed = window.dispatchEvent(
        new KeyboardEvent('keydown', {
          ...options,
          bubbles: true,
          cancelable: true,
        }),
      )
      window.dispatchEvent(
        new KeyboardEvent('keyup', {
          ...options,
          bubbles: true,
        }),
      )
      return keydownAllowed
    }
    const dispatchWheel = (options: { ctrlKey?: boolean; metaKey?: boolean }) =>
      window.dispatchEvent(
        new WheelEvent('wheel', {
          ...options,
          bubbles: true,
          cancelable: true,
          deltaY: -120,
        }),
      )

    const initialViewportSize = getViewportSize()
    const browserEventsAllowed = [
      dispatchKey({ code: 'Equal', ctrlKey: true, key: '+' }),
      dispatchKey({ code: 'Minus', key: '-', metaKey: true }),
      dispatchWheel({ ctrlKey: true }),
      dispatchWheel({ metaKey: true }),
    ]
    const viewportSizeAfterBrowserGestures = getViewportSize()

    dispatchKey({ code: 'Equal', key: '+' })

    return {
      browserEventsAllowed,
      initialViewportSize,
      viewportSizeAfterBrowserGestures,
      viewportSizeAfterPlainGameZoom: getViewportSize(),
    }
  })

  expect(result.initialViewportSize).not.toBeNull()
  expect(result.browserEventsAllowed).toEqual([true, true, true, true])
  expect(result.viewportSizeAfterBrowserGestures).toBe(
    result.initialViewportSize,
  )
  expect(result.viewportSizeAfterPlainGameZoom).toBeLessThan(
    result.initialViewportSize ?? 0,
  )
})
