import type {
  DesktopCameraPanMode,
  DesktopEdgePanSpeed,
  DesktopWheelPanSpeed,
  OrbitPointDisplaySettings,
} from '../userSettingsStorage'
import {
  type UiSettingsDialogPane,
  UiSettingsDialogSurface,
  type UiSettingsDialogSurfaceProps,
} from './components/UiSettingsDialogSurface'
import { createPreactUiSurface } from './createPreactUiSurface'

export type UiSettingsDialog = {
  close: (restoreFocus?: boolean) => void
  element: HTMLElement
  open: () => void
  syncState: () => void
}

type UiSettingsDialogRenderProps = Omit<UiSettingsDialogSurfaceProps, 'rootRef'>

type DesktopPanSpeed = DesktopEdgePanSpeed | DesktopWheelPanSpeed

const desktopPanSpeedOptions = [
  { label: 'Slow', value: 'slow' },
  { label: 'Normal', value: 'normal' },
  { label: 'Fast', value: 'fast' },
] satisfies Array<{
  label: string
  value: DesktopPanSpeed
}>

const getDesktopPanSpeedOptionIndex = (speed: DesktopPanSpeed) =>
  Math.max(
    0,
    desktopPanSpeedOptions.findIndex((option) => option.value === speed),
  )

const getDesktopPanSpeedLabel = (speed: DesktopPanSpeed) =>
  desktopPanSpeedOptions[getDesktopPanSpeedOptionIndex(speed)].label

const getDesktopPanSpeedStep = (speed: DesktopPanSpeed, direction: -1 | 1) => {
  const index = getDesktopPanSpeedOptionIndex(speed)
  return desktopPanSpeedOptions[
    Math.min(desktopPanSpeedOptions.length - 1, Math.max(0, index + direction))
  ].value
}

let nextUiSettingsDialogId = 0
let activeDialogClose: ((restoreFocus?: boolean) => void) | null = null
const touchControlsVisibleQuery = '(hover: none), (pointer: coarse)'

