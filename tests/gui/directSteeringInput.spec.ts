import { expect, type Page, type TestInfo, test } from '@playwright/test'
import type { SpaceGameDevtoolsSnapshot } from '../../src/devtools/devtoolsBridge'

type DevtoolsWindow = Window & {
  __SPACE_WEB_GAME_DEVTOOLS__?: {
    getSnapshot(): SpaceGameDevtoolsSnapshot
  }
}

type TouchPoint = {
  id: number
  x: number
  y: number
}

const startGame = async (page: Page) => {
  await page.goto('/?scenario=earth-moon&devtools=1&touchTrajectorySide=hidden')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()
  await expect(page.locator('.touch-controls')).toBeVisible()
  await page.waitForFunction(() =>
    Boolean((window as DevtoolsWindow).__SPACE_WEB_GAME_DEVTOOLS__),
  )
}

const getSnapshot = async (page: Page) =>
  page.evaluate(() =>
    (window as DevtoolsWindow).__SPACE_WEB_GAME_DEVTOOLS__?.getSnapshot(),
  )

const createTouchScreenshot = async (
  page: Page,
  testInfo: TestInfo,
  name: string,
) => {
  const screenshotPath = testInfo.outputPath(`${name}.png`)
  const screenshot = await page.screenshot({
    animations: 'disabled',
    fullPage: false,
    path: screenshotPath,
  })

  await testInfo.attach(name, {
    contentType: 'image/png',
    path: screenshotPath,
  })
  expect(screenshot.byteLength).toBeGreaterThan(5_000)
}

const dispatchTouch = async (
  page: Page,
  type: 'touchcancel' | 'touchend' | 'touchmove' | 'touchstart',
  touches: TouchPoint[],
  changedTouches: TouchPoint[],
) => {
  await page.evaluate(
    ({ changedTouches, touches, type }) => {
      const target = document.querySelector<HTMLElement>('.touch-controls')
      if (!target) {
        throw new Error('Touch controls are missing')
      }

      const createTouch = (touch: TouchPoint) =>
        new Touch({
          clientX: touch.x,
          clientY: touch.y,
          identifier: touch.id,
          target,
        })
      target.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          changedTouches: changedTouches.map(createTouch),
          targetTouches: touches.map(createTouch),
          touches: touches.map(createTouch),
        }),
      )
    },
    { changedTouches, touches, type },
  )
}

test('desktop mouse does not plan turns while A/D and arrows provide full and precise yaw', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 720 })
  await startGame(page)

  await page
    .locator('canvas')
    .first()
    .evaluate((canvas) => {
      for (const type of ['pointerdown', 'pointerup']) {
        canvas.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            button: 0,
            clientX: 700,
            clientY: 360,
            isPrimary: true,
            pointerId: 1,
            pointerType: 'mouse',
          }),
        )
      }
    })
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.targetHeading)
    .toBeNull()
  await expect(
    page.locator('.heading-target-overlay, .heading-target-dot'),
  ).toHaveCount(0)

  await page.keyboard.down('ArrowLeft')
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.controls.turn)
    .toBe(-1)

  await page.keyboard.down('Shift')
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.controls.turn)
    .toBeCloseTo(-0.25)

  await page.keyboard.up('Shift')
  await page.keyboard.up('ArrowLeft')
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.controls.turn)
    .toBe(0)

  await page.keyboard.down('Shift')
  await page.keyboard.down('ArrowRight')
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.controls.turn)
    .toBeCloseTo(0.25)
  await page.keyboard.up('ArrowRight')
  await page.keyboard.up('Shift')

  await page.keyboard.down('KeyA')
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.controls.turn)
    .toBe(-1)
  await page.keyboard.up('KeyA')

  await page.keyboard.down('Shift')
  await page.keyboard.down('KeyD')
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.controls.turn)
    .toBeCloseTo(0.25)
  await page.keyboard.up('KeyD')
  await page.keyboard.up('Shift')
})

test('mobile playfield gestures pan without creating a turn plan', async ({
  page,
}, testInfo) => {
  await startGame(page)
  const initial = await getSnapshot(page)
  if (!initial) {
    throw new Error('Devtools bridge is missing')
  }

  const start = { id: 1, x: 280, y: 360 }
  const end = { id: 1, x: 325, y: 410 }
  await dispatchTouch(page, 'touchstart', [start], [start])
  await dispatchTouch(page, 'touchmove', [end], [end])
  await dispatchTouch(page, 'touchend', [], [end])

  await expect
    .poll(async () => (await getSnapshot(page))?.camera.panOffset)
    .not.toEqual(initial.camera.panOffset)
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.targetHeading)
    .toBeNull()
  await expect(
    page.locator('.heading-target-overlay, .heading-target-dot'),
  ).toHaveCount(0)
  await createTouchScreenshot(
    page,
    testInfo,
    'mobile-direct-steering-camera-pan',
  )
})

test('mobile pinch zoom uses an off-center world focal point', async ({
  page,
}, testInfo) => {
  await startGame(page)

  const initial = await getSnapshot(page)
  if (!initial) {
    throw new Error('Devtools bridge is missing')
  }
  await createTouchScreenshot(page, testInfo, 'mobile-pinch-before')

  const firstStart = { id: 4, x: 260, y: 420 }
  const secondStart = { id: 5, x: 340, y: 420 }
  const firstMove = { id: 4, x: 220, y: 420 }
  const secondMove = { id: 5, x: 380, y: 420 }
  await dispatchTouch(
    page,
    'touchstart',
    [firstStart, secondStart],
    [firstStart, secondStart],
  )
  await dispatchTouch(
    page,
    'touchmove',
    [firstMove, secondMove],
    [firstMove, secondMove],
  )
  await dispatchTouch(page, 'touchend', [], [firstMove, secondMove])

  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.viewportSize)
    .toBeLessThan(initial.simulation.viewportSize)
  const zoomed = await getSnapshot(page)
  if (!zoomed) {
    throw new Error('Devtools bridge is missing')
  }

  expect(zoomed.camera.panOffset).not.toEqual(initial.camera.panOffset)
  await createTouchScreenshot(page, testInfo, 'mobile-pinch-after')
})
