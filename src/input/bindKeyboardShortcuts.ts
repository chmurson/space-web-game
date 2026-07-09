import type { KeyboardInput } from './keyboardInput'
import { getKeyboardShortcutAction } from './keyboardShortcuts'
import type { UIUserAction } from './uiUserActions'

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
    if (!options.getInteractionsEnabled()) {
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
      if (shortcutAction === 'resetScenario') {
        options.keyboardInput.clear()
      }
    }
  })

  options.windowTarget.addEventListener('keyup', (event) => {
    options.keyboardInput.release(event.code)
  })
}
