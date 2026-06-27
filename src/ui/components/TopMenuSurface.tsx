import type { TopMenuAction } from '../createTopMenu'

export type TopMenuSurfaceProps = {
  debugModeEnabled: boolean
  fpsIndicatorEnabled: boolean
  loadSnapshotAvailable: boolean
  menuId: string
  open: boolean
  pendingConfirmationAction: TopMenuAction | null
  rootRef(element: HTMLElement | null): void
  onAction(action: TopMenuAction): void
  onMenuButtonClick(): void
}

export const TopMenuSurface = ({
  debugModeEnabled,
  fpsIndicatorEnabled,
  loadSnapshotAvailable,
  menuId,
  open,
  pendingConfirmationAction,
  rootRef,
  onAction,
  onMenuButtonClick,
}: TopMenuSurfaceProps) => {
  const debugSectionLabelId = `${menuId}-debug`
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
        <section class="menu-section" aria-labelledby={debugSectionLabelId}>
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
            Load debug snapshot
          </button>
        </section>

        <hr class="menu-separator" />

        <section class="menu-section" aria-labelledby={scenarioSectionLabelId}>
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
