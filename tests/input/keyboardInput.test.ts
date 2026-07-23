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

  it('turns at full power with interchangeable A/D and arrow keys', () => {
    const keyboardInput = createKeyboardInput()

    for (const [left, right] of [
      ['KeyA', 'KeyD'],
      ['ArrowLeft', 'ArrowRight'],
    ]) {
      keyboardInput.press(left)
      expect(keyboardInput.getManualControls().turn).toBe(-1)
      expect(keyboardInput.hasManualTurn()).toBe(true)

      keyboardInput.press(right)
      expect(keyboardInput.getManualControls().turn).toBe(0)
      expect(keyboardInput.hasManualTurn()).toBe(false)

      keyboardInput.release(left)
      expect(keyboardInput.getManualControls().turn).toBe(1)
      expect(keyboardInput.hasManualTurn()).toBe(true)

      keyboardInput.release(right)
      expect(keyboardInput.getManualControls().turn).toBe(0)
      expect(keyboardInput.hasManualTurn()).toBe(false)
    }
  })

  it('turns at quarter power while either Shift key is held', () => {
    const keyboardInput = createKeyboardInput()

    keyboardInput.press('KeyA')
    keyboardInput.press('ShiftLeft')
    expect(keyboardInput.getManualControls().turn).toBeCloseTo(-0.25)

    keyboardInput.release('ShiftLeft')
    expect(keyboardInput.getManualControls().turn).toBe(-1)

    keyboardInput.release('KeyA')
    keyboardInput.press('ShiftRight')
    keyboardInput.press('KeyD')
    expect(keyboardInput.getManualControls().turn).toBeCloseTo(0.25)

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

  it('applies a one-eighth dead zone and quadratic response to analog turn', () => {
    const keyboardInput = createKeyboardInput()

    keyboardInput.setVirtualTurn(0.125)
    expect(keyboardInput.getManualControls().turn).toBe(0)
    expect(keyboardInput.hasManualTurn()).toBe(false)

    keyboardInput.setVirtualTurn(-0.125)
    expect(keyboardInput.getManualControls().turn).toBe(0)
    expect(keyboardInput.hasManualTurn()).toBe(false)

    keyboardInput.setVirtualTurn(0.5625)
    expect(keyboardInput.getManualControls().turn).toBeCloseTo(0.25)
    expect(keyboardInput.hasManualTurn()).toBe(true)

    keyboardInput.setVirtualTurn(-0.5625)
    expect(keyboardInput.getManualControls().turn).toBeCloseTo(-0.25)

    keyboardInput.setVirtualTurn(2)
    expect(keyboardInput.getManualControls().turn).toBe(1)

    keyboardInput.setVirtualTurn(-2)
    expect(keyboardInput.getManualControls().turn).toBe(-1)

    keyboardInput.setVirtualTurn(Number.NaN)
    expect(keyboardInput.getManualControls().turn).toBe(0)
    expect(keyboardInput.hasManualTurn()).toBe(false)

    keyboardInput.setVirtualTurn(0.5625)
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
    expect(keyboardInput.getManualControls().turn).toBeCloseTo((23 / 35) ** 2)

    keyboardInput.setVirtualKey('turnRight', true)
    expect(keyboardInput.getManualControls().turn).toBeCloseTo(-0.04)

    keyboardInput.setVirtualTurn(-0.7)
    expect(keyboardInput.getManualControls().turn).toBe(-1)

    keyboardInput.setVirtualKey('turnRight', false)
    expect(keyboardInput.getManualControls().turn).toBeCloseTo(
      -((23 / 35) ** 2),
    )

    keyboardInput.clear()
    expect(keyboardInput.getManualControls().turn).toBe(0)
    expect(keyboardInput.hasManualTurn()).toBe(false)
  })
})
