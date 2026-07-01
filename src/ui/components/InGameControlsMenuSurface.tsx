import type { CameraControlMode } from '../../scenario/scenarioDirectiveTypes'

export type InGameControlsMenuSurfaceProps = {
  cameraMode: CameraControlMode
  cameraModeChangesLocked: boolean
  coastHorizonLabel: string
  decreaseCoastHorizonDisabled: boolean
  increaseCoastHorizonDisabled: boolean
  menuId: string
  open: boolean
  rootRef(element: HTMLElement | null): void
  onCameraModeToggle(): void
  onDecreaseCoastHorizon(): void
  onIncreaseCoastHorizon(): void
  onMenuButtonClick(): void
  onOpenUiSettings(): void
}

const getCameraModeDescription = (mode: CameraControlMode) =>
  mode === 'centered' ? 'On spacecraft' : 'Free roam'

export const InGameControlsMenuSurface = ({
  cameraMode,
  cameraModeChangesLocked,
  coastHorizonLabel,
  decreaseCoastHorizonDisabled,
  increaseCoastHorizonDisabled,
  menuId,
  open,
  rootRef,
  onCameraModeToggle,
  onDecreaseCoastHorizon,
  onIncreaseCoastHorizon,
  onMenuButtonClick,
  onOpenUiSettings,
}: InGameControlsMenuSurfaceProps) => {
  const cameraControlLabelId = `${menuId}-camera`
  const trajectorySectionLabelId = `${menuId}-trajectory`
  const cameraLocked = cameraMode === 'centered'
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
        {/* biome-ignore lint/a11y/useSemanticElements: Preserve the existing role=group adapter contract. */}
        <div
          class="menu-stepper in-game-controls-menu-camera"
          role="group"
          aria-labelledby={cameraControlLabelId}
        >
          <div class="menu-stepper-copy">
            <span class="menu-stepper-name" id={cameraControlLabelId}>
              Camera locked
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
            <button
              type="button"
              class="in-game-controls-menu-switch"
              role="switch"
              data-in-game-action="toggleCameraMode"
              disabled={cameraModeChangesLocked}
              aria-checked={cameraLocked}
              aria-label={
                cameraModeChangesLocked
                  ? `Camera locked changes unavailable: ${cameraModeDescription}`
                  : `Camera locked ${cameraLocked ? 'on' : 'off'}: ${cameraModeDescription}`
              }
              onClick={onCameraModeToggle}
            >
              <span aria-hidden="true" />
            </button>
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
        </fieldset>
      </div>
    </section>
  )
}
