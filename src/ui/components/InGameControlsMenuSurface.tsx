import type { CameraFollowSubject } from '../../scenario/scenarioDirectiveTypes'
import {
  cameraFollowOptions,
  getCameraFollowAction,
  getCameraFollowDescription,
} from '../cameraControlActions'

export type InGameControlsMenuSurfaceProps = {
  cameraControlsLocked: boolean
  cameraControlsVisible: boolean
  cameraFollow: CameraFollowSubject
  coastHorizonLabel: string
  decreaseCoastHorizonDisabled: boolean
  increaseCoastHorizonDisabled: boolean
  menuId: string
  open: boolean
  rootRef(element: HTMLElement | null): void
  onCameraFollowSelect(follow: CameraFollowSubject): void
  onCameraRecenter(): void
  onDecreaseCoastHorizon(): void
  onIncreaseCoastHorizon(): void
  onMenuButtonClick(): void
  onOpenUiSettings(): void
}

export const InGameControlsMenuSurface = ({
  cameraControlsLocked,
  cameraControlsVisible,
  cameraFollow,
  coastHorizonLabel,
  decreaseCoastHorizonDisabled,
  increaseCoastHorizonDisabled,
  menuId,
  open,
  rootRef,
  onCameraFollowSelect,
  onCameraRecenter,
  onDecreaseCoastHorizon,
  onIncreaseCoastHorizon,
  onMenuButtonClick,
  onOpenUiSettings,
}: InGameControlsMenuSurfaceProps) => {
  const cameraFollowLabelId = `${menuId}-camera-follow`
  const trajectorySectionLabelId = `${menuId}-trajectory`
  const cameraFollowDescription = getCameraFollowDescription(cameraFollow)

  return (
    <section
      class={
        open
          ? 'in-game-controls-menu in-game-controls-menu-open'
          : 'in-game-controls-menu'
      }
      data-camera-follow={cameraFollow}
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
        {cameraControlsVisible ? (
          <div class="in-game-controls-menu-camera-grid">
            <div class="menu-stepper in-game-controls-menu-camera-control">
              <div class="menu-stepper-copy">
                <span class="menu-stepper-name" id={cameraFollowLabelId}>
                  Follow
                </span>
                <span
                  aria-live="polite"
                  class="menu-stepper-value"
                  data-in-game-camera-follow-status=""
                >
                  {cameraFollowDescription}
                </span>
              </div>
              <fieldset
                aria-labelledby={cameraFollowLabelId}
                class="segmented-control in-game-controls-menu-camera-options"
              >
                <legend class="in-game-controls-menu-camera-options-legend">
                  Camera follow subject
                </legend>
                {cameraFollowOptions.map((option) => {
                  const selected = option.follow === cameraFollow

                  return (
                    <button
                      aria-label={
                        cameraControlsLocked
                          ? `Camera controls unavailable: Follow ${option.label}`
                          : `Follow ${option.label}`
                      }
                      aria-pressed={selected}
                      class={
                        selected
                          ? 'segmented-control-option segmented-control-option-selected'
                          : 'segmented-control-option'
                      }
                      data-camera-follow-option={option.follow}
                      data-in-game-action={getCameraFollowAction(option.follow)}
                      disabled={cameraControlsLocked}
                      key={option.follow}
                      onClick={() => onCameraFollowSelect(option.follow)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  )
                })}
              </fieldset>
            </div>

            <button
              aria-label={
                cameraControlsLocked
                  ? 'Camera controls unavailable: Recenter followed subject'
                  : 'Recenter followed subject'
              }
              class="in-game-controls-menu-action in-game-controls-menu-camera-recenter"
              data-in-game-action="recenterCamera"
              disabled={cameraControlsLocked}
              onClick={onCameraRecenter}
              type="button"
            >
              Recenter
            </button>
          </div>
        ) : null}

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
              <kbd>A</kbd>
              <span> / </span>
              <kbd>D</kbd>
              <span> / </span>
              <kbd>←</kbd>
              <span> / </span>
              <kbd>→</kbd>
            </span>
          </div>
          <div class="in-game-controls-menu-keyboard-row">
            <span class="in-game-controls-menu-keyboard-name">
              Precise turn
            </span>
            <span class="in-game-controls-menu-keyboard-keys">
              <kbd>Shift</kbd>
              <span> + </span>
              <kbd>A</kbd>
              <span> / </span>
              <kbd>D</kbd>
              <span> / </span>
              <kbd>←</kbd>
              <span> / </span>
              <kbd>→</kbd>
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
            <span class="in-game-controls-menu-keyboard-name">
              Target selector
            </span>
            <span class="in-game-controls-menu-keyboard-keys">
              <kbd>T</kbd>
            </span>
          </div>
          <div class="in-game-controls-menu-keyboard-row">
            <span class="in-game-controls-menu-keyboard-name">Follow</span>
            <span class="in-game-controls-menu-keyboard-keys">
              <kbd>C</kbd>
            </span>
          </div>
          <div class="in-game-controls-menu-keyboard-row">
            <span class="in-game-controls-menu-keyboard-name">Recenter</span>
            <span class="in-game-controls-menu-keyboard-keys">
              <kbd>Shift</kbd>
              <span> + </span>
              <kbd>C</kbd>
            </span>
          </div>
        </fieldset>
      </div>
    </section>
  )
}
