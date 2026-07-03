import type { DebugScenarioSnapshotEntry } from '../../debugScenarioSnapshot'
import type { TopMenuAction } from '../createTopMenu'

export type TopMenuSurfaceProps = {
  activeSection: 'main' | 'debug-snapshot'
  debugModeEnabled: boolean
  fpsIndicatorEnabled: boolean
  loadSnapshotAvailable: boolean
  menuId: string
  open: boolean
  pendingConfirmationAction: TopMenuAction | null
  recentSnapshots: DebugScenarioSnapshotEntry[]
  selectedRecentSnapshotId: string
  rootRef(element: HTMLElement | null): void
  onAction(action: TopMenuAction): void
  onMenuButtonClick(): void
  onRecentSnapshotBack(): void
  onRecentSnapshotChange(id: string): void
  onRecentSnapshotLoad(): void
  onRecentSnapshotMenu(): void
}

export const TopMenuSurface = ({
  debugModeEnabled,
  activeSection,
  fpsIndicatorEnabled,
  loadSnapshotAvailable,
  menuId,
  open,
  pendingConfirmationAction,
  recentSnapshots,
  selectedRecentSnapshotId,
  rootRef,
  onAction,
  onMenuButtonClick,
  onRecentSnapshotBack,
  onRecentSnapshotChange,
  onRecentSnapshotLoad,
  onRecentSnapshotMenu,
}: TopMenuSurfaceProps) => {
  const debugSectionLabelId = `${menuId}-debug`
  const debugSnapshotSectionLabelId = `${menuId}-debug-snapshot`
  const scenarioSectionLabelId = `${menuId}-scenario`

  return (
    <div class={open ? 'top-menu top-menu-open' : 'top-menu'} ref={rootRef}>
      <button
        class="top-menu-button"
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={(event) => {
          event.stopPropagation()
          onMenuButtonClick()
        }}
      >
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
      </button>
      <div class="top-menu-dropdown" id={menuId} role="menu" hidden={!open}>
        <section
          class="menu-section"
          aria-labelledby={debugSectionLabelId}
          hidden={activeSection === 'debug-snapshot'}
        >
          <div class="menu-section-label" id={debugSectionLabelId}>
            Debug
          </div>
          <button
            type="button"
            role="menuitemcheckbox"
            data-menu-action="toggleDebugMode"
            data-menu-debug-toggle=""
            aria-checked={debugModeEnabled}
            onClick={() => onAction('toggleDebugMode')}
          >
            {debugModeEnabled ? 'Hide debug window' : 'Show debug window'}
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            data-menu-action="toggleFpsIndicator"
            data-menu-fps-toggle=""
            aria-checked={fpsIndicatorEnabled}
            onClick={() => onAction('toggleFpsIndicator')}
          >
            {fpsIndicatorEnabled ? 'Hide FPS meter' : 'Show FPS meter'}
          </button>
          <button
            type="button"
            role="menuitem"
            data-menu-action="saveDebugSnapshot"
            onClick={() => onAction('saveDebugSnapshot')}
          >
            Save debug snapshot
          </button>
          <button
            type="button"
            role="menuitem"
            data-menu-action="loadDebugSnapshot"
            disabled={!loadSnapshotAvailable}
            onClick={() => onAction('loadDebugSnapshot')}
          >
            Load last debug snapshot
          </button>
          <button
            type="button"
            role="menuitem"
            data-menu-action="openDebugSnapshotLoad"
            onClick={onRecentSnapshotMenu}
          >
            Load debug snapshot
          </button>
        </section>

        <section
          class="menu-section"
          aria-labelledby={debugSnapshotSectionLabelId}
          hidden={activeSection !== 'debug-snapshot'}
        >
          <div class="menu-section-label" id={debugSnapshotSectionLabelId}>
            Load debug snapshot
          </div>
          <div class="menu-recent-snapshot">
            <label
              class="menu-recent-snapshot-label"
              for={`${menuId}-recent-snapshot`}
            >
              Snapshot
            </label>
            <select
              id={`${menuId}-recent-snapshot`}
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
                    {new Date(snapshot.savedAt).toLocaleTimeString()}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              role="menuitem"
              data-menu-action="loadRecentDebugSnapshot"
              disabled={!selectedRecentSnapshotId}
              onClick={onRecentSnapshotLoad}
            >
              Load
            </button>
            <button
              type="button"
              role="menuitem"
              data-menu-action="backFromDebugSnapshotLoad"
              onClick={onRecentSnapshotBack}
            >
              Back
            </button>
          </div>
        </section>

        <hr class="menu-separator" />

        <section
          class="menu-section"
          aria-labelledby={scenarioSectionLabelId}
          hidden={activeSection === 'debug-snapshot'}
        >
          <div class="menu-section-label" id={scenarioSectionLabelId}>
            Scenario
          </div>
          <button
            type="button"
            role="menuitem"
            data-menu-action="resetScenario"
            onClick={() => onAction('resetScenario')}
          >
            {pendingConfirmationAction === 'resetScenario'
              ? 'Confirm restart'
              : 'Restart'}
          </button>
          <button
            type="button"
            role="menuitem"
            data-menu-action="enterMainMenu"
            onClick={() => onAction('enterMainMenu')}
          >
            {pendingConfirmationAction === 'enterMainMenu'
              ? 'Confirm exit'
              : 'Exit'}
          </button>
        </section>
      </div>
    </div>
  )
}
