import { describe, expect, it } from 'vitest'

import { createKeyboardInput } from '@/input/keyboardInput'

describe('createKeyboardInput', () => {
  it('does not expose manual turn from left and right keyboard keys', () => {
    const keyboardInput = createKeyboardInput()

    keyboardInput.press('KeyA')
    expect(keyboardInput.getManualControls().turn).toBe(0)

    keyboardInput.press('ArrowRight')
    expect(keyboardInput.getManualControls().turn).toBe(0)
    expect(keyboardInput.hasManualTurn()).toBe(false)
  })

  it('still supports virtual turn input for non-player guidance paths', () => {
    const keyboardInput = createKeyboardInput()

    keyboardInput.setVirtualKey('turnLeft', true)
    expect(keyboardInput.getManualControls().turn).toBe(1)
    expect(keyboardInput.hasManualTurn()).toBe(true)

    keyboardInput.setVirtualKey('turnLeft', false)
    keyboardInput.setVirtualKey('turnRight', true)
    expect(keyboardInput.getManualControls().turn).toBe(-1)
  })
})
