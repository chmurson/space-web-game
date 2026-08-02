import clsx from 'clsx'
import type { ComponentChildren } from 'preact'
import { useRef } from 'preact/hooks'
import type { DeveloperFeatureFlags } from '../../app/developerFeatureFlags'
import type { DebugScenarioSnapshotEntry } from '../../debugScenarioSnapshot'
import {
  type RankedReachMoonHighscoreRecord,
  REACH_MOON_HIGHSCORE_PLAYER_NAME_MAX_LENGTH,
  type ReachMoonHighscorePeriod,
  type ReachMoonHighscoreRecord,
  type ReachMoonHighscoreRollup,
  type ReachMoonHighscoreRollups,
} from '../../scenario/specific-scenarios/reachMoonHighscores'
import type { ReachMoonCompletedHighscorePayload } from '../../scenario/specific-scenarios/reachMoonScenario'
import {
  formatReachMoonFuelLeftPercent,
  formatReachMoonOrbitQualityContext,
  formatReachMoonScoreSummaryDisplay,
  getReachMoonFuelRemainingRatio,
  type ReachMoonScoreSummary,
} from '../../scenario/specific-scenarios/reachMoonScore'
import type { ReachMoonRunReceipt } from '../../server/reachMoonRunReceipts'
import { formatCompactElapsed } from '../formatters'
import {
  MenuActionButton,
  MenuActions,
  MenuCopy,
  MenuDescription,
  MenuKicker,
  MenuPanel,
} from './MenuSurfacePrimitives'
import {
  formatRecentSnapshotSavedAt,
  getRecentSnapshotDetails,
} from './recentSnapshotFormatting'

export type MainMenuView =
  | 'main'
  | 'developer-feature-flags'
  | 'load-game'
  | 'load-game-snapshot'
  | 'reach-moon'
  | 'reach-moon-highscores'

const mainMenuActionAttribute = 'data-main-menu-action'
const mainMenuViewAttribute = 'data-main-menu-view'

const reachMoonHighscorePeriodOptions: Array<{
  label: string
  period: ReachMoonHighscorePeriod
}> = [
  { label: 'Today', period: 'daily' },
  { label: 'Weekly', period: 'weekly' },
  { label: 'All-time', period: 'all-time' },
]

const reachMoonHighscoreSkeletonRows = [0, 1, 2]
const reachMoonHighscoreVisibleRowCount = 10

const reachMoonHighscoreSkeletonCells = [
  { className: 'reach-moon-highscore-cell-rank', key: 'rank' },
  { className: 'reach-moon-highscore-cell-name', key: 'name' },
  { className: 'reach-moon-highscore-cell-score', key: 'score' },
  { className: 'reach-moon-highscore-cell-elapsed', key: 'elapsed' },
  { className: 'reach-moon-highscore-cell-fuel', key: 'fuel' },
  { className: 'reach-moon-highscore-cell-orbit', key: 'orbit' },
  { className: 'reach-moon-highscore-cell-submitted', key: 'submitted' },
] as const

export type ReachMoonHighscorePendingRun =
  ReachMoonCompletedHighscorePayload & {
    runReceipt: ReachMoonRunReceipt | null
    runReceiptError: string | null
  }

export type ReachMoonHighscoreSubmitStatus =
  | 'error'
  | 'idle'
  | 'submitting'
  | 'success'

export type ReachMoonHighscoreMenuState = {
  activePeriod: ReachMoonHighscorePeriod
  loadError: string | null
  loadingFallbackRollup: ReachMoonHighscoreRollup | null
  loadingPeriod: ReachMoonHighscorePeriod | null
  playerName: string
  rollups: ReachMoonHighscoreRollups
  submitError: string | null
  submittedRecord: ReachMoonHighscoreRecord | null
  submitStatus: ReachMoonHighscoreSubmitStatus
}

type RecentSnapshotImportStatus = {
  message: string
  tone: 'error' | 'success'
}

