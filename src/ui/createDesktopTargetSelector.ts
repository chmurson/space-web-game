import type { AssistTargetUiState } from '../runtime/gameQueries'
import {
  createTargetControl,
  type TargetControlBodyRow,
} from './touchControls/targetControl/createTargetControl'

export type DesktopTargetSelector = {
  close(): void
  open(): boolean
  setTargetControlVisible(visible: boolean): void
  syncUi(): void
  toggleFromShortcut(): boolean
}

const desktopTargetSelectorQuery = '(min-width: 721px)'

const isDesktopTargetSelectorLayout = () =>
  window.matchMedia(desktopTargetSelectorQuery).matches

export const createDesktopTargetSelector = (options: {
  automaticTargetingAvailable: boolean
  button: HTMLButtonElement
  getRows(): TargetControlBodyRow[]
  getTargetState(): AssistTargetUiState
  onReturnToAutomaticTarget(): boolean
  onSelectTargetIndex(index: number): boolean
  onStateChange?(): void
  popover: HTMLElement
}): DesktopTargetSelector => {
  let available = true
  let open = false

  const targetControl = createTargetControl({
    automaticTargetingAvailable: options.automaticTargetingAvailable,
    getRows: options.getRows,
    getTargetState: options.getTargetState,
    onCommit: () => setOpen(false),
    onReturnToAutomaticTarget: options.onReturnToAutomaticTarget,
    onSelectTargetIndex: options.onSelectTargetIndex,
    onStateChange: options.onStateChange,
  })
  options.popover.id = 'desktop-target-selector-popover'
  options.popover.setAttribute('aria-label', 'Target body selector')
  options.popover.appendChild(targetControl.element)
  options.button.setAttribute('aria-controls', options.popover.id)

  const syncState = () => {
    if (!isDesktopTargetSelectorLayout()) {
      open = false
    }

    options.button.hidden = !available
    options.button.parentElement?.classList.toggle(
      'desktop-target-selector-available',
      available,
    )
    options.button.setAttribute('aria-expanded', String(open))
    options.button.classList.toggle('desktop-target-selector-button-open', open)
    options.popover.hidden = !open
  }

  const setOpen = (nextOpen: boolean) => {
    open = available && isDesktopTargetSelectorLayout() && nextOpen
    syncState()
    if (open) {
      targetControl.syncUi()
    }
  }

  options.button.addEventListener('click', (event) => {
    event.stopPropagation()
    setOpen(!open)
  })

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (
        !open ||
        !(event.target instanceof Node) ||
        options.button.contains(event.target) ||
        options.popover.contains(event.target)
      ) {
        return
      }

      setOpen(false)
    },
    { capture: true },
  )

  document.addEventListener('keydown', (event) => {
    if (open && event.key === 'Escape') {
      setOpen(false)
      options.button.focus()
    }
  })

  window
    .matchMedia(desktopTargetSelectorQuery)
    .addEventListener('change', syncState)
  syncState()

  return {
    close: () => setOpen(false),
    open: () => {
      setOpen(true)
      return open
    },
    setTargetControlVisible: (visible) => {
      available = visible
      if (!available) {
        setOpen(false)
      }
      syncState()
    },
    syncUi: targetControl.syncUi,
    toggleFromShortcut: () => {
      if (!available || !isDesktopTargetSelectorLayout()) {
        return false
      }
      setOpen(!open)
      return true
    },
  }
}
