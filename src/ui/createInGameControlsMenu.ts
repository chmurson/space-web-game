import type { UIUserAction } from '../input/uiUserActions'
import type {
  CameraFollowSubject,
  CameraViewMode,
} from '../scenario/scenarioDirectiveTypes'
import {
  getCameraFollowAction,
  getCameraViewAction,
} from './cameraControlActions'
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
  getCameraControlsLocked: () => boolean
  getCameraFollow: () => CameraFollowSubject
  getCameraView: () => CameraViewMode
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

  let cameraControlsLocked = options.getCameraControlsLocked()
  let cameraFollow = options.getCameraFollow()
  let cameraView = options.getCameraView()
  let coastHorizonLabel = ''
  let decreaseCoastHorizonDisabled = false
  let increaseCoastHorizonDisabled = false
  let open = false

  const syncRenderState = () => {
    const nextCameraControlsLocked = options.getCameraControlsLocked()
    const nextCameraFollow = options.getCameraFollow()
    const nextCameraView = options.getCameraView()
    const coastPredictionHorizonHours = options.getCoastPredictionHorizonHours()
    const nextCoastHorizonLabel = formatTrajectoryHorizonDuration(
      coastPredictionHorizonHours * 60 * 60,
    )
    const nextDecreaseCoastHorizonDisabled =
      coastPredictionHorizonHours <= options.getMinCoastPredictionHorizonHours()
    const nextIncreaseCoastHorizonDisabled =
      coastPredictionHorizonHours >= options.getMaxCoastPredictionHorizonHours()
    const changed =
      nextCameraControlsLocked !== cameraControlsLocked ||
      nextCameraFollow !== cameraFollow ||
      nextCameraView !== cameraView ||
      nextCoastHorizonLabel !== coastHorizonLabel ||
      nextDecreaseCoastHorizonDisabled !== decreaseCoastHorizonDisabled ||
      nextIncreaseCoastHorizonDisabled !== increaseCoastHorizonDisabled

    cameraControlsLocked = nextCameraControlsLocked
    cameraFollow = nextCameraFollow
    cameraView = nextCameraView
    coastHorizonLabel = nextCoastHorizonLabel
    decreaseCoastHorizonDisabled = nextDecreaseCoastHorizonDisabled
    increaseCoastHorizonDisabled = nextIncreaseCoastHorizonDisabled

    return changed
  }

  const renderMenu = () => {
    surface.render({
      cameraControlsLocked,
      cameraFollow,
      cameraView,
      coastHorizonLabel,
      decreaseCoastHorizonDisabled,
      increaseCoastHorizonDisabled,
      menuId,
      open,
      onCameraFollowSelect: (follow) => {
        options.onAction(getCameraFollowAction(follow))
        syncState()
      },
      onCameraViewSelect: (view) => {
        options.onAction(getCameraViewAction(view))
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
