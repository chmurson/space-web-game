import type {
  TouchControlSide,
  TouchTrajectoryControlState,
} from '../userSettingsStorage'
import {
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

let nextUiSettingsDialogId = 0
let activeDialogClose: ((restoreFocus?: boolean) => void) | null = null

export const createUiSettingsDialog = (options: {
  app: HTMLElement
  getTouchBurnControlSide: () => TouchControlSide
  getTouchTargetControlSide: () => TouchControlSide
  getTouchTrajectoryControlSide: () => TouchTrajectoryControlState
  getTouchWarpControlSide: () => TouchControlSide
  onOpenChange?: (open: boolean) => void
  onTouchBurnControlSideChange(side: TouchControlSide): void
  onTouchTargetControlSideChange(side: TouchControlSide): void
  onTouchTrajectoryControlSideChange(side: TouchTrajectoryControlState): void
  onTouchWarpControlSideChange(side: TouchControlSide): void
}): UiSettingsDialog => {
  const dialogId = `app-dialog-${++nextUiSettingsDialogId}`
  const surface = createPreactUiSurface<UiSettingsDialogRenderProps>({
    app: options.app,
    component: UiSettingsDialogSurface,
    missingRootError: 'Failed to create UI settings dialog',
  })

  let open = false
  let lastFocusedElement: HTMLElement | null = null

  const renderDialog = () => {
    surface.render({
      dialogId,
      open,
      touchBurnControlSide: options.getTouchBurnControlSide(),
      touchTargetControlSide: options.getTouchTargetControlSide(),
      touchTrajectoryControlSide: options.getTouchTrajectoryControlSide(),
      touchWarpControlSide: options.getTouchWarpControlSide(),
      onTouchBurnControlSideChange: (side) => {
        options.onTouchBurnControlSideChange(side)
        syncState()
      },
      onTouchTargetControlSideChange: (side) => {
        options.onTouchTargetControlSideChange(side)
        syncState()
      },
      onTouchTrajectoryControlSideChange: (side) => {
        options.onTouchTrajectoryControlSideChange(side)
        syncState()
      },
      onTouchWarpControlSideChange: (side) => {
        options.onTouchWarpControlSideChange(side)
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
      open = true
      renderDialog()
      options.onOpenChange?.(true)
    }

    activeDialogClose = close
    const focusTarget = getFocusableElements()[0] ?? getPanel()
    focusTarget.focus()
  }

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
