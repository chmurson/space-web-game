import type { UIUserAction } from '../input/uiUserActions'
import type { CameraControlMode } from '../scenario/scenarioDirectiveTypes'
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
  const surface = createPreactUiSurface<InGameControlsMenuRenderProps>({
    app: options.app,
    component: InGameControlsMenuSurface,
    missingRootError: 'Failed to create in-game controls menu',
  })

  let cameraMode = options.getCameraMode()
  let cameraModeChangesLocked = options.getCameraModeChangesLocked()
  let coastHorizonLabel = ''
  let decreaseCoastHorizonDisabled = false
  let increaseCoastHorizonDisabled = false
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
    const changed =
      nextCameraMode !== cameraMode ||
      nextCameraModeChangesLocked !== cameraModeChangesLocked ||
      nextCoastHorizonLabel !== coastHorizonLabel ||
      nextDecreaseCoastHorizonDisabled !== decreaseCoastHorizonDisabled ||
      nextIncreaseCoastHorizonDisabled !== increaseCoastHorizonDisabled

    cameraMode = nextCameraMode
    cameraModeChangesLocked = nextCameraModeChangesLocked
    coastHorizonLabel = nextCoastHorizonLabel
    decreaseCoastHorizonDisabled = nextDecreaseCoastHorizonDisabled
    increaseCoastHorizonDisabled = nextIncreaseCoastHorizonDisabled

    return changed
  }

  const renderMenu = () => {
    surface.render({
      cameraMode,
      cameraModeChangesLocked,
      coastHorizonLabel,
      decreaseCoastHorizonDisabled,
      increaseCoastHorizonDisabled,
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
      onIncreaseCoastHorizon: () => {
        options.onAction('increaseCoastHorizon')
        syncState()
      },
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
