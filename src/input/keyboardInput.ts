import type { ControlInput } from '../simulation/types'

export type VirtualControlKey =
  | 'main'
  | 'reverse'
  | 'strafeLeft'
  | 'strafeRight'
  | 'turnLeft'
  | 'turnRight'

export type KeyboardInput = {
  clear(): void
  getManualControls(): ControlInput
  hasManualTurn(): boolean
  press(code: string): void
  release(code: string): void
  setVirtualKey(control: VirtualControlKey, pressed: boolean): void
}

const mainThrustKeys = ['KeyW', 'ArrowUp']
const reverseThrustKeys = ['KeyS', 'ArrowDown']
const turnLeftKeys = ['KeyA', 'ArrowLeft']
const turnRightKeys = ['KeyD', 'ArrowRight']
const turnKeys = [...turnLeftKeys, ...turnRightKeys]

const hasAny = (pressedKeys: Set<string>, codes: string[]) =>
  codes.some((code) => pressedKeys.has(code))

export const createKeyboardInput = (): KeyboardInput => {
  const pressedKeys = new Set<string>()
  const virtualControls: Record<VirtualControlKey, boolean> = {
    main: false,
    reverse: false,
    strafeLeft: false,
    strafeRight: false,
    turnLeft: false,
    turnRight: false,
  }

  return {
    clear: () => {
      pressedKeys.clear()
      for (const control of Object.keys(
        virtualControls,
      ) as VirtualControlKey[]) {
        virtualControls[control] = false
      }
    },
    getManualControls: () => ({
      main: hasAny(pressedKeys, mainThrustKeys) || virtualControls.main ? 1 : 0,
      reverse:
        hasAny(pressedKeys, reverseThrustKeys) || virtualControls.reverse
          ? 1
          : 0,
      strafe:
        (pressedKeys.has('KeyQ') || virtualControls.strafeLeft ? -1 : 0) +
        (pressedKeys.has('KeyE') || virtualControls.strafeRight ? 1 : 0),
      turn:
        (hasAny(pressedKeys, turnLeftKeys) || virtualControls.turnLeft
          ? 1
          : 0) +
        (hasAny(pressedKeys, turnRightKeys) || virtualControls.turnRight
          ? -1
          : 0),
    }),
    hasManualTurn: () =>
      hasAny(pressedKeys, turnKeys) ||
      virtualControls.turnLeft ||
      virtualControls.turnRight,
    press: (code) => {
      pressedKeys.add(code)
    },
    release: (code) => {
      pressedKeys.delete(code)
    },
    setVirtualKey: (control, pressed) => {
      virtualControls[control] = pressed
    },
  }
}
