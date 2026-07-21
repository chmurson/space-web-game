import { afterEach, describe, expect, it, vi } from 'vitest'

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
    dispatch: (
      type: string,
      code: string,
      init: Partial<
        Pick<
          KeyboardEvent,
          'ctrlKey' | 'repeat' | 'shiftKey' | 'target' | 'timeStamp'
        >
      > = {},
    ) => {
      const event = {
        code,
        ctrlKey: init.ctrlKey ?? false,
        repeat: init.repeat ?? false,
        shiftKey: init.shiftKey ?? false,
        target: init.target ?? null,
        timeStamp: init.timeStamp ?? 0,
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

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('bindKeyboardShortcuts', () => {
  it('clears held and latched controls when gameplay interactions become disabled', () => {
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

    keyboardTarget.dispatch('keydown', 'KeyW', { timeStamp: 100 })
    expect(keyboardInput.getManualControls().main).toBe(1)
    keyboardTarget.dispatch('keyup', 'KeyW')
    keyboardTarget.dispatch('keydown', 'KeyW', { timeStamp: 220 })
    keyboardTarget.dispatch('keyup', 'KeyW')
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

  it('does not reserve R or clear latched thrust', () => {
    const keyboardInput = createKeyboardInput()
    const keyboardTarget = createKeyboardTarget()
    const handleAction = vi.fn()

    bindKeyboardShortcuts({
      autoDiscoverStrongestInfluence: false,
      getDebugModeEnabled: () => false,
      getInteractionsEnabled: () => true,
      handleAction,
      keyboardInput,
      windowTarget: keyboardTarget,
    })

    keyboardTarget.dispatch('keydown', 'ArrowUp', { timeStamp: 100 })
    keyboardTarget.dispatch('keyup', 'ArrowUp')
    keyboardTarget.dispatch('keydown', 'ArrowUp', { timeStamp: 220 })
    keyboardTarget.dispatch('keyup', 'ArrowUp')
    expect(keyboardInput.getManualControls().main).toBe(1)

    keyboardTarget.dispatch('keydown', 'KeyR', { timeStamp: 500 })

    expect(handleAction).not.toHaveBeenCalled()
    expect(keyboardInput.getManualControls().main).toBe(1)
  })

  it('lets the desktop target selector consume plain T before runtime actions', () => {
    const keyboardInput = createKeyboardInput()
    const keyboardTarget = createKeyboardTarget()
    const handleAction = vi.fn()
    const handleTargetSelectorShortcut = vi.fn(() => true)

    bindKeyboardShortcuts({
      autoDiscoverStrongestInfluence: true,
      getDebugModeEnabled: () => false,
      getInteractionsEnabled: () => true,
      handleAction,
      handleTargetSelectorShortcut,
      keyboardInput,
      windowTarget: keyboardTarget,
    })

    keyboardTarget.dispatch('keydown', 'KeyT')

    expect(handleTargetSelectorShortcut).toHaveBeenCalledTimes(1)
    expect(handleAction).not.toHaveBeenCalled()
  })

  it('falls back to the existing target shortcut when desktop selector is unavailable', () => {
    const keyboardInput = createKeyboardInput()
    const keyboardTarget = createKeyboardTarget()
    const handleAction = vi.fn()

    bindKeyboardShortcuts({
      autoDiscoverStrongestInfluence: false,
      getDebugModeEnabled: () => false,
      getInteractionsEnabled: () => true,
      handleAction,
      handleTargetSelectorShortcut: () => false,
      keyboardInput,
      windowTarget: keyboardTarget,
    })

    keyboardTarget.dispatch('keydown', 'KeyT')

    expect(handleAction).toHaveBeenCalledWith('cycleAssistTarget')
  })

  it('ignores gameplay input while an editable element owns the keyboard', () => {
    const keyboardInput = createKeyboardInput()
    const keyboardTarget = createKeyboardTarget()
    const handleAction = vi.fn()
    const handleTargetSelectorShortcut = vi.fn(() => true)

    bindKeyboardShortcuts({
      autoDiscoverStrongestInfluence: true,
      getDebugModeEnabled: () => true,
      getInteractionsEnabled: () => true,
      handleAction,
      handleTargetSelectorShortcut,
      keyboardInput,
      windowTarget: keyboardTarget,
    })

    for (const [code, target] of [
      ['KeyR', { tagName: 'INPUT' }],
      ['Digit1', { tagName: 'TEXTAREA' }],
      ['Digit2', { tagName: 'SELECT' }],
      ['KeyC', { isContentEditable: true, tagName: 'DIV' }],
    ]) {
      keyboardTarget.dispatch('keydown', code as string, {
        target: target as unknown as EventTarget,
      })
    }

    vi.stubGlobal('document', {
      activeElement: { tagName: 'INPUT' },
    })
    keyboardTarget.dispatch('keydown', 'KeyT')
    keyboardTarget.dispatch('keydown', 'KeyW')

    expect(handleAction).not.toHaveBeenCalled()
    expect(handleTargetSelectorShortcut).not.toHaveBeenCalled()
    expect(keyboardInput.getManualControls().main).toBe(0)
  })
})
