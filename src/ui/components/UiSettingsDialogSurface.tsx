import type { ComponentChildren } from 'preact'
import type {
  OrbitPointDisplaySettings,
  TouchControlSide,
  TouchTrajectoryControlState,
} from '../../userSettingsStorage'

type SegmentedControlOption<TValue extends string> = {
  label: string
  value: TValue
}

const sideOptions = [
  { label: 'Left', value: 'left' },
  { label: 'Right', value: 'right' },
] satisfies SegmentedControlOption<TouchControlSide>[]

const trajectoryOptions = [
  ...sideOptions,
  { label: 'Hidden', value: 'hidden' },
] satisfies SegmentedControlOption<TouchTrajectoryControlState>[]

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

type SpacecraftControlSettingsVisibility = {
  burnSide: boolean
  mobileManeuverStart: boolean
  targetSide: boolean
  trajectorySide: boolean
  warpSide: boolean
}

const desktopSpacecraftControlsSummary = 'Keyboard and mouse active'

const getVisibleSpacecraftControlSettings = ({
  touchBurnControlAvailable,
  touchControlsVisible,
  touchTargetControlAvailable,
  touchTrajectoryControlAvailable,
  touchWarpControlAvailable,
}: {
  touchBurnControlAvailable: boolean
  touchControlsVisible: boolean
  touchTargetControlAvailable: boolean
  touchTrajectoryControlAvailable: boolean
  touchWarpControlAvailable: boolean
}): SpacecraftControlSettingsVisibility => ({
  burnSide: touchControlsVisible && touchBurnControlAvailable,
  mobileManeuverStart: touchControlsVisible,
  targetSide: touchControlsVisible && touchTargetControlAvailable,
  trajectorySide: touchControlsVisible && touchTrajectoryControlAvailable,
  warpSide: touchControlsVisible && touchWarpControlAvailable,
})

const getSpacecraftControlsSummary = ({
  mobileManeuverStartByDrag,
  touchBurnControlAvailable,
  touchBurnControlSide,
  touchControlsVisible,
  touchTargetControlAvailable,
  touchTargetControlSide,
  touchTrajectoryControlAvailable,
  touchTrajectoryControlSide,
  touchWarpControlAvailable,
  touchWarpControlSide,
}: {
  mobileManeuverStartByDrag: boolean
  touchBurnControlAvailable: boolean
  touchBurnControlSide: TouchControlSide
  touchControlsVisible: boolean
  touchTargetControlAvailable: boolean
  touchTargetControlSide: TouchControlSide
  touchTrajectoryControlAvailable: boolean
  touchTrajectoryControlSide: TouchTrajectoryControlState
  touchWarpControlAvailable: boolean
  touchWarpControlSide: TouchControlSide
}) => {
  const visibleSettings = getVisibleSpacecraftControlSettings({
    touchBurnControlAvailable,
    touchControlsVisible,
    touchTargetControlAvailable,
    touchTrajectoryControlAvailable,
    touchWarpControlAvailable,
  })
  const summaryParts: string[] = []

  if (visibleSettings.burnSide) {
    summaryParts.push(`Burn ${touchBurnControlSide}`)
  }
  if (visibleSettings.warpSide) {
    summaryParts.push(`warp ${touchWarpControlSide}`)
  }
  if (visibleSettings.targetSide) {
    summaryParts.push(`target ${touchTargetControlSide}`)
  }
  if (visibleSettings.trajectorySide) {
    summaryParts.push(`trajectory ${touchTrajectoryControlSide}`)
  }
  if (visibleSettings.mobileManeuverStart) {
    summaryParts.push(`maneuver ${mobileManeuverStartByDrag ? 'drag' : 'tap'}`)
  }

  return summaryParts.length > 0
    ? summaryParts.join(', ')
    : desktopSpacecraftControlsSummary
}

const hasVisibleControlSideSettings = (
  settings: SpacecraftControlSettingsVisibility,
) =>
  settings.burnSide ||
  settings.warpSide ||
  settings.targetSide ||
  settings.trajectorySide

