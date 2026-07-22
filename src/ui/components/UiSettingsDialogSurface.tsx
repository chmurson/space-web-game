import type { OrbitPointDisplaySettings } from '../../userSettingsStorage'

const joinClassNames = (...classNames: Array<string | false | undefined>) =>
  classNames.filter(Boolean).join(' ')

const getOrbitPointDisplaySummary = (settings: OrbitPointDisplaySettings) => {
  if (!settings.markersVisible) {
    return 'Markers off'
  }

  if (!settings.labelsVisible) {
    return 'Markers on, labels off'
  }

  return [
    'Markers on',
    'labels on',
    `altitude ${settings.altitudeVisible ? 'on' : 'off'}`,
    `center ${settings.centerDistanceVisible ? 'on' : 'off'}`,
    `name ${settings.pointNameVisible ? 'on' : 'off'}`,
  ].join(', ')
}

const desktopSpacecraftControlsSummary = 'Keyboard and mouse active'

const getSpacecraftControlsSummary = ({
  mobileManeuverStartByDrag,
  touchControlsVisible,
}: {
  mobileManeuverStartByDrag: boolean
  touchControlsVisible: boolean
}) => {
  return touchControlsVisible
    ? `maneuver ${mobileManeuverStartByDrag ? 'drag' : 'tap'}`
    : desktopSpacecraftControlsSummary
}

const UiSettingsNavigationRow = ({
  label,
  onClick,
  summary,
}: {
  label: string
  onClick(): void
  summary: string
}) => (
  <button
    type="button"
    class="app-dialog-setting app-dialog-setting-button"
    aria-label={`${label}: ${summary}`}
    onClick={onClick}
  >
    <span class="app-dialog-setting-copy">
      <span class="app-dialog-setting-name">{label}</span>
      <span class="app-dialog-setting-summary">{summary}</span>
    </span>
    <span class="app-dialog-setting-chevron" aria-hidden="true">
      &gt;
    </span>
  </button>
)

const UiSettingsSwitch = ({
  checked,
  disabled = false,
  label,
  onChange,
  summary,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange(checked: boolean): void
  summary?: string
}) => (
  <button
    type="button"
    class="app-dialog-setting app-dialog-switch"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
  >
    <span class={summary ? 'app-dialog-setting-copy' : undefined}>
      <span class="app-dialog-setting-name">{label}</span>
      {summary ? (
        <span class="app-dialog-setting-summary">{summary}</span>
      ) : null}
    </span>
    <span class="app-dialog-switch-track" aria-hidden="true">
      <span />
    </span>
  </button>
)

export type UiSettingsDialogPane =
  | 'main'
  | 'orbitPointDisplay'
  | 'spacecraftControls'

export type UiSettingsDialogSurfaceProps = {
  activePane: UiSettingsDialogPane
  decreaseDesktopEdgePanSpeedDisabled: boolean
  desktopEdgePanEnabled: boolean
  desktopEdgePanSpeedLabel: string
  desktopEdgePanSpeedVisible: boolean
  desktopEdgePanVisible: boolean
  dialogId: string
  increaseDesktopEdgePanSpeedDisabled: boolean
  mobileManeuverStartByDrag: boolean
  orbitPointDisplay: OrbitPointDisplaySettings
  open: boolean
  rootRef(element: HTMLElement | null): void
  touchControlsVisible: boolean
  onBackToMainSettings(): void
  onDecreaseDesktopEdgePanSpeed(): void
  onDesktopEdgePanEnabledChange(enabled: boolean): void
  onIncreaseDesktopEdgePanSpeed(): void
  onMobileManeuverStartByDragChange(startByDrag: boolean): void
  onOpenOrbitPointDisplaySettings(): void
  onOpenSpacecraftControlsSettings(): void
  onOrbitPointDisplayChange(settings: OrbitPointDisplaySettings): void
}

