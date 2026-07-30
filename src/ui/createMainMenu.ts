import type { DeveloperFeatureFlags } from '../app/developerFeatureFlags'
import {
  type DebugScenarioSnapshotEntry,
  getRecentDebugScenarioSnapshots,
  insertImportedDebugScenarioSnapshot,
  loadRecentDebugScenarioSnapshot,
  parseDebugScenarioSnapshotJson,
  readDebugScenarioSnapshot,
} from '../debugScenarioSnapshot'
import {
  generateReachMoonFallbackPilotName,
  type ReachMoonHighscoreListResponse,
  type ReachMoonHighscorePeriod,
  type ReachMoonHighscoreRecord,
  type ReachMoonHighscoreRollup,
  type ReachMoonHighscoreRollups,
  type ReachMoonHighscoreSubmitResponse,
  reachMoonHighscorePeriods,
  selectReachMoonHighscoreDisplayPeriod,
} from '../scenario/specific-scenarios/reachMoonHighscores'
import {
  MainMenuSurface,
  type MainMenuSurfaceProps,
  type MainMenuView,
  type ReachMoonHighscorePendingRun,
  type ReachMoonHighscoreSubmitStatus,
} from './components/MainMenuSurface'
import { createPreactUiSurface } from './createPreactUiSurface'
import { isLoadGameAvailable, runLoadGameAction } from './loadGameAvailability'

export type MainMenu = {
  element: HTMLElement
  setVisible(visible: boolean): void
  showReachMoonHighscores(pendingRun?: ReachMoonHighscorePendingRun): void
  syncState(): void
}

type MainMenuRenderProps = Omit<MainMenuSurfaceProps, 'rootRef'>
type MainMenuHighscoresBackView = Exclude<MainMenuView, 'reach-moon-highscores'>

const defaultReachMoonHighscorePeriod: ReachMoonHighscorePeriod = 'daily'

const reachMoonHighscoreEndpoint = '/api/reach-moon/highscores'

const getHighscoreErrorMessage = (error: unknown, fallbackMessage: string) =>
  error instanceof Error ? error.message : fallbackMessage

const readHighscoreResponse = async <T>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => null)) as unknown

  if (!response.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      body.error &&
      typeof body.error === 'object' &&
      'message' in body.error &&
      typeof body.error.message === 'string'
        ? body.error.message
        : `Highscore request failed (${response.status}).`

    throw new Error(message)
  }

  return body as T
}

