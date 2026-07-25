import type { DesktopCameraPanMode } from '../../userSettingsStorage'

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

export type UiSettingsDialogPane = 'main' | 'camera'

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
  open: boolean
  rootRef(element: HTMLElement | null): void
  onBackToMainSettings(): void
  onDesktopCameraPanModeChange(mode: DesktopCameraPanMode): void
  onDecreaseDesktopEdgePanSpeed(): void
  onDecreaseDesktopWheelPanSpeed(): void
  onIncreaseDesktopEdgePanSpeed(): void
  onIncreaseDesktopWheelPanSpeed(): void
  onOpenCameraSettings(): void
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
  open,
  rootRef,
  onBackToMainSettings,
  onDesktopCameraPanModeChange,
  onDecreaseDesktopEdgePanSpeed,
  onDecreaseDesktopWheelPanSpeed,
  onIncreaseDesktopEdgePanSpeed,
  onIncreaseDesktopWheelPanSpeed,
  onOpenCameraSettings,
}: UiSettingsDialogSurfaceProps) => {
  const titleId =
    activePane === 'camera' ? `${dialogId}-camera-title` : `${dialogId}-title`
  const desktopCameraPanModeGroupName = `${dialogId}-desktop-camera-pan-mode`

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
            label="Camera settings"
            onClick={onOpenCameraSettings}
            summary="Camera preferences"
          />
        </div>
      </div>
    </>
  )

  const cameraSettingsPanel = (
    <>
      <header class="app-dialog-header">
        <div>
          <div class="app-dialog-kicker">Controls</div>
          <h2 id={titleId} class="app-dialog-title">
            Camera settings
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
            aria-label="Close camera settings"
            data-dialog-close="true"
          >
            Close
          </button>
        </div>
      </header>

      <div class="app-dialog-body">
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
        {activePane === 'camera' ? cameraSettingsPanel : mainPanel}
      </section>
    </div>
  )
}
