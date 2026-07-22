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
  press(code: string, options?: { timeStampMs?: number }): void
  release(code: string): void
  setVirtualKey(control: VirtualControlKey, pressed: boolean): void
  setVirtualTurn(turn: number): void
}

const mainThrustKeys = ['KeyW', 'ArrowUp']
const reverseThrustKeys = ['KeyS', 'ArrowDown']
const turnLeftKeys = ['KeyA', 'ArrowLeft']
const turnRightKeys = ['KeyD', 'ArrowRight']
const preciseTurnModifierKeys = ['ShiftLeft', 'ShiftRight']
const mainThrustLatchDoubleTapMs = 300
const preciseTurnTravel = 0.25
const rcsTurnDeadZone = 1 / 8
const rcsTurnExponent = 2

const hasAny = (pressedKeys: Set<string>, codes: string[]) =>
  codes.some((code) => pressedKeys.has(code))
const isMainThrustKey = (code: string) => mainThrustKeys.includes(code)
const isReverseThrustKey = (code: string) => reverseThrustKeys.includes(code)
const getInputTimeStampMs = () =>
  typeof performance === 'undefined' ? Date.now() : performance.now()
const sanitizeTurn = (turn: number) => {
  if (!Number.isFinite(turn)) {
    return 0
  }

  const clamped = Math.min(1, Math.max(-1, turn))
  return Math.abs(clamped) < 0.001 ? 0 : clamped
}
const applyRcsTurnResponse = (turn: number) => {
  const clampedTurn = sanitizeTurn(turn)
  const magnitude = Math.abs(clampedTurn)

  if (magnitude <= rcsTurnDeadZone) {
    return 0
  }

  const normalizedTravel = (magnitude - rcsTurnDeadZone) / (1 - rcsTurnDeadZone)
  return Math.sign(clampedTurn) * normalizedTravel ** rcsTurnExponent
}

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
  let virtualTurn = 0
  let mainThrustLatched = false
  let lastMainThrustTap: { code: string; timeStampMs: number } | null = null

  const clearMainThrustLatch = () => {
    mainThrustLatched = false
    lastMainThrustTap = null
  }

  const getKeyboardTurn = () => {
    const power = hasAny(pressedKeys, preciseTurnModifierKeys)
      ? preciseTurnTravel
      : 1

    return (
      (hasAny(pressedKeys, turnLeftKeys) ? -power : 0) +
      (hasAny(pressedKeys, turnRightKeys) ? power : 0)
    )
  }
  const getManualTurn = () =>
    applyRcsTurnResponse(
      virtualTurn +
        getKeyboardTurn() +
        (virtualControls.turnLeft ? 1 : 0) +
        (virtualControls.turnRight ? -1 : 0),
    )

  return {
    clear: () => {
      pressedKeys.clear()
      for (const control of Object.keys(
        virtualControls,
      ) as VirtualControlKey[]) {
        virtualControls[control] = false
      }
      virtualTurn = 0
      clearMainThrustLatch()
    },
    getManualControls: () => ({
      main:
        hasAny(pressedKeys, mainThrustKeys) ||
        mainThrustLatched ||
        virtualControls.main
          ? 1
          : 0,
      reverse:
        hasAny(pressedKeys, reverseThrustKeys) || virtualControls.reverse
          ? 1
          : 0,
      strafe:
        (pressedKeys.has('KeyQ') || virtualControls.strafeLeft ? -1 : 0) +
        (pressedKeys.has('KeyE') || virtualControls.strafeRight ? 1 : 0),
      turn: getManualTurn(),
    }),
    hasManualTurn: () => getManualTurn() !== 0,
    press: (code, options) => {
      if (pressedKeys.has(code)) {
        return
      }

      if (isReverseThrustKey(code)) {
        clearMainThrustLatch()
      }

      if (isMainThrustKey(code)) {
        const timeStampMs = options?.timeStampMs ?? getInputTimeStampMs()

        if (mainThrustLatched) {
          clearMainThrustLatch()
        } else if (
          lastMainThrustTap?.code === code &&
          timeStampMs >= lastMainThrustTap.timeStampMs &&
          timeStampMs - lastMainThrustTap.timeStampMs <=
            mainThrustLatchDoubleTapMs
        ) {
          mainThrustLatched = true
          lastMainThrustTap = null
        } else {
          lastMainThrustTap = { code, timeStampMs }
        }
      }

      pressedKeys.add(code)
    },
    release: (code) => {
      pressedKeys.delete(code)
    },
    setVirtualKey: (control, pressed) => {
      virtualControls[control] = pressed
    },
    setVirtualTurn: (turn) => {
      virtualTurn = sanitizeTurn(turn)
    },
  }
}
