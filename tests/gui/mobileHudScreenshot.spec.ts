import {
  expect,
  type Page,
  type Route,
  type TestInfo,
  test,
} from '@playwright/test'
import type { UIUserAction } from '../../src/input/uiUserActions'
import type { ReachMoonHighscorePendingRun } from '../../src/ui/components/MainMenuSurface'

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
  .heading-target-dot,
  .heading-target-overlay,
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

const expectWorldVisualsSuppressed = async (page: Page) => {
  await expect(page.locator('canvas')).toHaveCSS('visibility', 'hidden')
  await expect(page.locator('.spacecraft-callout')).toHaveCSS(
    'visibility',
    'hidden',
  )
}

const getReachMoonUrl = (query = '') =>
  query ? `/?reachmoon=1&${query}` : '/?reachmoon=1'

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

const startReachMoonMission = async (page: Page, query = '') => {
  await openReachMoonMainMenu(page, query)

  await page.getByRole('button', { name: 'Reach the Moon' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(
    page.getByRole('heading', { name: 'Reach the Moon' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Start mission' }).click()
  await expect(page.locator('.scenario-prompt')).toBeHidden()
  await expect(page.locator('.touch-controls')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Mission Brief' }),
  ).toBeVisible()
  await expectWorldVisualsSuppressed(page)
}

test('captures the mobile main menu HUD with world visuals suppressed', async ({
  page,
}, testInfo) => {
  await openReachMoonMainMenu(page)

  await attachMobileScreenshot(page, testInfo, 'mobile-main-menu')
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
      reachMoonFeatureEnabled: true,
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

  await page.goto('/?reachmoon=1')
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
      reachMoonFeatureEnabled: true,
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

test('skips highscore requests when the Reach the Moon feature is disabled', async ({
  page,
}) => {
  let highscoreRequestCount = 0
  await page.route('**/api/reach-moon/highscores**', async (route) => {
    highscoreRequestCount += 1
    await route.fulfill({
      body: JSON.stringify({ rollups: {} }),
      contentType: 'application/json',
      status: 200,
    })
  })

  await page.goto('/?reachmoon=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(async (pendingRun) => {
    const mainMenuModulePath = '/src/ui/createMainMenu.ts'
    const { createMainMenu } = await import(mainMenuModulePath)
    const app = document.createElement('div')
    document.body.append(app)

    const menu = createMainMenu({
      app,
      reachMoonFeatureEnabled: false,
      onFreeRoam: () => undefined,
      onLoadGame: () => undefined,
      onReachMoon: () => undefined,
      onTutorial: () => undefined,
    })
    menu.showReachMoonHighscores(pendingRun)

    return {
      highscorePanelCount: menu.element.querySelectorAll(
        '[data-main-menu-view="reach-moon-highscores"]',
      ).length,
      mainHidden:
        menu.element
          .querySelector('[data-main-menu-view="main"]')
          ?.hasAttribute('hidden') ?? true,
    }
  }, completedHighscoreRun)

  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(resolve)),
  )

  expect(result).toEqual({ highscorePanelCount: 0, mainHidden: false })
  expect(highscoreRequestCount).toBe(0)
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

  await page.goto('/?reachmoon=1')
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
      reachMoonFeatureEnabled: true,
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
    page.getByRole('heading', { name: 'Open Burn Control' }),
  ).toBeVisible()
  await expect(page.locator('.scenario-prompt-backdrop')).toHaveAttribute(
    'data-prompt-mode',
    'coach',
  )
  await expect(page.locator('.scenario-prompt')).toHaveAttribute(
    'data-anchor',
    'thrust-control',
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
  await page.goto('/?reachmoon=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(async () => {
    const mainMenuModulePath = '/src/ui/createMainMenu.ts'
    const debugSnapshotModulePath = '/src/debugScenarioSnapshot.ts'
    const { createMainMenu } = await import(mainMenuModulePath)
    const { clearDebugScenarioSnapshot, writeDebugScenarioSnapshot } =
      await import(debugSnapshotModulePath)
    const app = document.createElement('div')
    const events: string[] = []

    document.body.append(app)
    writeDebugScenarioSnapshot({
      version: 1,
      savedAt: new Date(0).toISOString(),
      elapsed: 0,
      bodies: [],
      spacecraft: {},
    })
    writeDebugScenarioSnapshot({
      version: 1,
      savedAt: new Date(1).toISOString(),
      elapsed: 1,
      bodies: [],
      spacecraft: {},
    })

    const menu = createMainMenu({
      app,
      reachMoonFeatureEnabled: false,
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
  await page.goto('/?reachmoon=1')
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
      version: 1,
      savedAt: new Date(0).toISOString(),
      elapsed: 0,
      bodies: [],
      spacecraft: {},
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
    events: ['load', 'checkpoint', 'exit', 'restart'],
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
  await page.goto('/?reachmoon=1')
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
        '.menu-recent-snapshot-select',
      ) as HTMLSelectElement | null
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
    writeDebugScenarioSnapshot({
      version: 1,
      savedAt: new Date(0).toISOString(),
      elapsed: 1,
      bodies: [],
      spacecraft: {},
    })
    writeDebugScenarioSnapshot({
      version: 1,
      savedAt: new Date(1).toISOString(),
      elapsed: 2,
      bodies: [],
      spacecraft: {},
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
      selectedRecentLoadedElapsed,
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
    fpsCheckedAfterToggle: 'true',
    fpsLabelAfterToggle: 'Hide FPS meter',
    focusAfterDebugSnapshotBack: 'openDebugSnapshotLoad',
    focusAfterDebugSnapshotOpen: true,
    debugSnapshotSectionHiddenAfterOpen: false,
    debugSnapshotSectionHiddenBeforeOpen: true,
    loadLastDebugLabel: 'Load last debug snapshot',
    loadDisabledWithSnapshot: false,
    loadDisabledWithoutSnapshot: true,
    openAfterClick: true,
    recentOptions: [
      expect.stringContaining('Snapshot at 2s - '),
      expect.stringContaining('Snapshot at 1s - '),
    ],
    restartLabelAfterFirstClick: 'Confirm restart',
    selectedRecentLoadedElapsed: 1,
  })
})

test('keeps the in-game controls menu adapter state and actions', async ({
  page,
}) => {
  await page.goto('/?reachmoon=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(async () => {
    const controlsMenuModulePath = '/src/ui/createInGameControlsMenu.ts'
    const { createInGameControlsMenu } = await import(controlsMenuModulePath)
    const app = document.createElement('div')
    const outsideButton = document.createElement('button')
    const events: string[] = []
    let cameraMode: 'centered' | 'target' | 'unlocked' = 'centered'
    let cameraModeChangesLocked = false
    let coastHorizonHours = 6
    let settingsOpened = false

    outsideButton.textContent = 'Outside controls'
    document.body.append(app, outsideButton)

    const menu = createInGameControlsMenu({
      app,
      getCameraMode: () => cameraMode,
      getCameraModeChangesLocked: () => cameraModeChangesLocked,
      getCoastPredictionHorizonHours: () => coastHorizonHours,
      getMaxCoastPredictionHorizonHours: () => 8,
      getMinCoastPredictionHorizonHours: () => 2,
      onAction: (action: UIUserAction) => {
        events.push(action)
        if (action === 'setCameraUnlocked') {
          cameraMode = 'unlocked'
        }
        if (action === 'setCameraCentered') {
          cameraMode = 'centered'
        }
        if (action === 'setCameraTarget') {
          cameraMode = 'target'
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
    const getCameraOption = (mode: string) =>
      menu.element.querySelector(
        `[data-camera-mode-option="${mode}"]`,
      ) as HTMLButtonElement | null
    const getCameraOptions = () =>
      Array.from(
        menu.element.querySelectorAll(
          '[data-camera-mode-option]',
        ) as NodeListOf<HTMLButtonElement>,
      ).map((element) => ({
        disabled: element.disabled,
        label: element.textContent?.trim(),
        mode: element.dataset.cameraModeOption,
        pressed: element.getAttribute('aria-pressed'),
      }))
    const getCameraStatus = () =>
      menu.element.querySelector('[data-in-game-camera-status]')?.textContent
    const getCameraOptionAriaLabels = () =>
      Object.fromEntries(
        Array.from(
          menu.element.querySelectorAll(
            '[data-camera-mode-option]',
          ) as NodeListOf<HTMLButtonElement>,
        ).map((element) => [
          element.dataset.cameraModeOption,
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
    const cameraModeDataInitial = menu.element.dataset.cameraMode
    const cameraStatusInitial = getCameraStatus()
    const cameraOptionsInitial = getCameraOptions()
    const coastHorizonInitial = getCoastHorizon()

    getCameraOption('target')?.click()
    const cameraModeDataAfterTarget = menu.element.dataset.cameraMode
    const cameraStatusAfterTarget = getCameraStatus()
    const cameraOptionsAfterTarget = getCameraOptions()

    cameraModeChangesLocked = true
    menu.syncState()
    const cameraOptionsWhenLocked = getCameraOptions()
    const cameraOptionAriaLabelsWhenLocked = getCameraOptionAriaLabels()
    const targetLabelWhenLocked =
      getCameraOption('target')?.getAttribute('aria-label')
    getCameraOption('unlocked')?.click()
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
      cameraModeDataAfterTarget,
      cameraModeDataInitial,
      cameraOptionAriaLabelsWhenLocked,
      cameraOptionsAfterTarget,
      cameraOptionsInitial,
      cameraOptionsWhenLocked,
      cameraStatusAfterTarget,
      cameraStatusInitial,
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
      settingsOpened,
      targetLabelWhenLocked,
    }
  })

  expect(result).toEqual({
    cameraModeDataAfterTarget: 'target',
    cameraModeDataInitial: 'centered',
    cameraOptionAriaLabelsWhenLocked: {
      centered: 'Camera mode changes unavailable: Spacecraft',
      target: 'Camera mode changes unavailable: Target',
      unlocked: 'Camera mode changes unavailable: Free roam',
    },
    cameraOptionsAfterTarget: [
      {
        disabled: false,
        label: 'Free roam',
        mode: 'unlocked',
        pressed: 'false',
      },
      {
        disabled: false,
        label: 'Spacecraft',
        mode: 'centered',
        pressed: 'false',
      },
      { disabled: false, label: 'Target', mode: 'target', pressed: 'true' },
    ],
    cameraOptionsInitial: [
      {
        disabled: false,
        label: 'Free roam',
        mode: 'unlocked',
        pressed: 'false',
      },
      {
        disabled: false,
        label: 'Spacecraft',
        mode: 'centered',
        pressed: 'true',
      },
      { disabled: false, label: 'Target', mode: 'target', pressed: 'false' },
    ],
    cameraOptionsWhenLocked: [
      {
        disabled: true,
        label: 'Free roam',
        mode: 'unlocked',
        pressed: 'false',
      },
      {
        disabled: true,
        label: 'Spacecraft',
        mode: 'centered',
        pressed: 'false',
      },
      { disabled: true, label: 'Target', mode: 'target', pressed: 'true' },
    ],
    cameraStatusAfterTarget: 'Target',
    cameraStatusInitial: 'Spacecraft',
    closedAfterClose: true,
    closedAfterEscape: true,
    closedAfterOutsidePointer: true,
    closedAfterSettings: true,
    coastHorizonAtMax: '8h',
    coastHorizonAtMin: '2h',
    coastHorizonInitial: '6h',
    decreaseDisabledAtMin: true,
    eventCountAfterDisabledDecrease: 3,
    eventCountAfterLockedClick: 1,
    events: [
      'setCameraTarget',
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
      'Turn click, move, click',
      'Time warp [ / ]',
      'Horizon Shift + [ / ]',
      'Target selector T',
      'Camera C',
    ],
    menuButtonLabelAfterClick: 'Close in-game controls',
    menuButtonLabelAfterEscape: 'Open in-game controls',
    openAfterClick: true,
    settingsOpened: true,
    targetLabelWhenLocked: 'Camera mode changes unavailable: Target',
  })
})

test('shows a bottom notice when cycling camera mode from the keyboard', async ({
  page,
}) => {
  await startReachMoonMission(page)

  await page.keyboard.press('KeyC')

  const notice = page.locator('.hud-notice-transient')
  await expect(notice).toBeVisible()
  await expect(notice.locator('.hud-notice-title')).toHaveText('Camera mode')
  await expect(notice.locator('.hud-notice-body')).toHaveText('Target')
  await expect(notice).toHaveAttribute('aria-label', 'Camera mode: Target')
})

test('keeps the empty camera unlock notice title readable inside the bottom pill', async ({
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

    titleElement.textContent = 'Camera unlocked'
    bodyElement.replaceChildren()
    noticeElement.hidden = false
    noticeElement.dataset.visible = 'true'
    noticeElement.setAttribute('aria-hidden', 'false')
    noticeElement.setAttribute(
      'aria-label',
      'Camera unlocked. Drag anywhere to pan.',
    )
  })

  await expect(notice).toBeVisible()
  await expect(notice.locator('.hud-notice-title')).toHaveText(
    'Camera unlocked',
  )
  await expect(notice.locator('.hud-notice-body')).toHaveText('')
  await expect(notice).toHaveAttribute(
    'aria-label',
    'Camera unlocked. Drag anywhere to pan.',
  )

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

  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-camera-unlocked-empty-notice',
  )

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

  await attachMobileScreenshot(
    page,
    testInfo,
    'wide-camera-unlocked-empty-notice',
  )
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

test('keeps the UI settings dialog adapter state, focus, and change behavior', async ({
  page,
}) => {
  await page.goto('/?reachmoon=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(async () => {
    const uiSettingsDialogModulePath = '/src/ui/createUiSettingsDialog.ts'
    const { createUiSettingsDialog } = await import(uiSettingsDialogModulePath)
    const app = document.createElement('div')
    const beforeButton = document.createElement('button')
    const events: string[] = []
    const openEvents: boolean[] = []
    let burnSide: 'left' | 'right' = 'right'
    let targetSide: 'left' | 'right' = 'right'
    let trajectorySide: 'left' | 'right' | 'hidden' = 'hidden'
    let warpSide: 'left' | 'right' = 'left'
    let mobileManeuverStartByDrag = true
    let orbitPointDisplay = {
      altitudeVisible: true,
      centerDistanceVisible: false,
      labelsVisible: true,
      markersVisible: true,
      pointNameVisible: true,
    }
    const orbitEvents: string[] = []

    beforeButton.textContent = 'Before settings'
    document.body.append(beforeButton, app)
    beforeButton.focus()

    const dialog = createUiSettingsDialog({
      app,
      getMobileManeuverStartByDrag: () => mobileManeuverStartByDrag,
      getOrbitPointDisplay: () => orbitPointDisplay,
      getTouchBurnControlSide: () => burnSide,
      getTouchTargetControlSide: () => targetSide,
      getTouchTrajectoryControlSide: () => trajectorySide,
      getTouchWarpControlSide: () => warpSide,
      onOrbitPointDisplayChange: (settings: typeof orbitPointDisplay) => {
        orbitEvents.push(
          `markers:${settings.markersVisible};labels:${settings.labelsVisible};center:${settings.centerDistanceVisible};name:${settings.pointNameVisible}`,
        )
        orbitPointDisplay = settings
      },
      onOpenChange: (open: boolean) => openEvents.push(open),
      onMobileManeuverStartByDragChange: (startByDrag: boolean) => {
        events.push(`maneuver:${startByDrag}`)
        mobileManeuverStartByDrag = startByDrag
      },
      onTouchBurnControlSideChange: (side: 'left' | 'right') => {
        events.push(`burn:${side}`)
        burnSide = side
      },
      onTouchTargetControlSideChange: (side: 'left' | 'right') => {
        events.push(`target:${side}`)
        targetSide = side
      },
      onTouchTrajectoryControlSideChange: (
        side: 'left' | 'right' | 'hidden',
      ) => {
        events.push(`trajectory:${side}`)
        trajectorySide = side
      },
      onTouchWarpControlSideChange: (side: 'left' | 'right') => {
        events.push(`warp:${side}`)
        warpSide = side
      },
    })
    const getCloseButton = () =>
      dialog.element.querySelector(
        '.app-dialog-close',
      ) as HTMLButtonElement | null
    const getControlButton = (ariaLabel: string, value: string) =>
      dialog.element.querySelector(
        `[aria-label="${ariaLabel}"] [data-segmented-control-value="${value}"]`,
      ) as HTMLButtonElement | null
    const getSelectedValue = (ariaLabel: string) =>
      dialog.element
        .querySelector(
          `[aria-label="${ariaLabel}"] .segmented-control-option-selected`,
        )
        ?.getAttribute('data-segmented-control-value')
    const getButtonByText = (text: string): HTMLButtonElement | undefined =>
      (
        Array.from(
          (dialog.element as HTMLElement).querySelectorAll('button'),
        ) as HTMLButtonElement[]
      ).find((button) => button.textContent?.includes(text))
    const getFocusableButtons = (): HTMLButtonElement[] =>
      Array.from(
        (dialog.element as HTMLElement).querySelectorAll('button'),
      ) as HTMLButtonElement[]
    const pressDocumentKey = (
      key: string,
      init: Omit<KeyboardEventInit, 'key'> = {},
    ) =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key,
          ...init,
        }),
      )

    dialog.open()
    const activeAfterOpen = document.activeElement === getCloseButton()
    const openAfterOpen = !dialog.element.hidden
    const role = dialog.element
      .querySelector('.app-dialog-panel')
      ?.getAttribute('role')
    const className = dialog.element.className
    const spacecraftSummaryInitial = getButtonByText(
      'Spacecraft controls settings',
    )?.textContent
    getButtonByText('Spacecraft controls settings')?.click()
    const spacecraftTitleAfterOpen =
      dialog.element.querySelector('.app-dialog-title')?.textContent
    const spacecraftFocusAfterOpen =
      document.activeElement === getButtonByText('Back')
    const spacecraftControlGroup = dialog.element.querySelector(
      '.app-dialog-setting-group-label',
    )?.textContent
    const spacecraftControlGroups = Array.from(
      (dialog.element as HTMLElement).querySelectorAll(
        '.app-dialog-setting-group-label',
      ) as NodeListOf<HTMLElement>,
    ).map((label) => label.textContent)
    const selectedAfterOpen = {
      burn: getSelectedValue('Burn control side'),
      target: getSelectedValue('Target control side'),
      trajectory: getSelectedValue('Trajectory control side'),
      warp: getSelectedValue('Warp control side'),
    }
    const maneuverSwitchInitial = getButtonByText(
      'Starts by drag or tap',
    )?.getAttribute('aria-checked')
    const maneuverSwitchInitialText = getButtonByText(
      'Starts by drag or tap',
    )?.textContent
    getButtonByText('Starts by drag or tap')?.click()
    getControlButton('Burn control side', 'left')?.click()
    getControlButton('Target control side', 'left')?.click()
    getControlButton('Trajectory control side', 'right')?.click()
    getControlButton('Warp control side', 'right')?.click()
    dialog.syncState()
    const selectedAfterChanges = {
      burn: getSelectedValue('Burn control side'),
      target: getSelectedValue('Target control side'),
      trajectory: getSelectedValue('Trajectory control side'),
      warp: getSelectedValue('Warp control side'),
    }
    const maneuverSwitchAfter = getButtonByText(
      'Starts by drag or tap',
    )?.getAttribute('aria-checked')
    const maneuverSwitchAfterText = getButtonByText(
      'Starts by drag or tap',
    )?.textContent
    const burnLeftPressed = getControlButton(
      'Burn control side',
      'left',
    )?.getAttribute('aria-pressed')
    const burnRightPressed = getControlButton(
      'Burn control side',
      'right',
    )?.getAttribute('aria-pressed')
    getButtonByText('Back')?.click()
    const titleAfterSpacecraftBack =
      dialog.element.querySelector('.app-dialog-title')?.textContent
    const spacecraftSummaryAfterChanges = getButtonByText(
      'Spacecraft controls settings',
    )?.textContent
    const orbitSummaryInitial = getButtonByText(
      'Orbit point display',
    )?.textContent
    getButtonByText('Orbit point display')?.click()
    const orbitTitleAfterOpen =
      dialog.element.querySelector('.app-dialog-title')?.textContent
    const orbitFocusAfterOpen =
      document.activeElement === getButtonByText('Back')
    const orbitSwitchOrder = (
      Array.from(
        dialog.element.querySelectorAll('.app-dialog-switch'),
      ) as HTMLButtonElement[]
    ).map((button) => button.textContent?.trim())
    const orbitLabelGroup = dialog.element.querySelector(
      '.app-dialog-setting-group-label',
    )?.textContent
    const centerDistanceInitial = getButtonByText(
      'Show center distance',
    )?.getAttribute('aria-checked')
    getButtonByText('Show center distance')?.click()
    getButtonByText('Show point name')?.click()
    const centerDistanceAfter = getButtonByText(
      'Show center distance',
    )?.getAttribute('aria-checked')
    const pointNameAfter =
      getButtonByText('Show point name')?.getAttribute('aria-checked')
    getButtonByText('Show marker labels')?.click()
    const labelSwitchDisabledWhenLabelsOff =
      getButtonByText('Show marker labels')?.disabled
    const altitudeDisabledWhenLabelsOff =
      getButtonByText('Show altitude')?.disabled
    const centerDisabledWhenLabelsOff = getButtonByText(
      'Show center distance',
    )?.disabled
    const pointNameDisabledWhenLabelsOff =
      getButtonByText('Show point name')?.disabled
    getButtonByText('Show center distance')?.click()
    const eventCountAfterDisabledCenterClick = orbitEvents.length
    getButtonByText('Show marker labels')?.click()
    getButtonByText('Show closest/farthest markers')?.click()
    const markerSwitchDisabledWhenMarkersOff = getButtonByText(
      'Show closest/farthest markers',
    )?.disabled
    const labelSwitchDisabledWhenMarkersOff =
      getButtonByText('Show marker labels')?.disabled
    const altitudeDisabledWhenMarkersOff =
      getButtonByText('Show altitude')?.disabled
    const centerDisabledWhenMarkersOff = getButtonByText(
      'Show center distance',
    )?.disabled
    const pointNameDisabledWhenMarkersOff =
      getButtonByText('Show point name')?.disabled
    getButtonByText('Show closest/farthest markers')?.click()
    getButtonByText('Back')?.click()
    const titleAfterOrbitBack =
      dialog.element.querySelector('.app-dialog-title')?.textContent
    const orbitSummaryAfterChanges = getButtonByText(
      'Orbit point display',
    )?.textContent

    getFocusableButtons().at(-1)?.focus()
    pressDocumentKey('Tab')
    const focusAfterForwardTrap = document.activeElement === getCloseButton()
    getCloseButton()?.focus()
    pressDocumentKey('Tab', { shiftKey: true })
    const focusAfterBackwardTrap =
      document.activeElement === getFocusableButtons().at(-1)

    pressDocumentKey('Escape')
    const hiddenAfterEscape = dialog.element.hidden
    const focusRestoredAfterEscape = document.activeElement === beforeButton

    targetSide = 'left'
    beforeButton.focus()
    dialog.open()
    getButtonByText('Spacecraft controls settings')?.click()
    const targetSyncedOnOpen = getSelectedValue('Target control side')
    dialog.element
      .querySelector('.app-dialog-backdrop')
      ?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
    const hiddenAfterBackdrop = dialog.element.hidden
    const focusRestoredAfterBackdrop = document.activeElement === beforeButton

    beforeButton.focus()
    dialog.open()
    getCloseButton()?.click()
    const hiddenAfterCloseButton = dialog.element.hidden
    const focusRestoredAfterCloseButton =
      document.activeElement === beforeButton

    const hiddenTriggerWrapper = document.createElement('div')
    const hiddenTriggerButton = document.createElement('button')
    hiddenTriggerButton.textContent = 'Hidden settings trigger'
    hiddenTriggerWrapper.append(hiddenTriggerButton)
    document.body.append(hiddenTriggerWrapper)
    hiddenTriggerButton.focus()
    hiddenTriggerWrapper.hidden = true
    const hiddenTriggerWasActiveBeforeOpen =
      document.activeElement === hiddenTriggerButton
    dialog.open()
    getCloseButton()?.click()
    const focusSkippedHiddenTrigger =
      document.activeElement !== hiddenTriggerButton

    return {
      activeAfterOpen,
      burnLeftPressed,
      burnRightPressed,
      className,
      events,
      focusAfterBackwardTrap,
      focusAfterForwardTrap,
      focusRestoredAfterBackdrop,
      focusRestoredAfterCloseButton,
      focusRestoredAfterEscape,
      focusSkippedHiddenTrigger,
      hiddenAfterBackdrop,
      hiddenAfterCloseButton,
      hiddenAfterEscape,
      hiddenTriggerWasActiveBeforeOpen,
      centerDistanceAfter,
      centerDistanceInitial,
      altitudeDisabledWhenLabelsOff,
      altitudeDisabledWhenMarkersOff,
      centerDisabledWhenLabelsOff,
      centerDisabledWhenMarkersOff,
      eventCountAfterDisabledCenterClick,
      labelSwitchDisabledWhenLabelsOff,
      labelSwitchDisabledWhenMarkersOff,
      maneuverSwitchAfter,
      maneuverSwitchAfterText,
      maneuverSwitchInitial,
      maneuverSwitchInitialText,
      markerSwitchDisabledWhenMarkersOff,
      openAfterOpen,
      openEvents,
      orbitEvents,
      orbitFocusAfterOpen,
      orbitSummaryAfterChangesIncludesCenterOn:
        orbitSummaryAfterChanges?.includes('center on'),
      orbitSummaryAfterChangesIncludesNameOff:
        orbitSummaryAfterChanges?.includes('name off'),
      orbitSummaryInitialIncludesCenterOff:
        orbitSummaryInitial?.includes('center off'),
      orbitSummaryInitialIncludesNameOn:
        orbitSummaryInitial?.includes('name on'),
      orbitLabelGroup,
      orbitSwitchOrder,
      orbitTitleAfterOpen,
      pointNameAfter,
      pointNameDisabledWhenLabelsOff,
      pointNameDisabledWhenMarkersOff,
      role,
      selectedAfterChanges,
      selectedAfterOpen,
      spacecraftControlGroup,
      spacecraftControlGroups,
      spacecraftFocusAfterOpen,
      spacecraftSummaryAfterChangesIncludesBurnLeft:
        spacecraftSummaryAfterChanges?.includes('Burn left'),
      spacecraftSummaryAfterChangesIncludesTargetLeft:
        spacecraftSummaryAfterChanges?.includes('target left'),
      spacecraftSummaryAfterChangesIncludesManeuverTap:
        spacecraftSummaryAfterChanges?.includes('maneuver tap'),
      spacecraftSummaryInitialIncludesBurnRight:
        spacecraftSummaryInitial?.includes('Burn right'),
      spacecraftSummaryInitialIncludesTrajectoryHidden:
        spacecraftSummaryInitial?.includes('trajectory hidden'),
      spacecraftSummaryInitialIncludesManeuverDrag:
        spacecraftSummaryInitial?.includes('maneuver drag'),
      spacecraftTitleAfterOpen,
      titleAfterSpacecraftBack,
      titleAfterOrbitBack,
      targetSyncedOnOpen,
    }
  })

  expect(result).toEqual({
    activeAfterOpen: true,
    burnLeftPressed: 'true',
    burnRightPressed: 'false',
    className: 'app-dialog ui-settings-dialog',
    events: [
      'maneuver:false',
      'burn:left',
      'target:left',
      'trajectory:right',
      'warp:right',
    ],
    focusAfterBackwardTrap: true,
    focusAfterForwardTrap: true,
    focusRestoredAfterBackdrop: true,
    focusRestoredAfterCloseButton: true,
    focusRestoredAfterEscape: true,
    focusSkippedHiddenTrigger: true,
    hiddenAfterBackdrop: true,
    hiddenAfterCloseButton: true,
    hiddenAfterEscape: true,
    hiddenTriggerWasActiveBeforeOpen: true,
    centerDistanceAfter: 'true',
    centerDistanceInitial: 'false',
    altitudeDisabledWhenLabelsOff: true,
    altitudeDisabledWhenMarkersOff: true,
    centerDisabledWhenLabelsOff: true,
    centerDisabledWhenMarkersOff: true,
    eventCountAfterDisabledCenterClick: 3,
    labelSwitchDisabledWhenLabelsOff: false,
    labelSwitchDisabledWhenMarkersOff: true,
    maneuverSwitchAfter: 'false',
    maneuverSwitchAfterText: 'Starts by drag or tapStarts by tap',
    maneuverSwitchInitial: 'true',
    maneuverSwitchInitialText: 'Starts by drag or tapStarts by drag',
    markerSwitchDisabledWhenMarkersOff: false,
    openAfterOpen: true,
    openEvents: [true, false, true, false, true, false, true, false],
    orbitEvents: [
      'markers:true;labels:true;center:true;name:true',
      'markers:true;labels:true;center:true;name:false',
      'markers:true;labels:false;center:true;name:false',
      'markers:true;labels:true;center:true;name:false',
      'markers:false;labels:true;center:true;name:false',
      'markers:true;labels:true;center:true;name:false',
    ],
    orbitFocusAfterOpen: true,
    orbitSummaryAfterChangesIncludesCenterOn: true,
    orbitSummaryAfterChangesIncludesNameOff: true,
    orbitSummaryInitialIncludesCenterOff: true,
    orbitSummaryInitialIncludesNameOn: true,
    orbitLabelGroup: 'Marker label contents',
    orbitSwitchOrder: [
      'Show closest/farthest markers',
      'Show marker labels',
      'Show point name',
      'Show altitude',
      'Show center distance',
    ],
    orbitTitleAfterOpen: 'Orbit point display',
    pointNameAfter: 'false',
    pointNameDisabledWhenLabelsOff: true,
    pointNameDisabledWhenMarkersOff: true,
    role: 'dialog',
    selectedAfterChanges: {
      burn: 'left',
      target: 'left',
      trajectory: 'right',
      warp: 'right',
    },
    selectedAfterOpen: {
      burn: 'right',
      target: 'right',
      trajectory: 'hidden',
      warp: 'left',
    },
    spacecraftControlGroup: 'Control sides',
    spacecraftControlGroups: ['Control sides', 'Maneuvers'],
    spacecraftFocusAfterOpen: true,
    spacecraftSummaryAfterChangesIncludesBurnLeft: true,
    spacecraftSummaryAfterChangesIncludesTargetLeft: true,
    spacecraftSummaryAfterChangesIncludesManeuverTap: true,
    spacecraftSummaryInitialIncludesBurnRight: true,
    spacecraftSummaryInitialIncludesTrajectoryHidden: true,
    spacecraftSummaryInitialIncludesManeuverDrag: true,
    spacecraftTitleAfterOpen: 'Spacecraft controls settings',
    titleAfterSpacecraftBack: 'UI settings',
    titleAfterOrbitBack: 'UI settings',
    targetSyncedOnOpen: 'left',
  })
})

test('hides desktop-only irrelevant spacecraft settings without resetting saved mobile values', async ({
  page,
}) => {
  await page.goto('/?reachmoon=1')
  await expect(page.locator('[data-boot-screen]')).toBeHidden()

  const result = await page.evaluate(async () => {
    const uiSettingsDialogModulePath = '/src/ui/createUiSettingsDialog.ts'
    const { createUiSettingsDialog } = await import(uiSettingsDialogModulePath)
    const app = document.createElement('div')
    const events: string[] = []
    let touchControlsVisible = false
    const burnControlAvailable = true
    let targetControlAvailable = true
    const trajectoryControlAvailable = true
    let warpControlAvailable = true
    let burnSide: 'left' | 'right' = 'left'
    let targetSide: 'left' | 'right' = 'right'
    let trajectorySide: 'left' | 'right' | 'hidden' = 'hidden'
    let warpSide: 'left' | 'right' = 'right'
    let mobileManeuverStartByDrag = true
    const orbitPointDisplay = {
      altitudeVisible: true,
      centerDistanceVisible: true,
      labelsVisible: true,
      markersVisible: true,
      pointNameVisible: true,
    }

    document.body.append(app)

    const dialog = createUiSettingsDialog({
      app,
      getMobileManeuverStartByDrag: () => mobileManeuverStartByDrag,
      getOrbitPointDisplay: () => orbitPointDisplay,
      getTouchBurnControlAvailable: () => burnControlAvailable,
      getTouchBurnControlSide: () => burnSide,
      getTouchControlsVisible: () => touchControlsVisible,
      getTouchTargetControlAvailable: () => targetControlAvailable,
      getTouchTargetControlSide: () => targetSide,
      getTouchTrajectoryControlAvailable: () => trajectoryControlAvailable,
      getTouchTrajectoryControlSide: () => trajectorySide,
      getTouchWarpControlAvailable: () => warpControlAvailable,
      getTouchWarpControlSide: () => warpSide,
      onMobileManeuverStartByDragChange: (startByDrag: boolean) => {
        events.push(`maneuver:${startByDrag}`)
        mobileManeuverStartByDrag = startByDrag
      },
      onOrbitPointDisplayChange: () => {
        events.push('orbit')
      },
      onOpenChange: () => {},
      onTouchBurnControlSideChange: (side: 'left' | 'right') => {
        events.push(`burn:${side}`)
        burnSide = side
      },
      onTouchTargetControlSideChange: (side: 'left' | 'right') => {
        events.push(`target:${side}`)
        targetSide = side
      },
      onTouchTrajectoryControlSideChange: (
        side: 'left' | 'right' | 'hidden',
      ) => {
        events.push(`trajectory:${side}`)
        trajectorySide = side
      },
      onTouchWarpControlSideChange: (side: 'left' | 'right') => {
        events.push(`warp:${side}`)
        warpSide = side
      },
    })

    const getButtonByText = (text: string): HTMLButtonElement | undefined =>
      (
        Array.from(
          (dialog.element as HTMLElement).querySelectorAll('button'),
        ) as HTMLButtonElement[]
      ).find((button) => button.textContent?.includes(text))
    const getSummaryText = () =>
      getButtonByText('Spacecraft controls settings')?.textContent ?? ''
    const readVisibleText = () => dialog.element.textContent ?? ''

    dialog.open()
    const desktopSummary = getSummaryText()
    getButtonByText('Spacecraft controls settings')?.click()
    const desktopPaneText = readVisibleText()
    const desktopControlSideGroup = dialog.element.querySelector(
      '[aria-label="Control sides"]',
    )
    const desktopManeuverSwitch = getButtonByText('Starts by drag or tap')

    touchControlsVisible = true
    dialog.syncState()
    const mobilePaneText = readVisibleText()
    const mobileControlSideGroup = dialog.element.querySelector(
      '[aria-label="Control sides"]',
    )
    const mobileManeuverSwitch = getButtonByText('Starts by drag or tap')

    targetControlAvailable = false
    warpControlAvailable = false
    dialog.syncState()
    getButtonByText('Back')?.click()
    const partiallyHiddenSummary = getSummaryText()
    getButtonByText('Spacecraft controls settings')?.click()
    const partiallyHiddenPaneText = readVisibleText()

    return {
      desktopControlSideGroupHidden: desktopControlSideGroup === null,
      desktopManeuverSwitchHidden: desktopManeuverSwitch === undefined,
      desktopPaneText,
      desktopSummary,
      events,
      mobileControlSideGroupVisible: mobileControlSideGroup !== null,
      mobileManeuverSwitchVisible: mobileManeuverSwitch !== undefined,
      mobilePaneText,
      partiallyHiddenPaneText,
      partiallyHiddenSummary,
      savedValues: {
        burnSide,
        mobileManeuverStartByDrag,
        targetSide,
        trajectorySide,
        warpSide,
      },
    }
  })

  expect(result.desktopSummary).toContain('Keyboard and mouse active')
  expect(result.desktopSummary).not.toContain('Burn left')
  expect(result.desktopSummary).not.toContain('warp right')
  expect(result.desktopSummary).not.toContain('target right')
  expect(result.desktopSummary).not.toContain('trajectory hidden')
  expect(result.desktopSummary).not.toContain('maneuver drag')
  expect(result.desktopControlSideGroupHidden).toBe(true)
  expect(result.desktopManeuverSwitchHidden).toBe(true)
  expect(result.desktopPaneText).toContain('Keyboard and mouse active')
  expect(result.desktopPaneText).not.toContain('Burn side')
  expect(result.desktopPaneText).not.toContain('Starts by drag or tap')

  expect(result.mobileControlSideGroupVisible).toBe(true)
  expect(result.mobileManeuverSwitchVisible).toBe(true)
  expect(result.mobilePaneText).toContain('Burn side')
  expect(result.mobilePaneText).toContain('Warp side')
  expect(result.mobilePaneText).toContain('Target side')
  expect(result.mobilePaneText).toContain('Trajectory side')
  expect(result.mobilePaneText).toContain('Starts by drag or tap')

  expect(result.partiallyHiddenSummary).toContain('Burn left')
  expect(result.partiallyHiddenSummary).toContain('trajectory hidden')
  expect(result.partiallyHiddenSummary).toContain('maneuver drag')
  expect(result.partiallyHiddenSummary).not.toContain('warp right')
  expect(result.partiallyHiddenSummary).not.toContain('target right')
  expect(result.partiallyHiddenPaneText).toContain('Burn side')
  expect(result.partiallyHiddenPaneText).toContain('Trajectory side')
  expect(result.partiallyHiddenPaneText).not.toContain('Warp side')
  expect(result.partiallyHiddenPaneText).not.toContain('Target side')
  expect(result.events).toEqual([])
  expect(result.savedValues).toEqual({
    burnSide: 'left',
    mobileManeuverStartByDrag: true,
    targetSide: 'right',
    trajectorySide: 'hidden',
    warpSide: 'right',
  })
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
})

test('captures the mobile in-game controls menu open over gameplay HUD', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page.getByRole('button', { name: 'Open in-game controls' }).click()
  await expect(
    page.getByRole('dialog', { name: 'In-game controls' }),
  ).toBeVisible()
  await expect(page.getByText('Prediction horizon')).toBeVisible()

  await attachMobileScreenshot(page, testInfo, 'mobile-in-game-controls-menu')
})

test('captures wide in-game controls keyboard hints', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 720 })
  await startReachMoonMission(page)

  await page.getByRole('button', { name: 'Open in-game controls' }).click()
  await expect(
    page.getByRole('dialog', { name: 'In-game controls' }),
  ).toBeVisible()
  await expect(
    page.getByRole('group', { name: 'Keyboard shortcuts' }),
  ).toBeVisible()
  await expect(page.getByText('Normal burn')).toBeVisible()
  await expect(page.getByText('Turn', { exact: true })).toBeVisible()
  await expect(page.getByText('Time warp')).toBeVisible()
  await expect(page.getByText('Burn latch')).toBeVisible()
  await expect(page.getByText('Horizon', { exact: true })).toBeVisible()

  await attachMobileScreenshot(
    page,
    testInfo,
    'wide-in-game-controls-keyboard-hints',
  )
})

test('captures the mobile UI settings dialog opened from in-game controls', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page.getByRole('button', { name: 'Open in-game controls' }).click()
  await page.getByRole('button', { name: 'UI settings' }).click()
  await expect(page.getByRole('dialog', { name: 'UI settings' })).toBeVisible()
  await expect(page.getByText('Spacecraft controls settings')).toBeVisible()
  await expect(page.getByText('Orbit point display')).toBeVisible()

  await attachMobileScreenshot(page, testInfo, 'mobile-ui-settings-dialog')

  await page
    .getByRole('button', { name: /Spacecraft controls settings/ })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Spacecraft controls settings' }),
  ).toBeVisible()
  await expect(page.getByRole('group', { name: 'Control sides' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Maneuvers' })).toBeVisible()
  await expect(page.getByText('Burn side')).toBeVisible()
  await expect(page.getByText('Trajectory side')).toBeVisible()
  await expect(page.getByText('Starts by drag or tap')).toBeVisible()
  await expect(page.getByText('Starts by drag', { exact: true })).toBeVisible()

  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-spacecraft-controls-settings-dialog',
  )

  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('dialog', { name: 'UI settings' })).toBeVisible()

  await page.getByRole('button', { name: /Orbit point display/ }).click()
  await expect(
    page.getByRole('dialog', { name: 'Orbit point display' }),
  ).toBeVisible()
  await expect(
    page.getByRole('switch', { name: 'Show altitude' }),
  ).toHaveAttribute('aria-checked', 'true')
  await expect(
    page.getByRole('switch', { name: 'Show center distance' }),
  ).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByText('Marker label contents')).toBeVisible()

  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-orbit-point-display-dialog',
  )

  await page.getByRole('switch', { name: 'Show marker labels' }).click()
  await expect(
    page.getByRole('switch', { name: 'Show marker labels' }),
  ).toBeEnabled()
  await expect(
    page.getByRole('switch', { name: 'Show altitude' }),
  ).toBeDisabled()
  await expect(
    page.getByRole('switch', { name: 'Show center distance' }),
  ).toBeDisabled()

  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-orbit-point-display-labels-disabled-dialog',
  )

  await page.getByRole('switch', { name: 'Show marker labels' }).click()
  await page
    .getByRole('switch', { name: 'Show closest/farthest markers' })
    .click()
  await expect(
    page.getByRole('switch', { name: 'Show closest/farthest markers' }),
  ).toBeEnabled()
  await expect(
    page.getByRole('switch', { name: 'Show marker labels' }),
  ).toBeDisabled()
  await expect(
    page.getByRole('switch', { name: 'Show altitude' }),
  ).toBeDisabled()

  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-orbit-point-display-markers-disabled-dialog',
  )
})

