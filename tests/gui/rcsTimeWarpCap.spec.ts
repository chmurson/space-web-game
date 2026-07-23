import { expect, type Page, type TestInfo, test } from '@playwright/test'
import type { SpaceGameDevtoolsSnapshot } from '../../src/devtools/devtoolsBridge'

const startGame = async (page: Page) => {
  await page.goto('/?scenario=earth-moon&devtools=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()
  await page.waitForFunction(() => Boolean(window.__SPACE_WEB_GAME_DEVTOOLS__))
}

const getSnapshot = async (page: Page) =>
  page.evaluate(
    () => window.__SPACE_WEB_GAME_DEVTOOLS__?.getSnapshot() ?? null,
  ) as Promise<SpaceGameDevtoolsSnapshot | null>

const setTimeWarp = async (page: Page, timeWarp: number) => {
  const snapshot = await getSnapshot(page)
  const index = snapshot?.simulation.timeWarps.indexOf(timeWarp) ?? -1

  if (index < 0) {
    throw new Error(`Time warp ${timeWarp} is unavailable`)
  }

  await page.evaluate((timeWarpIndex) => {
    const result = window.__SPACE_WEB_GAME_DEVTOOLS__?.handleRequest({
      index: timeWarpIndex,
      type: 'set-time-warp-index',
    })

    if (!result?.ok) {
      throw new Error(result?.error ?? 'Devtools time warp bridge is missing')
    }
  }, index)
}

test('caps controls and restores the prediction-limited warp request', async ({
  page,
}, testInfo: TestInfo) => {
  await startGame(page)
  await expect
    .poll(
      async () =>
        (await getSnapshot(page))?.simulation.trajectoryPrediction.nearSource,
    )
    .toBe('accepted-window')
  await setTimeWarp(page, 1800)

  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.timeWarp)
    .toBe(240)

  await page.keyboard.down('KeyD')
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.timeWarp)
    .toBe(15)
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.controls.turn)
    .toBe(1)
  await expect(page.locator('[data-stat="time"]')).toContainText('x15s')
  await page.screenshot({
    path: testInfo.outputPath('manual-rcs-x15s.png'),
  })

  await page.keyboard.up('KeyD')
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.timeWarp)
    .toBe(240)

  await page.keyboard.down('KeyW')
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.timeWarp)
    .toBe(60)
  await expect(page.locator('[data-stat="time"]')).toContainText('x1m')

  await page.keyboard.up('KeyW')
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.timeWarp)
    .toBe(240)
  await expect
    .poll(
      async () =>
        (await getSnapshot(page))?.simulation.timeWarpConstraint
          .requestedTimeWarp,
    )
    .toBe(1800)
})
