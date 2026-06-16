import { describe, expect, it, vi } from 'vitest'

import { bindKeyboardShortcuts } from '@/input/bindKeyboardShortcuts'
import { createKeyboardInput } from '@/input/keyboardInput'

const createKeyboardTarget = () => {
  const handlers = new Map<string, EventListenerOrEventListenerObject[]>()

  return {
    addEventListener: (
      type: string,
      handler: EventListenerOrEventListenerObject,
    ) => {
      handlers.set(type, [...(handlers.get(type) ?? []), handler])
    },
    dispatch: (type: string, code: string) => {
      const event = {
        code,
        ctrlKey: false,
        repeat: false,
      } as KeyboardEvent

      for (const handler of handlers.get(type) ?? []) {
        if (typeof handler === 'function') {
          handler(event)
        } else {
          handler.handleEvent(event)
        }
      }
    },
  }
}

describe('bindKeyboardShortcuts', () => {
  it('clears held controls when gameplay interactions become disabled', () => {
    const keyboardInput = createKeyboardInput()
    const keyboardTarget = createKeyboardTarget()
    let interactionsEnabled = true

    bindKeyboardShortcuts({
      autoDiscoverStrongestInfluence: false,
      getDebugModeEnabled: () => false,
      getInteractionsEnabled: () => interactionsEnabled,
      handleAction: vi.fn(),
      keyboardInput,
      windowTarget: keyboardTarget,
    })

    keyboardTarget.dispatch('keydown', 'KeyW')
    expect(keyboardInput.getManualControls().main).toBe(1)

    interactionsEnabled = false
    keyboardTarget.dispatch('keydown', 'KeyE')
    expect(keyboardInput.getManualControls()).toEqual({
      main: 0,
      reverse: 0,
      strafe: 0,
      turn: 0,
    })
  })

  it('still releases keys while gameplay interactions are disabled', () => {
    const keyboardInput = createKeyboardInput()
    const keyboardTarget = createKeyboardTarget()
    let interactionsEnabled = true

    bindKeyboardShortcuts({
      autoDiscoverStrongestInfluence: false,
      getDebugModeEnabled: () => false,
      getInteractionsEnabled: () => interactionsEnabled,
      handleAction: vi.fn(),
      keyboardInput,
      windowTarget: keyboardTarget,
    })

    keyboardTarget.dispatch('keydown', 'KeyW')
    interactionsEnabled = false
    keyboardTarget.dispatch('keyup', 'KeyW')
    interactionsEnabled = true

    expect(keyboardInput.getManualControls().main).toBe(0)
  })
})