const UiSettingsSegmentedControl = <TValue extends string>({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string
  onChange(value: TValue): void
  options: SegmentedControlOption<TValue>[]
  value: TValue
}) => {
  if (!options.some((option) => option.value === value)) {
    throw new Error(
      `Invalid segmented control value "${value}". Expected one of: ${options
        .map((option) => option.value)
        .join(', ')}`,
    )
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: Preserve the existing segmented-control role/group semantics.
    <div class="segmented-control" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const selected = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            class={joinClassNames(
              'segmented-control-option',
              selected && 'segmented-control-option-selected',
            )}
            data-segmented-control-value={option.value}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

const UiSettingsRow = ({
  children,
  label,
}: {
  children: ComponentChildren
  label: string
}) => (
  <div class="app-dialog-setting">
    <span class="app-dialog-setting-name">{label}</span>
    {children}
  </div>
)

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
  touchBurnControlAvailable: boolean
  touchBurnControlSide: TouchControlSide
  touchControlsVisible: boolean
  touchTargetControlAvailable: boolean
  touchTargetControlSide: TouchControlSide
  touchTrajectoryControlAvailable: boolean
  touchTrajectoryControlSide: TouchTrajectoryControlState
  touchWarpControlAvailable: boolean
  touchWarpControlSide: TouchControlSide
  onBackToMainSettings(): void
  onDecreaseDesktopEdgePanSpeed(): void
  onDesktopEdgePanEnabledChange(enabled: boolean): void
  onIncreaseDesktopEdgePanSpeed(): void
  onMobileManeuverStartByDragChange(startByDrag: boolean): void
  onOpenOrbitPointDisplaySettings(): void
  onOpenSpacecraftControlsSettings(): void
  onOrbitPointDisplayChange(settings: OrbitPointDisplaySettings): void
  onTouchBurnControlSideChange(side: TouchControlSide): void
  onTouchTargetControlSideChange(side: TouchControlSide): void
  onTouchTrajectoryControlSideChange(side: TouchTrajectoryControlState): void
  onTouchWarpControlSideChange(side: TouchControlSide): void
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
  touchBurnControlAvailable,
  touchBurnControlSide,
  touchControlsVisible,
  touchTargetControlAvailable,
  touchTargetControlSide,
  touchTrajectoryControlAvailable,
  touchTrajectoryControlSide,
  touchWarpControlAvailable,
  touchWarpControlSide,
  onBackToMainSettings,
  onDecreaseDesktopEdgePanSpeed,
  onDesktopEdgePanEnabledChange,
  onIncreaseDesktopEdgePanSpeed,
  onMobileManeuverStartByDragChange,
  onOpenOrbitPointDisplaySettings,
  onOpenSpacecraftControlsSettings,
  onOrbitPointDisplayChange,
  onTouchBurnControlSideChange,
  onTouchTargetControlSideChange,
  onTouchTrajectoryControlSideChange,
  onTouchWarpControlSideChange,
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
  const visibleSpacecraftControlSettings = getVisibleSpacecraftControlSettings({
    touchBurnControlAvailable,
    touchControlsVisible,
    touchTargetControlAvailable,
    touchTrajectoryControlAvailable,
    touchWarpControlAvailable,
  })
  const spacecraftControlSideSettingsVisible = hasVisibleControlSideSettings(
    visibleSpacecraftControlSettings,
  )
  const spacecraftSettingsVisible =
    spacecraftControlSideSettingsVisible ||
    visibleSpacecraftControlSettings.mobileManeuverStart

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
              touchBurnControlAvailable,
              touchBurnControlSide,
              touchControlsVisible,
              touchTargetControlAvailable,
              touchTargetControlSide,
              touchTrajectoryControlAvailable,
              touchTrajectoryControlSide,
              touchWarpControlAvailable,
              touchWarpControlSide,
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
        {spacecraftControlSideSettingsVisible ? (
          /* biome-ignore lint/a11y/useSemanticElements: Preserve the existing styled dialog group pattern. */
          <div
            class="app-dialog-setting-group"
            role="group"
            aria-label="Control sides"
          >
            <span class="app-dialog-setting-group-label">Control sides</span>
            {visibleSpacecraftControlSettings.burnSide ? (
              <UiSettingsRow label="Burn side">
                <UiSettingsSegmentedControl
                  ariaLabel="Burn control side"
                  onChange={onTouchBurnControlSideChange}
                  options={sideOptions}
                  value={touchBurnControlSide}
                />
              </UiSettingsRow>
            ) : null}
            {visibleSpacecraftControlSettings.warpSide ? (
              <UiSettingsRow label="Warp side">
                <UiSettingsSegmentedControl
                  ariaLabel="Warp control side"
                  onChange={onTouchWarpControlSideChange}
                  options={sideOptions}
                  value={touchWarpControlSide}
                />
              </UiSettingsRow>
            ) : null}
            {visibleSpacecraftControlSettings.targetSide ? (
              <UiSettingsRow label="Target side">
                <UiSettingsSegmentedControl
                  ariaLabel="Target control side"
                  onChange={onTouchTargetControlSideChange}
                  options={sideOptions}
                  value={touchTargetControlSide}
                />
              </UiSettingsRow>
            ) : null}
            {visibleSpacecraftControlSettings.trajectorySide ? (
              <UiSettingsRow label="Trajectory side">
                <UiSettingsSegmentedControl
                  ariaLabel="Trajectory control side"
                  onChange={onTouchTrajectoryControlSideChange}
                  options={trajectoryOptions}
                  value={touchTrajectoryControlSide}
                />
              </UiSettingsRow>
            ) : null}
          </div>
        ) : null}

        {visibleSpacecraftControlSettings.mobileManeuverStart ? (
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
