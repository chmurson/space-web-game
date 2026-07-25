import type {
  DesktopCameraPanMode,
  OrbitPointDisplaySettings,
} from '../../userSettingsStorage'

const getOrbitPointDisplaySummary = (settings: OrbitPointDisplaySettings) => {
  return settings.markersVisible ? 'Markers on' : 'Markers off'
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

const UiSettingsRadioOption = ({
  checked,
  description,
  groupName,
  label,
  onChange,
  value,
}: {
  checked: boolean
  description: string
  groupName: string
  label: string
  onChange(): void
  value: DesktopCameraPanMode
}) => {
  const descriptionId = `${groupName}-${value}-description`
  return (
    <label class="app-dialog-setting app-dialog-radio-option">
      <span class="app-dialog-setting-copy">
        <span class="app-dialog-setting-name">{label}</span>
        <span id={descriptionId} class="app-dialog-setting-summary">
          {description}
        </span>
      </span>
      <input
        type="radio"
        class="app-dialog-radio-input"
        name={groupName}
        value={value}
        aria-label={label}
        aria-describedby={descriptionId}
        checked={checked}
        onChange={onChange}
      />
    </label>
  )
}

const UiSettingsPanSpeedStepper = ({
  decreaseDisabled,
  increaseDisabled,
  label,
  onDecrease,
  onIncrease,
  setting,
  speedLabel,
}: {
  decreaseDisabled: boolean
  increaseDisabled: boolean
  label: string
  onDecrease(): void
  onIncrease(): void
  setting: 'edge' | 'wheel'
  speedLabel: string
}) => (
  // biome-ignore lint/a11y/useSemanticElements: Preserve the existing styled dialog group pattern.
  <div
    class="app-dialog-setting app-dialog-stepper"
    role="group"
    aria-label={label}
  >
    <span class="app-dialog-setting-copy">
      <span class="app-dialog-setting-name">{label}</span>
      <span
        class="app-dialog-setting-summary"
        data-ui-settings-pan-speed={setting}
        aria-live="polite"
      >
        {speedLabel}
      </span>
    </span>
    <span class="app-dialog-stepper-controls">
      <button
        type="button"
        class="app-dialog-button app-dialog-stepper-button"
        data-ui-settings-pan-speed-action={`${setting}-decrease`}
        aria-label={`Decrease ${label.toLowerCase()}`}
        disabled={decreaseDisabled}
        onClick={onDecrease}
      >
        −
      </button>
      <button
        type="button"
        class="app-dialog-button app-dialog-stepper-button"
        data-ui-settings-pan-speed-action={`${setting}-increase`}
        aria-label={`Increase ${label.toLowerCase()}`}
        disabled={increaseDisabled}
        onClick={onIncrease}
      >
        +
      </button>
    </span>
  </div>
)

export type UiSettingsDialogPane =
  | 'main'
  | 'orbitPointDisplay'
  | 'spacecraftControls'

export type UiSettingsDialogSurfaceProps = {
  activePane: UiSettingsDialogPane
  decreaseDesktopEdgePanSpeedDisabled: boolean
  decreaseDesktopWheelPanSpeedDisabled: boolean
  desktopCameraPanMode: DesktopCameraPanMode
  desktopCameraPanVisible: boolean
  desktopEdgePanSpeedLabel: string
  desktopEdgePanSpeedVisible: boolean
  desktopWheelPanSpeedLabel: string
  desktopWheelPanSpeedVisible: boolean
  dialogId: string
  increaseDesktopEdgePanSpeedDisabled: boolean
  increaseDesktopWheelPanSpeedDisabled: boolean
  mobileManeuverStartByDrag: boolean
  orbitPointDisplay: OrbitPointDisplaySettings
  open: boolean
  rootRef(element: HTMLElement | null): void
  touchControlsVisible: boolean
  onBackToMainSettings(): void
  onDesktopCameraPanModeChange(mode: DesktopCameraPanMode): void
  onDecreaseDesktopEdgePanSpeed(): void
  onDecreaseDesktopWheelPanSpeed(): void
  onIncreaseDesktopEdgePanSpeed(): void
  onIncreaseDesktopWheelPanSpeed(): void
  onMobileManeuverStartByDragChange(startByDrag: boolean): void
  onOpenOrbitPointDisplaySettings(): void
  onOpenSpacecraftControlsSettings(): void
  onOrbitPointDisplayChange(settings: OrbitPointDisplaySettings): void
}

export const UiSettingsDialogSurface = ({
  activePane,
  decreaseDesktopEdgePanSpeedDisabled,
  decreaseDesktopWheelPanSpeedDisabled,
  desktopCameraPanMode,
  desktopCameraPanVisible,
  desktopEdgePanSpeedLabel,
  desktopEdgePanSpeedVisible,
  desktopWheelPanSpeedLabel,
  desktopWheelPanSpeedVisible,
  dialogId,
  increaseDesktopEdgePanSpeedDisabled,
  increaseDesktopWheelPanSpeedDisabled,
  mobileManeuverStartByDrag,
  orbitPointDisplay,
  open,
  rootRef,
  touchControlsVisible,
  onBackToMainSettings,
  onDesktopCameraPanModeChange,
  onDecreaseDesktopEdgePanSpeed,
  onDecreaseDesktopWheelPanSpeed,
  onIncreaseDesktopEdgePanSpeed,
  onIncreaseDesktopWheelPanSpeed,
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
  const desktopCameraPanModeGroupName = `${dialogId}-desktop-camera-pan-mode`
  const updateOrbitPointDisplay = (
    key: keyof OrbitPointDisplaySettings,
    value: boolean,
  ) => onOrbitPointDisplayChange({ ...orbitPointDisplay, [key]: value })
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

        {desktopCameraPanVisible ? (
          // biome-ignore lint/a11y/useSemanticElements: Preserve the existing styled dialog group pattern.
          <div
            class="app-dialog-setting-group"
            role="group"
            aria-label="Camera"
          >
            <span class="app-dialog-setting-group-label">Camera</span>
            <fieldset class="app-dialog-radio-group">
              <legend class="app-dialog-setting-name">Pan camera</legend>
              <UiSettingsRadioOption
                checked={desktopCameraPanMode === 'wheel'}
                description="Scroll to pan · Ctrl/Cmd + scroll to zoom"
                groupName={desktopCameraPanModeGroupName}
                label="Wheel / trackpad"
                value="wheel"
                onChange={() => onDesktopCameraPanModeChange('wheel')}
              />
              <UiSettingsRadioOption
                checked={desktopCameraPanMode === 'drag'}
                description="Click and drag to pan · Scroll to zoom"
                groupName={desktopCameraPanModeGroupName}
                label="Mouse drag"
                value="drag"
                onChange={() => onDesktopCameraPanModeChange('drag')}
              />
              <UiSettingsRadioOption
                checked={desktopCameraPanMode === 'edge'}
                description="Move the pointer to an edge · Scroll to zoom"
                groupName={desktopCameraPanModeGroupName}
                label="Screen edge"
                value="edge"
                onChange={() => onDesktopCameraPanModeChange('edge')}
              />
            </fieldset>
            {desktopWheelPanSpeedVisible ? (
              <UiSettingsPanSpeedStepper
                decreaseDisabled={decreaseDesktopWheelPanSpeedDisabled}
                increaseDisabled={increaseDesktopWheelPanSpeedDisabled}
                label="Wheel / trackpad pan speed"
                setting="wheel"
                speedLabel={desktopWheelPanSpeedLabel}
                onDecrease={onDecreaseDesktopWheelPanSpeed}
                onIncrease={onIncreaseDesktopWheelPanSpeed}
              />
            ) : null}
            {desktopEdgePanSpeedVisible ? (
              <UiSettingsPanSpeedStepper
                decreaseDisabled={decreaseDesktopEdgePanSpeedDisabled}
                increaseDisabled={increaseDesktopEdgePanSpeedDisabled}
                label="Edge pan speed"
                setting="edge"
                speedLabel={desktopEdgePanSpeedLabel}
                onDecrease={onDecreaseDesktopEdgePanSpeed}
                onIncrease={onIncreaseDesktopEdgePanSpeed}
              />
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