test('captures the mobile time warp touch control after reveal', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page
    .getByRole('button', { exact: true, name: 'Reveal time warp control' })
    .click()
  await page.getByRole('button', { name: 'Reveal Time Warp control 2' }).click()
  const timeWarpReveal = page.locator('#touch-time-warp-reveal')
  const timeWarpPrototypeReveal = page.locator(
    '#touch-time-warp-prototype-reveal',
  )
  await expect(timeWarpReveal).toHaveClass(/touch-edge-reveal-control-open/)
  await expect(timeWarpPrototypeReveal).toHaveClass(
    /touch-edge-reveal-control-open/,
  )
  await expect(
    timeWarpReveal.getByLabel('Time warp control', { exact: true }),
  ).toBeVisible()
  const timeWarpPrototypeControl = timeWarpPrototypeReveal.getByLabel(
    'Time Warp control 2',
    { exact: true },
  )
  await expect(timeWarpPrototypeControl).toBeVisible()
  await expect(
    timeWarpReveal.getByLabel('Time Warp control 2', { exact: true }),
  ).toHaveCount(0)
  await expect(timeWarpReveal.locator('.touch-edge-reveal-content')).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, 0, 0)',
  )
  await expect(
    timeWarpPrototypeReveal.locator('.touch-edge-reveal-content'),
  ).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')

  await attachMobileScreenshot(page, testInfo, 'mobile-time-warp-control')

  const prototypeBox = await timeWarpPrototypeControl.boundingBox()
  if (!prototypeBox) {
    throw new Error('Expected Time Warp control 2 bounds')
  }
  await page.mouse.move(
    prototypeBox.x + prototypeBox.width / 2,
    prototypeBox.y + prototypeBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    prototypeBox.x + prototypeBox.width / 2 + 69,
    prototypeBox.y + prototypeBox.height / 2,
    { steps: 3 },
  )
  await expect(timeWarpPrototypeControl).toHaveClass(
    /touch-step-selector-dragging/,
  )
  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-time-warp-control-dragging',
  )
  await page.mouse.up()
  await expect(
    timeWarpPrototypeControl.locator('.touch-step-selector-value-current'),
  ).toHaveText('x30s')
  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-time-warp-control-elevated-spacing',
  )
})