export type MainMenuSurfaceProps = {
  activeView: MainMenuView
  developerFeatureFlags: DeveloperFeatureFlags
  developerFeatureFlagsMenuEnabled: boolean
  loadGameAvailable: boolean
  recentSnapshots: DebugScenarioSnapshotEntry[]
  recentSnapshotExportStatus: {
    kind: 'error' | 'success'
    message: string
  } | null
  recentSnapshotImportStatus: RecentSnapshotImportStatus | null
  reachMoonHighscorePendingRun: ReachMoonHighscorePendingRun | null
  reachMoonHighscoreState: ReachMoonHighscoreMenuState
  selectedRecentSnapshotId: string
  rootRef(element: HTMLElement | null): void
  visible: boolean
  onDeveloperFeatureFlagsApply(): void
  onDeveloperFeatureFlagsBack(): void
  onDeveloperFeatureFlagsChange(flags: DeveloperFeatureFlags): void
  onDeveloperFeatureFlagsMenu(): void
  onFreeRoam(): void
  onLoadGame(): void
  onLoadGameBack(): void
  onLoadGameMenu(): void
  onReachMoon(): void
  onReachMoonBack(): void
  onReachMoonHighscorePeriod(period: ReachMoonHighscorePeriod): void
  onReachMoonHighscorePlayerName(playerName: string): void
  onReachMoonHighscoreRetry(): void
  onReachMoonHighscoreSubmitRetry(): void
  onReachMoonHighscores(): void
  onReachMoonMenu(): void
  onTutorial(): void
  onRecentSnapshotChange(id: string): void
  onRecentSnapshotExport(): void
  onRecentSnapshotImport(file: File): void
  onRecentSnapshotLoad(): void
  onRecentSnapshotMenu(): void
}

const formatInteger = (value: number) =>
  Math.round(value).toLocaleString('en-US')

