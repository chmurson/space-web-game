
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

export type UiSettingsDialogPane = 'main' | 'camera'

export type UiSettingsDialogSurfaceProps = {
  activePane: UiSettingsDialogPane
  decreaseDesktopEdgePanSpeedDisabled: boolean
  desktopEdgePanEnabled: boolean
  desktopEdgePanSpeedLabel: string
  desktopEdgePanSpeedVisible: boolean
  desktopEdgePanVisible: boolean
  dialogId: string
  increaseDesktopEdgePanSpeedDisabled: boolean
  open: boolean
  rootRef(element: HTMLElement | null): void
  onBackToMainSettings(): void
  onDecreaseDesktopEdgePanSpeed(): void
  onDesktopEdgePanEnabledChange(enabled: boolean): void
  onIncreaseDesktopEdgePanSpeed(): void
  onOpenCameraSettings(): void
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
  open,
  rootRef,
  onBackToMainSettings,
  onDecreaseDesktopEdgePanSpeed,
  onDesktopEdgePanEnabledChange,
  onIncreaseDesktopEdgePanSpeed,
  onOpenCameraSettings,
}: UiSettingsDialogSurfaceProps) => {
  const titleId =
    activePane === 'camera' ? `${dialogId}-camera-title` : `${dialogId}-title`



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