export const createMainMenu = (options: {
  app: HTMLElement
  developerFeatureFlags: DeveloperFeatureFlags
  developerFeatureFlagsMenuEnabled: boolean
  onDeveloperFeatureFlagsApply(flags: DeveloperFeatureFlags): void
  onFreeRoam(): void
  onLoadGame(): void
  onReachMoon(): void
  onTutorial(): void
}): MainMenu => {
  const surface = createPreactUiSurface<MainMenuRenderProps>({
    app: options.app,
    component: MainMenuSurface,
    missingRootError: 'Failed to create main menu',
  })

  let activeView: MainMenuView = 'main'
  let developerFeatureFlags = { ...options.developerFeatureFlags }
  let loadGameAvailable = isLoadGameAvailable()
  let recentSnapshots: DebugScenarioSnapshotEntry[] =
    getRecentDebugScenarioSnapshots()
  let recentSnapshotImportStatus: MainMenuSurfaceProps['recentSnapshotImportStatus'] =
    null
  let selectedRecentSnapshotId = recentSnapshots[0]?.id ?? ''
  let reachMoonHighscorePendingRun: ReachMoonHighscorePendingRun | null = null
  let reachMoonHighscoreActivePeriod: ReachMoonHighscorePeriod =
    defaultReachMoonHighscorePeriod
  let reachMoonHighscoreBackView: MainMenuHighscoresBackView = 'reach-moon'
  let reachMoonHighscoreLoadingFallbackRollup: ReachMoonHighscoreRollup | null =
    null
  let reachMoonHighscoreLoadError: string | null = null
  let reachMoonHighscoreLoadingPeriod: ReachMoonHighscorePeriod | null = null
  let reachMoonHighscoreLoadRequestId = 0
  let reachMoonHighscorePlayerName = ''
  let reachMoonHighscoreRollups: ReachMoonHighscoreRollups = {}
  let reachMoonHighscoreSubmitError: string | null = null
  let reachMoonHighscoreSubmittedRecord: ReachMoonHighscoreRecord | null = null
  let reachMoonHighscoreSubmitRequestId = 0
  let reachMoonHighscoreSubmitStatus: ReachMoonHighscoreSubmitStatus = 'idle'
  let visible = true

  const refreshLoadGameAvailable = () => {
    const nextLoadGameAvailable = isLoadGameAvailable()
    const previousRecentSnapshotIds = recentSnapshots
      .map((snapshot) => snapshot.id)
      .join('\n')
    const previousSelectedRecentSnapshotId = selectedRecentSnapshotId

    recentSnapshots = getRecentDebugScenarioSnapshots()
    if (
      selectedRecentSnapshotId === '' ||
      !recentSnapshots.some(
        (snapshot) => snapshot.id === selectedRecentSnapshotId,
      )
    ) {
      selectedRecentSnapshotId = recentSnapshots[0]?.id ?? ''
    }

    const recentSnapshotIds = recentSnapshots
      .map((snapshot) => snapshot.id)
      .join('\n')
    const stateChanged =
      loadGameAvailable !== nextLoadGameAvailable ||
      previousRecentSnapshotIds !== recentSnapshotIds ||
      previousSelectedRecentSnapshotId !== selectedRecentSnapshotId

    if (!stateChanged) {
      return false
    }

    loadGameAvailable = nextLoadGameAvailable
    return true
  }

  const setActiveView = (view: MainMenuView) => {
    activeView = view
  }

  const mergeReachMoonHighscoreRollups = (
    rollups: ReachMoonHighscoreRollups,
  ) => {
    reachMoonHighscoreRollups = {
      ...reachMoonHighscoreRollups,
    }

    for (const period of reachMoonHighscorePeriods) {
      const rollup = rollups[period]
      if (rollup) {
        reachMoonHighscoreRollups[period] = rollup
      }
    }
  }

  const getReachMoonHighscoreSubmitName = () => {
    const trimmedName = reachMoonHighscorePlayerName.trim()
    if (trimmedName.length > 0) {
      reachMoonHighscorePlayerName = trimmedName
      return trimmedName
    }

    reachMoonHighscorePlayerName = generateReachMoonFallbackPilotName()
    return reachMoonHighscorePlayerName
  }

  const resetReachMoonHighscoreSubmitState = () => {
    reachMoonHighscoreSubmitRequestId += 1
    reachMoonHighscorePlayerName = ''
    reachMoonHighscoreSubmitError = null
    reachMoonHighscoreSubmittedRecord = null
    reachMoonHighscoreSubmitStatus = 'idle'
  }

  const getReachMoonHighscoreRollup = (period: ReachMoonHighscorePeriod) =>
    reachMoonHighscoreRollups[period] ?? null

  const getReachMoonHighscoreVisibleRollup = () =>
    getReachMoonHighscoreRollup(reachMoonHighscoreActivePeriod) ??
    (reachMoonHighscoreLoadingPeriod === reachMoonHighscoreActivePeriod
      ? reachMoonHighscoreLoadingFallbackRollup
      : null)

  const setReachMoonHighscoresView = (backView: MainMenuHighscoresBackView) => {
    reachMoonHighscoreBackView = backView
    setActiveView('reach-moon-highscores')
  }

  const handleReachMoonBack = () => {
    setActiveView(
      activeView === 'reach-moon-highscores'
        ? reachMoonHighscoreBackView
        : 'main',
    )
    renderMenu()
  }

  const renderMenu = () => {
    surface.render({
      activeView,
      developerFeatureFlags,
      developerFeatureFlagsMenuEnabled:
        options.developerFeatureFlagsMenuEnabled,
      loadGameAvailable,
      recentSnapshots,
      recentSnapshotImportStatus,
      reachMoonHighscorePendingRun,
      reachMoonHighscoreState: {
        activePeriod: reachMoonHighscoreActivePeriod,
        loadError: reachMoonHighscoreLoadError,
        loadingFallbackRollup: reachMoonHighscoreLoadingFallbackRollup,
        loadingPeriod: reachMoonHighscoreLoadingPeriod,
        playerName: reachMoonHighscorePlayerName,
        rollups: reachMoonHighscoreRollups,
        submitError: reachMoonHighscoreSubmitError,
        submittedRecord: reachMoonHighscoreSubmittedRecord,
        submitStatus: reachMoonHighscoreSubmitStatus,
      },
      selectedRecentSnapshotId,
      visible,
      onDeveloperFeatureFlagsApply: () =>
        options.onDeveloperFeatureFlagsApply(developerFeatureFlags),
      onDeveloperFeatureFlagsBack: () => {
        developerFeatureFlags = { ...options.developerFeatureFlags }
        setActiveView('main')
        renderMenu()
      },
      onDeveloperFeatureFlagsChange: (nextFlags) => {
        developerFeatureFlags = { ...nextFlags }
        renderMenu()
      },
      onDeveloperFeatureFlagsMenu: () => {
        setActiveView('developer-feature-flags')
        renderMenu()
      },
      onFreeRoam: () => handleActionThatClosesMenu(options.onFreeRoam),
      onLoadGame: () => {
        const didLoad = runLoadGameAction(() =>
          handleActionThatClosesMenu(options.onLoadGame),
        )
        if (!didLoad && refreshLoadGameAvailable()) {
          renderMenu()
        }
      },
      onLoadGameBack: () => {
        if (activeView === 'load-game-snapshot') {
          recentSnapshotImportStatus = null
        }
        setActiveView(
          activeView === 'load-game-snapshot' ? 'load-game' : 'main',
        )
        renderMenu()
      },
      onLoadGameMenu: () => {
        refreshLoadGameAvailable()
        setActiveView('load-game')
        renderMenu()
      },
      onReachMoon: () => handleActionThatClosesMenu(options.onReachMoon),
      onReachMoonBack: handleReachMoonBack,
      onReachMoonHighscorePeriod: (period) => {
        const loadingFallbackRollup = getReachMoonHighscoreVisibleRollup()
        const hasPeriodRollup = Boolean(getReachMoonHighscoreRollup(period))
        reachMoonHighscoreLoadRequestId += 1
        reachMoonHighscoreActivePeriod = period
        reachMoonHighscoreLoadError = null
        reachMoonHighscoreLoadingFallbackRollup = null
        reachMoonHighscoreLoadingPeriod = null
        if (hasPeriodRollup) {
          renderMenu()
        } else {
          loadReachMoonHighscores(period, loadingFallbackRollup)
        }
      },
      onReachMoonHighscorePlayerName: (playerName) => {
        reachMoonHighscorePlayerName = playerName
        renderMenu()
      },
      onReachMoonHighscoreRetry: () => {
        loadReachMoonHighscores(reachMoonHighscoreActivePeriod)
      },
      onReachMoonHighscoreSubmitRetry: () => {
        submitReachMoonHighscore()
      },
      onReachMoonHighscores: () => {
        reachMoonHighscorePendingRun = null
        reachMoonHighscoreLoadingFallbackRollup = null
        resetReachMoonHighscoreSubmitState()
        reachMoonHighscoreActivePeriod = defaultReachMoonHighscorePeriod
        setReachMoonHighscoresView('reach-moon')
        renderMenu()
        loadReachMoonHighscores(reachMoonHighscoreActivePeriod)
      },
      onReachMoonMenu: () => {
        setActiveView('reach-moon')
        renderMenu()
      },
      onTutorial: () => handleActionThatClosesMenu(options.onTutorial),
      onRecentSnapshotChange: (id) => {
        recentSnapshotImportStatus = null
        selectedRecentSnapshotId = id
        renderMenu()
      },
      onRecentSnapshotImport: (file) => {
        void importRecentSnapshot(file)
      },
      onRecentSnapshotLoad: () => {
        if (
          selectedRecentSnapshotId &&
          loadRecentDebugScenarioSnapshot(selectedRecentSnapshotId)
        ) {
          handleActionThatClosesMenu(options.onLoadGame)
          return
        }

        const recentStateChanged = refreshLoadGameAvailable()
        const activeSnapshotAvailable = readDebugScenarioSnapshot() !== null
        if (!activeSnapshotAvailable || recentStateChanged) {
          renderMenu()
        }
      },
      onRecentSnapshotMenu: () => {
        refreshLoadGameAvailable()
        recentSnapshotImportStatus = null
        setActiveView('load-game-snapshot')
        renderMenu()
      },
    })
  }

  const importRecentSnapshot = async (file: File) => {
    recentSnapshotImportStatus = null
    renderMenu()

    let snapshotJson: string
    try {
      snapshotJson = await file.text()
    } catch {
      recentSnapshotImportStatus = {
        message: 'Snapshot file could not be read.',
        tone: 'error',
      }
      renderMenu()
      return
    }

    const parsedSnapshot = parseDebugScenarioSnapshotJson(snapshotJson)
    if (!parsedSnapshot.ok) {
      recentSnapshotImportStatus = {
        message: parsedSnapshot.message,
        tone: 'error',
      }
      renderMenu()
      return
    }

    const importedEntry = insertImportedDebugScenarioSnapshot(
      parsedSnapshot.snapshot,
    )
    if (!importedEntry) {
      recentSnapshotImportStatus = {
        message:
          'Snapshot is valid, but it could not be added to recent games.',
        tone: 'error',
      }
      renderMenu()
      return
    }

    recentSnapshots = getRecentDebugScenarioSnapshots()
    selectedRecentSnapshotId = importedEntry.id
    recentSnapshotImportStatus = {
      message: 'Snapshot imported. Select Load to start.',
      tone: 'success',
    }
    setActiveView('load-game-snapshot')
    renderMenu()
  }

  const loadReachMoonHighscores = (
    period: ReachMoonHighscorePeriod,
    loadingFallbackRollup: ReachMoonHighscoreRollup | null = getReachMoonHighscoreRollup(
      period,
    ),
  ) => {
    reachMoonHighscoreLoadRequestId += 1
    const requestId = reachMoonHighscoreLoadRequestId
    reachMoonHighscoreLoadingFallbackRollup = loadingFallbackRollup
    reachMoonHighscoreLoadingPeriod = period
    reachMoonHighscoreLoadError = null
    renderMenu()

    void fetch(reachMoonHighscoreEndpoint)
      .then((response) =>
        readHighscoreResponse<ReachMoonHighscoreListResponse>(response),
      )
      .then((response) => {
        if (requestId !== reachMoonHighscoreLoadRequestId) {
          return
        }

        mergeReachMoonHighscoreRollups(response.rollups)
        reachMoonHighscoreActivePeriod = selectReachMoonHighscoreDisplayPeriod(
          reachMoonHighscoreRollups,
          period,
        )
        reachMoonHighscoreLoadError = null
      })
      .catch((error: unknown) => {
        if (requestId !== reachMoonHighscoreLoadRequestId) {
          return
        }

        reachMoonHighscoreLoadError = getHighscoreErrorMessage(
          error,
          'Leaderboard request failed.',
        )
      })
      .finally(() => {
        if (requestId !== reachMoonHighscoreLoadRequestId) {
          return
        }

        reachMoonHighscoreLoadingFallbackRollup = null
        reachMoonHighscoreLoadingPeriod = null
        renderMenu()
      })
  }

  const submitReachMoonHighscore = () => {
    const pendingRun = reachMoonHighscorePendingRun
    const runReceipt = pendingRun?.runReceipt
    reachMoonHighscoreSubmitRequestId += 1
    const requestId = reachMoonHighscoreSubmitRequestId

    if (!pendingRun) {
      return
    }

    if (!runReceipt) {
      reachMoonHighscoreSubmitStatus = 'error'
      reachMoonHighscoreSubmitError =
        pendingRun.runReceiptError ?? 'Run receipt was not prepared.'
      reachMoonHighscoreSubmittedRecord = null
      renderMenu()
      return
    }

    const playerName = getReachMoonHighscoreSubmitName()
    reachMoonHighscoreSubmitStatus = 'submitting'
    reachMoonHighscoreSubmitError = null
    reachMoonHighscoreSubmittedRecord = null
    renderMenu()

    void fetch(reachMoonHighscoreEndpoint, {
      body: JSON.stringify({
        ...pendingRun.input,
        playerName,
        runReceipt,
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    })
      .then((response) =>
        readHighscoreResponse<ReachMoonHighscoreSubmitResponse>(response),
      )
      .then((response) => {
        if (requestId !== reachMoonHighscoreSubmitRequestId) {
          return
        }

        if (
          reachMoonHighscoreLoadingPeriod === reachMoonHighscoreActivePeriod &&
          response.rollups[reachMoonHighscoreActivePeriod]
        ) {
          reachMoonHighscoreLoadRequestId += 1
          reachMoonHighscoreLoadingFallbackRollup = null
          reachMoonHighscoreLoadingPeriod = null
        }
        mergeReachMoonHighscoreRollups(response.rollups)
        reachMoonHighscoreSubmittedRecord = response.record
        reachMoonHighscoreSubmitError = null
        reachMoonHighscoreSubmitStatus = 'success'
      })
      .catch((error: unknown) => {
        if (requestId !== reachMoonHighscoreSubmitRequestId) {
          return
        }

        reachMoonHighscoreSubmitError = getHighscoreErrorMessage(
          error,
          'Highscore submission failed.',
        )
        reachMoonHighscoreSubmittedRecord = null
        reachMoonHighscoreSubmitStatus = 'error'
      })
      .finally(() => {
        if (requestId !== reachMoonHighscoreSubmitRequestId) {
          return
        }

        renderMenu()
      })
  }

  const setVisible = (nextVisible: boolean) => {
    visible = nextVisible
    if (nextVisible) {
      recentSnapshotImportStatus = null
      setActiveView('main')
    }
    renderMenu()
  }

  const handleActionThatClosesMenu = (action: () => void) => {
    setVisible(false)
    action()
  }

  renderMenu()
  const element = surface.element

  return {
    element,
    setVisible,
    showReachMoonHighscores: (pendingRun) => {
      visible = true
      reachMoonHighscorePendingRun = pendingRun ?? null
      reachMoonHighscoreBackView = 'reach-moon'
      reachMoonHighscoreLoadingFallbackRollup = null
      resetReachMoonHighscoreSubmitState()
      reachMoonHighscoreActivePeriod = defaultReachMoonHighscorePeriod
      if (pendingRun) {
        reachMoonHighscorePlayerName = generateReachMoonFallbackPilotName()
      }
      setReachMoonHighscoresView('reach-moon')
      renderMenu()
      loadReachMoonHighscores(reachMoonHighscoreActivePeriod)
      if (pendingRun) {
        submitReachMoonHighscore()
      }
    },
    syncState: () => {
      if (refreshLoadGameAvailable()) {
        renderMenu()
      }
    },
  }
}
