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

const userSettingsStorageKey = 'space-web-game.userSettings.v1'

const startGame = async (
  page: Page,
  options: { mobileManeuverStartByDrag?: boolean } = {},
) => {
  if (options.mobileManeuverStartByDrag !== undefined) {
    await page.addInitScript(
      ({ key, mobileManeuverStartByDrag }) => {
        window.localStorage.setItem(
          key,
          JSON.stringify({ mobileManeuverStartByDrag }),
        )
      },
      {
        key: userSettingsStorageKey,
        mobileManeuverStartByDrag: options.mobileManeuverStartByDrag,
      },
    )
  }

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

const getHeadingTargetState = async (page: Page) =>
  page.evaluate(() => {
    const dot = document.querySelector<HTMLElement>('.heading-target-dot')
    const overlay = document.querySelector<SVGSVGElement>(
      '.heading-target-overlay',
    )
    const line = document.querySelector<SVGLineElement>('.heading-target-line')
    const slice = document.querySelector<SVGPathElement>(
      '.heading-target-turn-slice',
    )

    if (!dot || !overlay || !line || !slice) {
      throw new Error('Heading target overlay is missing')
    }

    const lineStyle = getComputedStyle(line)
    const sliceStyle = getComputedStyle(slice)

    return {
      dotDisplay: getComputedStyle(dot).display,
      dotPlanning: dot.classList.contains('heading-target-dot-planning'),
      lineLength: Math.hypot(
        Number(line.getAttribute('x2')) - Number(line.getAttribute('x1')),
        Number(line.getAttribute('y2')) - Number(line.getAttribute('y1')),
      ),
      lineX2: line.getAttribute('x2'),
      lineY2: line.getAttribute('y2'),
      lineStroke: lineStyle.stroke,
      overlayDisplay: getComputedStyle(overlay).display,
      overlayPlanning: overlay.classList.contains(
        'heading-target-overlay-planning',
      ),
      sliceFill: sliceStyle.fill,
    }
  })

const expectHeadingTargetVisible = async (
  page: Page,
  options: { dotVisible?: boolean } = {},
) => {
  const dotDisplay = options.dotVisible === false ? 'none' : 'block'
  await expect
    .poll(async () => (await getHeadingTargetState(page)).overlayDisplay)
    .toBe('block')
  await expect
    .poll(async () => (await getHeadingTargetState(page)).dotDisplay)
    .toBe(dotDisplay)
}

const expectHeadingTargetHidden = async (page: Page) => {
  await expect
    .poll(async () => (await getHeadingTargetState(page)).overlayDisplay)
    .toBe('none')
}

const expectCyanColor = (color: string) => {
  const [red, green, blue] =
    color
      .match(/\d+(?:\.\d+)?/g)
      ?.slice(0, 3)
      .map(Number) ?? []

  expect(red).toBeLessThan(150)
  expect(green).toBeGreaterThan(150)
  expect(blue).toBeGreaterThan(220)
}

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
      const event = new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        changedTouches: changedTouches.map(createTouch),
        targetTouches: touches.map(createTouch),
        touches: touches.map(createTouch),
      })

      target.dispatchEvent(event)
    },
    { changedTouches, touches, type },
  )
}

const tap = async (page: Page, point: TouchPoint) => {
  await dispatchTouch(page, 'touchstart', [point], [point])
  await dispatchTouch(page, 'touchend', [], [point])
}

test('desktop mouse stays out of turn planning while A/D and arrows provide full and precise yaw', async ({
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
  await expectHeadingTargetHidden(page)

  await page.keyboard.down('ArrowLeft')
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.controls.turn)
    .toBe(-1)

  await page.keyboard.down('Shift')
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.controls.turn)
    .toBeCloseTo(-1 / 49)

  await page.keyboard.up('Shift')
  await page.keyboard.up('ArrowLeft')
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.controls.turn)
    .toBe(0)

  await page.keyboard.down('Shift')
  await page.keyboard.down('ArrowRight')
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.controls.turn)
    .toBeCloseTo(1 / 49)
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
    .toBeCloseTo(1 / 49)
  await page.keyboard.up('KeyD')
  await page.keyboard.up('Shift')
})

