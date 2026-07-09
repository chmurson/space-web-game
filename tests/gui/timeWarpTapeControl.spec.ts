import { expect, test } from '@playwright/test'
import type { TimeWarpAction } from '../../src/runtime/timeWarpFeedbackPolicy'
import type { TimeWarpPreview } from '../../src/ui/touchControls/timeWarpControlTypes'

type TimeWarpTapeControlModule =
  typeof import('../../src/ui/touchControls/timeWarpTapeControl/createTimeWarpTapeControl')

type TimeWarpTapeTestState = {
  commits: string[]
  index: number
}

test('supports mouse dragging the Time Warp tape left faster and right slower', async ({
  page,
}) => {
  await page.goto('/')

  const center = await page.evaluate(async () => {
    const timeWarpTapeControlModulePath =
      '/src/ui/touchControls/timeWarpTapeControl/createTimeWarpTapeControl.ts'
    const { createTimeWarpTapeControl } = (await import(
      timeWarpTapeControlModulePath
    )) as TimeWarpTapeControlModule
    const values = [1, 2, 3, 4, 5]
    const state: TimeWarpTapeTestState = {
      commits: [],
      index: 2,
    }
    ;(
      window as Window & {
        __timeWarpTapeTestState?: TimeWarpTapeTestState
      }
    ).__timeWarpTapeTestState = state
    const panel = document.createElement('div')
    panel.id = 'time-warp-tape-test-panel'
    panel.style.position = 'fixed'
    panel.style.left = '20px'
    panel.style.top = '20px'
    panel.style.width = '360px'
    panel.style.zIndex = '99999'
    document.body.append(panel)

    const getPreviews = (
      action: TimeWarpAction,
      count: number,
    ): TimeWarpPreview[] => {
      const direction = action === 'increaseTimeWarp' ? 1 : -1
      const previews: TimeWarpPreview[] = []
      let cursor = state.index
      const getBlockedReason = (
        blockedAction: TimeWarpAction,
      ): TimeWarpPreview['reason'] => {
        if (blockedAction === 'increaseTimeWarp') {
          return 'global-max'
        }
        return 'global-min'
      }

      for (let step = 0; step < count; step += 1) {
        const nextIndex = Math.max(
          0,
          Math.min(values.length - 1, cursor + direction),
        )
        const canCommit = nextIndex !== cursor
        const reason: TimeWarpPreview['reason'] = canCommit
          ? null
          : getBlockedReason(action)
        previews.push({
          canCommit,
          reason,
          value: values[nextIndex] ?? values[cursor] ?? 1,
        })
        if (!canCommit) {
          break
        }
        cursor = nextIndex
      }

      return previews
    }

    createTimeWarpTapeControl({
      commitTimeWarp: (action) => {
        state.commits.push(action)
        state.index = Math.max(
          0,
          Math.min(
            values.length - 1,
            state.index + (action === 'increaseTimeWarp' ? 1 : -1),
          ),
        )
      },
      getCurrentTimeWarp: () => values[state.index] ?? 1,
      getTimeWarpPreview: (action) => getPreviews(action, 1)[0],
      getTimeWarpPreviews: getPreviews,
      onSessionChange: () => undefined,
      panel,
    })

    const element = panel.querySelector<HTMLElement>('.touch-time-warp-tape')
    if (!element) {
      throw new Error('Time Warp tape did not render')
    }
    const rect = element.getBoundingClientRect()
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  })

  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x - 20, center.y)
  await page.mouse.up()

  const testTapeValue = page.locator(
    '#time-warp-tape-test-panel .touch-time-warp-tape-header strong',
  )
  await expect(testTapeValue).toHaveText('x4s')

  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + 20, center.y)
  await page.mouse.up()

  await expect(testTapeValue).toHaveText('x3s')
  const state = await page.evaluate(
    () =>
      (
        window as Window & {
          __timeWarpTapeTestState?: TimeWarpTapeTestState
        }
      ).__timeWarpTapeTestState,
  )
  expect(state).toEqual({
    commits: ['increaseTimeWarp', 'decreaseTimeWarp'],
    index: 2,
  })
})

test('commits mobile touch drags through the edge reveal coordinator', async ({
  page,
}) => {
  await page.goto('/?reachmoon=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  await page.getByRole('button', { name: 'Reach the Moon' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Start mission' }).click()
  await expect(page.locator('.scenario-prompt')).toBeHidden()

  await page.getByRole('button', { name: 'Reveal time warp control' }).click()
  const tape = page.locator('#touch-time-warp-reveal .touch-time-warp-tape')
  await expect(tape).toBeVisible()

  const box = await tape.boundingBox()
  if (!box) {
    throw new Error('Time Warp tape has no bounding box')
  }

  await page.evaluate(
    ({ startX, x, y }) => {
      const target = document.querySelector<HTMLElement>(
        '#touch-time-warp-reveal .touch-time-warp-tape',
      )
      if (!target) {
        throw new Error('Missing Time Warp tape target')
      }

      const dispatchTouch = (
        type: 'touchend' | 'touchmove' | 'touchstart',
        pointX: number,
      ) => {
        const touch = new Touch({
          clientX: pointX,
          clientY: y,
          identifier: 41,
          target,
        })
        const activeTouches = type === 'touchend' ? [] : [touch]
        target.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            changedTouches: [touch],
            targetTouches: activeTouches,
            touches: activeTouches,
          }),
        )
      }

      dispatchTouch('touchstart', startX)
      dispatchTouch('touchmove', x)
      dispatchTouch('touchend', x)
    },
    {
      startX: box.x + box.width / 2,
      x: box.x + box.width / 2 - 20,
      y: box.y + box.height / 2,
    },
  )

  await expect(tape.locator('.touch-time-warp-tape-header strong')).toHaveText(
    'x2s',
  )
})
