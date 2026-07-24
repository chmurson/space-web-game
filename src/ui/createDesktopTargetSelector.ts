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

const desktopTargetSelectorQuery = '(hover: hover) and (pointer: fine)'

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
  const desktopTargetSelectorMedia = window.matchMedia(
    desktopTargetSelectorQuery,
  )
  let available = true
  let open = false
  const isSelectorAvailable = () =>
    available && desktopTargetSelectorMedia.matches

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
    const selectorAvailable = isSelectorAvailable()
    if (!selectorAvailable) {
      open = false
    }

    options.button.hidden = !selectorAvailable
    options.button.parentElement?.classList.toggle(
      'desktop-target-selector-available',
      selectorAvailable,
    )
    options.button.setAttribute('aria-expanded', String(open))
    options.button.classList.toggle('desktop-target-selector-button-open', open)
    options.popover.hidden = !open
  }

  const setOpen = (nextOpen: boolean) => {
    open = isSelectorAvailable() && nextOpen
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

  desktopTargetSelectorMedia.addEventListener('change', syncState)
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
    syncUi: () => {
      if (open) {
        targetControl.syncUi()
      }
    },
    toggleFromShortcut: () => {
      if (!isSelectorAvailable()) {
        return false
      }
      setOpen(!open)
      return true
    },
  }
}
