import type { UIUserAction } from '../input/uiUserActions'
import type { CameraControlMode } from '../scenario/scenarioDirectiveTypes'
import { formatTrajectoryHorizonDuration } from './formatters'
import { addTapSafeButtonHandler } from './tapSafeButtonHandler'

export type InGameControlsMenu = {
  close: () => void
  element: HTMLElement
  syncState: () => void
}

const getCameraModeDescription = (mode: CameraControlMode) =>
  mode === 'centered' ? 'On spacecraft' : 'Free roam'

export const createInGameControlsMenu = (options: {
  app: HTMLElement
  getCameraMode: () => CameraControlMode
  getCameraModeChangesLocked: () => boolean
  getCoastPredictionHorizonHours: () => number
  getMaxCoastPredictionHorizonHours: () => number
  getMinCoastPredictionHorizonHours: () => number
  onAction: (action: UIUserAction) => void
  onOpenUiSettings: () => void
}): InGameControlsMenu => {
  const menuId = 'in-game-controls-menu-popover'
  const cameraControlLabelId = `${menuId}-camera`
  const trajectorySectionLabelId = `${menuId}-trajectory`
  const root = document.createElement('section')
  root.className = 'in-game-controls-menu'

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'in-game-controls-menu-button'
  button.setAttribute('aria-label', 'Open in-game controls')
  button.setAttribute('aria-controls', menuId)
  button.setAttribute('aria-expanded', 'false')
  button.innerHTML = `
    <span class="in-game-controls-menu-button-icon" aria-hidden="true"></span>
  `

  const popover = document.createElement('div')
  popover.id = menuId
  popover.className = 'in-game-controls-menu-popover'
  popover.hidden = true
  popover.setAttribute('role', 'dialog')
  popover.setAttribute('aria-label', 'In-game controls')
  popover.innerHTML = `
    <div class="in-game-controls-menu-heading">Controls</div>
    <div class="menu-stepper in-game-controls-menu-camera" role="group" aria-labelledby="${cameraControlLabelId}">
      <div class="menu-stepper-copy">
        <span class="menu-stepper-name" id="${cameraControlLabelId}">Camera locked</span>
        <span class="menu-stepper-value" data-in-game-camera-status aria-live="polite"></span>
      </div>
      <div class="menu-stepper-controls">
        <button type="button" class="in-game-controls-menu-switch" role="switch" data-in-game-action="toggleCameraMode">
          <span aria-hidden="true"></span>
        </button>
      </div>
    </div>
    <button class="in-game-controls-menu-action" type="button" data-in-game-action="openUiSettings">
      <span>UI settings</span>
    </button>
    <div class="in-game-controls-menu-heading" id="${trajectorySectionLabelId}">Trajectory</div>
    <div class="menu-stepper in-game-controls-menu-stepper" role="group" aria-labelledby="${trajectorySectionLabelId}">
      <div class="menu-stepper-copy">
        <span class="menu-stepper-name">Prediction horizon</span>
        <span class="menu-stepper-value" data-in-game-coast-horizon aria-live="polite"></span>
      </div>
      <div class="menu-stepper-controls">
        <button type="button" class="menu-stepper-button" data-in-game-action="decreaseCoastHorizon" aria-label="Decrease prediction horizon">−</button>
        <button type="button" class="menu-stepper-button" data-in-game-action="increaseCoastHorizon" aria-label="Increase prediction horizon">+</button>
      </div>
    </div>
  `

  root.append(button, popover)
  options.app.appendChild(root)

  const cameraStatus = popover.querySelector<HTMLElement>(
    '[data-in-game-camera-status]',
  )
  const cameraModeSwitch = popover.querySelector<HTMLButtonElement>(
    '[data-in-game-action="toggleCameraMode"]',
  )
  const uiSettingsButton = popover.querySelector<HTMLButtonElement>(
    '[data-in-game-action="openUiSettings"]',
  )
  const decreaseCoastHorizonButton = popover.querySelector<HTMLButtonElement>(
    '[data-in-game-action="decreaseCoastHorizon"]',
  )
  const increaseCoastHorizonButton = popover.querySelector<HTMLButtonElement>(
    '[data-in-game-action="increaseCoastHorizon"]',
  )
  const coastHorizonValue = popover.querySelector<HTMLElement>(
    '[data-in-game-coast-horizon]',
  )
  if (
    !cameraStatus ||
    !cameraModeSwitch ||
    !uiSettingsButton ||
    !decreaseCoastHorizonButton ||
    !increaseCoastHorizonButton ||
    !coastHorizonValue
  ) {
    throw new Error('Failed to create in-game controls menu')
  }
  let lastMode: CameraControlMode | null = null
  let lastLocked: boolean | null = null
  let lastCoastHorizonLabel = ''
  let lastDecreaseDisabled: boolean | null = null
  let lastIncreaseDisabled: boolean | null = null
  let open = false

  const setOpen = (nextOpen: boolean) => {
    open = nextOpen
    popover.hidden = !open
    root.classList.toggle('in-game-controls-menu-open', open)
    button.setAttribute('aria-expanded', String(open))
  }

  const syncState = () => {
    const mode = options.getCameraMode()
    const locked = options.getCameraModeChangesLocked()
    const modeChanged = mode !== lastMode
    const lockedChanged = locked !== lastLocked
    const coastPredictionHorizonHours = options.getCoastPredictionHorizonHours()
    const coastHorizonLabel = formatTrajectoryHorizonDuration(
      coastPredictionHorizonHours * 60 * 60,
    )
    const decreaseDisabled =
      coastPredictionHorizonHours <= options.getMinCoastPredictionHorizonHours()
    const increaseDisabled =
      coastPredictionHorizonHours >= options.getMaxCoastPredictionHorizonHours()

    if (modeChanged) {
      root.dataset.cameraMode = mode
      lastMode = mode
    }

    if (lockedChanged || modeChanged) {
      const cameraLocked = mode === 'centered'
      const cameraModeDescription = getCameraModeDescription(mode)

      cameraModeSwitch.disabled = locked
      cameraModeSwitch.setAttribute('aria-checked', String(cameraLocked))
      cameraModeSwitch.setAttribute(
        'aria-label',
        locked
          ? `Camera locked changes unavailable: ${cameraModeDescription}`
          : `Camera locked ${cameraLocked ? 'on' : 'off'}: ${cameraModeDescription}`,
      )
      cameraStatus.textContent = cameraModeDescription
      lastLocked = locked
    }

    if (coastHorizonLabel !== lastCoastHorizonLabel) {
      coastHorizonValue.textContent = coastHorizonLabel
      lastCoastHorizonLabel = coastHorizonLabel
    }
    if (decreaseDisabled !== lastDecreaseDisabled) {
      decreaseCoastHorizonButton.disabled = decreaseDisabled
      lastDecreaseDisabled = decreaseDisabled
    }
    if (increaseDisabled !== lastIncreaseDisabled) {
      increaseCoastHorizonButton.disabled = increaseDisabled
      lastIncreaseDisabled = increaseDisabled
    }
  }

  addTapSafeButtonHandler(button, () => {
    setOpen(!open)
  })

  popover.addEventListener('click', (event) => {
    event.stopPropagation()
  })

  addTapSafeButtonHandler(uiSettingsButton, () => {
    setOpen(false)
    options.onOpenUiSettings()
  })

  addTapSafeButtonHandler(cameraModeSwitch, () => {
    options.onAction(
      options.getCameraMode() === 'centered'
        ? 'setCameraUnlocked'
        : 'setCameraCentered',
    )
    syncState()
  })

  addTapSafeButtonHandler(decreaseCoastHorizonButton, () => {
    options.onAction('decreaseCoastHorizon')
    syncState()
  })

  addTapSafeButtonHandler(increaseCoastHorizonButton, () => {
    options.onAction('increaseCoastHorizon')
    syncState()
  })

  document.addEventListener('pointerdown', (event) => {
    if (!root.contains(event.target as Node)) {
      setOpen(false)
    }
  })

  document.addEventListener('keydown', (event) => {
    if (open && event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      button.focus()
    }
  })

  syncState()

  return {
    close: () => setOpen(false),
    element: root,
    syncState,
  }
}
