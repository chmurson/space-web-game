import type {
  DesktopEdgePanSpeed,
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

let nextUiSettingsDialogId = 0
let activeDialogClose: ((restoreFocus?: boolean) => void) | null = null
const touchControlsVisibleQuery = '(hover: none), (pointer: coarse)'

export const createUiSettingsDialog = (options: {
  app: HTMLElement
  getDesktopEdgePanEnabled: () => boolean
  getDesktopEdgePanSpeed: () => DesktopEdgePanSpeed
  getDesktopEdgePanVisible: () => boolean
  getMobileManeuverStartByDrag: () => boolean
  getOrbitPointDisplay: () => OrbitPointDisplaySettings
  getTouchControlsVisible?: () => boolean
  onDesktopEdgePanEnabledChange(enabled: boolean): void
  onDesktopEdgePanSpeedChange(speed: DesktopEdgePanSpeed): void
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

  const setDesktopEdgePanSpeed = (direction: -1 | 1) => {
    const desktopEdgePanSpeed = options.getDesktopEdgePanSpeed()
    const nextSpeed = getDesktopEdgePanSpeedStep(desktopEdgePanSpeed, direction)
    if (nextSpeed === desktopEdgePanSpeed) {
      return
    }

    options.onDesktopEdgePanSpeedChange(nextSpeed)
    syncState()
  }

  const renderDialog = () => {
    const desktopEdgePanEnabled = options.getDesktopEdgePanEnabled()
    const desktopEdgePanSpeed = options.getDesktopEdgePanSpeed()
    const desktopEdgePanSpeedIndex =
      getDesktopEdgePanSpeedOptionIndex(desktopEdgePanSpeed)
    const desktopEdgePanVisible = options.getDesktopEdgePanVisible()

    surface.render({
      activePane,
      decreaseDesktopEdgePanSpeedDisabled: desktopEdgePanSpeedIndex <= 0,
      desktopEdgePanEnabled,
      desktopEdgePanSpeedLabel:
        getDesktopEdgePanSpeedLabel(desktopEdgePanSpeed),
      desktopEdgePanSpeedVisible:
        desktopEdgePanVisible && desktopEdgePanEnabled,
      desktopEdgePanVisible,
      dialogId,
      increaseDesktopEdgePanSpeedDisabled:
        desktopEdgePanSpeedIndex >= desktopEdgePanSpeedOptions.length - 1,
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
      onDecreaseDesktopEdgePanSpeed: () => setDesktopEdgePanSpeed(-1),
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
      onDesktopEdgePanEnabledChange: (enabled) => {
        options.onDesktopEdgePanEnabledChange(enabled)
        syncState()
      },
      onIncreaseDesktopEdgePanSpeed: () => setDesktopEdgePanSpeed(1),
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
