import { describe, expect, it } from 'vitest'

import { createKeyboardInput } from '@/input/keyboardInput'

describe('createKeyboardInput', () => {
  it('keeps held main thrust momentary without the latch', () => {
    const keyboardInput = createKeyboardInput()

    keyboardInput.press('KeyW', { timeStampMs: 100 })
    expect(keyboardInput.getManualControls().main).toBe(1)

    keyboardInput.release('KeyW')
    expect(keyboardInput.getManualControls().main).toBe(0)
  })

  it('latches main thrust after a double tap and cancels on the thrust key', () => {
    const keyboardInput = createKeyboardInput()

    keyboardInput.press('KeyW', { timeStampMs: 100 })
    keyboardInput.release('KeyW')
    keyboardInput.press('KeyW', { timeStampMs: 260 })
    keyboardInput.release('KeyW')

    expect(keyboardInput.getManualControls().main).toBe(1)

    keyboardInput.press('KeyW', { timeStampMs: 620 })
    expect(keyboardInput.getManualControls().main).toBe(1)

    keyboardInput.release('KeyW')
    expect(keyboardInput.getManualControls().main).toBe(0)
  })

  it('supports ArrowUp double-tap latching without latching slow taps', () => {
    const keyboardInput = createKeyboardInput()

    keyboardInput.press('ArrowUp', { timeStampMs: 100 })
    keyboardInput.release('ArrowUp')
    keyboardInput.press('ArrowUp', { timeStampMs: 460 })
    keyboardInput.release('ArrowUp')

    expect(keyboardInput.getManualControls().main).toBe(0)

    const freshKeyboardInput = createKeyboardInput()
    freshKeyboardInput.press('ArrowUp', { timeStampMs: 700 })
    freshKeyboardInput.release('ArrowUp')
    freshKeyboardInput.press('ArrowUp', { timeStampMs: 880 })
    freshKeyboardInput.release('ArrowUp')

    expect(freshKeyboardInput.getManualControls().main).toBe(1)
  })

  it('cancels latched main thrust with reverse thrust and clear', () => {
    const keyboardInput = createKeyboardInput()

    keyboardInput.press('KeyW', { timeStampMs: 100 })
    keyboardInput.release('KeyW')
    keyboardInput.press('KeyW', { timeStampMs: 220 })
    keyboardInput.release('KeyW')

    keyboardInput.press('KeyS')
    expect(keyboardInput.getManualControls()).toMatchObject({
      main: 0,
      reverse: 1,
    })

    keyboardInput.release('KeyS')
    keyboardInput.press('ArrowUp', { timeStampMs: 500 })
    keyboardInput.release('ArrowUp')
    keyboardInput.press('ArrowUp', { timeStampMs: 620 })
    keyboardInput.release('ArrowUp')
    keyboardInput.clear()

    expect(keyboardInput.getManualControls().main).toBe(0)
  })

  it('turns at full power with left and right arrow keys', () => {
    const keyboardInput = createKeyboardInput()

    keyboardInput.press('KeyA')
    expect(keyboardInput.getManualControls().turn).toBe(0)

    keyboardInput.press('ArrowLeft')
    expect(keyboardInput.getManualControls().turn).toBe(-1)
    expect(keyboardInput.hasManualTurn()).toBe(true)

    keyboardInput.press('ArrowRight')
    expect(keyboardInput.getManualControls().turn).toBe(0)
    expect(keyboardInput.hasManualTurn()).toBe(false)

    keyboardInput.release('ArrowLeft')
    expect(keyboardInput.getManualControls().turn).toBe(1)
    expect(keyboardInput.hasManualTurn()).toBe(true)

    keyboardInput.release('ArrowRight')
    expect(keyboardInput.getManualControls().turn).toBe(0)
    expect(keyboardInput.hasManualTurn()).toBe(false)
  })

  it('uses quarter power while either Shift key is held', () => {
    const keyboardInput = createKeyboardInput()

    keyboardInput.press('ArrowLeft')
    keyboardInput.press('ShiftLeft')
    expect(keyboardInput.getManualControls().turn).toBe(-0.25)

    keyboardInput.release('ShiftLeft')
    expect(keyboardInput.getManualControls().turn).toBe(-1)

    keyboardInput.release('ArrowLeft')
    keyboardInput.press('ShiftRight')
    keyboardInput.press('ArrowRight')
    expect(keyboardInput.getManualControls().turn).toBe(0.25)

    keyboardInput.clear()
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

  it('supports clamped analog virtual turn input and clears it', () => {
    const keyboardInput = createKeyboardInput()

    keyboardInput.setVirtualTurn(0.42)
    expect(keyboardInput.getManualControls().turn).toBe(0.42)
    expect(keyboardInput.hasManualTurn()).toBe(true)

    keyboardInput.setVirtualTurn(2)
    expect(keyboardInput.getManualControls().turn).toBe(1)

    keyboardInput.setVirtualTurn(-2)
    expect(keyboardInput.getManualControls().turn).toBe(-1)

    keyboardInput.setVirtualTurn(Number.NaN)
    expect(keyboardInput.getManualControls().turn).toBe(0)
    expect(keyboardInput.hasManualTurn()).toBe(false)

    keyboardInput.setVirtualTurn(0.5)
    keyboardInput.clear()
    expect(keyboardInput.getManualControls().turn).toBe(0)
    expect(keyboardInput.hasManualTurn()).toBe(false)
  })

  it('combines analog virtual turn with digital virtual turn keys', () => {
    const keyboardInput = createKeyboardInput()

    keyboardInput.setVirtualTurn(0.7)
    keyboardInput.setVirtualKey('turnLeft', true)
    expect(keyboardInput.getManualControls().turn).toBe(1)
    expect(keyboardInput.hasManualTurn()).toBe(true)

    keyboardInput.setVirtualKey('turnLeft', false)
    expect(keyboardInput.getManualControls().turn).toBeCloseTo(0.7)

    keyboardInput.setVirtualKey('turnRight', true)
    expect(keyboardInput.getManualControls().turn).toBeCloseTo(-0.3)

    keyboardInput.setVirtualTurn(-0.7)
    expect(keyboardInput.getManualControls().turn).toBe(-1)

    keyboardInput.setVirtualKey('turnRight', false)
    expect(keyboardInput.getManualControls().turn).toBeCloseTo(-0.7)

    keyboardInput.clear()
    expect(keyboardInput.getManualControls().turn).toBe(0)
    expect(keyboardInput.hasManualTurn()).toBe(false)
  })
})
