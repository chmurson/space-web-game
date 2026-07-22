import type { KeyboardInput } from './keyboardInput'
import { getKeyboardShortcutAction } from './keyboardShortcuts'
import type { UIUserAction } from './uiUserActions'

const isEditableKeyboardTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null
  return (
    element?.isContentEditable === true ||
    element?.tagName === 'INPUT' ||
    element?.tagName === 'TEXTAREA' ||
    element?.tagName === 'SELECT'
  )
}

export const bindKeyboardShortcuts = (options: {
  autoDiscoverStrongestInfluence: boolean
  getDebugModeEnabled(): boolean
  getInteractionsEnabled(): boolean
  handleTargetSelectorShortcut?(): boolean
  handleAction(action: UIUserAction): void
  keyboardInput: KeyboardInput
  windowTarget: Pick<Window, 'addEventListener'>
}) => {
  options.windowTarget.addEventListener('keydown', (event) => {
    const editableElementFocused =
      typeof document !== 'undefined' &&
      isEditableKeyboardTarget(document.activeElement)
    if (
      !options.getInteractionsEnabled() ||
      editableElementFocused ||
      isEditableKeyboardTarget(event.target)
    ) {
      options.keyboardInput.clear()
      return
    }

    options.keyboardInput.press(event.code, { timeStampMs: event.timeStamp })

    if (
      !event.repeat &&
      event.code === 'KeyT' &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      options.handleTargetSelectorShortcut?.()
    ) {
      return
    }

    const shortcutAction = getKeyboardShortcutAction(event, {
      autoDiscoverStrongestInfluence: options.autoDiscoverStrongestInfluence,
      debugModeEnabled: options.getDebugModeEnabled(),
    })

    if (shortcutAction) {
      options.handleAction(shortcutAction)
    }
  })

  options.windowTarget.addEventListener('keyup', (event) => {
    options.keyboardInput.release(event.code)
  })
}
