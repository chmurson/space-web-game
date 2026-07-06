import type { CameraControlMode } from '../../scenario/scenarioDirectiveTypes'
import { getCameraModeAction } from '../cameraModeActions'

export type InGameControlsMenuSurfaceProps = {
  cameraMode: CameraControlMode
  cameraModeChangesLocked: boolean
  coastHorizonLabel: string
  decreaseCoastHorizonDisabled: boolean
  increaseCoastHorizonDisabled: boolean
  menuId: string
  open: boolean
  rootRef(element: HTMLElement | null): void
  onCameraModeSelect(mode: CameraControlMode): void
  onDecreaseCoastHorizon(): void
  onIncreaseCoastHorizon(): void
  onMenuButtonClick(): void
  onOpenUiSettings(): void
}

const cameraModeOptions = [
  { label: 'Free roam', mode: 'unlocked' },
  { label: 'Spacecraft', mode: 'centered' },
  { label: 'Target', mode: 'target' },
] satisfies Array<{
  label: string
  mode: CameraControlMode
}>

const getCameraModeDescription = (mode: CameraControlMode) =>
  cameraModeOptions.find((option) => option.mode === mode)?.label ?? 'Unknown'

export const InGameControlsMenuSurface = ({
  cameraMode,
  cameraModeChangesLocked,
  coastHorizonLabel,
  decreaseCoastHorizonDisabled,
  increaseCoastHorizonDisabled,
  menuId,
  open,
  rootRef,
  onCameraModeSelect,
  onDecreaseCoastHorizon,
  onIncreaseCoastHorizon,
  onMenuButtonClick,
  onOpenUiSettings,
}: InGameControlsMenuSurfaceProps) => {
  const cameraControlLabelId = `${menuId}-camera`
  const trajectorySectionLabelId = `${menuId}-trajectory`
  const cameraModeDescription = getCameraModeDescription(cameraMode)

  return (
    <section
      class={
        open
          ? 'in-game-controls-menu in-game-controls-menu-open'
          : 'in-game-controls-menu'
      }
      data-camera-mode={cameraMode}
      ref={rootRef}
    >
      <button
        type="button"
        class="in-game-controls-menu-button"
        aria-label={open ? 'Close in-game controls' : 'Open in-game controls'}
        aria-controls={menuId}
        aria-expanded={open}
        onClick={onMenuButtonClick}
      >
        <span class="in-game-controls-menu-button-icon" aria-hidden="true" />
      </button>

      <div
        id={menuId}
        class="in-game-controls-menu-popover"
        hidden={!open}
        role="dialog"
        aria-label="In-game controls"
      >
        <div class="in-game-controls-menu-heading">Controls</div>
        <div class="menu-stepper in-game-controls-menu-camera">
          <div class="menu-stepper-copy">
            <span class="menu-stepper-name" id={cameraControlLabelId}>
              Camera mode
            </span>
            <span
              class="menu-stepper-value"
              data-in-game-camera-status=""
              aria-live="polite"
            >
              {cameraModeDescription}
            </span>
          </div>
          <div class="menu-stepper-controls">
            <fieldset
              class="segmented-control in-game-controls-menu-camera-options"
              aria-labelledby={cameraControlLabelId}
            >
              <legend class="in-game-controls-menu-camera-options-legend">
                Camera mode
              </legend>
              {cameraModeOptions.map((option) => {
                const selected = option.mode === cameraMode

                return (
                  <button
                    key={option.mode}
                    type="button"
                    class={
                      selected
                        ? 'segmented-control-option segmented-control-option-selected'
                        : 'segmented-control-option'
                    }
                    data-in-game-action={getCameraModeAction(option.mode)}
                    data-camera-mode-option={option.mode}
                    disabled={cameraModeChangesLocked}
                    aria-pressed={selected}
                    aria-label={
                      cameraModeChangesLocked
                        ? `Camera mode changes unavailable: ${option.label}`
                        : `Set camera mode to ${option.label}`
                    }
                    onClick={() => onCameraModeSelect(option.mode)}
                  >
                    {option.label}
                  </button>
                )
              })}
            </fieldset>
          </div>
        </div>

        <button
          class="in-game-controls-menu-action"
          type="button"
          data-in-game-action="openUiSettings"
          onClick={onOpenUiSettings}
        >
          <span>UI settings</span>
        </button>

        <div
          class="in-game-controls-menu-heading"
          id={trajectorySectionLabelId}
        >
          Trajectory
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: Preserve the existing role=group adapter contract. */}
        <div
          class="menu-stepper in-game-controls-menu-stepper"
          role="group"
          aria-labelledby={trajectorySectionLabelId}
        >
          <div class="menu-stepper-copy">
            <span class="menu-stepper-name">Prediction horizon</span>
            <span
              class="menu-stepper-value"
              data-in-game-coast-horizon=""
              aria-live="polite"
            >
              {coastHorizonLabel}
            </span>
          </div>
          <div class="menu-stepper-controls">
            <button
              type="button"
              class="menu-stepper-button"
              data-in-game-action="decreaseCoastHorizon"
              aria-label="Decrease prediction horizon"
              disabled={decreaseCoastHorizonDisabled}
              onClick={onDecreaseCoastHorizon}
            >
              −
            </button>
            <button
              type="button"
              class="menu-stepper-button"
              data-in-game-action="increaseCoastHorizon"
              aria-label="Increase prediction horizon"
              disabled={increaseCoastHorizonDisabled}
              onClick={onIncreaseCoastHorizon}
            >
              +
            </button>
          </div>
        </div>

        <fieldset class="in-game-controls-menu-keyboard-hints">
          <legend class="in-game-controls-menu-keyboard-legend">
            Keyboard shortcuts
          </legend>
          <div class="in-game-controls-menu-keyboard-row">
            <span class="in-game-controls-menu-keyboard-name">Normal burn</span>
            <span class="in-game-controls-menu-keyboard-keys">
              <span>hold</span>
              <span> </span>
              <kbd>W</kbd>
              <span> / </span>
              <kbd>↑</kbd>
            </span>
          </div>
          <div class="in-game-controls-menu-keyboard-row">
            <span class="in-game-controls-menu-keyboard-name">Burn latch</span>
            <span class="in-game-controls-menu-keyboard-keys">
              <span>double</span>
              <span> </span>
              <kbd>W</kbd>
              <span> / </span>
              <kbd>↑</kbd>
            </span>
          </div>
          <div class="in-game-controls-menu-keyboard-row">
            <span class="in-game-controls-menu-keyboard-name">Cancel burn</span>
            <span class="in-game-controls-menu-keyboard-keys">
              <kbd>W</kbd>
              <span> / </span>
              <kbd>↑</kbd>
              <span> / </span>
              <kbd>S</kbd>
              <span> / </span>
              <kbd>↓</kbd>
            </span>
          </div>
          <div class="in-game-controls-menu-keyboard-row">
            <span class="in-game-controls-menu-keyboard-name">Turn</span>
            <span class="in-game-controls-menu-keyboard-keys">
              <span>mouse double-click</span>
            </span>
          </div>
          <div class="in-game-controls-menu-keyboard-row">
            <span class="in-game-controls-menu-keyboard-name">Time warp</span>
            <span class="in-game-controls-menu-keyboard-keys">
              <kbd>[</kbd>
              <span> / </span>
              <kbd>]</kbd>
            </span>
          </div>
          <div class="in-game-controls-menu-keyboard-row">
            <span class="in-game-controls-menu-keyboard-name">Horizon</span>
            <span class="in-game-controls-menu-keyboard-keys">
              <kbd>Shift</kbd>
              <span> + </span>
              <kbd>[</kbd>
              <span> / </span>
              <kbd>]</kbd>
            </span>
          </div>
          <div class="in-game-controls-menu-keyboard-row">
            <span class="in-game-controls-menu-keyboard-name">Assist</span>
            <span class="in-game-controls-menu-keyboard-keys">
              <kbd>Shift</kbd>
              <span> + </span>
              <kbd>C</kbd>
            </span>
          </div>
          <div class="in-game-controls-menu-keyboard-row">
            <span class="in-game-controls-menu-keyboard-name">Camera</span>
            <span class="in-game-controls-menu-keyboard-keys">
              <kbd>C</kbd>
            </span>
          </div>
        </fieldset>
      </div>
    </section>
  )
}