test('captures the mobile trajectory horizon touch control after reveal', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page, 'touchTrajectorySide=right')

  await page
    .getByRole('button', {
      name: 'Reveal trajectory prediction horizon control',
    })
    .click()
  const trajectoryReveal = page.locator('#touch-trajectory-horizon-reveal')
  await expect(trajectoryReveal).toHaveClass(/touch-edge-reveal-control-open/)
  await expect(
    trajectoryReveal.getByLabel('Trajectory prediction horizon control', {
      exact: true,
    }),
  ).toBeVisible()

  await attachMobileScreenshot(
    page,
    testInfo,
    'mobile-trajectory-horizon-control',
  )
})

test('captures the mobile target selector side panel after reveal', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page
    .getByRole('button', { name: /Reveal target body selector/ })
    .click()
  const targetReveal = page.locator('#touch-target-reveal')
  await expect(targetReveal).toHaveClass(/touch-edge-reveal-control-open/)
  await expect(
    targetReveal.getByLabel('Target body selector', { exact: true }),
  ).toBeVisible()

  await attachMobileScreenshot(page, testInfo, 'mobile-target-selector')
})

test('captures the mobile thrust touch control after reveal', async ({
  page,
}, testInfo) => {
  await startReachMoonMission(page)

  await page.getByRole('button', { name: 'Reveal thrust control' }).click()
  const thrustReveal = page.locator('#touch-thrust-reveal')
  await expect(thrustReveal).toHaveClass(/touch-edge-reveal-control-open/)
  await expect(thrustReveal.locator('.touch-thrust-control')).toBeVisible()

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
