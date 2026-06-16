import type { UIUserAction } from '../input/uiUserActions'
import type { CameraControlMode } from '../scenario/scenarioDirectiveTypes'
import { formatTrajectoryHorizonDuration } from './formatters'
import { createSegmentedControl } from './segmentedControl'

export type InGameControlsMenu = {
  close: () => void
  element: HTMLElement
  syncState: () => void
}

const getCameraModeLabel = (mode: CameraControlMode) =>
  mode === 'centered' ? 'Centered' : 'Free roam'

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
    <div class="in-game-controls-menu-setting">
      <div class="in-game-controls-menu-setting-copy">
        <span class="in-game-controls-menu-setting-name">Camera mode</span>
        <span class="in-game-controls-menu-setting-value" data-in-game-camera-status></span>
      </div>
      <div data-in-game-camera-control></div>
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
  const cameraControlContainer = popover.querySelector<HTMLElement>(
    '[data-in-game-camera-control]',
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
    !cameraControlContainer ||
    !uiSettingsButton ||
    !decreaseCoastHorizonButton ||
    !increaseCoastHorizonButton ||
    !coastHorizonValue
  ) {
    throw new Error('Failed to create in-game controls menu')
  }
  const cameraModeControl = createSegmentedControl<CameraControlMode>({
    ariaLabel: 'Camera mode',
    onChange: (mode) => {
      options.onAction(
        mode === 'centered' ? 'setCameraCentered' : 'setCameraUnlocked',
      )
      syncState()
    },
    options: [
      { label: 'Centered', value: 'centered' },
      { label: 'Free roam', value: 'unlocked' },
    ],
    value: options.getCameraMode(),
  })
  cameraControlContainer.append(cameraModeControl.element)

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
      cameraModeControl.sync(mode)
      lastMode = mode
    }

    if (lockedChanged || modeChanged) {
      cameraModeControl.setDisabled(locked)
      cameraStatus.textContent = locked
        ? `${getCameraModeLabel(mode)} · locked`
        : getCameraModeLabel(mode)
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

  button.addEventListener('click', (event) => {
    event.stopPropagation()
    setOpen(!open)
  })

  popover.addEventListener('click', (event) => {
    event.stopPropagation()
  })

  uiSettingsButton.addEventListener('click', () => {
    setOpen(false)
    options.onOpenUiSettings()
  })

  decreaseCoastHorizonButton.addEventListener('click', () => {
    options.onAction('decreaseCoastHorizon')
    syncState()
  })

  increaseCoastHorizonButton.addEventListener('click', () => {
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