export const UiSettingsDialogSurface = ({
  activePane,
  decreaseDesktopEdgePanSpeedDisabled,
  desktopEdgePanEnabled,
  desktopEdgePanSpeedLabel,
  desktopEdgePanSpeedVisible,
  desktopEdgePanVisible,
  dialogId,
  increaseDesktopEdgePanSpeedDisabled,
  mobileManeuverStartByDrag,
  orbitPointDisplay,
  open,
  rootRef,
  touchControlsVisible,
  onBackToMainSettings,
  onDecreaseDesktopEdgePanSpeed,
  onDesktopEdgePanEnabledChange,
  onIncreaseDesktopEdgePanSpeed,
  onMobileManeuverStartByDragChange,
  onOpenOrbitPointDisplaySettings,
  onOpenSpacecraftControlsSettings,
  onOrbitPointDisplayChange,
}: UiSettingsDialogSurfaceProps) => {
  const titleId =
    activePane === 'orbitPointDisplay'
      ? `${dialogId}-orbit-point-display-title`
      : activePane === 'spacecraftControls'
        ? `${dialogId}-spacecraft-controls-title`
        : `${dialogId}-title`
  const updateOrbitPointDisplay = (
    key: keyof OrbitPointDisplaySettings,
    value: boolean,
  ) => onOrbitPointDisplayChange({ ...orbitPointDisplay, [key]: value })
  const orbitLabelsDisabled = !orbitPointDisplay.markersVisible
  const orbitFieldsDisabled =
    !orbitPointDisplay.markersVisible || !orbitPointDisplay.labelsVisible
  const spacecraftSettingsVisible = touchControlsVisible

  const mainPanel = (
    <>
      <header class="app-dialog-header">
        <div>
          <div class="app-dialog-kicker">Controls</div>
          <h2 id={titleId} class="app-dialog-title">
            UI settings
          </h2>
        </div>
        <button
          type="button"
          class="app-dialog-button app-dialog-close"
          aria-label="Close UI settings"
          data-dialog-close="true"
        >
          Close
        </button>
      </header>

      <div class="app-dialog-body">
        <div class="app-dialog-setting-list">
          <UiSettingsNavigationRow
            label="Spacecraft controls settings"
            onClick={onOpenSpacecraftControlsSettings}
            summary={getSpacecraftControlsSummary({
              mobileManeuverStartByDrag,
              touchControlsVisible,
            })}
          />
          <UiSettingsNavigationRow
            label="Orbit point display"
            onClick={onOpenOrbitPointDisplaySettings}
            summary={getOrbitPointDisplaySummary(orbitPointDisplay)}
          />
        </div>
      </div>
    </>
  )

  const spacecraftControlsPanel = (
    <>
      <header class="app-dialog-header">
        <div>
          <div class="app-dialog-kicker">Controls</div>
          <h2 id={titleId} class="app-dialog-title">
            Spacecraft controls settings
          </h2>
        </div>
        <div class="app-dialog-header-actions">
          <button
            type="button"
            class="app-dialog-button"
            onClick={onBackToMainSettings}
          >
            Back
          </button>
          <button
            type="button"
            class="app-dialog-button app-dialog-close"
            aria-label="Close spacecraft controls settings"
            data-dialog-close="true"
          >
            Close
          </button>
        </div>
      </header>

      <div class="app-dialog-body">
        {touchControlsVisible ? (
          /* biome-ignore lint/a11y/useSemanticElements: Preserve the existing styled dialog group pattern. */
          <div
            class="app-dialog-setting-group"
            role="group"
            aria-label="Maneuvers"
          >
            <span class="app-dialog-setting-group-label">Maneuvers</span>
            <UiSettingsSwitch
              checked={mobileManeuverStartByDrag}
              label="Starts by drag or tap"
              summary={
                mobileManeuverStartByDrag ? 'Starts by drag' : 'Starts by tap'
              }
              onChange={onMobileManeuverStartByDragChange}
            />
          </div>
        ) : null}

        {desktopEdgePanVisible ? (
          // biome-ignore lint/a11y/useSemanticElements: Preserve the existing styled dialog group pattern.
          <div
            class="app-dialog-setting-group"
            role="group"
            aria-label="Camera"
          >
            <span class="app-dialog-setting-group-label">Camera</span>
            <UiSettingsSwitch
              checked={desktopEdgePanEnabled}
              label="Turn on scrolling by edge pan"
              summary={
                desktopEdgePanEnabled
                  ? 'Scrolling by edge pan'
                  : 'Scrolling by dragging'
              }
              onChange={onDesktopEdgePanEnabledChange}
            />
            {desktopEdgePanSpeedVisible ? (
              // biome-ignore lint/a11y/useSemanticElements: Preserve the existing styled dialog group pattern.
              <div
                class="app-dialog-setting app-dialog-stepper"
                role="group"
                aria-label="Edge pan speed"
              >
                <span class="app-dialog-setting-copy">
                  <span class="app-dialog-setting-name">Edge pan speed</span>
                  <span
                    class="app-dialog-setting-summary"
                    data-ui-settings-edge-pan-speed=""
                    aria-live="polite"
                  >
                    {desktopEdgePanSpeedLabel}
                  </span>
                </span>
                <span class="app-dialog-stepper-controls">
                  <button
                    type="button"
                    class="app-dialog-button app-dialog-stepper-button"
                    data-ui-settings-edge-pan-speed-action="decrease"
                    aria-label="Decrease edge pan speed"
                    disabled={decreaseDesktopEdgePanSpeedDisabled}
                    onClick={onDecreaseDesktopEdgePanSpeed}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    class="app-dialog-button app-dialog-stepper-button"
                    data-ui-settings-edge-pan-speed-action="increase"
                    aria-label="Increase edge pan speed"
                    disabled={increaseDesktopEdgePanSpeedDisabled}
                    onClick={onIncreaseDesktopEdgePanSpeed}
                  >
                    +
                  </button>
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {spacecraftSettingsVisible ? null : (
          <div class="app-dialog-setting">
            <span class="app-dialog-setting-copy">
              <span class="app-dialog-setting-name">
                {desktopSpacecraftControlsSummary}
              </span>
              <span class="app-dialog-setting-summary">
                Touch controls are hidden in this mode.
              </span>
            </span>
          </div>
        )}
      </div>
    </>
  )

  const orbitPointDisplayPanel = (
    <>
      <header class="app-dialog-header">
        <div>
          <div class="app-dialog-kicker">Display</div>
          <h2 id={titleId} class="app-dialog-title">
            Orbit point display
          </h2>
        </div>
        <div class="app-dialog-header-actions">
          <button
            type="button"
            class="app-dialog-button"
            onClick={onBackToMainSettings}
          >
            Back
          </button>
          <button
            type="button"
            class="app-dialog-button app-dialog-close"
            aria-label="Close orbit point display settings"
            data-dialog-close="true"
          >
            Close
          </button>
        </div>
      </header>

      <div class="app-dialog-body">
        <div class="app-dialog-setting-list">
          <UiSettingsSwitch
            checked={orbitPointDisplay.markersVisible}
            label="Show closest/farthest markers"
            onChange={(checked) =>
              updateOrbitPointDisplay('markersVisible', checked)
            }
          />
          <UiSettingsSwitch
            checked={orbitPointDisplay.labelsVisible}
            disabled={orbitLabelsDisabled}
            label="Show marker labels"
            onChange={(checked) =>
              updateOrbitPointDisplay('labelsVisible', checked)
            }
          />
          {/* biome-ignore lint/a11y/useSemanticElements: Preserve the existing styled dialog group pattern. */}
          <div
            class={joinClassNames(
              'app-dialog-setting-group',
              orbitFieldsDisabled && 'app-dialog-setting-group-disabled',
            )}
            role="group"
            aria-label="Marker label contents"
          >
            <span class="app-dialog-setting-group-label">
              Marker label contents
            </span>
            <UiSettingsSwitch
              checked={orbitPointDisplay.pointNameVisible}
              disabled={orbitFieldsDisabled}
              label="Show point name"
              onChange={(checked) =>
                updateOrbitPointDisplay('pointNameVisible', checked)
              }
            />
            <UiSettingsSwitch
              checked={orbitPointDisplay.altitudeVisible}
              disabled={orbitFieldsDisabled}
              label="Show altitude"
              onChange={(checked) =>
                updateOrbitPointDisplay('altitudeVisible', checked)
              }
            />
            <UiSettingsSwitch
              checked={orbitPointDisplay.centerDistanceVisible}
              disabled={orbitFieldsDisabled}
              label="Show center distance"
              onChange={(checked) =>
                updateOrbitPointDisplay('centerDistanceVisible', checked)
              }
            />
          </div>
        </div>
      </div>
    </>
  )

  return (
    <div class="app-dialog ui-settings-dialog" hidden={!open} ref={rootRef}>
      <div class="app-dialog-backdrop" data-dialog-close="true" />
      <section
        class="app-dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {activePane === 'orbitPointDisplay'
          ? orbitPointDisplayPanel
          : activePane === 'spacecraftControls'
            ? spacecraftControlsPanel
            : mainPanel}
      </section>
    </div>
  )
}