const formatSubmittedAt = (value: string) => {
  const date = new Date(value)
  if (!Number.isFinite(date.valueOf())) {
    return 'Unknown'
  }

  return date.toLocaleString('en-US', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const getPeriodLabel = (period: ReachMoonHighscorePeriod) =>
  reachMoonHighscorePeriodOptions.find((option) => option.period === period)
    ?.label ?? 'Today'

const getSubmittedRank = (state: ReachMoonHighscoreMenuState) => {
  if (!state.submittedRecord) {
    return null
  }

  return (
    state.rollups[state.activePeriod]?.entries.find(
      (candidate) => candidate.id === state.submittedRecord?.id,
    )?.rank ?? null
  )
}

const ReachMoonHighscoreTimeIcon = () => (
  <svg class="telemetry-time-icon" viewBox="0 0 16 16" aria-hidden="true">
    <circle class="telemetry-time-icon-face" cx="8" cy="8" r="6.25" />
    <line
      class="telemetry-time-icon-hand telemetry-time-icon-hand-minute"
      x1="8"
      y1="8"
      x2="8"
      y2="3.5"
    />
    <circle class="telemetry-time-icon-center" cx="8" cy="8" r="0.9" />
  </svg>
)

const getReachMoonHighscoreFuelIconLevel = (
  score: Pick<ReachMoonScoreSummary, 'fuelRemainingKg'>,
) => {
  const maxHeight = 8.6
  const levelHeight = maxHeight * getReachMoonFuelRemainingRatio(score)

  return {
    height: levelHeight.toFixed(2),
    y: (3.95 + maxHeight - levelHeight).toFixed(2),
  }
}

const ReachMoonHighscoreFuelIcon = ({
  score,
}: {
  score: Pick<ReachMoonScoreSummary, 'fuelRemainingKg'>
}) => {
  const level = getReachMoonHighscoreFuelIconLevel(score)

  return (
    <svg class="telemetry-fuel-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        class="telemetry-fuel-icon-tank"
        d="M5.1 2.2h5.8l1.25 1.7v8.4c0 .85-.55 1.5-1.42 1.5H5.27c-.87 0-1.42-.65-1.42-1.5V3.9Z"
      />
      <path class="telemetry-fuel-icon-cap" d="M5.6 2.2V1.3h4.8v.9" />
      <rect
        class="telemetry-fuel-icon-level telemetry-fuel-icon-live-level"
        x="5.65"
        y={level.y}
        width="4.7"
        height={level.height}
        rx="0.35"
      />
    </svg>
  )
}

const ReachMoonHighscoreOrbitIcon = () => (
  <svg class="telemetry-orbit-icon" viewBox="0 0 16 16" aria-hidden="true">
    <circle class="telemetry-orbit-icon-moon" cx="8" cy="8" r="2" />
    <ellipse class="telemetry-orbit-icon-path" cx="8" cy="8" rx="6" ry="3.6" />
  </svg>
)

const ReachMoonHighscoreMetric = (
  props:
    | {
        icon: 'fuel'
        score: Pick<ReachMoonScoreSummary, 'fuelRemainingKg'>
        value: string
      }
    | {
        icon: 'orbit' | 'time'
        value: string
      },
) => {
  const icon =
    props.icon === 'fuel' ? (
      <ReachMoonHighscoreFuelIcon score={props.score} />
    ) : props.icon === 'orbit' ? (
      <ReachMoonHighscoreOrbitIcon />
    ) : (
      <ReachMoonHighscoreTimeIcon />
    )

  return (
    <span class="reach-moon-highscore-metric">
      {icon}
      <span aria-hidden="true">{props.value}</span>
    </span>
  )
}

const ReachMoonHighscoreScoreSummary = ({
  score,
}: {
  score: ReachMoonScoreSummary
}) => {
  const display = formatReachMoonScoreSummaryDisplay(score)

  return (
    <strong class="reach-moon-highscore-score-summary">
      <span>Score {display.totalScore}.</span>
      <span class="reach-moon-highscore-score-summary-line">
        <ReachMoonHighscoreTimeIcon />
        <span>
          Time used {display.missionElapsed} (+{display.timeScorePoints}).
        </span>
      </span>
      <span class="reach-moon-highscore-score-summary-line">
        <ReachMoonHighscoreFuelIcon score={score} />
        <span>
          Fuel left {display.fuelLeft} (+{display.fuelBonusPoints}).
        </span>
      </span>
      <span class="reach-moon-highscore-score-summary-line">
        <ReachMoonHighscoreOrbitIcon />
        <span>
          Orbit quality {display.lunarOrbitQualityAltitude} (
          {display.lunarOrbitQualityPoints}).
        </span>
      </span>
    </strong>
  )
}

const ReachMoonHighscoreSubmitPanel = ({
  pendingRun,
  state,
  onPlayerName,
  onSubmitRetry,
}: {
  pendingRun: ReachMoonHighscorePendingRun | null
  state: ReachMoonHighscoreMenuState
  onPlayerName(playerName: string): void
  onSubmitRetry(): void
}) => {
  if (!pendingRun) {
    return null
  }

  const canRetry = pendingRun.runReceipt && state.submitStatus === 'error'
  const inputDisabled =
    !pendingRun.runReceipt ||
    state.submitStatus === 'submitting' ||
    state.submitStatus === 'success'
  const submittedRank = getSubmittedRank(state)
  const statusText =
    state.submitStatus === 'submitting'
      ? `Submitting as ${state.playerName}...`
      : state.submitStatus === 'success'
        ? `Submitted as ${state.submittedRecord?.playerName ?? state.playerName}${submittedRank ? ` at #${submittedRank}` : ''}.`
        : state.submitStatus === 'error'
          ? `Submission failed: ${state.submitError ?? 'Highscore submission failed.'}`
          : 'Ready to submit.'

  return (
    <section class="reach-moon-highscore-submit" aria-live="polite">
      <div class="reach-moon-highscore-submit-copy">
        <span class="reach-moon-highscore-section-label">Completed run</span>
        <ReachMoonHighscoreScoreSummary score={pendingRun.score} />
      </div>
      <label class="reach-moon-highscore-name-field">
        <span>Pilot name</span>
        <input
          aria-label="Pilot name"
          disabled={inputDisabled}
          maxLength={REACH_MOON_HIGHSCORE_PLAYER_NAME_MAX_LENGTH}
          type="text"
          value={state.playerName}
          onInput={(event) =>
            onPlayerName((event.currentTarget as HTMLInputElement).value)
          }
        />
      </label>
      <div
        class={`reach-moon-highscore-status reach-moon-highscore-status-${state.submitStatus}`}
      >
        {statusText}
      </div>
      {canRetry ? (
        <button
          class="reach-moon-highscore-inline-action"
          type="button"
          onClick={onSubmitRetry}
        >
          Retry submit
        </button>
      ) : null}
    </section>
  )
}

const ReachMoonHighscoreHeaderRow = () => (
  <tr class="reach-moon-highscore-row reach-moon-highscore-row-header">
    <th scope="col">Rank</th>
    <th scope="col">Name</th>
    <th scope="col">Score</th>
    <th scope="col">Time</th>
    <th scope="col">Fuel left</th>
    <th scope="col">Orbit</th>
    <th scope="col">Submitted</th>
  </tr>
)

const ReachMoonHighscoreSkeletonRow = () => (
  <tr class="reach-moon-highscore-row reach-moon-highscore-row-skeleton">
    {reachMoonHighscoreSkeletonCells.map(({ className, key }) => (
      <td class={className} key={key}>
        <span
          class={`reach-moon-highscore-skeleton reach-moon-highscore-skeleton-${key}`}
        />
      </td>
    ))}
  </tr>
)

const ReachMoonHighscoreRow = ({
  entry,
  loading,
  hide,
}: {
  entry: RankedReachMoonHighscoreRecord
  loading: boolean
  hide?: boolean
}) => {
  const elapsed = formatCompactElapsed(entry.score.missionElapsedSeconds)
  const fuelLeft = formatReachMoonFuelLeftPercent(entry.score)
  const orbitQuality = formatReachMoonOrbitQualityContext(
    entry.score.lunarOrbitQuality,
    entry.score,
  )

  return (
    <tr
      class={clsx(
        'reach-moon-highscore-row',
        loading && 'reach-moon-highscore-row-loading',
        hide && 'reach-moon-highscore-row-spacer',
      )}
    >
      <td class="reach-moon-highscore-cell-rank">#{entry.rank}</td>
      <td class="reach-moon-highscore-cell-name" title={entry.playerName}>
        {entry.playerName}
      </td>
      <td class="reach-moon-highscore-cell-score">
        {formatInteger(entry.score.totalScore)}
      </td>
      <td
        class="reach-moon-highscore-cell-elapsed"
        aria-label={`Time ${elapsed}`}
      >
        <ReachMoonHighscoreMetric icon="time" value={elapsed} />
      </td>
      <td
        class="reach-moon-highscore-cell-fuel"
        aria-label={`Fuel left ${fuelLeft}`}
      >
        <ReachMoonHighscoreMetric
          icon="fuel"
          score={entry.score}
          value={fuelLeft}
        />
      </td>
      <td
        class="reach-moon-highscore-cell-orbit"
        aria-label={`Orbit quality ${orbitQuality}`}
      >
        <ReachMoonHighscoreMetric icon="orbit" value={orbitQuality} />
      </td>
      <td class="reach-moon-highscore-cell-submitted">
        {formatSubmittedAt(entry.submittedAt)}
      </td>
    </tr>
  )
}

const reachMoonHighscoreFillerEntry: RankedReachMoonHighscoreRecord = {
  id: '',
  rank: 0,
  playerName: '',
  score: {
    totalScore: 0,
    missionElapsedSeconds: 0,
    fuelRemainingKg: 0,
    baseScorePoints: 0,
    fuelBonusPoints: 0,
    timePenaltyPoints: 0,
    lunarOrbitQuality: {
      orbitApoapsisAltitudeMeters: 0,
      orbitPeriapsisAltitudeMeters: 0,
    },
  },
  submittedAt: '',
}

const ReachMoonHighscoreFillerRows = ({ count }: { count: number }) => (
  <>
    {Array.from({ length: Math.max(0, count) }).map((_, index) => (
      <ReachMoonHighscoreRow
        key={index}
        loading={false}
        hide
        entry={reachMoonHighscoreFillerEntry}
      />
    ))}
  </>
)

const ReachMoonHighscoreEmptyRow = ({
  children,
}: {
  children: ComponentChildren
}) => (
  <tr class="reach-moon-highscore-row reach-moon-highscore-row-empty">
    <td colSpan={7}>
      <div class="reach-moon-highscore-state" aria-live="polite">
        {children}
      </div>
    </td>
  </tr>
)

const ReachMoonHighscoreBoard = ({
  activePeriod,
  loadError,
  loading,
  loadingFallbackRollup,
  rollup,
  showGlobalEmptyState,
  onRetry,
}: {
  activePeriod: ReachMoonHighscorePeriod
  loadError: string | null
  loading: boolean
  loadingFallbackRollup: ReachMoonHighscoreRollup | null
  rollup: ReachMoonHighscoreRollup | undefined
  showGlobalEmptyState: boolean
  onRetry(): void
}) => {
  const displayedRollup =
    rollup ?? (loading ? loadingFallbackRollup : undefined)
  const entries = displayedRollup?.entries ?? []
  const periodLabel = getPeriodLabel(activePeriod)
  const renderLoadErrorState = () => (
    <div class="reach-moon-highscore-empty-container">
      <div class="reach-moon-highscore-state" aria-live="polite">
        <strong>Leaderboard unavailable.</strong>
        <span>{loadError}</span>
        <button
          class="reach-moon-highscore-inline-action"
          type="button"
          onClick={onRetry}
        >
          Retry
        </button>
      </div>
    </div>
  )

  if (loadError && (!displayedRollup || entries.length === 0)) {
    return renderLoadErrorState()
  }

  if (loading && !displayedRollup) {
    return (
      <table
        aria-busy="true"
        aria-label={`${periodLabel} Reach the Moon leaderboard`}
        class="reach-moon-highscore-board reach-moon-highscore-board-skeleton"
      >
        <caption class="reach-moon-highscore-refreshing" aria-live="polite">
          Loading {periodLabel.toLowerCase()} leaderboard...
        </caption>
        <thead>
          <ReachMoonHighscoreHeaderRow />
        </thead>
        <tbody>
          {reachMoonHighscoreSkeletonRows.map((row) => (
            <ReachMoonHighscoreSkeletonRow key={row} />
          ))}
        </tbody>
      </table>
    )
  }

  if (entries.length === 0) {
    return (
      <table
        aria-busy="false"
        aria-label={`${periodLabel} Reach the Moon leaderboard`}
        class="reach-moon-highscore-board"
      >
        <caption class="reach-moon-highscore-refreshing" aria-live="polite" />
        <thead>
          <ReachMoonHighscoreHeaderRow />
        </thead>
        <tbody>
          <ReachMoonHighscoreEmptyRow>
            {showGlobalEmptyState
              ? 'No Reach the Moon runs yet.'
              : `No ${periodLabel.toLowerCase()} runs yet.`}
          </ReachMoonHighscoreEmptyRow>
          <ReachMoonHighscoreFillerRows
            count={reachMoonHighscoreVisibleRowCount - 1}
          />
        </tbody>
      </table>
    )
  }

  const emptyFillerRowCount = reachMoonHighscoreVisibleRowCount - entries.length

  return (
    <>
      {loadError ? renderLoadErrorState() : null}
      <table
        aria-busy={loading ? 'true' : 'false'}
        aria-label={`${periodLabel} Reach the Moon leaderboard`}
        class="reach-moon-highscore-board"
      >
        <caption class="reach-moon-highscore-refreshing" aria-live="polite">
          {loading ? `Refreshing ${periodLabel.toLowerCase()}...` : ''}
        </caption>
        <thead>
          <ReachMoonHighscoreHeaderRow />
        </thead>
        <tbody>
          {entries.map((entry) => (
            <ReachMoonHighscoreRow
              entry={entry}
              key={entry.id}
              loading={loading}
            />
          ))}
          <ReachMoonHighscoreFillerRows count={emptyFillerRowCount} />
        </tbody>
      </table>
    </>
  )
}

export const MainMenuSurface = ({
  activeView,
  developerFeatureFlags,
  developerFeatureFlagsMenuEnabled,
  loadGameAvailable,
  recentSnapshots,
  recentSnapshotExportStatus,
  recentSnapshotImportStatus,
  reachMoonHighscorePendingRun,
  reachMoonHighscoreState,
  rootRef,
  selectedRecentSnapshotId,
  visible,
  onDeveloperFeatureFlagsApply,
  onDeveloperFeatureFlagsBack,
  onDeveloperFeatureFlagsChange,
  onDeveloperFeatureFlagsMenu,
  onFreeRoam,
  onLoadGame,
  onLoadGameBack,
  onLoadGameMenu,
  onReachMoon,
  onReachMoonBack,
  onReachMoonHighscorePeriod,
  onReachMoonHighscorePlayerName,
  onReachMoonHighscoreRetry,
  onReachMoonHighscoreSubmitRetry,
  onReachMoonHighscores,
  onReachMoonMenu,
  onTutorial,
  onRecentSnapshotChange,
  onRecentSnapshotExport,
  onRecentSnapshotImport,
  onRecentSnapshotLoad,
  onRecentSnapshotMenu,
}: MainMenuSurfaceProps) => {
  const displayedView = activeView
  const activeHighscoreRollup =
    reachMoonHighscoreState.rollups[reachMoonHighscoreState.activePeriod]
  const hasHighscoreEntries = reachMoonHighscorePeriodOptions.some(
    ({ period }) =>
      (reachMoonHighscoreState.rollups[period]?.entries.length ?? 0) > 0,
  )
  const highscoreLoading =
    reachMoonHighscoreState.loadingPeriod ===
    reachMoonHighscoreState.activePeriod
  const highscoreDescription = reachMoonHighscorePendingRun
    ? 'Your completed run submits automatically, then the board refreshes.'
    : 'Compare completed Earth-Moon mission runs.'
  const selectedRecentSnapshot =
    recentSnapshots.find(
      (snapshot) => snapshot.id === selectedRecentSnapshotId,
    ) ?? null
  const selectedRecentSnapshotDetails = selectedRecentSnapshot
    ? getRecentSnapshotDetails(selectedRecentSnapshot)
    : []
  const recentSnapshotFileInputRef = useRef<HTMLInputElement>(null)

  return (
    <section
      class="main-menu"
      ref={rootRef}
      style={{ display: visible ? 'flex' : 'none' }}
    >
      <MenuPanel
        className="main-menu-panel"
        view="main"
        viewAttribute={mainMenuViewAttribute}
        hidden={displayedView !== 'main'}
      >
        <MenuCopy className="main-menu-copy">
          <MenuKicker className="main-menu-kicker">Space Web Game</MenuKicker>
          <MenuDescription>
            Learn the flight model, then take the Earth-Moon run.
          </MenuDescription>
        </MenuCopy>
        <MenuActions className="main-menu-actions">
          <MenuActionButton
            action="tutorial"
            actionAttribute={mainMenuActionAttribute}
            className="main-menu-action-primary"
            variant="primary"
            onClick={onTutorial}
          >
            Tutorial
          </MenuActionButton>
          <MenuActionButton
            action="reach-moon-menu"
            actionAttribute={mainMenuActionAttribute}
            className="main-menu-action-primary"
            variant="primary"
            onClick={onReachMoonMenu}
          >
            Reach the Moon
          </MenuActionButton>
          <MenuActionButton
            action="free-roam"
            actionAttribute={mainMenuActionAttribute}
            className="main-menu-action-secondary"
            variant="secondary"
            onClick={onFreeRoam}
          >
            Free Roam
          </MenuActionButton>
          <MenuActionButton
            action="load-menu"
            actionAttribute={mainMenuActionAttribute}
            className="main-menu-action-secondary"
            variant="secondary"
            onClick={onLoadGameMenu}
          >
            Load Game
          </MenuActionButton>
          {developerFeatureFlagsMenuEnabled ? (
            <MenuActionButton
              action="developer-feature-flags-menu"
              actionAttribute={mainMenuActionAttribute}
              className="main-menu-action-developer"
              variant="secondary"
              onClick={onDeveloperFeatureFlagsMenu}
            >
              Developer flags
            </MenuActionButton>
          ) : null}
        </MenuActions>
      </MenuPanel>

      <MenuPanel
        className="main-menu-panel"
        view="developer-feature-flags"
        viewAttribute={mainMenuViewAttribute}
        hidden={displayedView !== 'developer-feature-flags'}
      >
        <MenuCopy className="main-menu-copy">
          <MenuKicker className="main-menu-kicker">Developer flags</MenuKicker>
          <MenuDescription>
            Choose the trajectory implementation and horizon. Applying changes
            reloads the app with the selected configuration.
          </MenuDescription>
        </MenuCopy>
        <MenuActions className="main-menu-actions">
          <label class="main-menu-feature-flag">
            <span>Trajectory prediction</span>
            <select
              aria-label="Trajectory prediction implementation"
              value={developerFeatureFlags.trajectoryPredictionImplementation}
              onChange={(event) =>
                onDeveloperFeatureFlagsChange({
                  ...developerFeatureFlags,
                  trajectoryPredictionImplementation: event.currentTarget
                    .value as DeveloperFeatureFlags['trajectoryPredictionImplementation'],
                })
              }
            >
              <option value="euler">Euler numerical</option>
              <option value="kepler">Kepler two-body</option>
            </select>
          </label>
          <label class="main-menu-feature-flag">
            <span>Trajectory horizon</span>
            <select
              aria-label="Trajectory horizon"
              value={
                developerFeatureFlags.noHorizonLimit ? 'extended' : 'default'
              }
              onChange={(event) =>
                onDeveloperFeatureFlagsChange({
                  ...developerFeatureFlags,
                  noHorizonLimit: event.currentTarget.value === 'extended',
                })
              }
            >
              <option value="default">Default limit</option>
              <option value="extended">Extended limit</option>
            </select>
          </label>
          <MenuActionButton
            action="developer-feature-flags-apply"
            actionAttribute={mainMenuActionAttribute}
            variant="primary"
            onClick={onDeveloperFeatureFlagsApply}
          >
            Apply and reload
          </MenuActionButton>
          <MenuActionButton
            action="developer-feature-flags-back"
            actionAttribute={mainMenuActionAttribute}
            variant="secondary"
            onClick={onDeveloperFeatureFlagsBack}
          >
            Back
          </MenuActionButton>
        </MenuActions>
      </MenuPanel>

      <MenuPanel
        className="main-menu-panel"
        view="load-game"
        viewAttribute={mainMenuViewAttribute}
        hidden={displayedView !== 'load-game'}
      >
        <MenuCopy className="main-menu-copy">
          <MenuKicker className="main-menu-kicker">Load game</MenuKicker>
          <MenuDescription>
            Resume the last saved debug snapshot or choose another recent
            snapshot from this browser.
          </MenuDescription>
        </MenuCopy>
        <MenuActions className="main-menu-actions">
          <MenuActionButton
            action="load-last"
            actionAttribute={mainMenuActionAttribute}
            disabled={!loadGameAvailable}
            variant="secondary"
            onClick={onLoadGame}
          >
            Load last game
          </MenuActionButton>
          <MenuActionButton
            action="load-any-menu"
            actionAttribute={mainMenuActionAttribute}
            variant="secondary"
            onClick={onRecentSnapshotMenu}
          >
            Load any game
          </MenuActionButton>
          <MenuActionButton
            action="load-back"
            actionAttribute={mainMenuActionAttribute}
            variant="secondary"
            onClick={onLoadGameBack}
          >
            Back
          </MenuActionButton>
        </MenuActions>
      </MenuPanel>

      <MenuPanel
        className="main-menu-panel main-menu-panel-snapshot"
        view="load-game-snapshot"
        viewAttribute={mainMenuViewAttribute}
        hidden={displayedView !== 'load-game-snapshot'}
      >
        <MenuCopy className="main-menu-copy">
          <MenuKicker className="main-menu-kicker">Load any game</MenuKicker>
          <MenuDescription>
            Choose a recent debug snapshot from this browser.
          </MenuDescription>
        </MenuCopy>
        <MenuActions className="main-menu-actions">
          <div class="menu-recent-snapshot main-menu-recent-snapshot">
            <label
              class="menu-recent-snapshot-label"
              for="main-menu-recent-snapshot"
            >
              Snapshot
            </label>
            <select
              id="main-menu-recent-snapshot"
              class="menu-recent-snapshot-select"
              value={selectedRecentSnapshotId}
              disabled={recentSnapshots.length === 0}
              onChange={(event) => {
                onRecentSnapshotChange(event.currentTarget.value)
              }}
            >
              {recentSnapshots.length === 0 ? (
                <option value="">No recent snapshots</option>
              ) : (
                recentSnapshots.map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id}>
                    {snapshot.name} -{' '}
                    {formatRecentSnapshotSavedAt(snapshot.savedAt)}
                  </option>
                ))
              )}
            </select>
            {selectedRecentSnapshot ? (
              <dl
                aria-atomic="true"
                aria-label="Selected snapshot details"
                aria-live="polite"
                class="menu-recent-snapshot-details"
              >
                {selectedRecentSnapshotDetails.map((detail) => (
                  <div class="menu-recent-snapshot-detail" key={detail.label}>
                    <dt>{detail.label}</dt>
                    <dd>{detail.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <input
              accept=".json,application/json"
              aria-label="Snapshot JSON file"
              hidden
              ref={recentSnapshotFileInputRef}
              type="file"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (file) {
                  onRecentSnapshotImport(file)
                }
              }}
            />
            <div class="main-menu-snapshot-actions">
              <MenuActionButton
                action="load-any"
                actionAttribute={mainMenuActionAttribute}
                disabled={!selectedRecentSnapshotId}
                variant="primary"
                onClick={onRecentSnapshotLoad}
              >
                Load
              </MenuActionButton>
              <MenuActionButton
                action="export-snapshot"
                actionAttribute={mainMenuActionAttribute}
                disabled={!selectedRecentSnapshotId}
                variant="secondary"
                onClick={onRecentSnapshotExport}
              >
                Export
              </MenuActionButton>
            </div>
            {recentSnapshotExportStatus ? (
              <p
                class={clsx(
                  'menu-recent-snapshot-status',
                  `menu-recent-snapshot-status-${recentSnapshotExportStatus.kind}`,
                )}
                role={
                  recentSnapshotExportStatus.kind === 'error'
                    ? 'alert'
                    : 'status'
                }
              >
                {recentSnapshotExportStatus.message}
              </p>
            ) : null}
            {recentSnapshotImportStatus ? (
              <p
                class={clsx(
                  'menu-recent-snapshot-status',
                  `menu-recent-snapshot-status-${recentSnapshotImportStatus.tone}`,
                )}
                role={
                  recentSnapshotImportStatus.tone === 'error'
                    ? 'alert'
                    : 'status'
                }
              >
                {recentSnapshotImportStatus.message}
              </p>
            ) : null}
          </div>
          <div class="main-menu-snapshot-navigation-actions">
            <MenuActionButton
              action="import-snapshot"
              actionAttribute={mainMenuActionAttribute}
              variant="secondary"
              onClick={() => recentSnapshotFileInputRef.current?.click()}
            >
              Import
            </MenuActionButton>
            <MenuActionButton
              action="load-back"
              actionAttribute={mainMenuActionAttribute}
              variant="secondary"
              onClick={onLoadGameBack}
            >
              Back
            </MenuActionButton>
          </div>
        </MenuActions>
      </MenuPanel>

      <MenuPanel
        className="main-menu-panel"
        view="reach-moon"
        viewAttribute={mainMenuViewAttribute}
        hidden={displayedView !== 'reach-moon'}
      >
        <MenuCopy className="main-menu-copy">
          <MenuKicker className="main-menu-kicker">Reach the Moon</MenuKicker>
          <MenuDescription>
            Launch into the Earth-Moon mission route.
          </MenuDescription>
        </MenuCopy>
        <MenuActions className="main-menu-actions">
          <MenuActionButton
            action="reach-moon-start"
            actionAttribute={mainMenuActionAttribute}
            className="main-menu-action-primary"
            variant="primary"
            onClick={onReachMoon}
          >
            Start
          </MenuActionButton>
          <MenuActionButton
            action="reach-moon-highscores"
            actionAttribute={mainMenuActionAttribute}
            variant="secondary"
            onClick={onReachMoonHighscores}
          >
            Highscores
          </MenuActionButton>
          <MenuActionButton
            action="reach-moon-back"
            actionAttribute={mainMenuActionAttribute}
            className="main-menu-action-secondary"
            variant="secondary"
            onClick={onReachMoonBack}
          >
            Back
          </MenuActionButton>
        </MenuActions>
      </MenuPanel>

      <MenuPanel
        className="main-menu-panel main-menu-panel-highscores"
        view="reach-moon-highscores"
        viewAttribute={mainMenuViewAttribute}
        hidden={displayedView !== 'reach-moon-highscores'}
      >
        <MenuCopy className="main-menu-copy">
          <MenuKicker className="main-menu-kicker">
            Reach the Moon Highscores
          </MenuKicker>
          <MenuDescription>{highscoreDescription}</MenuDescription>
        </MenuCopy>
        <fieldset class="reach-moon-highscore-filters">
          <legend class="reach-moon-highscore-filters-label">
            Leaderboard period
          </legend>
          {reachMoonHighscorePeriodOptions.map(({ label, period }) => (
            <button
              aria-pressed={reachMoonHighscoreState.activePeriod === period}
              class={
                reachMoonHighscoreState.activePeriod === period
                  ? 'reach-moon-highscore-filter reach-moon-highscore-filter-active'
                  : 'reach-moon-highscore-filter'
              }
              key={period}
              type="button"
              onClick={() => onReachMoonHighscorePeriod(period)}
            >
              {label}
            </button>
          ))}
        </fieldset>
        <ReachMoonHighscoreSubmitPanel
          pendingRun={reachMoonHighscorePendingRun}
          state={reachMoonHighscoreState}
          onPlayerName={onReachMoonHighscorePlayerName}
          onSubmitRetry={onReachMoonHighscoreSubmitRetry}
        />
        <ReachMoonHighscoreBoard
          activePeriod={reachMoonHighscoreState.activePeriod}
          loadError={reachMoonHighscoreState.loadError}
          loading={highscoreLoading}
          loadingFallbackRollup={reachMoonHighscoreState.loadingFallbackRollup}
          rollup={activeHighscoreRollup}
          showGlobalEmptyState={!hasHighscoreEntries}
          onRetry={onReachMoonHighscoreRetry}
        />
        <MenuActions className="main-menu-actions">
          <MenuActionButton
            action="reach-moon-back"
            actionAttribute={mainMenuActionAttribute}
            className="main-menu-action-secondary"
            variant="secondary"
            onClick={onReachMoonBack}
          >
            Back
          </MenuActionButton>
        </MenuActions>
      </MenuPanel>
    </section>
  )
}
