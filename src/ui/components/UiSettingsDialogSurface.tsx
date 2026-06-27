import type { ComponentChildren } from 'preact'
import type {
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

export type UiSettingsDialogSurfaceProps = {
  dialogId: string
  open: boolean
  rootRef(element: HTMLElement | null): void
  touchBurnControlSide: TouchControlSide
  touchTargetControlSide: TouchControlSide
  touchTrajectoryControlSide: TouchTrajectoryControlState
  touchWarpControlSide: TouchControlSide
  onTouchBurnControlSideChange(side: TouchControlSide): void
  onTouchTargetControlSideChange(side: TouchControlSide): void
  onTouchTrajectoryControlSideChange(side: TouchTrajectoryControlState): void
  onTouchWarpControlSideChange(side: TouchControlSide): void
}

export const UiSettingsDialogSurface = ({
  dialogId,
  open,
  rootRef,
  touchBurnControlSide,
  touchTargetControlSide,
  touchTrajectoryControlSide,
  touchWarpControlSide,
  onTouchBurnControlSideChange,
  onTouchTargetControlSideChange,
  onTouchTrajectoryControlSideChange,
  onTouchWarpControlSideChange,
}: UiSettingsDialogSurfaceProps) => {
  const titleId = `${dialogId}-title`

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
      </section>
    </div>
  )
}
