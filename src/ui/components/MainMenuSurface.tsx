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
  formatReachMoonScoreSummaryDisplay,
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

export type MainMenuView =
  | 'main'
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

const reachMoonHighscoreSkeletonCells = [
  { className: 'reach-moon-highscore-cell-rank', key: 'rank' },
  { className: 'reach-moon-highscore-cell-name', key: 'name' },
  { className: 'reach-moon-highscore-cell-score', key: 'score' },
  { className: 'reach-moon-highscore-cell-elapsed', key: 'elapsed' },
  { className: 'reach-moon-highscore-cell-fuel', key: 'fuel' },
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

export type MainMenuSurfaceProps = {
  activeView: MainMenuView
  loadGameAvailable: boolean
  recentSnapshots: DebugScenarioSnapshotEntry[]
  reachMoonHighscorePendingRun: ReachMoonHighscorePendingRun | null
  reachMoonHighscoreState: ReachMoonHighscoreMenuState
  reachMoonFeatureEnabled: boolean
  selectedRecentSnapshotId: string
  rootRef(element: HTMLElement | null): void
  visible: boolean
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

const formatRecentSnapshotSavedAt = (value: string) => {
  const date = new Date(value)
  return Number.isFinite(date.valueOf()) ? date.toLocaleTimeString() : 'Unknown'
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

const ReachMoonHighscoreFuelIcon = () => (
  <svg class="telemetry-fuel-icon" viewBox="0 0 16 16" aria-hidden="true">
    <path
      class="telemetry-fuel-icon-tank"
      d="M5.1 2.2h5.8l1.25 1.7v8.4c0 .85-.55 1.5-1.42 1.5H5.27c-.87 0-1.42-.65-1.42-1.5V3.9Z"
    />
    <path class="telemetry-fuel-icon-cap" d="M5.6 2.2V1.3h4.8v.9" />
    <path class="telemetry-fuel-icon-level" d="M5.65 10.65h4.7" />
  </svg>
)

const ReachMoonHighscoreMetric = ({
  icon,
  value,
}: {
  icon: 'fuel' | 'time'
  value: string
}) => (
  <span class="reach-moon-highscore-metric">
    {icon === 'time' ? (
      <ReachMoonHighscoreTimeIcon />
    ) : (
      <ReachMoonHighscoreFuelIcon />
    )}
    <span aria-hidden="true">{value}</span>
  </span>
)

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
        <ReachMoonHighscoreFuelIcon />
        <span>
          Fuel left {display.fuelLeft} (+{display.fuelBonusPoints}).
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
}: {
  entry: RankedReachMoonHighscoreRecord
  loading: boolean
}) => {
  const elapsed = formatCompactElapsed(entry.score.missionElapsedSeconds)
  const fuelLeft = formatReachMoonFuelLeftPercent(entry.score)

  return (
    <tr
      class={
        loading
          ? 'reach-moon-highscore-row reach-moon-highscore-row-loading'
          : 'reach-moon-highscore-row'
      }
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
        <ReachMoonHighscoreMetric icon="fuel" value={fuelLeft} />
      </td>
      <td class="reach-moon-highscore-cell-submitted">
        {formatSubmittedAt(entry.submittedAt)}
      </td>
    </tr>
  )
}

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
      <div class="reach-moon-highscore-state" aria-live="polite">
        {showGlobalEmptyState
          ? 'No Reach the Moon runs yet.'
          : `No ${periodLabel.toLowerCase()} runs yet.`}
      </div>
    )
  }

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
        </tbody>
      </table>
    </>
  )
}

export const MainMenuSurface = ({
  activeView,
  loadGameAvailable,
  recentSnapshots,
  reachMoonHighscorePendingRun,
  reachMoonHighscoreState,
  reachMoonFeatureEnabled,
  rootRef,
  selectedRecentSnapshotId,
  visible,
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
            {reachMoonFeatureEnabled
              ? 'Learn the flight model, then take the Earth-Moon run.'
              : 'Drift above Earth, resume a saved snapshot, or jump straight into the tutorial.'}
          </MenuDescription>
        </MenuCopy>
        <MenuActions className="main-menu-actions">
          {reachMoonFeatureEnabled ? (
            <>
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
            </>
          ) : (
            <>
              <MenuActionButton
                action="load-menu"
                actionAttribute={mainMenuActionAttribute}
                onClick={onLoadGameMenu}
              >
                Load Game
              </MenuActionButton>
              <MenuActionButton
                action="tutorial"
                actionAttribute={mainMenuActionAttribute}
                onClick={onTutorial}
              >
                Tutorial
              </MenuActionButton>
              <MenuActionButton
                action="free-roam"
                actionAttribute={mainMenuActionAttribute}
                onClick={onFreeRoam}
              >
                Free Roam
              </MenuActionButton>
            </>
          )}
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
            onClick={onLoadGame}
          >
            Load last game
          </MenuActionButton>
          <MenuActionButton
            action="load-any-menu"
            actionAttribute={mainMenuActionAttribute}
            onClick={onRecentSnapshotMenu}
          >
            Load any game
          </MenuActionButton>
          <MenuActionButton
            action="load-back"
            actionAttribute={mainMenuActionAttribute}
            onClick={onLoadGameBack}
          >
            Back
          </MenuActionButton>
        </MenuActions>
      </MenuPanel>

      <MenuPanel
        className="main-menu-panel"
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
            <MenuActionButton
              action="load-any"
              actionAttribute={mainMenuActionAttribute}
              disabled={!selectedRecentSnapshotId}
              onClick={onRecentSnapshotLoad}
            >
              Load
            </MenuActionButton>
          </div>
          <MenuActionButton
            action="load-back"
            actionAttribute={mainMenuActionAttribute}
            onClick={onLoadGameBack}
          >
            Back
          </MenuActionButton>
        </MenuActions>
      </MenuPanel>

      {reachMoonFeatureEnabled ? (
        <>
          <MenuPanel
            className="main-menu-panel"
            view="reach-moon"
            viewAttribute={mainMenuViewAttribute}
            hidden={displayedView !== 'reach-moon'}
          >
            <MenuCopy className="main-menu-copy">
              <MenuKicker className="main-menu-kicker">
                Reach the Moon
              </MenuKicker>
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
              loadingFallbackRollup={
                reachMoonHighscoreState.loadingFallbackRollup
              }
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
        </>
      ) : null}
    </section>
  )
}
