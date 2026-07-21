import type { UIUserAction } from './uiUserActions'

export type KeyboardShortcutContext = {
  autoDiscoverStrongestInfluence: boolean
  debugModeEnabled: boolean
}

type KeyboardShortcutEvent = Pick<
  KeyboardEvent,
  'code' | 'ctrlKey' | 'repeat' | 'shiftKey'
>

export const getKeyboardShortcutAction = (
  event: KeyboardShortcutEvent,
  context: KeyboardShortcutContext,
): UIUserAction | null => {
  if (event.shiftKey && event.code === 'BracketRight') {
    return event.repeat ? null : 'increaseCoastHorizon'
  }
  if (event.shiftKey && event.code === 'BracketLeft') {
    return event.repeat ? null : 'decreaseCoastHorizon'
  }
  if (event.code === 'BracketRight') {
    return 'increaseTimeWarp'
  }
  if (event.code === 'BracketLeft') {
    return 'decreaseTimeWarp'
  }
  if (event.code === 'KeyR') {
    return 'resetScenario'
  }
  if (
    !event.repeat &&
    !context.autoDiscoverStrongestInfluence &&
    event.code === 'KeyT'
  ) {
    return 'cycleAssistTarget'
  }
  if (!event.repeat && event.shiftKey && event.code === 'KeyC') {
    return 'cycleAssistMode'
  }
  if (!event.repeat && event.code === 'KeyC') {
    return 'toggleCameraFollow'
  }
  if (!event.repeat && event.ctrlKey && event.code === 'KeyX') {
    return 'toggleDebugMode'
  }
  if (!event.repeat && context.debugModeEnabled && event.code === 'Digit1') {
    return 'toggleNoGravityDebug'
  }
  if (!event.repeat && context.debugModeEnabled && event.code === 'Digit2') {
    return 'toggleFpsIndicator'
  }
  if (!event.repeat && context.debugModeEnabled && event.code === 'Digit4') {
    return 'decreaseCoastHorizon'
  }
  if (!event.repeat && context.debugModeEnabled && event.code === 'Digit5') {
    return 'increaseCoastHorizon'
  }
  if (!event.repeat && context.debugModeEnabled && event.code === 'Digit6') {
    return 'saveDebugSnapshot'
  }
  if (!event.repeat && context.debugModeEnabled && event.code === 'Digit7') {
    return 'loadDebugSnapshot'
  }
  if (event.code === 'Equal' || event.code === 'NumpadAdd') {
    return 'zoomIn'
  }
  if (event.code === 'Minus' || event.code === 'NumpadSubtract') {
    return 'zoomOut'
  }
  if (event.code === 'Enter' || event.code === 'Space') {
    return 'promptConfirm'
  }

  return null
}
