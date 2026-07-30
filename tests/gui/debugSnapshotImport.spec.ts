import { expect, type Page, type TestInfo, test } from '@playwright/test'
import type {
  DebugScenarioSnapshot,
  DebugScenarioSnapshotEntry,
} from '../../src/debugScenarioSnapshot'

declare const Buffer: {
  from(value: string): never
}

const activeSnapshotStorageKey = 'space-web-game.debugScenarioSnapshot.v1'
const recentSnapshotsStorageKey =
  'space-web-game.recentDebugScenarioSnapshots.v1'

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
  .offscreen-indicator,
  .spacecraft-callout {
    visibility: hidden !important;
  }
`

const createSnapshot = (
  elapsed: number,
  savedAt: string,
  overrides: Partial<DebugScenarioSnapshot> = {},
): DebugScenarioSnapshot => ({
  version: 3,
  savedAt,
  elapsed,
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
  ...overrides,
})

const createRecentEntries = (count: number): DebugScenarioSnapshotEntry[] =>
  Array.from({ length: count }, (_, index) => {
    const savedAt = new Date(
      Date.UTC(2026, 6, 29, 12, 0, count - index),
    ).toISOString()
    return {
      id: `recent-${count - index}`,
      name: `Recent ${count - index}`,
      savedAt,
      snapshot: createSnapshot(count - index, savedAt),
    }
  })

const openSnapshotImportMenu = async (
  page: Page,
  options: {
    activeSnapshot?: DebugScenarioSnapshot
    recentEntries?: DebugScenarioSnapshotEntry[]
  } = {},
) => {
  const seed = {
    activeSnapshotJson: options.activeSnapshot
      ? JSON.stringify(options.activeSnapshot)
      : null,
    recentEntriesJson: options.recentEntries
      ? JSON.stringify(options.recentEntries)
      : null,
  }
  await page.addInitScript(({ activeSnapshotJson, recentEntriesJson }) => {
    localStorage.clear()
    if (activeSnapshotJson) {
      localStorage.setItem(
        'space-web-game.debugScenarioSnapshot.v1',
        activeSnapshotJson,
      )
    }
    if (recentEntriesJson) {
      localStorage.setItem(
        'space-web-game.recentDebugScenarioSnapshots.v1',
        recentEntriesJson,
      )
    }
  }, seed)

  await page.goto('/')
  await page.addStyleTag({ content: screenshotCss })
  await expect(page.locator('[data-boot-screen]')).toBeHidden()
  await page.getByRole('button', { name: 'Load Game' }).click()
  await page.getByRole('button', { name: 'Load any game' }).click()
  await expect(
    page.locator('[data-main-menu-view="load-game-snapshot"]'),
  ).toBeVisible()
}

const attachScreenshot = async (
  page: Page,
  testInfo: TestInfo,
  name: string,
) => {
  const path = testInfo.outputPath(`${name}.png`)
  const screenshot = await page.screenshot({
    animations: 'disabled',
    fullPage: false,
    path,
  })

  await testInfo.attach(name, {
    contentType: 'image/png',
    path,
  })
  expect(screenshot.byteLength).toBeGreaterThan(5_000)
}

const setSnapshotFile = async (
  page: Page,
  contents: string,
  name = 'debug-snapshot.json',
) => {
  await page.getByLabel('Snapshot JSON file').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(contents),
  })
}

test('imports a supported legacy-shaped v3 snapshot newest-first and loads it only after Load', async ({
  page,
}, testInfo) => {
  const activeSnapshot = createSnapshot(1, '2026-07-29T10:00:00.000Z')
  const recentEntries = createRecentEntries(10)
  const importedSnapshot = createSnapshot(42, '2026-07-30T08:15:00.000Z', {
    cameraPanOffset: { x: 12, y: -24 },
    cameraView: 'locked',
  })
  const importedId = `debug-snapshot-${importedSnapshot.savedAt}`

  await openSnapshotImportMenu(page, { activeSnapshot, recentEntries })

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Import' }).click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({
    name: 'legacy-v3-snapshot.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(importedSnapshot)),
  })

  await expect(page.getByRole('status')).toHaveText(
    'Snapshot imported. Select Load to start.',
  )
  await expect(page.locator('#main-menu-recent-snapshot')).toHaveValue(
    importedId,
  )
  await expect(
    page
      .getByLabel('Selected snapshot details')
      .getByText('Imported', { exact: true }),
  ).toBeVisible()

  const stateAfterImport = await page.evaluate(
    ({ activeKey, recentKey }) => ({
      active: JSON.parse(localStorage.getItem(activeKey) ?? 'null'),
      recent: JSON.parse(localStorage.getItem(recentKey) ?? '[]'),
    }),
    {
      activeKey: activeSnapshotStorageKey,
      recentKey: recentSnapshotsStorageKey,
    },
  )
  const importedEntry = stateAfterImport.recent[0] as
    | DebugScenarioSnapshotEntry
    | undefined

  expect(stateAfterImport.active).toEqual(activeSnapshot)
  expect(stateAfterImport.recent).toHaveLength(10)
  expect(
    stateAfterImport.recent.map(
      (entry: DebugScenarioSnapshotEntry) => entry.id,
    ),
  ).toEqual([importedId, ...recentEntries.slice(0, 9).map((entry) => entry.id)])
  expect(importedEntry).toMatchObject({
    id: importedId,
    snapshot: importedSnapshot,
  })
  expect(Date.parse(importedEntry?.importedAt ?? '')).not.toBeNaN()

  await attachScreenshot(page, testInfo, 'mobile-debug-snapshot-import-success')

  await page.getByRole('button', { name: 'Load', exact: true }).click()
  await expect(page.locator('.main-menu')).toBeHidden()
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const value = localStorage.getItem(key)
        return value ? JSON.parse(value).elapsed : null
      }, activeSnapshotStorageKey),
    )
    .toBe(importedSnapshot.elapsed)
})

test('shows parser and read errors without mutating recents, active state, or selection', async ({
  page,
}) => {
  const activeSnapshot = createSnapshot(7, '2026-07-29T09:00:00.000Z')
  const recentEntries = createRecentEntries(2)

  await openSnapshotImportMenu(page, { activeSnapshot, recentEntries })

  const unchangedState = async () =>
    page.evaluate(
      ({ activeKey, recentKey }) => ({
        active: localStorage.getItem(activeKey),
        recent: localStorage.getItem(recentKey),
        selected: (
          document.querySelector(
            '#main-menu-recent-snapshot',
          ) as HTMLSelectElement | null
        )?.value,
      }),
      {
        activeKey: activeSnapshotStorageKey,
        recentKey: recentSnapshotsStorageKey,
      },
    )
  const before = await unchangedState()

  await setSnapshotFile(page, '{ nope')
  await expect(page.getByRole('alert')).toHaveText(
    'Snapshot file is not valid JSON.',
  )
  expect(await unchangedState()).toEqual(before)

  await setSnapshotFile(
    page,
    JSON.stringify({ ...activeSnapshot, version: 2 }),
    'unsupported.json',
  )
  await expect(page.getByRole('alert')).toHaveText(
    'Debug snapshot version 2 is not supported.',
  )
  expect(await unchangedState()).toEqual(before)

  await setSnapshotFile(
    page,
    JSON.stringify({ ...activeSnapshot, spacecraft: null }),
    'malformed.json',
  )
  await expect(page.getByRole('alert')).toHaveText(
    'Snapshot data must include a valid spacecraft.',
  )
  expect(await unchangedState()).toEqual(before)

  await page.evaluate(() => {
    File.prototype.text = () =>
      Promise.reject(new DOMException('Read failed', 'NotReadableError'))
  })
  await setSnapshotFile(page, JSON.stringify(activeSnapshot), 'unreadable.json')
  await expect(page.getByRole('alert')).toHaveText(
    'Snapshot file could not be read.',
  )
  expect(await unchangedState()).toEqual(before)
})

test('keeps Back navigation while a valid import finishes asynchronously', async ({
  page,
}, testInfo) => {
  const importedSnapshot = createSnapshot(84, '2026-07-30T09:15:00.000Z')
  const importedId = `debug-snapshot-${importedSnapshot.savedAt}`

  await openSnapshotImportMenu(page)
  await page.evaluate(() => {
    let resolveSnapshotText: ((value: string) => void) | undefined
    const snapshotTextPromise = new Promise<string>((resolve) => {
      resolveSnapshotText = resolve
    })

    File.prototype.text = () => snapshotTextPromise
    Object.assign(window, {
      resolveSnapshotImportText: (value: string) => {
        resolveSnapshotText?.(value)
      },
    })
  })

  await setSnapshotFile(
    page,
    JSON.stringify(importedSnapshot),
    'delayed-snapshot.json',
  )
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.locator('[data-main-menu-view="load-game"]')).toBeVisible()

  await page.evaluate((snapshotJson) => {
    const resolveSnapshotImportText = Reflect.get(
      window,
      'resolveSnapshotImportText',
    )
    if (typeof resolveSnapshotImportText !== 'function') {
      throw new Error('Snapshot import resolver is unavailable')
    }

    resolveSnapshotImportText(snapshotJson)
  }, JSON.stringify(importedSnapshot))

  await expect
    .poll(() =>
      page.evaluate((recentKey) => {
        const recent = JSON.parse(localStorage.getItem(recentKey) ?? '[]') as
          | DebugScenarioSnapshotEntry[]
          | undefined
        return recent?.[0]?.id ?? null
      }, recentSnapshotsStorageKey),
    )
    .toBe(importedId)
  await expect(page.locator('[data-main-menu-view="load-game"]')).toBeVisible()
  await expect(
    page.locator('[data-main-menu-view="load-game-snapshot"]'),
  ).toBeHidden()

  await attachScreenshot(
    page,
    testInfo,
    'mobile-debug-snapshot-import-back-race',
  )

  await page.getByRole('button', { name: 'Load any game' }).click()
  await expect(page.locator('#main-menu-recent-snapshot')).toHaveValue(
    importedId,
  )
})

test('keeps Import available with no recents and fits the imported state on desktop', async ({
  baseURL,
  browser,
}, testInfo) => {
  if (!baseURL) {
    throw new Error('Playwright base URL is not configured')
  }

  const context = await browser.newContext({
    baseURL,
    colorScheme: 'dark',
    hasTouch: false,
    isMobile: false,
    reducedMotion: 'reduce',
    viewport: { width: 1024, height: 720 },
  })
  const page = await context.newPage()

  try {
    await openSnapshotImportMenu(page)

    await expect(page.getByRole('button', { name: 'Import' })).toBeEnabled()
    await expect(
      page.getByRole('button', { name: 'Load', exact: true }),
    ).toBeDisabled()
    await expect(page.getByLabel('Snapshot JSON file')).toHaveAttribute(
      'type',
      'file',
    )

    const importedSnapshot = createSnapshot(99, '2026-07-30T08:30:00.000Z')
    await setSnapshotFile(page, JSON.stringify(importedSnapshot))

    await expect(page.getByRole('status')).toHaveText(
      'Snapshot imported. Select Load to start.',
    )
    await expect(
      page.getByRole('button', { name: 'Load', exact: true }),
    ).toBeEnabled()

    const panel = page.locator('[data-main-menu-view="load-game-snapshot"]')
    const panelBounds = await panel.boundingBox()
    expect(panelBounds).not.toBeNull()
    expect(panelBounds?.y ?? -1).toBeGreaterThanOrEqual(0)
    expect(
      (panelBounds?.y ?? 0) + (panelBounds?.height ?? Number.POSITIVE_INFINITY),
    ).toBeLessThanOrEqual(720)

    await attachScreenshot(
      page,
      testInfo,
      'desktop-debug-snapshot-import-success',
    )
  } finally {
    await context.close()
  }
})
