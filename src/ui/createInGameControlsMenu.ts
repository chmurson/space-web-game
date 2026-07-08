import type { UIUserAction } from '../input/uiUserActions'
import type { CameraControlMode } from '../scenario/scenarioDirectiveTypes'
import type { DesktopEdgePanSpeed } from '../userSettingsStorage'
import { getCameraModeAction } from './cameraModeActions'
import {
  InGameControlsMenuSurface,
  type InGameControlsMenuSurfaceProps,
} from './components/InGameControlsMenuSurface'
import { createPreactUiSurface } from './createPreactUiSurface'
import { formatTrajectoryHorizonDuration } from './formatters'

export type InGameControlsMenu = {
  close: () => void
  element: HTMLElement
  isOpen: () => boolean
  syncState: () => void
}

type InGameControlsMenuRenderProps = Omit<
  InGameControlsMenuSurfaceProps,
  'rootRef'
>

const desktopEdgePanSpeedOptions = [
  { label: 'Slow', value: 'slow' },
  { label: 'Normal', value: 'normal' },
  { label: 'Fast', value: 'fast' },
] satisfies Array<{
  label: string
  value: DesktopEdgePanSpeed
}>

const getDesktopEdgePanSpeedOptionIndex = (speed: DesktopEdgePanSpeed) =>
  Math.max(
    0,
    desktopEdgePanSpeedOptions.findIndex((option) => option.value === speed),
  )

const getDesktopEdgePanSpeedLabel = (speed: DesktopEdgePanSpeed) =>
  desktopEdgePanSpeedOptions[getDesktopEdgePanSpeedOptionIndex(speed)].label

const getDesktopEdgePanSpeedStep = (
  speed: DesktopEdgePanSpeed,
  direction: -1 | 1,
) => {
  const index = getDesktopEdgePanSpeedOptionIndex(speed)
  return desktopEdgePanSpeedOptions[
    Math.min(
      desktopEdgePanSpeedOptions.length - 1,
      Math.max(0, index + direction),
    )
  ].value
}

