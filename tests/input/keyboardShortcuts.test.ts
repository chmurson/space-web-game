import { describe, expect, it } from 'vitest'

import { getKeyboardShortcutAction } from '@/input/keyboardShortcuts'

const createDebugShortcutEvent = (code: string) => ({
  code,
  ctrlKey: false,
  repeat: false,
  shiftKey: false,
})

describe('getKeyboardShortcutAction', () => {
  it('keeps plain bracket shortcuts mapped to time warp', () => {
    expect(
      getKeyboardShortcutAction(createDebugShortcutEvent('BracketLeft'), {
        autoDiscoverStrongestInfluence: false,
        debugModeEnabled: false,
      }),
    ).toBe('decreaseTimeWarp')
    expect(
      getKeyboardShortcutAction(createDebugShortcutEvent('BracketRight'), {
        autoDiscoverStrongestInfluence: false,
        debugModeEnabled: false,
      }),
    ).toBe('increaseTimeWarp')
  })

  it('maps Shift bracket shortcuts to trajectory horizon outside debug mode', () => {
    expect(
      getKeyboardShortcutAction(
        {
          ...createDebugShortcutEvent('BracketLeft'),
          shiftKey: true,
        },
        {
          autoDiscoverStrongestInfluence: false,
          debugModeEnabled: false,
        },
      ),
    ).toBe('decreaseCoastHorizon')
    expect(
      getKeyboardShortcutAction(
        {
          ...createDebugShortcutEvent('BracketRight'),
          shiftKey: true,
        },
        {
          autoDiscoverStrongestInfluence: false,
          debugModeEnabled: false,
        },
      ),
    ).toBe('increaseCoastHorizon')
  })

  it('does not fall through repeated Shift bracket shortcuts to time warp', () => {
    expect(
      getKeyboardShortcutAction(
        {
          ...createDebugShortcutEvent('BracketRight'),
          repeat: true,
          shiftKey: true,
        },
        {
          autoDiscoverStrongestInfluence: false,
          debugModeEnabled: false,
        },
      ),
    ).toBeNull()
  })

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

  it('maps C to Follow, maps Shift+C to Recenter, and leaves L and R unreserved', () => {
    expect(
      getKeyboardShortcutAction(createDebugShortcutEvent('KeyC'), {
        autoDiscoverStrongestInfluence: false,
        debugModeEnabled: false,
      }),
    ).toBe('toggleCameraFollow')
    expect(
      getKeyboardShortcutAction(
        { ...createDebugShortcutEvent('KeyC'), repeat: true },
        {
          autoDiscoverStrongestInfluence: false,
          debugModeEnabled: false,
        },
      ),
    ).toBeNull()
    expect(
      getKeyboardShortcutAction(createDebugShortcutEvent('KeyL'), {
        autoDiscoverStrongestInfluence: false,
        debugModeEnabled: false,
      }),
    ).toBeNull()
    expect(
      getKeyboardShortcutAction(createDebugShortcutEvent('KeyR'), {
        autoDiscoverStrongestInfluence: false,
        debugModeEnabled: false,
      }),
    ).toBeNull()
    expect(
      getKeyboardShortcutAction(
        { ...createDebugShortcutEvent('KeyL'), repeat: true },
        {
          autoDiscoverStrongestInfluence: false,
          debugModeEnabled: false,
        },
      ),
    ).toBeNull()
    expect(
      getKeyboardShortcutAction(
        { ...createDebugShortcutEvent('KeyC'), shiftKey: true },
        {
          autoDiscoverStrongestInfluence: false,
          debugModeEnabled: false,
        },
      ),
    ).toBe('recenterCamera')
    expect(
      getKeyboardShortcutAction(
        { ...createDebugShortcutEvent('KeyC'), repeat: true, shiftKey: true },
        {
          autoDiscoverStrongestInfluence: false,
          debugModeEnabled: false,
        },
      ),
    ).toBeNull()
  })

  it('maps T to target cycling when automatic target discovery is disabled', () => {
    expect(
      getKeyboardShortcutAction(createDebugShortcutEvent('KeyT'), {
        autoDiscoverStrongestInfluence: false,
        debugModeEnabled: false,
      }),
    ).toBe('cycleAssistTarget')
    expect(
      getKeyboardShortcutAction(createDebugShortcutEvent('KeyT'), {
        autoDiscoverStrongestInfluence: true,
        debugModeEnabled: false,
      }),
    ).toBeNull()
    expect(
      getKeyboardShortcutAction(
        { ...createDebugShortcutEvent('KeyT'), repeat: true },
        {
          autoDiscoverStrongestInfluence: false,
          debugModeEnabled: false,
        },
      ),
    ).toBeNull()
  })
})
