import { describe, expect, it } from 'vitest'

import { getKeyboardShortcutAction } from '@/input/keyboardShortcuts'

const createDebugShortcutEvent = (code: string) => ({
  code,
  ctrlKey: false,
  repeat: false,
})

describe('getKeyboardShortcutAction', () => {
  it('does not reserve the old performance debug shortcut', () => {
    expect(
      getKeyboardShortcutAction(createDebugShortcutEvent('Digit3'), {
        autoDiscoverStrongestInfluence: false,
        debugModeEnabled: true,
      }),
    ).toBeNull()
  })

  it('keeps the FPS meter debug shortcut', () => {
    expect(
      getKeyboardShortcutAction(createDebugShortcutEvent('Digit2'), {
        autoDiscoverStrongestInfluence: false,
        debugModeEnabled: true,
      }),
    ).toBe('toggleFpsIndicator')
  })
})