export const createInGameControlsMenu = (options: {
  app: HTMLElement
  getCameraMode: () => CameraControlMode
  getCameraModeChangesLocked: () => boolean
  getCoastPredictionHorizonHours: () => number
  getDesktopEdgePanSpeed: () => DesktopEdgePanSpeed
  getDesktopEdgePanSpeedVisible: () => boolean
  getMaxCoastPredictionHorizonHours: () => number
  getMinCoastPredictionHorizonHours: () => number
  onAction: (action: UIUserAction) => void
  onDesktopEdgePanSpeedChange: (speed: DesktopEdgePanSpeed) => void
  onOpenUiSettings: () => void
}): InGameControlsMenu => {
  const menuId = 'in-game-controls-menu-popover'
  const surface = createPreactUiSurface<InGameControlsMenuRenderProps>({
    app: options.app,
    component: InGameControlsMenuSurface,
    missingRootError: 'Failed to create in-game controls menu',
  })

  let cameraMode = options.getCameraMode()
  let cameraModeChangesLocked = options.getCameraModeChangesLocked()
  let coastHorizonLabel = ''
  let decreaseCoastHorizonDisabled = false
  let decreaseDesktopEdgePanSpeedDisabled = false
  let desktopEdgePanSpeed: DesktopEdgePanSpeed =
    options.getDesktopEdgePanSpeed()
  let desktopEdgePanSpeedLabel =
    getDesktopEdgePanSpeedLabel(desktopEdgePanSpeed)
  let desktopEdgePanSpeedVisible = options.getDesktopEdgePanSpeedVisible()
  let increaseCoastHorizonDisabled = false
  let increaseDesktopEdgePanSpeedDisabled = false
  let open = false

  const syncRenderState = () => {
    const nextCameraMode = options.getCameraMode()
    const nextCameraModeChangesLocked = options.getCameraModeChangesLocked()
    const coastPredictionHorizonHours = options.getCoastPredictionHorizonHours()
    const nextCoastHorizonLabel = formatTrajectoryHorizonDuration(
      coastPredictionHorizonHours * 60 * 60,
    )
    const nextDecreaseCoastHorizonDisabled =
      coastPredictionHorizonHours <= options.getMinCoastPredictionHorizonHours()
    const nextIncreaseCoastHorizonDisabled =
      coastPredictionHorizonHours >= options.getMaxCoastPredictionHorizonHours()
    const nextDesktopEdgePanSpeed = options.getDesktopEdgePanSpeed()
    const nextDesktopEdgePanSpeedIndex = getDesktopEdgePanSpeedOptionIndex(
      nextDesktopEdgePanSpeed,
    )
    const nextDesktopEdgePanSpeedVisible =
      options.getDesktopEdgePanSpeedVisible()
    const nextDesktopEdgePanSpeedLabel = getDesktopEdgePanSpeedLabel(
      nextDesktopEdgePanSpeed,
    )
    const nextDecreaseDesktopEdgePanSpeedDisabled =
      nextDesktopEdgePanSpeedIndex <= 0
    const nextIncreaseDesktopEdgePanSpeedDisabled =
      nextDesktopEdgePanSpeedIndex >= desktopEdgePanSpeedOptions.length - 1
    const changed =
      nextCameraMode !== cameraMode ||
      nextCameraModeChangesLocked !== cameraModeChangesLocked ||
      nextCoastHorizonLabel !== coastHorizonLabel ||
      nextDecreaseCoastHorizonDisabled !== decreaseCoastHorizonDisabled ||
      nextDecreaseDesktopEdgePanSpeedDisabled !==
        decreaseDesktopEdgePanSpeedDisabled ||
      nextDesktopEdgePanSpeed !== desktopEdgePanSpeed ||
      nextDesktopEdgePanSpeedLabel !== desktopEdgePanSpeedLabel ||
      nextDesktopEdgePanSpeedVisible !== desktopEdgePanSpeedVisible ||
      nextIncreaseCoastHorizonDisabled !== increaseCoastHorizonDisabled ||
      nextIncreaseDesktopEdgePanSpeedDisabled !==
        increaseDesktopEdgePanSpeedDisabled

    cameraMode = nextCameraMode
    cameraModeChangesLocked = nextCameraModeChangesLocked
    coastHorizonLabel = nextCoastHorizonLabel
    decreaseCoastHorizonDisabled = nextDecreaseCoastHorizonDisabled
    decreaseDesktopEdgePanSpeedDisabled =
      nextDecreaseDesktopEdgePanSpeedDisabled
    desktopEdgePanSpeed = nextDesktopEdgePanSpeed
    desktopEdgePanSpeedLabel = nextDesktopEdgePanSpeedLabel
    desktopEdgePanSpeedVisible = nextDesktopEdgePanSpeedVisible
    increaseCoastHorizonDisabled = nextIncreaseCoastHorizonDisabled
    increaseDesktopEdgePanSpeedDisabled =
      nextIncreaseDesktopEdgePanSpeedDisabled

    return changed
  }

  const setDesktopEdgePanSpeed = (direction: -1 | 1) => {
    const nextSpeed = getDesktopEdgePanSpeedStep(desktopEdgePanSpeed, direction)
    if (nextSpeed === desktopEdgePanSpeed) {
      return
    }

    options.onDesktopEdgePanSpeedChange(nextSpeed)
    syncState()
  }

  const renderMenu = () => {
    surface.render({
      cameraMode,
      cameraModeChangesLocked,
      coastHorizonLabel,
      decreaseCoastHorizonDisabled,
      decreaseDesktopEdgePanSpeedDisabled,
      desktopEdgePanSpeedLabel,
      desktopEdgePanSpeedVisible,
      increaseCoastHorizonDisabled,
      increaseDesktopEdgePanSpeedDisabled,
      menuId,
      open,
      onCameraModeSelect: (mode) => {
        options.onAction(getCameraModeAction(mode))
        syncState()
      },
      onDecreaseCoastHorizon: () => {
        options.onAction('decreaseCoastHorizon')
        syncState()
      },
      onDecreaseDesktopEdgePanSpeed: () => setDesktopEdgePanSpeed(-1),
      onIncreaseCoastHorizon: () => {
        options.onAction('increaseCoastHorizon')
        syncState()
      },
      onIncreaseDesktopEdgePanSpeed: () => setDesktopEdgePanSpeed(1),
      onMenuButtonClick: () => {
        setOpen(!open)
      },
      onOpenUiSettings: () => {
        setOpen(false)
        options.onOpenUiSettings()
      },
    })
  }

  const syncState = () => {
    if (syncRenderState()) {
      renderMenu()
    }
  }

  const setOpen = (nextOpen: boolean) => {
    if (open === nextOpen) {
      return
    }

    open = nextOpen
    syncRenderState()
    renderMenu()
  }

  syncRenderState()
  renderMenu()
  const root = surface.element
  const button = root.querySelector<HTMLButtonElement>(
    '.in-game-controls-menu-button',
  )
  if (!button) {
    throw new Error('Failed to create in-game controls menu')
  }

  document.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Node && !root.contains(event.target)) {
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

  return {
    close: () => setOpen(false),
    element: root,
    isOpen: () => open,
    syncState,
  }
}
