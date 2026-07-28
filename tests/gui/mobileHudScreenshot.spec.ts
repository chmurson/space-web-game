import {
  expect,
  type Page,
  type Route,
  type TestInfo,
  test,
} from '@playwright/test'
import type { UIUserAction } from '../../src/input/uiUserActions'
import type { ReachMoonHighscorePendingRun } from '../../src/ui/components/MainMenuSurface'
import type {
  DesktopCameraPanMode,
  DesktopEdgePanSpeed,
  DesktopWheelPanSpeed,
} from '../../src/userSettingsStorage'

const screenshotCss = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }

  canvas,
  .body-label,
  .rcs-actual-turn-overlay,
  .offscreen-indicator,
  .spacecraft-callout,
  .spacecraft-icon-thrust {
    visibility: hidden !important;
  }
`

const attachMobileScreenshot = async (
  page: Page,
  testInfo: TestInfo,
  name: string,
  options: { animations?: 'allow' | 'disabled' } = {},
) => {
  const screenshotPath = testInfo.outputPath(`${name}.png`)
  const screenshot = await page.screenshot({
    animations: options.animations ?? 'disabled',
    fullPage: false,
    path: screenshotPath,
  })

  await testInfo.attach(name, {
    contentType: 'image/png',
    path: screenshotPath,
  })
  expect(screenshot.byteLength).toBeGreaterThan(5_000)
}

const expectWorldVisualsSuppressed = async (page: Page) => {
  await expect(page.locator('canvas')).toHaveCSS('visibility', 'hidden')
  await expect(page.locator('.spacecraft-callout')).toHaveCSS(
    'visibility',
    'hidden',
  )
}

const getReachMoonUrl = (query = '') => (query ? `/?${query}` : '/')

const highscoreScore = {
  baseScorePoints: 0,
  fuelBonusPoints: 196,
  fuelRemainingKg: 31_360,
  lunarOrbitCircularityPoints: 25,
  lunarOrbitEccentricity: 0.007,
  lunarOrbitQuality: {
    orbitApoapsisAltitudeMeters: 420_000,
    orbitPeriapsisAltitudeMeters: 390_000,
  },
  lunarOrbitQualityPoints: 66.6,
  missionElapsedSeconds: 27_000,
  timePenaltyPoints: 28,
  totalScore: 290.6,
}

const completedHighscoreRun: ReachMoonHighscorePendingRun = {
  input: {
    fuelRemainingRatio: 0.98,
    lunarOrbitQuality: highscoreScore.lunarOrbitQuality,
    missionElapsedSeconds: 27_000,
  },
  runReceipt: {
    issuedAt: '2026-06-29T08:00:00.000Z',
    runId: 'run-117',
    scenarioId: 'reach-moon',
    signature: 'signature',
  },
  runReceiptError: null,
  score: highscoreScore,
}

type HighscorePeriod = 'all-time' | 'daily' | 'weekly'

const createHighscoreRollup = (
  period: HighscorePeriod,
  entries = [
    {
      id: 'run-117',
      playerName: 'Artemis Pathfinder With A Long Callsign',
      rank: 1,
      score: highscoreScore,
      submittedAt: '2026-06-29T08:30:00.000Z',
    },
  ],
) => ({
  entries,
  generatedAt: '2026-06-29T08:35:00.000Z',
  period,
})

type HighscoreEntries = ReturnType<typeof createHighscoreRollup>['entries']

const createHighscoreRollups = (
  entriesByPeriod: Partial<Record<HighscorePeriod, HighscoreEntries>> = {},
) => ({
  'all-time': createHighscoreRollup(
    'all-time',
    entriesByPeriod['all-time'] ?? [],
  ),
  daily: createHighscoreRollup('daily', entriesByPeriod.daily ?? []),
  weekly: createHighscoreRollup('weekly', entriesByPeriod.weekly ?? []),
})

const createHighscoreListResponse = (
  period: HighscorePeriod | null,
  entriesByPeriod: Partial<Record<HighscorePeriod, HighscoreEntries>> = {},
) => ({
  rollups:
    period == null
      ? createHighscoreRollups(entriesByPeriod)
      : {
          [period]: createHighscoreRollup(
            period,
            entriesByPeriod[period] ?? [],
          ),
        },
})

const getHighscorePeriodFromRequest = (
  requestUrl: string,
): HighscorePeriod | null => {
  const value = new URL(requestUrl).searchParams.get('period')
  if (value == null || value.length === 0) {
    return null
  }
  if (value === 'all-time' || value === 'daily' || value === 'weekly') {
    return value
  }

  throw new Error(`Missing or unexpected highscore period: ${value}`)
}

const openReachMoonMainMenu = async (page: Page, query = '') => {
  await page.goto(getReachMoonUrl(query))
  await page.addStyleTag({ content: screenshotCss })

  await expect(page.locator('[data-boot-screen]')).toBeHidden()
  await expect(page.locator('.main-menu')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tutorial' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Reach the Moon' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Load Game' })).toBeVisible()
  await expectWorldVisualsSuppressed(page)
}

const startReachMoonMission = async (
  page: Page,
  query = '',
  options: { touchControlsVisible?: boolean } = {},
) => {
  await openReachMoonMainMenu(page, query)

  await page.getByRole('button', { name: 'Reach the Moon' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(
    page.getByRole('heading', { name: 'Reach the Moon' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Start mission' }).click()
  await expect(page.locator('.scenario-prompt')).toBeHidden()
  if (options.touchControlsVisible === false) {
    await expect(page.locator('.touch-controls')).toBeHidden()
  } else {
    await expect(page.locator('.touch-controls')).toBeVisible()
  }
  await expect(
    page.getByRole('button', { name: 'Mission Brief' }),
  ).toBeVisible()
  await expectWorldVisualsSuppressed(page)
}

test('captures the mobile main menu HUD with world visuals suppressed', async ({
  page,
}, testInfo) => {
  await openReachMoonMainMenu(page)

  await expect(
    page.locator(
      '.main-menu .menu-action:not(.menu-action-primary):not(.menu-action-secondary)',
    ),
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Tutorial' })).toHaveClass(
    /menu-action-primary/,
  )
  await expect(page.getByRole('button', { name: 'Free Roam' })).toHaveClass(
    /menu-action-secondary/,
  )
  await expect(page.getByRole('button', { name: 'Free Roam' })).toHaveCSS(
    'opacity',
    '1',
  )
  await attachMobileScreenshot(page, testInfo, 'mobile-main-menu')

  await page.getByRole('button', { name: 'Load Game' }).click()
  const loadLastButton = page.getByRole('button', { name: 'Load last game' })
  await expect(loadLastButton).toBeDisabled()
  await expect(loadLastButton).toHaveClass(/menu-action-secondary/)
  await expect(loadLastButton).toHaveCSS('opacity', '0.5')
  await expect(page.getByRole('button', { name: 'Load any game' })).toHaveClass(
    /menu-action-secondary/,
  )
  await attachMobileScreenshot(page, testInfo, 'mobile-main-menu-load-disabled')

  await page.getByRole('button', { name: 'Load any game' }).click()
  const loadButton = page.getByRole('button', { name: 'Load', exact: true })
  await expect(loadButton).toBeDisabled()
  await expect(loadButton).toHaveClass(/menu-action-secondary/)
  await expect(loadButton).toHaveCSS('opacity', '0.5')
  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-main-menu-snapshot-load-disabled',
  )
})

test('captures the mobile Reach the Moon menu transition', async ({
  page,
}, testInfo) => {
  await openReachMoonMainMenu(page)

  await page.getByRole('button', { name: 'Reach the Moon' }).click()
  await expect(page.locator('[data-main-menu-view="reach-moon"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Highscores' })).toBeVisible()

  await attachMobileScreenshot(page, testInfo, 'mobile-reach-moon-menu')

  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.locator('[data-main-menu-view="main"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tutorial' })).toBeVisible()
})

test('keeps named debug snapshots available after a page refresh', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  await page.evaluate(async () => {
    const debugSnapshotModulePath = '/src/debugScenarioSnapshot.ts'
    const { writeDebugScenarioSnapshot } = await import(debugSnapshotModulePath)

    localStorage.clear()
    writeDebugScenarioSnapshot(
      {
        version: 3,
        savedAt: '2026-07-19T09:00:00.000Z',
        elapsed: 42,
        bodies: [],
        spacecraft: {
          position: { x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
          heading: 0,
          fuel: 0,
          fuelUsed: 0,
          dryMass: 1,
          fuelMass: 0,
          fuelCapacity: 0,
        },
      },
      'Moon approach',
    )
  })

  await page.reload()
  await expect(page.locator('[data-boot-screen]')).toBeHidden()
  await page.getByRole('button', { name: 'Load Game' }).click()
  await page.getByRole('button', { name: 'Load any game' }).click()

  await expect(
    page.locator('.main-menu-recent-snapshot select option'),
  ).toContainText(['Moon approach'])
})

test('blocks gameplay shortcuts while editing a debug snapshot name', async ({
  page,
}) => {
  await startReachMoonMission(page)
  await page.waitForFunction(
    () => window.__SPACE_WEB_GAME_DEVTOOLS__ !== undefined,
  )
  const before = await page.evaluate(() =>
    window.__SPACE_WEB_GAME_DEVTOOLS__?.getSnapshot(),
  )

  await page.getByLabel('Open menu').click()
  await page.getByRole('menuitem', { name: 'Save debug snapshot' }).click()
  const nameInput = page.getByRole('textbox', { name: 'Name' })
  await nameInput.fill('')
  await nameInput.pressSequentially('crqwe12')
  await expect(nameInput).toHaveValue('crqwe12')

  const after = await page.evaluate(() =>
    window.__SPACE_WEB_GAME_DEVTOOLS__?.getSnapshot(),
  )
  expect(after?.camera.follow).toBe(before?.camera.follow)
  expect(after?.camera.panOffset).toEqual(before?.camera.panOffset)
  expect(after?.simulation.controls).toEqual({
    main: 0,
    reverse: 0,
    strafe: 0,
    turn: 0,
  })
})

test('captures the mobile RCS yaw and thrust controls in Flight', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page, 'devtools=1')
  await page.addStyleTag({
    content:
      '.rcs-actual-turn-overlay, .spacecraft-callout { visibility: visible !important; }',
  })
  await page.waitForFunction(
    () =>
      '__SPACE_WEB_GAME_DEVTOOLS__' in window &&
      window.__SPACE_WEB_GAME_DEVTOOLS__ !== undefined,
  )
  await page.evaluate(() => {
    const result = window.__SPACE_WEB_GAME_DEVTOOLS__?.handleRequest({
      index: 2,
      type: 'set-time-warp-index',
    })
    if (!result?.ok) {
      throw new Error(result?.error ?? 'Devtools time warp bridge is missing')
    }
  })

  await page.getByRole('button', { name: 'Open Flight panel' }).click()
  await expect(page.locator('#mobile-command-dock-flight-panel')).toBeVisible()
  await expect(page.locator('.touch-rcs-yaw-control-track')).toBeVisible()
  await expect(page.locator('.touch-thrust-control-track')).toBeVisible()
  await expect(page.locator('.touch-rcs-yaw-control')).toHaveCSS(
    'border-top-width',
    '0px',
  )
  await expect(
    page.locator('.touch-rcs-yaw-control-header, .touch-rcs-yaw-control-close'),
  ).toHaveCount(0)
  await expect(page.locator('.touch-rcs-yaw-control-track')).toHaveCSS(
    'border-radius',
    '15px',
  )
  await expect(page.locator('.touch-rcs-yaw-control-track')).toHaveCSS(
    'overflow',
    'visible',
  )
  await expect(page.locator('.touch-rcs-yaw-control-thumb')).toHaveCSS(
    'border-radius',
    '15px',
  )
  await expect(page.locator('.touch-thrust-control-track')).toHaveCSS(
    'border-radius',
    '15px',
  )
  await expect(page.locator('.touch-thrust-control-thumb')).toHaveCSS(
    'border-radius',
    '15px',
  )
  await page.evaluate(() => {
    const track = document.querySelector<HTMLElement>(
      '.touch-rcs-yaw-control-track',
    )
    if (!track) {
      throw new Error('RCS yaw track is missing')
    }

    const rect = track.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const createTouch = (x: number) =>
      new Touch({
        clientX: x,
        clientY: centerY,
        identifier: 223,
        target: track,
      })
    const dispatch = (
      type: 'touchend' | 'touchmove' | 'touchstart',
      x: number,
    ) => {
      const touch = createTouch(x)
      const activeTouches = type === 'touchend' ? [] : [touch]
      track.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          changedTouches: [touch],
          targetTouches: activeTouches,
          touches: activeTouches,
        }),
      )
    }

    dispatch('touchstart', centerX)
    dispatch('touchmove', rect.right + rect.width)
  })
  await expect(page.locator('.touch-rcs-yaw-control-track')).toHaveAttribute(
    'data-rcs-yaw-turn',
    '1.00',
  )
  await expect
    .poll(() =>
      page.locator('.touch-rcs-yaw-control-track').evaluate((track) => {
        const thumb = track.querySelector<HTMLElement>(
          '.touch-rcs-yaw-control-thumb',
        )
        if (!thumb) {
          throw new Error('RCS yaw thumb is missing')
        }

        return Math.abs(
          track.getBoundingClientRect().right -
            thumb.getBoundingClientRect().right,
        )
      }),
    )
    .toBeLessThan(0.5)
  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-rcs-yaw-control-far-edge',
  )
  await expect(page.locator('.rcs-actual-turn-overlay')).toHaveCSS(
    'display',
    'block',
  )
  await expect
    .poll(async () =>
      page
        .locator('.rcs-actual-turn-slice')
        .first()
        .evaluate((slice) => slice.getAttribute('d')),
    )
    .toMatch(/^M .* Z$/)
  await expect
    .poll(() =>
      page.locator('.rcs-actual-turn-slice[style*="display: block"]').count(),
    )
    .toBeGreaterThan(20)
  await page.evaluate(() => {
    const result = window.__SPACE_WEB_GAME_DEVTOOLS__?.handleRequest({
      index: 0,
      type: 'set-time-warp-index',
    })
    if (!result?.ok) {
      throw new Error(result?.error ?? 'Devtools time warp bridge is missing')
    }
  })
  await expect(page.locator('[data-stat="time"]')).toContainText('x1')
  await page.evaluate(() => {
    const track = document.querySelector<HTMLElement>(
      '.touch-rcs-yaw-control-track',
    )
    if (!track) {
      throw new Error('RCS yaw track is missing')
    }

    const rect = track.getBoundingClientRect()
    const centerY = rect.top + rect.height / 2
    const touch = new Touch({
      clientX: rect.right + rect.width,
      clientY: centerY,
      identifier: 223,
      target: track,
    })
    track.dispatchEvent(
      new TouchEvent('touchend', {
        bubbles: true,
        cancelable: true,
        changedTouches: [touch],
        targetTouches: [],
        touches: [],
      }),
    )
  })
  await page.waitForTimeout(50)
  await expect
    .poll(() =>
      page.locator('.rcs-actual-turn-slice[style*="display: block"]').count(),
    )
    .toBeGreaterThan(20)

  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-rcs-yaw-actual-turn-feedback',
    { animations: 'allow' },
  )

  await page.waitForTimeout(100)
  await expect(page.locator('.rcs-actual-turn-overlay')).toHaveCSS(
    'display',
    'block',
  )
  await expect(page.locator('.rcs-actual-turn-slice').first()).toHaveCSS(
    'stroke',
    'none',
  )
})

test('captures the mobile Reach the Moon highscores leaderboard', async ({
  page,
}, testInfo) => {
  await page.route('**/api/reach-moon/highscores**', async (route) => {
    const period = getHighscorePeriodFromRequest(route.request().url())

    await route.fulfill({
      body: JSON.stringify(
        createHighscoreListResponse(period, {
          daily: createHighscoreRollup('daily').entries,
        }),
      ),
      contentType: 'application/json',
      status: 200,
    })
  })
  await openReachMoonMainMenu(page)

  await page.getByRole('button', { name: 'Reach the Moon' }).click()
  await page.getByRole('button', { name: 'Highscores' }).click()

  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Weekly' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'All-time' })).toBeVisible()
  await expect(
    page.getByText('Artemis Pathfinder With A Long Callsign'),
  ).toBeVisible()
  await expect(page.getByText('291')).toBeVisible()
  await expect(page.getByText('7h30m')).toBeVisible()
  const highscoreTable = page.getByRole('table', {
    name: 'Today Reach the Moon leaderboard',
  })
  await expect(highscoreTable).toBeVisible()
  await expect(highscoreTable.getByRole('row')).toHaveCount(2)
  await expect(
    highscoreTable.getByRole('columnheader', { name: 'Rank' }),
  ).toBeVisible()
  await expect(
    highscoreTable.getByRole('cell', { name: 'Time 7h30m' }),
  ).toBeVisible()
  await expect(
    highscoreTable.getByRole('cell', { name: 'Fuel left 98%' }),
  ).toBeVisible()
  await expect(
    highscoreTable.getByRole('cell', {
      name: 'Orbit quality Ap 420 km / Pe 390 km - near circular',
    }),
  ).toBeVisible()
  const firstHighscoreRow = highscoreTable
    .locator('.reach-moon-highscore-row:not(.reach-moon-highscore-row-header)')
    .first()
  await expect(
    firstHighscoreRow.locator(
      '.reach-moon-highscore-cell-elapsed .telemetry-time-icon',
    ),
  ).toBeVisible()
  await expect(
    firstHighscoreRow.locator(
      '.reach-moon-highscore-cell-fuel .telemetry-fuel-icon',
    ),
  ).toBeVisible()
  await expect(
    firstHighscoreRow.locator(
      '.reach-moon-highscore-cell-orbit .telemetry-orbit-icon',
    ),
  ).toBeVisible()

  await attachMobileScreenshot(page, testInfo, 'mobile-reach-moon-highscores')

  await page.getByRole('button', { name: 'Weekly' }).click()
  await expect(page.getByText('No weekly runs yet.')).toBeVisible()
  const emptyWeeklyTable = page.getByRole('table', {
    name: 'Weekly Reach the Moon leaderboard',
  })
  await expect(emptyWeeklyTable).toBeVisible()
  await expect(emptyWeeklyTable.getByRole('row')).toHaveCount(2)
  await expect(
    emptyWeeklyTable.locator('.reach-moon-highscore-row-spacer'),
  ).toHaveCount(9)
})

test('falls back to weekly highscores from the all-section response', async ({
  page,
}, testInfo) => {
  const getRequestUrls: string[] = []

  await page.route('**/api/reach-moon/highscores**', async (route) => {
    if (route.request().method() === 'GET') {
      getRequestUrls.push(route.request().url())
    }

    await route.fulfill({
      body: JSON.stringify(
        createHighscoreListResponse(
          getHighscorePeriodFromRequest(route.request().url()),
          {
            'all-time': [
              {
                id: 'all-time-run',
                playerName: 'All Time Pilot',
                rank: 1,
                score: highscoreScore,
                submittedAt: '2026-06-29T08:00:00.000Z',
              },
            ],
            weekly: [
              {
                id: 'weekly-run',
                playerName: 'Weekly Pilot',
                rank: 1,
                score: highscoreScore,
                submittedAt: '2026-06-29T09:00:00.000Z',
              },
            ],
          },
        ),
      ),
      contentType: 'application/json',
      status: 200,
    })
  })

  await openReachMoonMainMenu(page)
  await page.getByRole('button', { name: 'Reach the Moon' }).click()
  await page.getByRole('button', { name: 'Highscores' }).click()

  await expect(page.getByRole('cell', { name: 'Weekly Pilot' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Weekly' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByText('No Reach the Moon runs yet.')).toHaveCount(0)
  expect(getRequestUrls).toHaveLength(1)
  expect(new URL(getRequestUrls[0]).searchParams.has('period')).toBe(false)

  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-reach-moon-highscores-weekly-fallback',
  )
})

test('shows skeleton rows while highscores initially load', async ({
  page,
}, testInfo) => {
  let resolveLeaderboardRoute: (route: Route) => void = () => undefined
  const leaderboardRoutePromise = new Promise<Route>((resolve) => {
    resolveLeaderboardRoute = resolve
  })

  await page.route('**/api/reach-moon/highscores**', async (route) => {
    const period = getHighscorePeriodFromRequest(route.request().url())

    if (period == null) {
      resolveLeaderboardRoute(route)
      return
    }

    await route.fulfill({
      body: JSON.stringify(createHighscoreListResponse(period)),
      contentType: 'application/json',
      status: 200,
    })
  })

  await openReachMoonMainMenu(page)
  await page.getByRole('button', { name: 'Reach the Moon' }).click()
  await page.getByRole('button', { name: 'Highscores' }).click()

  const leaderboardRoute = await leaderboardRoutePromise
  await expect(page.locator('.reach-moon-highscore-board')).toHaveAttribute(
    'aria-busy',
    'true',
  )
  await expect(page.locator('.reach-moon-highscore-row-skeleton')).toHaveCount(
    3,
  )
  await expect(page.getByText('Loading today leaderboard...')).toBeVisible()

  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-reach-moon-highscores-initial-skeleton',
  )

  await leaderboardRoute.fulfill({
    body: JSON.stringify(
      createHighscoreListResponse(null, {
        daily: createHighscoreRollup('daily').entries,
      }),
    ),
    contentType: 'application/json',
    status: 200,
  })

  await expect(
    page.getByRole('cell', {
      name: 'Artemis Pathfinder With A Long Callsign',
    }),
  ).toBeVisible()
  await expect(page.locator('.reach-moon-highscore-board')).toHaveAttribute(
    'aria-busy',
    'false',
  )
  await expect(page.locator('.reach-moon-highscore-row-skeleton')).toHaveCount(
    0,
  )
})

test('backs out of Reach the Moon highscores one menu step', async ({
  page,
}) => {
  await page.route('**/api/reach-moon/highscores**', async (route) => {
    const request = route.request()
    const period =
      request.method() === 'POST'
        ? 'daily'
        : getHighscorePeriodFromRequest(request.url())

    await route.fulfill({
      body: JSON.stringify(
        request.method() === 'POST'
          ? {
              record: {
                id: 'run-117',
                playerName: 'Back Pilot',
                score: highscoreScore,
                submittedAt: '2026-06-29T08:40:00.000Z',
              },
              rollups: {
                daily: createHighscoreRollup('daily'),
              },
            }
          : {
              ...createHighscoreListResponse(period, {
                'all-time': createHighscoreRollup('all-time').entries,
                daily: createHighscoreRollup('daily').entries,
                weekly: createHighscoreRollup('weekly').entries,
              }),
            },
      ),
      contentType: 'application/json',
      status: 200,
    })
  })

  await openReachMoonMainMenu(page)
  await page.getByRole('button', { name: 'Reach the Moon' }).click()
  await page.getByRole('button', { name: 'Highscores' }).click()
  await expect(
    page.locator('[data-main-menu-view="reach-moon-highscores"]'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.locator('[data-main-menu-view="reach-moon"]')).toBeVisible()
  await expect(page.locator('[data-main-menu-view="main"]')).toBeHidden()

  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.locator('[data-main-menu-view="main"]')).toBeVisible()

  await page.evaluate(async (pendingRun) => {
    const mainMenuModulePath = '/src/ui/createMainMenu.ts'
    const { createMainMenu } = await import(mainMenuModulePath)
    const app = document.querySelector<HTMLElement>('#app')
    if (!app) {
      throw new Error('Missing app')
    }

    app.replaceChildren()
    const menu = createMainMenu({
      app,
      onFreeRoam: () => undefined,
      onLoadGame: () => undefined,
      onReachMoon: () => undefined,
      onTutorial: () => undefined,
    })
    menu.showReachMoonHighscores(pendingRun)
  }, completedHighscoreRun)

  await expect(
    page.locator('[data-main-menu-view="reach-moon-highscores"]'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.locator('[data-main-menu-view="reach-moon"]')).toBeVisible()
  await expect(page.locator('[data-main-menu-view="main"]')).toBeHidden()
})

test('switches highscore periods from the cached all-section response', async ({
  page,
}, testInfo) => {
  const getRequestUrls: string[] = []

  await page.route('**/api/reach-moon/highscores**', async (route) => {
    if (route.request().method() === 'GET') {
      getRequestUrls.push(route.request().url())
    }

    await route.fulfill({
      body: JSON.stringify(
        createHighscoreListResponse(
          getHighscorePeriodFromRequest(route.request().url()),
          {
            daily: createHighscoreRollup('daily').entries,
            weekly: [
              {
                id: 'weekly-run',
                playerName: 'Weekly Pilot',
                rank: 1,
                score: highscoreScore,
                submittedAt: '2026-06-29T09:00:00.000Z',
              },
            ],
          },
        ),
      ),
      contentType: 'application/json',
      status: 200,
    })
  })

  await openReachMoonMainMenu(page)
  await page.getByRole('button', { name: 'Reach the Moon' }).click()
  await page.getByRole('button', { name: 'Highscores' }).click()
  await expect(
    page.getByRole('cell', {
      name: 'Artemis Pathfinder With A Long Callsign',
    }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Weekly' }).click()

  await expect(page.getByRole('cell', { name: 'Weekly Pilot' })).toBeVisible()
  await expect(page.locator('.reach-moon-highscore-board')).toHaveAttribute(
    'aria-busy',
    'false',
  )
  await expect(page.locator('.reach-moon-highscore-row-loading')).toHaveCount(0)
  expect(getRequestUrls).toHaveLength(1)
  expect(new URL(getRequestUrls[0]).searchParams.has('period')).toBe(false)

  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-reach-moon-highscores-cached-weekly',
  )
})

test('shows retry when highscore refresh fails with stale rows', async ({
  page,
}) => {
  let leaderboardRequests = 0

  await page.route('**/api/reach-moon/highscores**', async (route) => {
    const period = getHighscorePeriodFromRequest(route.request().url())

    if (route.request().method() === 'GET') {
      leaderboardRequests += 1
    }

    if (route.request().method() === 'GET' && leaderboardRequests > 1) {
      await route.fulfill({
        body: JSON.stringify({
          error: { message: 'Highscore service offline.' },
        }),
        contentType: 'application/json',
        status: 503,
      })
      return
    }

    await route.fulfill({
      body: JSON.stringify(
        createHighscoreListResponse(period, {
          daily: createHighscoreRollup('daily').entries,
        }),
      ),
      contentType: 'application/json',
      status: 200,
    })
  })

  await openReachMoonMainMenu(page)
  await page.getByRole('button', { name: 'Reach the Moon' }).click()
  await page.getByRole('button', { name: 'Highscores' }).click()
  await expect(
    page.getByRole('cell', {
      name: 'Artemis Pathfinder With A Long Callsign',
    }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('button', { name: 'Highscores' }).click()

  await expect(page.getByText('Leaderboard unavailable.')).toBeVisible()
  await expect(page.getByText('Highscore service offline.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(
    page.getByRole('cell', {
      name: 'Artemis Pathfinder With A Long Callsign',
    }),
  ).toBeVisible()
})

test('autosubmits completion highscores and retries failures', async ({
  page,
}) => {
  const postBodies: Array<Record<string, unknown>> = []
  await page.route('**/api/reach-moon/highscores**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>
      postBodies.push(body)

      if (postBodies.length === 1) {
        await route.fulfill({
          body: JSON.stringify({
            error: {
              code: 'storage_error',
              message: 'Storage offline.',
            },
          }),
          contentType: 'application/json',
          status: 503,
        })
        return
      }

      const playerName = String(body.playerName)
      await route.fulfill({
        body: JSON.stringify({
          record: {
            id: 'run-117',
            playerName,
            score: highscoreScore,
            submittedAt: '2026-06-29T08:40:00.000Z',
          },
          rollups: {
            'all-time': createHighscoreRollup('all-time', [
              {
                id: 'run-117',
                playerName,
                rank: 1,
                score: highscoreScore,
                submittedAt: '2026-06-29T08:40:00.000Z',
              },
            ]),
            daily: createHighscoreRollup('daily', [
              {
                id: 'run-117',
                playerName,
                rank: 1,
                score: highscoreScore,
                submittedAt: '2026-06-29T08:40:00.000Z',
              },
            ]),
            weekly: createHighscoreRollup('weekly', [
              {
                id: 'run-117',
                playerName,
                rank: 1,
                score: highscoreScore,
                submittedAt: '2026-06-29T08:40:00.000Z',
              },
            ]),
          },
        }),
        contentType: 'application/json',
        status: 200,
      })
      return
    }

    const period = getHighscorePeriodFromRequest(url.href)
    await route.fulfill({
      body: JSON.stringify(createHighscoreListResponse(period)),
      contentType: 'application/json',
      status: 200,
    })
  })

  await page.goto('/')
  await page.addStyleTag({ content: screenshotCss })
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  await page.evaluate(async (pendingRun) => {
    const mainMenuModulePath = '/src/ui/createMainMenu.ts'
    const { createMainMenu } = await import(mainMenuModulePath)
    const app = document.querySelector<HTMLElement>('#app')
    if (!app) {
      throw new Error('Missing app')
    }

    app.replaceChildren()
    const menu = createMainMenu({
      app,
      onFreeRoam: () => undefined,
      onLoadGame: () => undefined,
      onReachMoon: () => undefined,
      onTutorial: () => undefined,
    })
    menu.showReachMoonHighscores(pendingRun)
  }, completedHighscoreRun)

  const pilotName = page.getByLabel('Pilot name')
  await expect(pilotName).toBeVisible()
  await expect(page.getByText('Time used 7h 30m (+28).')).toBeVisible()
  await expect(page.getByText('Fuel left 98% (+196).')).toBeVisible()
  await expect(
    page.locator('.reach-moon-highscore-submit .telemetry-time-icon'),
  ).toBeVisible()
  await expect(
    page.locator('.reach-moon-highscore-submit .telemetry-fuel-icon'),
  ).toBeVisible()
  await expect(
    page.getByText('Submission failed: Storage offline.'),
  ).toBeVisible()
  expect(postBodies).toHaveLength(1)
  expect(String(postBodies[0].playerName).split(' ')).toHaveLength(2)

  await pilotName.fill('Retry Pilot')
  await page.getByRole('button', { name: 'Retry submit' }).click()

  await expect(page.getByText('Submitted as Retry Pilot at #1.')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Retry Pilot' })).toBeVisible()
  expect(postBodies).toHaveLength(2)
  expect(postBodies[1].playerName).toBe('Retry Pilot')
})

test('keeps loading the active period when submit rollups omit it', async ({
  page,
}) => {
  let resolveLeaderboardRoute: (route: Route) => void = () => undefined
  const leaderboardRoutePromise = new Promise<Route>((resolve) => {
    resolveLeaderboardRoute = resolve
  })

  await page.route('**/api/reach-moon/highscores**', async (route) => {
    const request = route.request()

    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>
      const playerName = String(body.playerName)

      await route.fulfill({
        body: JSON.stringify({
          record: {
            id: 'run-117',
            playerName,
            score: highscoreScore,
            submittedAt: '2026-06-29T08:40:00.000Z',
          },
          rollups: {
            weekly: createHighscoreRollup('weekly', [
              {
                id: 'run-117',
                playerName,
                rank: 1,
                score: highscoreScore,
                submittedAt: '2026-06-29T08:40:00.000Z',
              },
            ]),
          },
        }),
        contentType: 'application/json',
        status: 200,
      })
      return
    }

    const period = getHighscorePeriodFromRequest(request.url())
    if (period == null) {
      resolveLeaderboardRoute(route)
      return
    }

    await route.fulfill({
      body: JSON.stringify(createHighscoreListResponse(period)),
      contentType: 'application/json',
      status: 200,
    })
  })

  await page.goto('/')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  await page.evaluate(async (pendingRun) => {
    const mainMenuModulePath = '/src/ui/createMainMenu.ts'
    const { createMainMenu } = await import(mainMenuModulePath)
    const app = document.querySelector<HTMLElement>('#app')
    if (!app) {
      throw new Error('Missing app')
    }

    app.replaceChildren()
    const menu = createMainMenu({
      app,
      onFreeRoam: () => undefined,
      onLoadGame: () => undefined,
      onReachMoon: () => undefined,
      onTutorial: () => undefined,
    })
    menu.showReachMoonHighscores(pendingRun)
  }, completedHighscoreRun)

  await expect(page.getByText(/^Submitted as /)).toBeVisible()
  await expect(page.getByText('Loading today leaderboard...')).toBeVisible()

  const leaderboardRoute = await leaderboardRoutePromise
  await leaderboardRoute.fulfill({
    body: JSON.stringify(
      createHighscoreListResponse(null, {
        daily: [
          {
            id: 'daily-run',
            playerName: 'Daily Pilot',
            rank: 1,
            score: highscoreScore,
            submittedAt: '2026-06-29T08:45:00.000Z',
          },
        ],
      }),
    ),
    contentType: 'application/json',
    status: 200,
  })
  await expect(page.getByRole('cell', { name: 'Daily Pilot' })).toBeVisible()
})

test('captures the mobile tutorial coach prompt transition', async ({
  page,
}, testInfo) => {
  await openReachMoonMainMenu(page)

  await page.getByRole('button', { name: 'Tutorial' }).click()
  await expect(page.locator('.main-menu')).toBeHidden()
  await expect(
    page.getByRole('heading', { name: 'Leave Earth Orbit' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Start' }).click()
  await expect(
    page.getByRole('heading', { name: 'Start A Burn' }),
  ).toBeVisible()
  await expect(page.locator('.scenario-prompt-backdrop')).toHaveAttribute(
    'data-prompt-mode',
    'coach',
  )
  await expect(page.locator('.scenario-prompt')).toHaveAttribute(
    'data-anchor',
    'thrust-control',
  )
  await expect(page.locator('#mobile-command-dock-flight-panel')).toBeVisible()
  await expect(page.locator('.mobile-command-dock')).toHaveAttribute(
    'data-tutorial-focused',
    'burn',
  )

  await attachMobileScreenshot(page, testInfo, 'mobile-tutorial-coach-prompt')
})

test('captures the mobile Reach the Moon replay pill transition', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)
  await expect(page.locator('.scenario-prompt-pill')).toBeVisible()

  await attachMobileScreenshot(page, testInfo, 'mobile-reach-moon-replay-pill')
})

test('keeps the Reach the Moon replay pill wired to the prompt adapter', async ({
  page,
}) => {
  await startReachMoonMission(page)

  const replayPill = page.getByRole('button', { name: 'Mission Brief' })
  await expect(replayPill).toBeVisible()
  await expect(page.locator('.scenario-prompt-pill-label')).toHaveText(
    'Mission Brief',
  )

  await replayPill.click()
  await expect(replayPill).toBeHidden()
  await expect(
    page.getByRole('heading', { name: 'Reach the Moon' }),
  ).toBeVisible()

  const closeButton = page.locator('.scenario-prompt [data-role="close"]')
  await expect(closeButton).toBeVisible()
  await expect(closeButton).toHaveAttribute(
    'data-prompt-action',
    /dismiss_to_replay/,
  )

  await closeButton.click()
  await expect(page.locator('.scenario-prompt')).toBeHidden()
  await expect(replayPill).toBeVisible()
})

test('refreshes stale main menu load state when the snapshot disappears', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(async () => {
    const mainMenuModulePath = '/src/ui/createMainMenu.ts'
    const debugSnapshotModulePath = '/src/debugScenarioSnapshot.ts'
    const { createMainMenu } = await import(mainMenuModulePath)
    const { clearDebugScenarioSnapshot, writeDebugScenarioSnapshot } =
      await import(debugSnapshotModulePath)
    const app = document.createElement('div')
    const events: string[] = []
    const spacecraft = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      heading: 0,
      fuel: 0,
      fuelUsed: 0,
      dryMass: 1,
      fuelMass: 0,
      fuelCapacity: 0,
    }

    document.body.append(app)
    writeDebugScenarioSnapshot({
      version: 3,
      savedAt: new Date(0).toISOString(),
      elapsed: 0,
      bodies: [],
      spacecraft,
    })
    writeDebugScenarioSnapshot({
      version: 3,
      savedAt: new Date(1).toISOString(),
      elapsed: 1,
      bodies: [],
      spacecraft,
    })

    const menu = createMainMenu({
      app,
      onFreeRoam: () => events.push('free-roam'),
      onLoadGame: () => events.push('load'),
      onReachMoon: () => events.push('reach-moon'),
      onTutorial: () => events.push('tutorial'),
    })
    const loadMenuButton = menu.element.querySelector(
      '[data-main-menu-action="load-menu"]',
    ) as HTMLButtonElement | null
    const isMainMenuSectionVisible = (view: string) => {
      const section = menu.element.querySelector(
        `[data-main-menu-view="${view}"]`,
      ) as HTMLDivElement | null
      if (!section) {
        throw new Error(`Missing main menu section: ${view}`)
      }

      return !section.hidden
    }

    loadMenuButton?.click()
    const loadLastButton = menu.element.querySelector(
      '[data-main-menu-action="load-last"]',
    ) as HTMLButtonElement | null
    const loadSectionVisible = isMainMenuSectionVisible('load-game')
    const loadAnyMenuButton = menu.element.querySelector(
      '[data-main-menu-action="load-any-menu"]',
    ) as HTMLButtonElement | null
    loadAnyMenuButton?.click()
    const snapshotSectionVisible =
      isMainMenuSectionVisible('load-game-snapshot')
    const recentOptions = Array.from(
      (
        menu.element.querySelector(
          '.main-menu-recent-snapshot select',
        ) as HTMLSelectElement | null
      )?.options ?? [],
    ).map((option) => option.textContent)
    const snapshotBackButton = menu.element.querySelector(
      '[data-main-menu-action="load-back"]',
    ) as HTMLButtonElement | null
    snapshotBackButton?.click()
    const loadSectionVisibleAfterBack = isMainMenuSectionVisible('load-game')
    const initiallyDisabled = loadLastButton?.disabled

    clearDebugScenarioSnapshot()
    loadLastButton?.click()
    const refreshedLoadButton = menu.element.querySelector(
      '[data-main-menu-action="load-last"]',
    ) as HTMLButtonElement | null

    return {
      displayAfterStaleClick: menu.element.style.display,
      disabledAfterStaleClick: refreshedLoadButton?.disabled,
      events,
      initiallyDisabled,
      loadSectionVisible,
      loadSectionVisibleAfterBack,
      loadMenuVisible: !loadMenuButton?.hidden,
      recentOptions,
      snapshotSectionVisible,
    }
  })

  expect(result).toEqual({
    displayAfterStaleClick: 'flex',
    disabledAfterStaleClick: true,
    events: [],
    initiallyDisabled: false,
    loadSectionVisible: true,
    loadSectionVisibleAfterBack: true,
    loadMenuVisible: true,
    recentOptions: [
      expect.stringContaining('Snapshot at 1s - '),
      expect.stringContaining('0s - '),
    ],
    snapshotSectionVisible: true,
  })
})

test('keeps the crash menu adapter state, focus, and keyboard behavior', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(async () => {
    const crashMenuModulePath = '/src/ui/createCrashMenu.ts'
    const debugSnapshotModulePath = '/src/debugScenarioSnapshot.ts'
    const { createCrashMenu } = await import(crashMenuModulePath)
    const { clearDebugScenarioSnapshot, writeDebugScenarioSnapshot } =
      await import(debugSnapshotModulePath)
    const app = document.createElement('div')
    const beforeButton = document.createElement('button')
    const events: string[] = []

    beforeButton.textContent = 'Before crash'
    document.body.append(beforeButton, app)
    beforeButton.focus()
    writeDebugScenarioSnapshot({
      version: 3,
      savedAt: new Date(0).toISOString(),
      elapsed: 0,
      bodies: [],
      spacecraft: {
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        heading: 0,
        fuel: 0,
        fuelUsed: 0,
        dryMass: 1,
        fuelMass: 0,
        fuelCapacity: 0,
      },
    })

    const menu = createCrashMenu({
      app,
      onExit: () => events.push('exit'),
      onLoadGame: () => events.push('load'),
      onRestart: () => events.push('restart'),
      onRestartFromCheckpoint: () => events.push('checkpoint'),
    })
    const getAction = () =>
      document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.crashMenuAction
        : undefined
    const dispatchKey = (init: KeyboardEventInit) =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          ...init,
        }),
      )

    menu.syncState({ crashedBodyName: 'Moon', hasCheckpoint: true })
    menu.setVisible(true)
    const checkpointButton = menu.element.querySelector(
      '[data-crash-menu-action="checkpoint"]',
    ) as HTMLButtonElement | null
    const restartButton = menu.element.querySelector(
      '[data-crash-menu-action="restart"]',
    ) as HTMLButtonElement | null
    const loadButton = menu.element.querySelector(
      '[data-crash-menu-action="load"]',
    ) as HTMLButtonElement | null
    const exitButton = menu.element.querySelector(
      '[data-crash-menu-action="exit"]',
    ) as HTMLButtonElement | null
    const activeAfterShow = checkpointButton === document.activeElement
    const checkpointHidden = checkpointButton?.hidden
    const checkpointPrimary = checkpointButton?.classList.contains(
      'crash-menu-primary-action',
    )
    const loadHidden = loadButton?.hidden
    const restartPrimary = restartButton?.classList.contains(
      'crash-menu-primary-action',
    )
    const description = menu.element.querySelector(
      '#crash-menu-description',
    )?.textContent
    const title = menu.element.querySelector('#crash-menu-title')?.textContent

    loadButton?.click()
    clearDebugScenarioSnapshot()
    loadButton?.click()
    const loadHiddenAfterStaleClick = (
      menu.element.querySelector(
        '[data-crash-menu-action="load"]',
      ) as HTMLButtonElement | null
    )?.hidden
    dispatchKey({ code: 'KeyR', key: 'r' })
    exitButton?.focus()
    dispatchKey({ key: 'Tab' })
    const focusAfterForwardTrap = getAction()
    checkpointButton?.focus()
    dispatchKey({ key: 'Tab', shiftKey: true })
    const focusAfterBackwardTrap = getAction()
    dispatchKey({ key: 'Escape' })
    menu.setVisible(false)
    const restoredFocusText = document.activeElement?.textContent

    clearDebugScenarioSnapshot()
    menu.syncState({ crashedBodyName: null, hasCheckpoint: false })
    menu.setVisible(true)
    const activeAfterNoCheckpointShow = getAction()
    dispatchKey({ code: 'KeyR', key: 'r' })

    return {
      activeAfterNoCheckpointShow,
      activeAfterShow,
      checkpointHidden,
      checkpointPrimary,
      description,
      events,
      focusAfterBackwardTrap,
      focusAfterForwardTrap,
      loadHiddenAfterStaleClick,
      loadHidden,
      panelFound: Boolean(menu.element.querySelector('.crash-menu-panel')),
      restoredFocusText,
      restartPrimary,
      role: menu.element.getAttribute('role'),
      title,
    }
  })

  expect(result).toEqual({
    activeAfterNoCheckpointShow: 'restart',
    activeAfterShow: true,
    checkpointHidden: false,
    checkpointPrimary: true,
    description:
      'Impact with Moon ended this run. Restart to try the approach again.',
    events: ['load', 'exit'],
    focusAfterBackwardTrap: 'exit',
    focusAfterForwardTrap: 'checkpoint',
    loadHiddenAfterStaleClick: true,
    loadHidden: false,
    panelFound: true,
    restoredFocusText: 'Before crash',
    restartPrimary: false,
    role: 'dialog',
    title: 'Crashed into Moon',
  })
})

test('keeps the top menu adapter state, focus, keyboard, and debug behavior', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(async () => {
    const topMenuModulePath = '/src/ui/createTopMenu.ts'
    const debugSnapshotModulePath = '/src/debugScenarioSnapshot.ts'
    const { createTopMenu } = await import(topMenuModulePath)
    const {
      clearDebugScenarioSnapshot,
      clearRecentDebugScenarioSnapshotsForTests,
      readDebugScenarioSnapshot,
      writeDebugScenarioSnapshot,
    } = await import(debugSnapshotModulePath)
    const app = document.createElement('div')
    const topBar = document.createElement('div')
    const telemetry = document.createElement('div')
    const outsideButton = document.createElement('button')
    const events: string[] = []
    const savedSnapshotNames: string[] = []
    const spacecraft = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      heading: 0,
      fuel: 0,
      fuelUsed: 0,
      dryMass: 1,
      fuelMass: 0,
      fuelCapacity: 0,
    }
    let debugModeEnabled = false
    let fpsIndicatorEnabled = false

    topBar.className = 'top-bar'
    telemetry.className = 'telemetry-strip'
    outsideButton.textContent = 'Outside'
    topBar.append(telemetry)
    app.append(topBar)
    document.body.append(app, outsideButton)
    clearDebugScenarioSnapshot()
    clearRecentDebugScenarioSnapshotsForTests()

    const menu = createTopMenu({
      app,
      getDebugModeEnabled: () => debugModeEnabled,
      getDebugSnapshotSuggestedName: () => 'Snapshot at 42s',
      getFpsIndicatorEnabled: () => fpsIndicatorEnabled,
      onAction: (action: string) => {
        events.push(action)
        if (action === 'toggleDebugMode') {
          debugModeEnabled = !debugModeEnabled
        }
        if (action === 'toggleFpsIndicator') {
          fpsIndicatorEnabled = !fpsIndicatorEnabled
        }
      },
      onSaveDebugSnapshot: (name: string) => {
        savedSnapshotNames.push(name)
      },
    })
    const getButton = () =>
      menu.element.querySelector('.top-menu-button') as HTMLButtonElement | null
    const getDropdown = () =>
      menu.element.querySelector('.top-menu-dropdown') as HTMLDivElement | null
    const getActionButton = (action: string) =>
      menu.element.querySelector(
        `[data-menu-action="${action}"]`,
      ) as HTMLButtonElement | null
    const getRecentSelect = () =>
      menu.element.querySelector(
        'select.menu-recent-snapshot-select',
      ) as HTMLSelectElement | null
    const getSnapshotNameInput = () =>
      menu.element.querySelector(
        '.menu-debug-snapshot-name',
      ) as HTMLInputElement | null
    const getActiveAction = () =>
      document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.menuAction
        : undefined
    const getActiveIsRecentSelect = () =>
      document.activeElement === getRecentSelect()
    const pressActiveKey = (key: string) =>
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key,
        }),
      )
    const pressDocumentKey = (key: string) =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key,
        }),
      )
    const openMenu = () => getButton()?.click()

    openMenu()
    const openAfterClick = !getDropdown()?.hidden
    const expandedAfterClick = getButton()?.getAttribute('aria-expanded')
    const activeAfterOpen = getActiveAction()
    const loadDisabledWithoutSnapshot =
      getActionButton('loadDebugSnapshot')?.disabled
    const loadLastDebugLabel = getActionButton('loadDebugSnapshot')?.textContent
    const debugLabelInitial = getActionButton('toggleDebugMode')?.textContent
    const debugCheckedInitial =
      getActionButton('toggleDebugMode')?.getAttribute('aria-checked')

    pressActiveKey('ArrowDown')
    const activeAfterArrowDown = getActiveAction()
    pressActiveKey('ArrowDown')
    const activeAfterSave = getActiveAction()
    pressActiveKey('ArrowDown')
    const activeAfterDisabledSkip = getActiveAction()
    pressActiveKey('End')
    const activeAfterEnd = getActiveAction()
    pressActiveKey('ArrowDown')
    const activeAfterWrap = getActiveAction()
    pressActiveKey('Home')
    const activeAfterHome = getActiveAction()

    getActionButton('resetScenario')?.click()
    const restartLabelAfterFirstClick =
      getActionButton('resetScenario')?.textContent
    getActionButton('resetScenario')?.click()
    const closedAfterRestart = getDropdown()?.hidden
    const focusAfterRestart = document.activeElement === getButton()

    openMenu()
    getActionButton('enterMainMenu')?.click()
    const exitLabelAfterFirstClick =
      getActionButton('enterMainMenu')?.textContent
    getActionButton('enterMainMenu')?.click()
    const closedAfterExit = getDropdown()?.hidden

    openMenu()
    getActionButton('toggleDebugMode')?.click()
    openMenu()
    const debugLabelAfterToggle =
      getActionButton('toggleDebugMode')?.textContent
    const debugCheckedAfterToggle =
      getActionButton('toggleDebugMode')?.getAttribute('aria-checked')
    getActionButton('toggleFpsIndicator')?.click()
    openMenu()
    const fpsLabelAfterToggle =
      getActionButton('toggleFpsIndicator')?.textContent
    const fpsCheckedAfterToggle =
      getActionButton('toggleFpsIndicator')?.getAttribute('aria-checked')

    menu.close()
    openMenu()
    getActionButton('saveDebugSnapshot')?.click()
    const suggestedSnapshotName = getSnapshotNameInput()?.value
    const focusAfterSnapshotSaveOpen =
      document.activeElement === getSnapshotNameInput()
    getActionButton('backFromDebugSnapshotSave')?.click()
    const focusAfterSnapshotSaveBack = getActiveAction()

    menu.openDebugSnapshotSave()
    const snapshotNameInput = getSnapshotNameInput()
    if (snapshotNameInput) {
      snapshotNameInput.value = 'Moon approach'
      snapshotNameInput.dispatchEvent(new Event('input', { bubbles: true }))
    }
    getActionButton('saveNamedDebugSnapshot')?.click()
    const closedAfterNamedSnapshotSave = getDropdown()?.hidden

    menu.close()
    writeDebugScenarioSnapshot({
      version: 3,
      savedAt: new Date(0).toISOString(),
      elapsed: 1,
      bodies: [],
      spacecraft,
    })
    writeDebugScenarioSnapshot({
      version: 3,
      savedAt: new Date(1).toISOString(),
      elapsed: 2,
      bodies: [],
      spacecraft,
    })
    menu.syncState()
    openMenu()
    const loadDisabledWithSnapshot =
      getActionButton('loadDebugSnapshot')?.disabled
    const recentOptions = Array.from(getRecentSelect()?.options ?? []).map(
      (option) => option.textContent,
    )
    const debugSnapshotSectionHiddenBeforeOpen =
      getRecentSelect()?.closest('section')?.hidden
    getActionButton('openDebugSnapshotLoad')?.click()
    const debugSnapshotSectionHiddenAfterOpen =
      getRecentSelect()?.closest('section')?.hidden
    const focusAfterDebugSnapshotOpen = getActiveIsRecentSelect()
    pressActiveKey('ArrowDown')
    const activeAfterDebugSnapshotArrowDown = getActiveAction()
    const recentSelect = getRecentSelect()
    if (recentSelect) {
      recentSelect.selectedIndex = 1
      recentSelect.dispatchEvent(new Event('change', { bubbles: true }))
    }
    getActionButton('loadRecentDebugSnapshot')?.click()
    const selectedRecentLoadedElapsed = readDebugScenarioSnapshot()?.elapsed

    openMenu()
    getActionButton('openDebugSnapshotLoad')?.click()
    getActionButton('backFromDebugSnapshotLoad')?.click()
    const focusAfterDebugSnapshotBack = getActiveAction()

    getActionButton('loadDebugSnapshot')?.click()

    openMenu()
    outsideButton.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true }),
    )
    const closedAfterOutsidePointer = getDropdown()?.hidden

    openMenu()
    pressDocumentKey('Escape')
    const closedAfterEscape = getDropdown()?.hidden
    const focusAfterEscape = document.activeElement === getButton()

    openMenu()
    pressActiveKey('Tab')
    const closedAfterTab = getDropdown()?.hidden

    return {
      activeAfterArrowDown,
      activeAfterDisabledSkip,
      activeAfterEnd,
      activeAfterHome,
      activeAfterOpen,
      activeAfterSave,
      activeAfterDebugSnapshotArrowDown,
      activeAfterWrap,
      closedAfterEscape,
      closedAfterExit,
      closedAfterNamedSnapshotSave,
      closedAfterOutsidePointer,
      closedAfterRestart,
      closedAfterTab,
      debugCheckedAfterToggle,
      debugCheckedInitial,
      debugLabelAfterToggle,
      debugLabelInitial,
      events,
      expandedAfterClick,
      exitLabelAfterFirstClick,
      focusAfterEscape,
      focusAfterRestart,
      focusAfterSnapshotSaveBack,
      focusAfterSnapshotSaveOpen,
      fpsCheckedAfterToggle,
      fpsLabelAfterToggle,
      focusAfterDebugSnapshotBack,
      focusAfterDebugSnapshotOpen,
      debugSnapshotSectionHiddenAfterOpen,
      debugSnapshotSectionHiddenBeforeOpen,
      loadLastDebugLabel,
      loadDisabledWithSnapshot,
      loadDisabledWithoutSnapshot,
      openAfterClick,
      recentOptions,
      restartLabelAfterFirstClick,
      savedSnapshotNames,
      selectedRecentLoadedElapsed,
      suggestedSnapshotName,
    }
  })

  expect(result).toEqual({
    activeAfterArrowDown: 'toggleFpsIndicator',
    activeAfterDisabledSkip: 'openDebugSnapshotLoad',
    activeAfterEnd: 'enterMainMenu',
    activeAfterHome: 'toggleDebugMode',
    activeAfterOpen: 'toggleDebugMode',
    activeAfterSave: 'saveDebugSnapshot',
    activeAfterDebugSnapshotArrowDown: 'loadRecentDebugSnapshot',
    activeAfterWrap: 'toggleDebugMode',
    closedAfterEscape: true,
    closedAfterExit: true,
    closedAfterOutsidePointer: true,
    closedAfterRestart: true,
    closedAfterTab: true,
    debugCheckedAfterToggle: 'true',
    debugCheckedInitial: 'false',
    debugLabelAfterToggle: 'Hide debug window',
    debugLabelInitial: 'Show debug window',
    events: [
      'resetScenario',
      'enterMainMenu',
      'toggleDebugMode',
      'toggleFpsIndicator',
      'loadDebugSnapshot',
      'loadDebugSnapshot',
    ],
    expandedAfterClick: 'true',
    exitLabelAfterFirstClick: 'Confirm exit',
    focusAfterEscape: true,
    focusAfterRestart: true,
    focusAfterSnapshotSaveBack: 'saveDebugSnapshot',
    focusAfterSnapshotSaveOpen: true,
    fpsCheckedAfterToggle: 'true',
    fpsLabelAfterToggle: 'Hide FPS meter',
    focusAfterDebugSnapshotBack: 'openDebugSnapshotLoad',
    focusAfterDebugSnapshotOpen: true,
    debugSnapshotSectionHiddenAfterOpen: false,
    debugSnapshotSectionHiddenBeforeOpen: true,
    loadLastDebugLabel: 'Load last debug snapshot',
    loadDisabledWithSnapshot: false,
    loadDisabledWithoutSnapshot: true,
    closedAfterNamedSnapshotSave: true,
    openAfterClick: true,
    recentOptions: [
      expect.stringContaining('Snapshot at 2s - '),
      expect.stringContaining('Snapshot at 1s - '),
    ],
    restartLabelAfterFirstClick: 'Confirm restart',
    savedSnapshotNames: ['Moon approach'],
    selectedRecentLoadedElapsed: 1,
    suggestedSnapshotName: 'Snapshot at 42s',
  })
})

test('keeps the in-game controls menu adapter state and actions', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(async () => {
    const controlsMenuModulePath = '/src/ui/createInGameControlsMenu.ts'
    const { createInGameControlsMenu } = await import(controlsMenuModulePath)
    const app = document.createElement('div')
    const outsideButton = document.createElement('button')
    const events: string[] = []
    let cameraCanRecenter = false
    let cameraControlsLocked = false
    let cameraFollow: 'spacecraft' | 'target' = 'spacecraft'
    let coastHorizonHours = 6
    let settingsOpened = false

    outsideButton.textContent = 'Outside controls'
    document.body.append(app, outsideButton)

    const menu = createInGameControlsMenu({
      app,
      getCameraCanRecenter: () => cameraCanRecenter,
      getCameraControlsLocked: () => cameraControlsLocked,
      getCameraControlsVisible: () => true,
      getCameraFollow: () => cameraFollow,
      getCoastPredictionHorizonHours: () => coastHorizonHours,
      getMaxCoastPredictionHorizonHours: () => 8,
      getMinCoastPredictionHorizonHours: () => 2,
      onAction: (action: UIUserAction) => {
        events.push(action)
        if (action === 'setCameraFollowSpacecraft') {
          cameraFollow = 'spacecraft'
        }
        if (action === 'setCameraFollowTarget') {
          cameraFollow = 'target'
        }
        if (action === 'recenterCamera') {
          cameraCanRecenter = false
        }
        if (action === 'decreaseCoastHorizon') {
          coastHorizonHours = Math.max(2, coastHorizonHours - 2)
        }
        if (action === 'increaseCoastHorizon') {
          coastHorizonHours = Math.min(8, coastHorizonHours + 2)
        }
      },
      onOpenUiSettings: () => {
        settingsOpened = true
      },
    })
    const getMenuButton = () =>
      menu.element.querySelector(
        '.in-game-controls-menu-button',
      ) as HTMLButtonElement | null
    const getPopover = () =>
      menu.element.querySelector(
        '.in-game-controls-menu-popover',
      ) as HTMLDivElement | null
    const getActionButton = (action: string) =>
      menu.element.querySelector(
        `[data-in-game-action="${action}"]`,
      ) as HTMLButtonElement | null
    const getCameraFollowOption = (follow: string) =>
      menu.element.querySelector(
        `[data-camera-follow-option="${follow}"]`,
      ) as HTMLButtonElement | null
    const getCameraFollowOptions = () =>
      Array.from(
        menu.element.querySelectorAll(
          '[data-camera-follow-option]',
        ) as NodeListOf<HTMLButtonElement>,
      ).map((element) => ({
        disabled: element.disabled,
        label: element.textContent?.trim(),
        value: element.dataset.cameraFollowOption,
        pressed: element.getAttribute('aria-pressed'),
      }))
    const getCameraFollowStatus = () =>
      menu.element.querySelector('[data-in-game-camera-follow-status]')
        ?.textContent
    const getCameraOptionAriaLabels = (selector: string, dataKey: string) =>
      Object.fromEntries(
        Array.from(
          menu.element.querySelectorAll(
            selector,
          ) as NodeListOf<HTMLButtonElement>,
        ).map((element) => [
          element.dataset[dataKey],
          element.getAttribute('aria-label'),
        ]),
      )
    const getCoastHorizon = () =>
      menu.element.querySelector('[data-in-game-coast-horizon]')?.textContent
    const getKeyboardHints = () =>
      Array.from(
        menu.element.querySelectorAll(
          '.in-game-controls-menu-keyboard-row',
        ) as NodeListOf<HTMLElement>,
      ).map((element) =>
        [
          element
            .querySelector('.in-game-controls-menu-keyboard-name')
            ?.textContent?.trim(),
          element
            .querySelector('.in-game-controls-menu-keyboard-keys')
            ?.textContent?.replace(/\s+/g, ' ')
            .trim(),
        ]
          .filter(Boolean)
          .join(' '),
      )
    const pressDocumentKey = (key: string) =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key,
        }),
      )
    const openMenu = () => getMenuButton()?.click()

    openMenu()
    const openAfterClick = !getPopover()?.hidden
    const expandedAfterClick = getMenuButton()?.getAttribute('aria-expanded')
    const menuButtonLabelAfterClick =
      getMenuButton()?.getAttribute('aria-label')
    const cameraFollowDataInitial = menu.element.dataset.cameraFollow
    const cameraFollowStatusInitial = getCameraFollowStatus()
    const cameraFollowOptionsInitial = getCameraFollowOptions()
    const recenterButtonInitial = getActionButton('recenterCamera')
    const recenterDisabledInitial = recenterButtonInitial?.disabled
    const recenterAriaLabelInitial =
      recenterButtonInitial?.getAttribute('aria-label')
    const coastHorizonInitial = getCoastHorizon()

    cameraCanRecenter = true
    menu.syncState()
    const recenterButtonAfterPan = getActionButton('recenterCamera')
    const recenterDisabledAfterPan = recenterButtonAfterPan?.disabled
    const recenterPressableAfterPan =
      recenterButtonAfterPan?.classList.contains('ui-pressable-strong')
    recenterButtonAfterPan?.click()

    getCameraFollowOption('target')?.click()
    getActionButton('recenterCamera')?.click()
    const cameraFollowDataAfterSelection = menu.element.dataset.cameraFollow
    const cameraFollowStatusAfterSelection = getCameraFollowStatus()
    const cameraFollowOptionsAfterSelection = getCameraFollowOptions()

    cameraControlsLocked = true
    menu.syncState()
    const cameraFollowOptionsWhenLocked = getCameraFollowOptions()
    const cameraFollowAriaLabelsWhenLocked = getCameraOptionAriaLabels(
      '[data-camera-follow-option]',
      'cameraFollowOption',
    )
    const recenterButtonWhenLocked = getActionButton('recenterCamera')
    const recenterAriaLabelWhenLocked =
      recenterButtonWhenLocked?.getAttribute('aria-label')
    const recenterDisabledWhenLocked = recenterButtonWhenLocked?.disabled
    recenterButtonWhenLocked?.click()
    getCameraFollowOption('spacecraft')?.click()
    const eventCountAfterLockedClick = events.length

    getActionButton('decreaseCoastHorizon')?.click()
    getActionButton('decreaseCoastHorizon')?.click()
    const coastHorizonAtMin = getCoastHorizon()
    const decreaseDisabledAtMin = getActionButton(
      'decreaseCoastHorizon',
    )?.disabled
    getActionButton('decreaseCoastHorizon')?.click()
    const eventCountAfterDisabledDecrease = events.length

    getActionButton('increaseCoastHorizon')?.click()
    getActionButton('increaseCoastHorizon')?.click()
    getActionButton('increaseCoastHorizon')?.click()
    const coastHorizonAtMax = getCoastHorizon()
    const increaseDisabledAtMax = getActionButton(
      'increaseCoastHorizon',
    )?.disabled

    getActionButton('openUiSettings')?.click()
    const closedAfterSettings = getPopover()?.hidden

    openMenu()
    outsideButton.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true }),
    )
    const closedAfterOutsidePointer = getPopover()?.hidden

    openMenu()
    pressDocumentKey('Escape')
    const closedAfterEscape = getPopover()?.hidden
    const focusAfterEscape = document.activeElement === getMenuButton()
    const menuButtonLabelAfterEscape =
      getMenuButton()?.getAttribute('aria-label')

    menu.close()
    const closedAfterClose = getPopover()?.hidden

    return {
      cameraFollowAriaLabelsWhenLocked,
      cameraFollowDataAfterSelection,
      cameraFollowDataInitial,
      cameraFollowOptionsAfterSelection,
      cameraFollowOptionsInitial,
      cameraFollowOptionsWhenLocked,
      cameraFollowStatusAfterSelection,
      cameraFollowStatusInitial,
      closedAfterClose,
      closedAfterEscape,
      closedAfterOutsidePointer,
      closedAfterSettings,
      coastHorizonAtMax,
      coastHorizonAtMin,
      coastHorizonInitial,
      decreaseDisabledAtMin,
      eventCountAfterDisabledDecrease,
      eventCountAfterLockedClick,
      events,
      expandedAfterClick,
      focusAfterEscape,
      increaseDisabledAtMax,
      keyboardHints: getKeyboardHints(),
      menuButtonLabelAfterClick,
      menuButtonLabelAfterEscape,
      openAfterClick,
      recenterAriaLabelWhenLocked,
      recenterAriaLabelInitial,
      recenterDisabledAfterPan,
      recenterDisabledInitial,
      recenterDisabledWhenLocked,
      recenterPressableAfterPan,
      settingsOpened,
    }
  })

  expect(result).toEqual({
    cameraFollowAriaLabelsWhenLocked: {
      spacecraft: 'Camera controls unavailable: Follow Spacecraft',
      target: 'Camera controls unavailable: Follow Target',
    },
    cameraFollowDataAfterSelection: 'target',
    cameraFollowDataInitial: 'spacecraft',
    cameraFollowOptionsAfterSelection: [
      {
        disabled: false,
        label: 'Spacecraft',
        pressed: 'false',
        value: 'spacecraft',
      },
      { disabled: false, label: 'Target', pressed: 'true', value: 'target' },
    ],
    cameraFollowOptionsInitial: [
      {
        disabled: false,
        label: 'Spacecraft',
        pressed: 'true',
        value: 'spacecraft',
      },
      { disabled: false, label: 'Target', pressed: 'false', value: 'target' },
    ],
    cameraFollowOptionsWhenLocked: [
      {
        disabled: true,
        label: 'Spacecraft',
        pressed: 'false',
        value: 'spacecraft',
      },
      { disabled: true, label: 'Target', pressed: 'true', value: 'target' },
    ],
    cameraFollowStatusAfterSelection: 'Target',
    cameraFollowStatusInitial: 'Spacecraft',
    closedAfterClose: true,
    closedAfterEscape: true,
    closedAfterOutsidePointer: true,
    closedAfterSettings: true,
    coastHorizonAtMax: '8h',
    coastHorizonAtMin: '2h',
    coastHorizonInitial: '6h',
    decreaseDisabledAtMin: true,
    eventCountAfterDisabledDecrease: 4,
    eventCountAfterLockedClick: 2,
    events: [
      'recenterCamera',
      'setCameraFollowTarget',
      'decreaseCoastHorizon',
      'decreaseCoastHorizon',
      'increaseCoastHorizon',
      'increaseCoastHorizon',
      'increaseCoastHorizon',
    ],
    expandedAfterClick: 'true',
    focusAfterEscape: true,
    increaseDisabledAtMax: true,
    keyboardHints: [
      'Normal burn hold W / ↑',
      'Burn latch double W / ↑',
      'Cancel burn W / ↑ / S / ↓',
      'Turn A / D / ← / →',
      'Precise turn Shift + A / D / ← / →',
      'Time warp [ / ]',
      'Horizon Shift + [ / ]',
      'Target selector T',
      'Toggle Info I',
      'Clear Info pins Shift + I',
      'Switch camera follow C',
      'Recenter camera Shift + C',
    ],
    menuButtonLabelAfterClick: 'Close in-game controls',
    menuButtonLabelAfterEscape: 'Open in-game controls',
    openAfterClick: true,
    recenterAriaLabelInitial: 'Camera already centered on followed subject',
    recenterAriaLabelWhenLocked:
      'Camera controls unavailable: Recenter followed subject',
    recenterDisabledAfterPan: false,
    recenterDisabledInitial: true,
    recenterDisabledWhenLocked: true,
    recenterPressableAfterPan: true,
    settingsOpened: true,
  })
})

test('keeps an empty transient notice title readable inside the bottom pill', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  const notice = page.locator('.hud-notice-transient')
  await page.evaluate(() => {
    const noticeElement = document.querySelector<HTMLElement>(
      '.hud-notice-transient',
    )
    const titleElement =
      noticeElement?.querySelector<HTMLElement>('.hud-notice-title')
    const bodyElement =
      noticeElement?.querySelector<HTMLElement>('.hud-notice-body')
    if (!noticeElement || !titleElement || !bodyElement) {
      throw new Error('Missing transient notice DOM')
    }

    titleElement.textContent = 'Checkpoint saved'
    bodyElement.replaceChildren()
    noticeElement.hidden = false
    noticeElement.dataset.visible = 'true'
    noticeElement.setAttribute('aria-hidden', 'false')
    noticeElement.setAttribute('aria-label', 'Checkpoint saved')
  })

  await expect(notice).toBeVisible()
  await expect(notice.locator('.hud-notice-title')).toHaveText(
    'Checkpoint saved',
  )
  await expect(notice.locator('.hud-notice-body')).toHaveText('')
  await expect(notice).toHaveAttribute('aria-label', 'Checkpoint saved')

  const getMetrics = () =>
    notice.evaluate((noticeElement) => {
      const titleElement =
        noticeElement.querySelector<HTMLElement>('.hud-notice-title')
      const bodyElement =
        noticeElement.querySelector<HTMLElement>('.hud-notice-body')
      if (!titleElement || !bodyElement) {
        throw new Error('Missing transient notice text spans')
      }

      return {
        bodyDisplay: getComputedStyle(bodyElement).display,
        noticeClientWidth: noticeElement.clientWidth,
        noticeScrollWidth: noticeElement.scrollWidth,
        titleClientWidth: titleElement.clientWidth,
        titleMaxWidth: getComputedStyle(titleElement).maxWidth,
        titleScrollWidth: titleElement.scrollWidth,
      }
    })

  const mobileMetrics = await getMetrics()
  expect(mobileMetrics.bodyDisplay).toBe('none')
  expect(mobileMetrics.titleMaxWidth).toBe('100%')
  expect(mobileMetrics.noticeScrollWidth).toBeLessThanOrEqual(
    mobileMetrics.noticeClientWidth,
  )
  expect(mobileMetrics.titleScrollWidth).toBeLessThanOrEqual(
    mobileMetrics.titleClientWidth,
  )

  await attachMobileScreenshot(page, testInfo, 'mobile-empty-transient-notice')

  await page.setViewportSize({ width: 1024, height: 720 })
  await expect(notice).toBeVisible()

  const wideMetrics = await getMetrics()
  expect(wideMetrics.bodyDisplay).toBe('none')
  expect(wideMetrics.titleMaxWidth).toBe('100%')
  expect(wideMetrics.noticeScrollWidth).toBeLessThanOrEqual(
    wideMetrics.noticeClientWidth,
  )
  expect(wideMetrics.titleScrollWidth).toBeLessThanOrEqual(
    wideMetrics.titleClientWidth,
  )

  await attachMobileScreenshot(page, testInfo, 'wide-empty-transient-notice')
})

test('keeps the lunar orbit quality notice text inside the bottom pill', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  const notice = page.locator('.hud-notice-transient')
  await page.evaluate(() => {
    const noticeElement = document.querySelector<HTMLElement>(
      '.hud-notice-transient',
    )
    const titleElement =
      noticeElement?.querySelector<HTMLElement>('.hud-notice-title')
    const bodyElement =
      noticeElement?.querySelector<HTMLElement>('.hud-notice-body')
    if (!noticeElement || !titleElement || !bodyElement) {
      throw new Error('Missing transient notice DOM')
    }

    titleElement.textContent = 'Close lunar orbit recorded'
    bodyElement.textContent = 'Ap 3970 km / Pe 770 km - very elongated'
    noticeElement.hidden = false
    noticeElement.dataset.visible = 'true'
    noticeElement.setAttribute('aria-hidden', 'false')
  })

  await expect(notice).toBeVisible()

  const metrics = await notice.evaluate((noticeElement) => {
    const titleElement =
      noticeElement.querySelector<HTMLElement>('.hud-notice-title')
    const bodyElement =
      noticeElement.querySelector<HTMLElement>('.hud-notice-body')
    if (!titleElement || !bodyElement) {
      throw new Error('Missing transient notice text spans')
    }

    return {
      bodyClientWidth: bodyElement.clientWidth,
      bodyLeft: bodyElement.getBoundingClientRect().left,
      noticeClientWidth: noticeElement.clientWidth,
      noticeScrollWidth: noticeElement.scrollWidth,
      titleClientWidth: titleElement.clientWidth,
      titleOverflow: getComputedStyle(titleElement).overflow,
      titleRight: titleElement.getBoundingClientRect().right,
      titleTextOverflow: getComputedStyle(titleElement).textOverflow,
    }
  })

  expect(metrics.noticeScrollWidth).toBeLessThanOrEqual(
    metrics.noticeClientWidth,
  )
  expect(metrics.titleClientWidth).toBeGreaterThan(0)
  expect(metrics.bodyClientWidth).toBeGreaterThan(0)
  expect(metrics.titleRight).toBeLessThanOrEqual(metrics.bodyLeft)
  expect(metrics.titleOverflow).toBe('hidden')
  expect(metrics.titleTextOverflow).toBe('ellipsis')

  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-lunar-orbit-quality-notice',
  )
})

test('keeps the desktop UI settings dialog focus and camera pan behavior', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(async () => {
    const uiSettingsDialogModulePath = '/src/ui/createUiSettingsDialog.ts'
    const { createUiSettingsDialog } = await import(uiSettingsDialogModulePath)
    const app = document.createElement('div')
    const beforeButton = document.createElement('button')
    const events: string[] = []
    const openEvents: boolean[] = []
    let desktopCameraPanMode: DesktopCameraPanMode = 'wheel'
    let desktopEdgePanSpeed: DesktopEdgePanSpeed = 'normal'
    let desktopWheelPanSpeed: DesktopWheelPanSpeed = 'normal'

    beforeButton.textContent = 'Before settings'
    document.body.append(beforeButton, app)
    beforeButton.focus()

    const dialog = createUiSettingsDialog({
      app,
      getDesktopCameraPanMode: () => desktopCameraPanMode,
      getDesktopCameraPanVisible: () => true,
      getDesktopEdgePanSpeed: () => desktopEdgePanSpeed,
      getDesktopWheelPanSpeed: () => desktopWheelPanSpeed,
      onOpenChange: (open: boolean) => openEvents.push(open),
      onDesktopCameraPanModeChange: (mode: DesktopCameraPanMode) => {
        events.push(`panMode:${mode}`)
        desktopCameraPanMode = mode
      },
      onDesktopEdgePanSpeedChange: (speed: DesktopEdgePanSpeed) => {
        events.push(`edgePanSpeed:${speed}`)
        desktopEdgePanSpeed = speed
      },
      onDesktopWheelPanSpeedChange: (speed: DesktopWheelPanSpeed) => {
        events.push(`wheelPanSpeed:${speed}`)
        desktopWheelPanSpeed = speed
      },
    })
    const getButtonByText = (text: string): HTMLButtonElement | undefined =>
      (
        Array.from(
          (dialog.element as HTMLElement).querySelectorAll('button'),
        ) as HTMLButtonElement[]
      ).find((button) => button.textContent?.includes(text))
    const getPanModeRadio = (mode: DesktopCameraPanMode) =>
      dialog.element.querySelector(
        `.app-dialog-radio-input[value="${mode}"]`,
      ) as HTMLInputElement | null
    const getPanSpeed = (setting: 'edge' | 'wheel') =>
      dialog.element.querySelector(`[data-ui-settings-pan-speed="${setting}"]`)
        ?.textContent
    const getPanSpeedButton = (
      setting: 'edge' | 'wheel',
      action: 'decrease' | 'increase',
    ) =>
      dialog.element.querySelector(
        `[data-ui-settings-pan-speed-action="${setting}-${action}"]`,
      ) as HTMLButtonElement | null

    dialog.open()
    const activeAfterOpen =
      document.activeElement?.classList.contains('app-dialog-close')
    const settingsEntryLabels = (
      Array.from(
        dialog.element.querySelectorAll('.app-dialog-setting-button'),
      ) as HTMLButtonElement[]
    ).map((button) => button.getAttribute('aria-label'))
    getButtonByText('Camera settings')?.click()
    const cameraTitle =
      dialog.element.querySelector('.app-dialog-title')?.textContent
    const paneText = dialog.element.textContent ?? ''
    const panCameraGroup = dialog.element.querySelector(
      '.app-dialog-radio-group',
    ) as HTMLFieldSetElement | null
    const panModeRadios = Array.from(
      dialog.element.querySelectorAll(
        '.app-dialog-radio-input',
      ) as NodeListOf<HTMLInputElement>,
    )
    const panModeRadioAccessibleNames = panModeRadios.map((input) =>
      input.getAttribute('aria-label'),
    )
    const panModeRadioDescriptions = panModeRadios.map((input) => {
      const descriptionId = input.getAttribute('aria-describedby')
      return descriptionId
        ? document.getElementById(descriptionId)?.textContent
        : undefined
    })
    const panModeRadioNames = panModeRadios.map((input) => input.name)
    const wheelModeCheckedInitial = getPanModeRadio('wheel')?.checked
    const wheelPanSpeedInitial = getPanSpeed('wheel')
    const edgePanSpeedHiddenInitial = getPanSpeed('edge') === undefined

    getPanModeRadio('edge')?.click()
    const edgeModeCheckedAfterSelect = getPanModeRadio('edge')?.checked
    const edgePanSpeedAfterSelect = getPanSpeed('edge')
    const wheelPanSpeedHiddenForEdge = getPanSpeed('wheel') === undefined
    getPanSpeedButton('edge', 'increase')?.click()
    const edgePanSpeedAfterIncrease = getPanSpeed('edge')

    getPanModeRadio('drag')?.click()
    const panSpeedsHiddenForDrag =
      getPanSpeed('edge') === undefined && getPanSpeed('wheel') === undefined

    getPanModeRadio('wheel')?.click()
    getPanSpeedButton('wheel', 'increase')?.click()
    const wheelPanSpeedAfterIncrease = getPanSpeed('wheel')
    dialog.syncState()
    const wheelModeCheckedAfterSync = getPanModeRadio('wheel')?.checked
    dialog.close()

    return {
      activeAfterOpen,
      edgeModeCheckedAfterSelect,
      edgePanSpeedAfterIncrease,
      edgePanSpeedAfterSelect,
      edgePanSpeedHiddenInitial,
      events,
      focusRestored: document.activeElement === beforeButton,
      openEvents,
      paneText,
      cameraTitle,
      panCameraGroupLabel: panCameraGroup?.querySelector('legend')?.textContent,
      panCameraGroupTagName: panCameraGroup?.tagName,
      panModeRadioAccessibleNames,
      panModeRadioDescriptions,
      panModeRadioLabelCount: panModeRadios.length,
      panModeRadioNameCount: new Set(panModeRadioNames).size,
      panSpeedsHiddenForDrag,
      settingsEntryLabels,
      wheelModeCheckedAfterSync,
      wheelModeCheckedInitial,
      wheelPanSpeedAfterIncrease,
      wheelPanSpeedHiddenForEdge,
      wheelPanSpeedInitial,
    }
  })

  expect(result).toEqual({
    activeAfterOpen: true,
    cameraTitle: 'Camera settings',
    edgeModeCheckedAfterSelect: true,
    edgePanSpeedAfterIncrease: 'Fast',
    edgePanSpeedAfterSelect: 'Normal',
    edgePanSpeedHiddenInitial: true,
    events: [
      'panMode:edge',
      'edgePanSpeed:fast',
      'panMode:drag',
      'panMode:wheel',
      'wheelPanSpeed:fast',
    ],
    focusRestored: true,
    openEvents: [true, false],
    paneText: expect.stringContaining('Camera'),
    panCameraGroupLabel: 'Pan camera',
    panCameraGroupTagName: 'FIELDSET',
    panModeRadioAccessibleNames: [
      'Wheel / trackpad',
      'Mouse drag',
      'Screen edge',
    ],
    panModeRadioDescriptions: [
      'Scroll to pan · Ctrl/Cmd + scroll to zoom',
      'Click and drag to pan · Scroll to zoom',
      'Move the pointer to an edge · Scroll to zoom',
    ],
    panModeRadioLabelCount: 3,
    panModeRadioNameCount: 1,
    panSpeedsHiddenForDrag: true,
    settingsEntryLabels: ['Camera settings: Camera preferences'],
    wheelModeCheckedAfterSync: true,
    wheelModeCheckedInitial: true,
    wheelPanSpeedAfterIncrease: 'Fast',
    wheelPanSpeedHiddenForEdge: true,
    wheelPanSpeedInitial: 'Normal',
  })
  expect(result.paneText).not.toContain('Starts by drag or tap')
  expect(result.paneText).not.toContain('Orbit point display')
  expect(result.paneText).not.toContain('Target side')
  expect(result.paneText).not.toContain('Trajectory side')
})

test('omits retired mobile controls from desktop settings', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const paneText = await page.evaluate(async () => {
    const uiSettingsDialogModulePath = '/src/ui/createUiSettingsDialog.ts'
    const { createUiSettingsDialog } = await import(uiSettingsDialogModulePath)
    const app = document.createElement('div')
    document.body.append(app)

    const dialog = createUiSettingsDialog({
      app,
      getDesktopCameraPanMode: () => 'wheel' as DesktopCameraPanMode,
      getDesktopCameraPanVisible: () => true,
      getDesktopEdgePanSpeed: () => 'normal' as DesktopEdgePanSpeed,
      getDesktopWheelPanSpeed: () => 'normal' as DesktopWheelPanSpeed,
      onDesktopCameraPanModeChange: () => {},
      onDesktopEdgePanSpeedChange: () => {},
      onDesktopWheelPanSpeedChange: () => {},
    })
    dialog.open()
    const settingsButton = Array.from(
      dialog.element.querySelectorAll(
        'button',
      ) as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Camera settings')) as
      | HTMLButtonElement
      | undefined
    settingsButton?.click()
    const paneText = dialog.element.textContent ?? ''
    dialog.close()

    return paneText
  })

  expect(paneText).toContain('Camera')
  expect(paneText).not.toContain('Starts by drag or tap')
  expect(paneText).not.toContain('Orbit point display')
  expect(paneText).not.toContain('Target side')
  expect(paneText).not.toContain('Trajectory side')
})

test('captures the mobile top menu open over gameplay HUD', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page.getByLabel('Open menu').click()
  await expect(page.locator('.top-menu-dropdown')).toBeVisible()
  await expect(
    page.getByRole('menuitemcheckbox', { name: 'Show debug window' }),
  ).toBeVisible()

  await attachMobileScreenshot(page, testInfo, 'mobile-top-menu-open')

  await page.getByRole('menuitem', { name: 'Save debug snapshot' }).click()
  await expect(page.getByRole('textbox', { name: 'Name' })).toHaveValue(
    /Reach the Moon|reach-moon/,
  )
  await attachMobileScreenshot(page, testInfo, 'mobile-top-menu-snapshot-save')
})

test('hides the empty in-game controls menu on mobile', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await expect(
    page.getByRole('button', { name: 'Open in-game controls' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('dialog', { name: 'In-game controls' }),
  ).toHaveCount(0)

  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-gameplay-without-controls-menu',
  )
})

test('captures desktop camera pan modes and conditional speeds in UI settings', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 480, height: 720 })
  await page.goto('/?reachmoon=1')
  await page.addStyleTag({
    content: `
      #app {
        background: #05070d !important;
      }
    `,
  })

  await page.evaluate(async () => {
    const uiSettingsDialogModulePath = '/src/ui/createUiSettingsDialog.ts'
    const { createUiSettingsDialog } = await import(uiSettingsDialogModulePath)
    const app = document.querySelector<HTMLElement>('#app')
    let desktopCameraPanMode: DesktopCameraPanMode = 'wheel'
    let desktopEdgePanSpeed: DesktopEdgePanSpeed = 'normal'
    let desktopWheelPanSpeed: DesktopWheelPanSpeed = 'normal'

    if (!app) {
      throw new Error('Missing app root')
    }

    app.replaceChildren()
    app.classList.remove('app-main-menu', 'app-crashed')

    const dialog = createUiSettingsDialog({
      app,
      getDesktopCameraPanMode: () => desktopCameraPanMode,
      getDesktopCameraPanVisible: () => true,
      getDesktopEdgePanSpeed: () => desktopEdgePanSpeed,
      getDesktopWheelPanSpeed: () => desktopWheelPanSpeed,
      onDesktopCameraPanModeChange: (mode: DesktopCameraPanMode) => {
        desktopCameraPanMode = mode
      },
      onDesktopEdgePanSpeedChange: (speed: DesktopEdgePanSpeed) => {
        desktopEdgePanSpeed = speed
      },
      onDesktopWheelPanSpeedChange: (speed: DesktopWheelPanSpeed) => {
        desktopWheelPanSpeed = speed
      },
    })

    dialog.open()
    const cameraSettingsButton = (
      Array.from(
        dialog.element.querySelectorAll('button'),
      ) as HTMLButtonElement[]
    ).find((button) => button.textContent?.includes('Camera settings'))
    cameraSettingsButton?.click()
  })

  await expect(
    page.getByRole('dialog', { name: 'Camera settings' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Spacecraft controls settings/ }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: /Orbit point display/ }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('group', { name: 'Camera', exact: true }),
  ).toBeVisible()
  const panCameraGroup = page.getByRole('group', { name: 'Pan camera' })
  const wheelRadio = panCameraGroup.getByRole('radio', {
    name: 'Wheel / trackpad',
    exact: true,
  })
  const dragRadio = panCameraGroup.getByRole('radio', {
    name: 'Mouse drag',
    exact: true,
  })
  const edgeRadio = panCameraGroup.getByRole('radio', {
    name: 'Screen edge',
    exact: true,
  })

  await expect(panCameraGroup.getByRole('radio')).toHaveCount(3)
  await expect(wheelRadio).toBeChecked()
  await expect(
    page.getByText('Scroll to pan · Ctrl/Cmd + scroll to zoom'),
  ).toBeVisible()
  await expect(
    page.getByText('Click and drag to pan · Scroll to zoom'),
  ).toBeVisible()
  await expect(
    page.getByText('Move the pointer to an edge · Scroll to zoom'),
  ).toBeVisible()
  await expect(page.getByText('Edge pan speed')).toHaveCount(0)
  await expect(page.getByText('Wheel / trackpad pan speed')).toBeVisible()
  await expect(page.locator('[data-ui-settings-pan-speed="wheel"]')).toHaveText(
    'Normal',
  )

  await wheelRadio.press('ArrowRight')
  await expect(dragRadio).toBeChecked()
  await expect(page.getByText('Edge pan speed')).toHaveCount(0)
  await expect(page.getByText('Wheel / trackpad pan speed')).toHaveCount(0)

  await dragRadio.press('ArrowRight')
  await expect(edgeRadio).toBeChecked()
  await expect(page.getByText('Edge pan speed')).toBeVisible()
  await expect(page.getByText('Wheel / trackpad pan speed')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Decrease edge pan speed' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Increase edge pan speed' }),
  ).toBeVisible()

  await wheelRadio.check()
  await attachMobileScreenshot(
    page,
    testInfo,
    'desktop-camera-pan-wheel-settings',
  )

  await edgeRadio.check()
  const edgeSpeedGroup = page.getByRole('group', { name: 'Edge pan speed' })
  await edgeSpeedGroup.scrollIntoViewIfNeeded()
  const edgeSpeedBounds = await edgeSpeedGroup.boundingBox()
  const dialogBounds = await page
    .getByRole('dialog', { name: 'Camera settings' })
    .boundingBox()
  expect(edgeSpeedBounds).not.toBeNull()
  expect(dialogBounds).not.toBeNull()
  expect(
    (edgeSpeedBounds?.y ?? 0) + (edgeSpeedBounds?.height ?? 0),
  ).toBeLessThanOrEqual(
    (dialogBounds?.y ?? 0) + (dialogBounds?.height ?? Number.POSITIVE_INFINITY),
  )
  await attachMobileScreenshot(
    page,
    testInfo,
    'desktop-camera-pan-edge-settings',
  )
})

test('captures wide in-game controls keyboard hints', async ({
  baseURL,
  browser,
}, testInfo) => {
  if (!baseURL) {
    throw new Error('Playwright base URL is not configured')
  }

  const context = await browser.newContext({
    baseURL,
    hasTouch: false,
    isMobile: false,
    viewport: { width: 1024, height: 720 },
  })
  const page = await context.newPage()

  try {
    await startReachMoonMission(page, '', { touchControlsVisible: false })

    await page.getByRole('button', { name: 'Open in-game controls' }).click()
    const controlsDialog = page.getByRole('dialog', {
      name: 'In-game controls',
    })
    await expect(controlsDialog).toBeVisible()
    await expect(
      page.getByRole('group', { name: 'Keyboard shortcuts' }),
    ).toBeVisible()
    const controlsBounds = await controlsDialog.boundingBox()
    expect(controlsBounds).not.toBeNull()
    expect(controlsBounds?.y ?? -1).toBeGreaterThanOrEqual(0)
    expect(
      (controlsBounds?.y ?? 0) + (controlsBounds?.height ?? 0),
    ).toBeLessThanOrEqual(720)
    const controlsScrollMetrics = await controlsDialog.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }))
    expect(controlsScrollMetrics.scrollHeight).toBeGreaterThan(
      controlsScrollMetrics.clientHeight,
    )
    await expect(page.getByText('Normal burn')).toBeVisible()
    await expect(page.getByText('Turn', { exact: true })).toBeVisible()
    await expect(page.getByText('Precise turn', { exact: true })).toBeVisible()
    await expect(
      controlsDialog.getByText('Time warp', { exact: true }),
    ).toBeVisible()
    await expect(page.getByText('Burn latch')).toBeVisible()
    await expect(
      page
        .getByLabel('In-game controls', { exact: true })
        .getByText('Horizon', { exact: true }),
    ).toBeVisible()
    await expect(page.getByText('Toggle Info', { exact: true })).toBeVisible()
    await expect(
      page.getByText('Clear Info pins', { exact: true }),
    ).toBeVisible()
    await expect(
      controlsDialog.getByRole('group', { name: 'Follow' }),
    ).toBeVisible()
    await expect(
      controlsDialog.getByRole('button', {
        name: 'Camera already centered on followed subject',
      }),
    ).toBeVisible()
    await expect(
      controlsDialog.locator('.in-game-controls-menu-keyboard-name', {
        hasText: 'Switch camera follow',
      }),
    ).toBeVisible()
    await expect(
      controlsDialog.locator('.in-game-controls-menu-keyboard-name', {
        hasText: 'Recenter camera',
      }),
    ).toBeVisible()
    const cameraGrid = controlsDialog.locator(
      '.in-game-controls-menu-camera-grid',
    )
    const followGroup = controlsDialog.getByRole('group', { name: 'Follow' })
    const recenterButton = controlsDialog.getByRole('button', {
      name: 'Camera already centered on followed subject',
    })
    const [cameraGridBounds, followGroupBounds, recenterBounds] =
      await Promise.all([
        cameraGrid.boundingBox(),
        followGroup.boundingBox(),
        recenterButton.boundingBox(),
      ])
    expect(cameraGridBounds).not.toBeNull()
    expect(followGroupBounds).not.toBeNull()
    expect(recenterBounds).not.toBeNull()
    expect(followGroupBounds?.width ?? 0).toBeGreaterThanOrEqual(
      (cameraGridBounds?.width ?? 0) * 0.9,
    )
    expect(recenterBounds?.width ?? 0).toBeLessThan(
      (followGroupBounds?.width ?? 0) * 0.5,
    )
    await expect(
      controlsDialog.locator('.in-game-controls-menu-keyboard-name', {
        hasText: 'View',
      }),
    ).toHaveCount(0)
    await attachMobileScreenshot(
      page,
      testInfo,
      'wide-in-game-controls-menu-top',
    )
    await controlsDialog.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })

    await attachMobileScreenshot(
      page,
      testInfo,
      'wide-in-game-controls-keyboard-hints',
    )
  } finally {
    await context.close()
  }
})

test('captures the mobile Time Warp control in Nav', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page.getByRole('button', { name: 'Open Nav panel' }).click()
  const navPanel = page.locator('#mobile-command-dock-nav-panel')
  const timeWarpControl = navPanel.getByLabel('Time Warp', { exact: true })
  await expect(navPanel).toBeVisible()
  await expect(timeWarpControl).toBeVisible()
  await expect(
    page.locator('#touch-time-warp-reveal, #touch-time-warp-prototype-reveal'),
  ).toHaveCount(0)
  await expect(
    page.getByLabel(/Time Warp control [12]/, { exact: true }),
  ).toHaveCount(0)

  await attachMobileScreenshot(page, testInfo, 'mobile-time-warp-control')
  await page.addStyleTag({
    content: `
      .touch-step-selector-horizontal-track {
        transition-duration: var(--touch-step-selector-horizontal-settle-duration) !important;
      }
    `,
  })

  const timeWarpBox = await timeWarpControl.boundingBox()
  if (!timeWarpBox) {
    throw new Error('Expected Time Warp bounds')
  }
  await page.mouse.move(
    timeWarpBox.x + timeWarpBox.width / 2,
    timeWarpBox.y + timeWarpBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    timeWarpBox.x + timeWarpBox.width / 2 - 69,
    timeWarpBox.y + timeWarpBox.height / 2,
    { steps: 3 },
  )
  await expect(timeWarpControl).toHaveClass(/touch-step-selector-dragging/)
  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-time-warp-control-dragging',
  )
  await page.mouse.up()
  await page.waitForTimeout(200)
  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-time-warp-control-fling-rolling',
    { animations: 'allow' },
  )
  await expect(
    timeWarpControl.locator('.touch-step-selector-value-current'),
  ).toHaveText('x4m')
  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-time-warp-control-elevated-spacing',
  )
})

test('captures the mobile trajectory horizon control in Nav', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page, 'touchTrajectorySide=hidden')

  await page.getByRole('button', { name: 'Open Nav panel' }).click()
  const navPanel = page.locator('#mobile-command-dock-nav-panel')
  await expect(
    navPanel.getByLabel('Trajectory prediction horizon control', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    navPanel.locator(
      '.touch-step-selector-trajectory .touch-step-selector-value-current',
    ),
  ).toHaveText('2d')
  await expect(page.locator('#touch-trajectory-horizon-reveal')).toHaveCount(0)

  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-trajectory-horizon-control',
  )
})

test('captures automatic and manual-recommended Target states in Nav', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page, 'touchTargetSide=right')

  await page.getByRole('button', { name: 'Open Nav panel' }).click()
  const navPanel = page.locator('#mobile-command-dock-nav-panel')
  const targetButton = navPanel.locator('#mobile-command-dock-target-button')
  const targetControl = navPanel.getByLabel('Target body selector', {
    exact: true,
  })
  await expect(targetButton).toHaveAttribute('aria-expanded', 'false')
  await targetButton.click()
  await expect(targetButton).toHaveAttribute('aria-expanded', 'true')
  await expect(targetControl).toBeVisible()
  await expect(page.locator('#touch-target-reveal')).toHaveCount(0)

  await attachMobileScreenshot(page, testInfo, 'mobile-target-selector-auto')

  await targetControl.getByRole('button', { name: /^Moon,/ }).click()
  await expect(navPanel).toBeVisible()
  await expect(
    targetControl.getByRole('button', { name: /^Moon,.*pinned target/ }),
  ).toBeVisible()
  await expect(targetButton).toHaveAccessibleName(/Earth target recommended/)
  await expect(
    page.locator('#mobile-command-dock-nav-button'),
  ).toHaveAccessibleName(/Earth target recommended/)
  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-target-selector-manual-recommended',
  )

  await targetControl
    .getByRole('switch', { name: /Automatic targeting off/ })
    .click()
  await expect(navPanel).toBeVisible()
})

test('captures the mobile thrust touch control in Flight', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page.getByRole('button', { name: 'Open Flight panel' }).click()
  await expect(
    page.locator('.mobile-command-dock-panel .touch-thrust-control'),
  ).toBeVisible()

  await attachMobileScreenshot(page, testInfo, 'mobile-thrust-control')
})

test('captures mobile active thrust without a bottom burn notice pill', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        code: 'KeyW',
        key: 'w',
      }),
    )
  })

  const burnNotice = page.locator('.burn-active-notice')
  await expect(burnNotice).toHaveCount(0)
  await expect(page.locator('.telemetry-pill-velocity')).toHaveClass(
    /telemetry-pill-thrusting/,
  )
  await expect(page.locator('.telemetry-speed-icon')).toHaveClass(
    /telemetry-speed-icon-thrusting/,
  )
  const activePillState = await page.evaluate(() => {
    const speedPill = document.querySelector<HTMLElement>(
      '.telemetry-pill-velocity.telemetry-pill-thrusting',
    )
    const burnPill = document.querySelector<HTMLElement>('.burn-active-notice')
    if (!speedPill || burnPill) {
      throw new Error('Expected active speed pill and no burn notice pill')
    }

    return {
      burnNoticeCount: document.querySelectorAll('.burn-active-notice').length,
      speedPillClassName: speedPill.className,
    }
  })
  expect(activePillState).toEqual({
    burnNoticeCount: 0,
    speedPillClassName:
      'telemetry-pill telemetry-pill-velocity telemetry-pill-thrusting',
  })

  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-active-thrust-speed-pill',
  )

  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent('keyup', {
        bubbles: true,
        cancelable: true,
        code: 'KeyW',
        key: 'w',
      }),
    )
  })
  await expect(page.locator('.telemetry-pill-velocity')).not.toHaveClass(
    /telemetry-pill-thrusting/,
  )
})