export const createUiSettingsDialog = (options: {
  app: HTMLElement
  getDesktopCameraPanMode: () => DesktopCameraPanMode
  getDesktopCameraPanVisible: () => boolean
  getDesktopEdgePanSpeed: () => DesktopEdgePanSpeed
  getDesktopWheelPanSpeed: () => DesktopWheelPanSpeed
  getMobileManeuverStartByDrag: () => boolean
  getOrbitPointDisplay: () => OrbitPointDisplaySettings
  getTouchControlsVisible?: () => boolean
  onDesktopCameraPanModeChange(mode: DesktopCameraPanMode): void
  onDesktopEdgePanSpeedChange(speed: DesktopEdgePanSpeed): void
  onDesktopWheelPanSpeedChange(speed: DesktopWheelPanSpeed): void
  onMobileManeuverStartByDragChange(startByDrag: boolean): void
  onOrbitPointDisplayChange(settings: OrbitPointDisplaySettings): void
  onOpenChange?: (open: boolean) => void
}): UiSettingsDialog => {
  const dialogId = `app-dialog-${++nextUiSettingsDialogId}`
  const touchControlsVisibleMedia = window.matchMedia(touchControlsVisibleQuery)
  const surface = createPreactUiSurface<UiSettingsDialogRenderProps>({
    app: options.app,
    component: UiSettingsDialogSurface,
    missingRootError: 'Failed to create UI settings dialog',
  })

  let open = false
  let activePane: UiSettingsDialogPane = 'main'
  let lastFocusedElement: HTMLElement | null = null

  const setDesktopPanSpeed = (
    getSpeed: () => DesktopPanSpeed,
    onChange: (speed: DesktopPanSpeed) => void,
    direction: -1 | 1,
  ) => {
    const speed = getSpeed()
    const nextSpeed = getDesktopPanSpeedStep(speed, direction)
    if (nextSpeed === speed) {
      return
    }

    onChange(nextSpeed)
    syncState()
  }

  const renderDialog = () => {
    const desktopCameraPanMode = options.getDesktopCameraPanMode()
    const desktopEdgePanSpeed = options.getDesktopEdgePanSpeed()
    const desktopWheelPanSpeed = options.getDesktopWheelPanSpeed()
    const desktopEdgePanSpeedIndex =
      getDesktopPanSpeedOptionIndex(desktopEdgePanSpeed)
    const desktopWheelPanSpeedIndex =
      getDesktopPanSpeedOptionIndex(desktopWheelPanSpeed)
    const desktopCameraPanVisible = options.getDesktopCameraPanVisible()

    surface.render({
      activePane,
      decreaseDesktopEdgePanSpeedDisabled: desktopEdgePanSpeedIndex <= 0,
      decreaseDesktopWheelPanSpeedDisabled: desktopWheelPanSpeedIndex <= 0,
      desktopCameraPanMode,
      desktopCameraPanVisible,
      desktopEdgePanSpeedLabel: getDesktopPanSpeedLabel(desktopEdgePanSpeed),
      desktopEdgePanSpeedVisible:
        desktopCameraPanVisible && desktopCameraPanMode === 'edge',
      desktopWheelPanSpeedLabel: getDesktopPanSpeedLabel(desktopWheelPanSpeed),
      desktopWheelPanSpeedVisible:
        desktopCameraPanVisible && desktopCameraPanMode === 'wheel',
      dialogId,
      increaseDesktopEdgePanSpeedDisabled:
        desktopEdgePanSpeedIndex >= desktopPanSpeedOptions.length - 1,
      increaseDesktopWheelPanSpeedDisabled:
        desktopWheelPanSpeedIndex >= desktopPanSpeedOptions.length - 1,
      mobileManeuverStartByDrag: options.getMobileManeuverStartByDrag(),
      orbitPointDisplay: options.getOrbitPointDisplay(),
      open,
      touchControlsVisible:
        options.getTouchControlsVisible?.() ??
        touchControlsVisibleMedia.matches,
      onBackToMainSettings: () => {
        activePane = 'main'
        syncState()
        focusFirstElement()
      },
      onDecreaseDesktopEdgePanSpeed: () =>
        setDesktopPanSpeed(
          options.getDesktopEdgePanSpeed,
          options.onDesktopEdgePanSpeedChange,
          -1,
        ),
      onDecreaseDesktopWheelPanSpeed: () =>
        setDesktopPanSpeed(
          options.getDesktopWheelPanSpeed,
          options.onDesktopWheelPanSpeedChange,
          -1,
        ),
      onOpenOrbitPointDisplaySettings: () => {
        activePane = 'orbitPointDisplay'
        syncState()
        focusFirstElement()
      },
      onOpenSpacecraftControlsSettings: () => {
        activePane = 'spacecraftControls'
        syncState()
        focusFirstElement()
      },
      onDesktopCameraPanModeChange: (mode) => {
        options.onDesktopCameraPanModeChange(mode)
        syncState()
      },
      onIncreaseDesktopEdgePanSpeed: () =>
        setDesktopPanSpeed(
          options.getDesktopEdgePanSpeed,
          options.onDesktopEdgePanSpeedChange,
          1,
        ),
      onIncreaseDesktopWheelPanSpeed: () =>
        setDesktopPanSpeed(
          options.getDesktopWheelPanSpeed,
          options.onDesktopWheelPanSpeedChange,
          1,
        ),
      onMobileManeuverStartByDragChange: (startByDrag) => {
        options.onMobileManeuverStartByDragChange(startByDrag)
        syncState()
      },
      onOrbitPointDisplayChange: (settings) => {
        options.onOrbitPointDisplayChange(settings)
        syncState()
      },
    })
  }

  function syncState() {
    renderDialog()
  }

  const getPanel = () => {
    const panel =
      surface.element.querySelector<HTMLElement>('.app-dialog-panel')
    if (!panel) {
      throw new Error('Failed to create UI settings dialog')
    }

    return panel
  }

  const getFocusableElements = () =>
    Array.from(
      getPanel().querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )

  function focusFirstElement() {
    const focusTarget = getFocusableElements()[0] ?? getPanel()
    focusTarget.focus()
  }

  const getRestorableFocusElement = (element: Element | null) => {
    if (!(element instanceof HTMLElement)) {
      return null
    }

    return element.isConnected && !element.closest('[hidden]') ? element : null
  }

  const close = (restoreFocus = true) => {
    if (!open) {
      return
    }

    open = false
    activePane = 'main'
    renderDialog()
    options.onOpenChange?.(false)

    if (activeDialogClose === close) {
      activeDialogClose = null
    }

    const focusTarget = getRestorableFocusElement(lastFocusedElement)
    if (restoreFocus && focusTarget) {
      focusTarget.focus()
    }
    lastFocusedElement = null
  }

  const openDialog = () => {
    if (activeDialogClose && activeDialogClose !== close) {
      activeDialogClose(false)
    }

    syncState()
    if (!open) {
      lastFocusedElement = getRestorableFocusElement(document.activeElement)
      activePane = 'main'
      open = true
      renderDialog()
      options.onOpenChange?.(true)
    }

    activeDialogClose = close
    focusFirstElement()
  }

  touchControlsVisibleMedia.addEventListener('change', syncState)
  renderDialog()
  const root = surface.element

  root.addEventListener('click', (event) => {
    const target = event.target
    if (
      target instanceof HTMLElement &&
      target.closest('[data-dialog-close]')
    ) {
      close()
    }
  })

  document.addEventListener('keydown', (event) => {
    if (!open || activeDialogClose !== close) {
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const focusableElements = getFocusableElements()
    if (focusableElements.length === 0) {
      event.preventDefault()
      getPanel().focus()
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements.at(-1)
    if (!firstElement || !lastElement) {
      return
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
      return
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  })

  return {
    close,
    element: root,
    open: openDialog,
    syncState,
  }
}