test('mobile tap planning persists through drag release and confirms on second tap', async ({
  page,
}, testInfo) => {
  await startGame(page, { mobileManeuverStartByDrag: false })

  await tap(page, { id: 1, x: 280, y: 360 })
  await expectHeadingTargetVisible(page)
  const pendingPlanStyle = await getHeadingTargetState(page)
  expect(pendingPlanStyle.overlayPlanning).toBe(true)
  expect(pendingPlanStyle.dotPlanning).toBe(true)
  expectCyanColor(pendingPlanStyle.lineStroke)
  expectCyanColor(pendingPlanStyle.sliceFill)
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.targetHeading)
    .toBeNull()
  const initialTarget = await getHeadingTargetState(page)

  await dispatchTouch(
    page,
    'touchstart',
    [{ id: 2, x: 280, y: 360 }],
    [{ id: 2, x: 280, y: 360 }],
  )
  await dispatchTouch(
    page,
    'touchmove',
    [{ id: 2, x: 325, y: 410 }],
    [{ id: 2, x: 325, y: 410 }],
  )
  await dispatchTouch(page, 'touchend', [], [{ id: 2, x: 325, y: 410 }])
  await expectHeadingTargetVisible(page)
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.targetHeading)
    .toBeNull()
  const draggedTarget = await getHeadingTargetState(page)
  expect(`${draggedTarget.lineX2},${draggedTarget.lineY2}`).not.toBe(
    `${initialTarget.lineX2},${initialTarget.lineY2}`,
  )

  await createTouchScreenshot(page, testInfo, 'mobile-turn-plan-active')

  await tap(page, { id: 3, x: 325, y: 410 })
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.targetHeading)
    .not.toBeNull()
  await expectHeadingTargetVisible(page, { dotVisible: false })
  const committedTurnStyle = await getHeadingTargetState(page)
  expect(committedTurnStyle.overlayPlanning).toBe(false)
  expect(committedTurnStyle.dotPlanning).toBe(false)
  expect(committedTurnStyle.dotDisplay).toBe('none')
  expect(committedTurnStyle.lineLength).toBeLessThanOrEqual(56)

  await createTouchScreenshot(page, testInfo, 'mobile-turn-committed')
})

test('mobile two-finger tap cancels active turn planning without committing', async ({
  page,
}, testInfo) => {
  await startGame(page, { mobileManeuverStartByDrag: false })

  await tap(page, { id: 1, x: 280, y: 360 })
  await expectHeadingTargetVisible(page)

  const first = { id: 2, x: 260, y: 360 }
  const second = { id: 3, x: 320, y: 390 }
  await dispatchTouch(page, 'touchstart', [first, second], [first, second])
  await dispatchTouch(page, 'touchend', [], [first, second])

  await expectHeadingTargetHidden(page)
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.targetHeading)
    .toBeNull()
  await createTouchScreenshot(page, testInfo, 'mobile-turn-plan-canceled')
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

test('mobile default drag maneuver starts turning on release', async ({
  page,
}, testInfo) => {
  await startGame(page)

  await tap(page, { id: 1, x: 280, y: 360 })
  await expectHeadingTargetHidden(page)
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.targetHeading)
    .toBeNull()
  await page.waitForTimeout(360)

  await dispatchTouch(
    page,
    'touchstart',
    [{ id: 2, x: 280, y: 360 }],
    [{ id: 2, x: 280, y: 360 }],
  )
  await page.waitForTimeout(220)
  await expectHeadingTargetVisible(page)
  const pendingPlanStyle = await getHeadingTargetState(page)
  expect(pendingPlanStyle.overlayPlanning).toBe(true)
  expect(pendingPlanStyle.dotPlanning).toBe(true)
  expectCyanColor(pendingPlanStyle.lineStroke)
  expectCyanColor(pendingPlanStyle.sliceFill)
  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.targetHeading)
    .toBeNull()

  await dispatchTouch(
    page,
    'touchmove',
    [{ id: 2, x: 325, y: 410 }],
    [{ id: 2, x: 325, y: 410 }],
  )
  await dispatchTouch(page, 'touchend', [], [{ id: 2, x: 325, y: 410 }])

  await expect
    .poll(async () => (await getSnapshot(page))?.simulation.targetHeading)
    .not.toBeNull()
  await expectHeadingTargetVisible(page, { dotVisible: false })
  const committedTurnStyle = await getHeadingTargetState(page)
  expect(committedTurnStyle.overlayPlanning).toBe(false)
  expect(committedTurnStyle.dotDisplay).toBe('none')
  expect(committedTurnStyle.lineLength).toBeLessThanOrEqual(56)

  await createTouchScreenshot(page, testInfo, 'mobile-turn-drag-committed')
})
