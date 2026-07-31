import type { DebugScenarioSnapshotEntry } from '../../debugScenarioSnapshot'
import type { TopMenuAction } from '../createTopMenu'
import { formatRecentSnapshotSavedAt } from './recentSnapshotFormatting'

export type TopMenuSurfaceProps = {
  activeSection: 'main' | 'debug-snapshot' | 'debug-snapshot-save'
  debugModeEnabled: boolean
  debugSnapshotName: string
  fpsIndicatorEnabled: boolean
  loadSnapshotAvailable: boolean
  menuId: string
  open: boolean
  pendingConfirmationAction: TopMenuAction | null
  recentSnapshots: DebugScenarioSnapshotEntry[]
  selectedRecentSnapshotId: string
  snapshotExportStatus: {
    message: string
    tone: 'error' | 'success'
  } | null
  rootRef(element: HTMLElement | null): void
  onAction(action: TopMenuAction): void
  onDebugSnapshotNameChange(name: string): void
  onDebugSnapshotSave(): void
  onDebugSnapshotSaveAndExport(): void
  onDebugSnapshotSaveBack(): void
  onDebugSnapshotSaveMenu(): void
  onMenuButtonClick(): void
  onRecentSnapshotBack(): void
  onRecentSnapshotChange(id: string): void
  onRecentSnapshotExport(): void
  onRecentSnapshotLoad(): void
  onRecentSnapshotMenu(): void
}

export const TopMenuSurface = ({
  debugModeEnabled,
  debugSnapshotName,
  activeSection,
  fpsIndicatorEnabled,
  loadSnapshotAvailable,
  menuId,
  open,
  pendingConfirmationAction,
  recentSnapshots,
  selectedRecentSnapshotId,
  snapshotExportStatus,
  rootRef,
  onAction,
  onDebugSnapshotNameChange,
  onDebugSnapshotSave,
  onDebugSnapshotSaveAndExport,
  onDebugSnapshotSaveBack,
  onDebugSnapshotSaveMenu,
  onMenuButtonClick,
  onRecentSnapshotBack,
  onRecentSnapshotChange,
  onRecentSnapshotExport,
  onRecentSnapshotLoad,
  onRecentSnapshotMenu,
}: TopMenuSurfaceProps) => {
  const debugSectionLabelId = `${menuId}-debug`
  const debugSnapshotSectionLabelId = `${menuId}-debug-snapshot`
  const debugSnapshotSaveSectionLabelId = `${menuId}-debug-snapshot-save`
  const scenarioSectionLabelId = `${menuId}-scenario`
  const renderSnapshotExportStatus = () =>
    snapshotExportStatus ? (
      <p
        class={`top-menu-snapshot-status top-menu-snapshot-status-${snapshotExportStatus.tone}`}
        role={snapshotExportStatus.tone === 'error' ? 'alert' : 'status'}
      >
        {snapshotExportStatus.message}
      </p>
    ) : null

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
          hidden={activeSection !== 'main'}
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
            onClick={onDebugSnapshotSaveMenu}
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
          aria-labelledby={debugSnapshotSaveSectionLabelId}
          hidden={activeSection !== 'debug-snapshot-save'}
        >
          <div class="menu-section-label" id={debugSnapshotSaveSectionLabelId}>
            Save debug snapshot
          </div>
          <div class="menu-recent-snapshot">
            <label
              class="menu-recent-snapshot-label"
              for={`${menuId}-debug-snapshot-name`}
            >
              Name
            </label>
            <input
              id={`${menuId}-debug-snapshot-name`}
              class="menu-recent-snapshot-select menu-debug-snapshot-name"
              type="text"
              value={debugSnapshotName}
              onInput={(event) => {
                onDebugSnapshotNameChange(event.currentTarget.value)
              }}
            />
            <div class="menu-recent-snapshot-buttons">
              <button
                type="button"
                role="menuitem"
                data-menu-action="saveNamedDebugSnapshot"
                onClick={onDebugSnapshotSave}
              >
                Save
              </button>
              <button
                type="button"
                role="menuitem"
                data-menu-action="saveAndExportDebugSnapshot"
                onClick={onDebugSnapshotSaveAndExport}
              >
                Save &amp; export
              </button>
              <button
                type="button"
                role="menuitem"
                data-menu-action="backFromDebugSnapshotSave"
                onClick={onDebugSnapshotSaveBack}
              >
                Back
              </button>
            </div>
            {renderSnapshotExportStatus()}
          </div>
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
                    {formatRecentSnapshotSavedAt(snapshot.savedAt)}
                  </option>
                ))
              )}
            </select>
            <div class="menu-recent-snapshot-buttons">
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
                data-menu-action="exportRecentDebugSnapshot"
                disabled={!selectedRecentSnapshotId}
                onClick={onRecentSnapshotExport}
              >
                Export
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
            {renderSnapshotExportStatus()}
          </div>
        </section>

        <hr class="menu-separator" />

        <section
          class="menu-section"
          aria-labelledby={scenarioSectionLabelId}
          hidden={activeSection !== 'main'}
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
