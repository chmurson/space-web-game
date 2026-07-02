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

const getSpacecraftControlsSummary = ({
  touchBurnControlSide,
  touchTargetControlSide,
  touchTrajectoryControlSide,
  touchWarpControlSide,
}: {
  touchBurnControlSide: TouchControlSide
  touchTargetControlSide: TouchControlSide
  touchTrajectoryControlSide: TouchTrajectoryControlState
  touchWarpControlSide: TouchControlSide
}) =>
  [
    `Burn ${touchBurnControlSide}`,
    `warp ${touchWarpControlSide}`,
    `target ${touchTargetControlSide}`,
    `trajectory ${touchTrajectoryControlSide}`,
  ].join(', ')

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
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange(checked: boolean): void
}) => (
  <button
    type="button"
    class="app-dialog-setting app-dialog-switch"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
  >
    <span class="app-dialog-setting-name">{label}</span>
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
  dialogId: string
  orbitPointDisplay: OrbitPointDisplaySettings
  open: boolean
  rootRef(element: HTMLElement | null): void
  touchBurnControlSide: TouchControlSide
  touchTargetControlSide: TouchControlSide
  touchTrajectoryControlSide: TouchTrajectoryControlState
  touchWarpControlSide: TouchControlSide
  onBackToMainSettings(): void
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
  dialogId,
  orbitPointDisplay,
  open,
  rootRef,
  touchBurnControlSide,
  touchTargetControlSide,
  touchTrajectoryControlSide,
  touchWarpControlSide,
  onBackToMainSettings,
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
              touchBurnControlSide,
              touchTargetControlSide,
              touchTrajectoryControlSide,
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
        {/* biome-ignore lint/a11y/useSemanticElements: Preserve the existing styled dialog group pattern. */}
        <div
          class="app-dialog-setting-group"
          role="group"
          aria-label="Control sides"
        >
          <span class="app-dialog-setting-group-label">Control sides</span>
          <UiSettingsRow label="Burn side">
            <UiSettingsSegmentedControl
              ariaLabel="Burn control side"
              onChange={onTouchBurnControlSideChange}
              options={sideOptions}
              value={touchBurnControlSide}
            />
          </UiSettingsRow>
          <UiSettingsRow label="Warp side">
            <UiSettingsSegmentedControl
              ariaLabel="Warp control side"
              onChange={onTouchWarpControlSideChange}
              options={sideOptions}
              value={touchWarpControlSide}
            />
          </UiSettingsRow>
          <UiSettingsRow label="Target side">
            <UiSettingsSegmentedControl
              ariaLabel="Target control side"
              onChange={onTouchTargetControlSideChange}
              options={sideOptions}
              value={touchTargetControlSide}
            />
          </UiSettingsRow>
          <UiSettingsRow label="Trajectory side">
            <UiSettingsSegmentedControl
              ariaLabel="Trajectory control side"
              onChange={onTouchTrajectoryControlSideChange}
              options={trajectoryOptions}
              value={touchTrajectoryControlSide}
            />
          </UiSettingsRow>
        </div>
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
