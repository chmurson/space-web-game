import type { AssistMode } from '../../assist/orbitalAssist'
import type { KeyboardInput } from '../../input/keyboardInput'
import type { UIUserAction } from '../../input/uiUserActions'
import type { ScenarioTouchHintTarget } from '../../scenario/scenarioRegistry'
import './touchControls.css'
import { createTouchControlsTutorialHint } from './touchControlsTutorialHint'

export type TouchControls = {
  element: HTMLElement
  setTutorialHintTarget(target: ScenarioTouchHintTarget | null): void
  updateAssistMode(mode: AssistMode): void
}

const headingStepDistancePx = 24
const headingStepRadians = Math.PI / 56
const doubleTapWindowMs = 320
const tapMoveTolerancePx = 22
const thrustHoldDelayMs = 140
const hapticPulseMs = 12
const pinchZoomMinFactor = 0.86
const pinchZoomMaxFactor = 1.16
const pinchSuppressTapMs = 140
const doubleTapZoomStartPx = 10
const doubleTapZoomMinFactor = 0.9
const doubleTapZoomMaxFactor = 1.12
const singleFingerWarpStepDistancePx = 88

const vibrate = () => {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.vibrate !== 'function'
  ) {
    return
  }

  navigator.vibrate(hapticPulseMs)
}

type TapState = {
  startTime: number
  startX: number
  startY: number
}

type DoubleTapZoomState = {
  lastY: number
  startX: number
  startY: number
  touchId: number
  zooming: boolean
}

type TwoFingerGestureState = {
  lastDistance: number
}

type DragState = {
  horizontalCarry: number
  holdTimer: number | null
  lastX: number
  lastY: number
  startX: number
  startY: number
  thrustActive: boolean
  verticalCarry: number
}

export const createTouchControls = (options: {
  app: HTMLElement
  keyboardInput: KeyboardInput
  nudgeTargetHeading(deltaRadians: number): void
  onAction(action: UIUserAction): void
  onTargetHeadingSelected(screenX: number, screenY: number): void
  onZoom(factor: number): void
}): TouchControls => {
  const panel = document.createElement('section')
  panel.className = 'touch-controls'
  const tutorialHint = createTouchControlsTutorialHint()
  panel.appendChild(tutorialHint.element)

  const tapTouches = new Map<number, TapState>()
  const gesturePointers = new Map<number, DragState>()
  const activeThrustPointers = new Set<number>()
  let pinchSuppressTapUntil = 0
  let doubleTapZoom: DoubleTapZoomState | null = null
  let twoFingerGesture: TwoFingerGestureState | null = null
  let lastTap: {
    time: number
    x: number
    y: number
  } | null = null

  const syncMainThrust = () => {
    options.keyboardInput.setVirtualKey('main', activeThrustPointers.size > 0)
  }

  const clearHoldTimer = (state: DragState) => {
    if (state.holdTimer === null) {
      return
    }

    window.clearTimeout(state.holdTimer)
    state.holdTimer = null
  }

  const cancelAllManualGestures = () => {
    for (const state of gesturePointers.values()) {
      clearHoldTimer(state)
    }
    gesturePointers.clear()
    activeThrustPointers.clear()
    syncMainThrust()
  }

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value))

  const getTouchDistance = (first: Touch, second: Touch) =>
    Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)
  const suppressDefaultTouchBehavior = (event: TouchEvent) => {
    event.preventDefault()
  }

  panel.addEventListener('touchstart', suppressDefaultTouchBehavior, {
    passive: false,
  })
  panel.addEventListener('touchmove', suppressDefaultTouchBehavior, {
    passive: false,
  })
  panel.addEventListener('touchend', suppressDefaultTouchBehavior, {
    passive: false,
  })
  panel.addEventListener('touchcancel', suppressDefaultTouchBehavior, {
    passive: false,
  })

  panel.addEventListener(
    'touchstart',
    (event) => {
      const now = performance.now()
      if (event.touches.length >= 2) {
        cancelAllManualGestures()
        tapTouches.clear()
        lastTap = null
        doubleTapZoom = null
        pinchSuppressTapUntil = now + pinchSuppressTapMs
        twoFingerGesture = {
          lastDistance: getTouchDistance(event.touches[0], event.touches[1]),
        }
      }

      for (const touch of Array.from(event.changedTouches)) {
        const isDoubleTapCandidate =
          event.touches.length === 1 &&
          lastTap &&
          now - lastTap.time <= doubleTapWindowMs &&
          Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y) <=
            tapMoveTolerancePx * 2

        if (isDoubleTapCandidate) {
          cancelAllManualGestures()
          doubleTapZoom = {
            lastY: touch.clientY,
            startX: touch.clientX,
            startY: touch.clientY,
            touchId: touch.identifier,
            zooming: false,
          }
          continue
        }

        tapTouches.set(touch.identifier, {
          startTime: now,
          startX: touch.clientX,
          startY: touch.clientY,
        })
      }
    },
    { passive: false },
  )

  panel.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length < 2) {
        return
      }

      const now = performance.now()
      pinchSuppressTapUntil = now + pinchSuppressTapMs
      cancelAllManualGestures()
      if (!twoFingerGesture) {
        twoFingerGesture = {
          lastDistance: getTouchDistance(event.touches[0], event.touches[1]),
        }
      }

      const distance = getTouchDistance(event.touches[0], event.touches[1])
      const factor = clamp(
        twoFingerGesture.lastDistance / distance,
        pinchZoomMinFactor,
        pinchZoomMaxFactor,
      )
      if (Math.abs(factor - 1) > 0.01) {
        options.onZoom(factor)
      }
      twoFingerGesture.lastDistance = distance
    },
    { passive: false },
  )

  panel.addEventListener(
    'touchmove',
    (event) => {
      if (!doubleTapZoom) {
        return
      }

      const touch = Array.from(event.touches).find(
        (candidate) => candidate.identifier === doubleTapZoom?.touchId,
      )
      if (!touch) {
        return
      }

      const movedY = touch.clientY - doubleTapZoom.startY
      if (!doubleTapZoom.zooming && Math.abs(movedY) >= doubleTapZoomStartPx) {
        doubleTapZoom.zooming = true
        lastTap = null
      }

      if (!doubleTapZoom.zooming) {
        return
      }

      const deltaY = touch.clientY - doubleTapZoom.lastY
      doubleTapZoom.lastY = touch.clientY
      const factor = clamp(
        Math.exp(deltaY * 0.01),
        doubleTapZoomMinFactor,
        doubleTapZoomMaxFactor,
      )
      if (Math.abs(factor - 1) > 0.002) {
        options.onZoom(factor)
      }
    },
    { passive: false },
  )

  panel.addEventListener(
    'touchend',
    (event) => {
      const now = performance.now()
      if (event.touches.length < 2) {
        twoFingerGesture = null
      }
      for (const touch of Array.from(event.changedTouches)) {
        if (doubleTapZoom?.touchId === touch.identifier) {
          const completedZoom = doubleTapZoom.zooming
          const touchX = touch.clientX
          const touchY = touch.clientY
          doubleTapZoom = null
          lastTap = null
          if (!completedZoom) {
            options.onTargetHeadingSelected(touchX, touchY)
            vibrate()
          }
          continue
        }

        const tapState = tapTouches.get(touch.identifier)
        tapTouches.delete(touch.identifier)
        if (!tapState) {
          continue
        }

        if (now < pinchSuppressTapUntil) {
          continue
        }

        const isTap =
          now - tapState.startTime <= doubleTapWindowMs &&
          Math.hypot(
            touch.clientX - tapState.startX,
            touch.clientY - tapState.startY,
          ) <= tapMoveTolerancePx

        if (!isTap) {
          continue
        }

        const isDoubleTap =
          lastTap &&
          now - lastTap.time <= doubleTapWindowMs &&
          Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y) <=
            tapMoveTolerancePx * 2

        if (isDoubleTap) {
          lastTap = null
          options.onTargetHeadingSelected(touch.clientX, touch.clientY)
          vibrate()
          continue
        }

        lastTap = { time: now, x: touch.clientX, y: touch.clientY }
      }
    },
    { passive: false },
  )

  panel.addEventListener(
    'touchcancel',
    (event) => {
      twoFingerGesture = null
      pinchSuppressTapUntil = performance.now() + pinchSuppressTapMs
      cancelAllManualGestures()
      if (
        doubleTapZoom &&
        Array.from(event.changedTouches).some(
          (touch) => touch.identifier === doubleTapZoom?.touchId,
        )
      ) {
        doubleTapZoom = null
      }
      for (const touch of Array.from(event.changedTouches)) {
        tapTouches.delete(touch.identifier)
      }
    },
    { passive: false },
  )

  panel.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') {
      return
    }
    if (twoFingerGesture !== null) {
      return
    }
    if (doubleTapZoom !== null) {
      return
    }

    const state: DragState = {
      horizontalCarry: 0,
      holdTimer: null,
      lastX: event.clientX,
      lastY: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      thrustActive: false,
      verticalCarry: 0,
    }
    state.holdTimer = window.setTimeout(() => {
      state.thrustActive = true
      activeThrustPointers.add(event.pointerId)
      syncMainThrust()
      vibrate()
      state.holdTimer = null
    }, thrustHoldDelayMs)
    gesturePointers.set(event.pointerId, state)
  })

  panel.addEventListener('pointermove', (event) => {
    if (twoFingerGesture !== null) {
      return
    }
    if (doubleTapZoom !== null) {
      return
    }

    const state = gesturePointers.get(event.pointerId)
    if (!state) {
      return
    }

    const deltaX = event.clientX - state.lastX
    const deltaY = event.clientY - state.lastY
    state.lastX = event.clientX
    state.lastY = event.clientY
    const totalDeltaX = event.clientX - state.startX
    const totalDeltaY = event.clientY - state.startY
    const isHorizontalDominant =
      Math.abs(totalDeltaX) > Math.abs(totalDeltaY) * 1.15
    const isVerticalDominant =
      Math.abs(totalDeltaY) > Math.abs(totalDeltaX) * 1.15

    if (
      !state.thrustActive &&
      Math.hypot(event.clientX - state.startX, event.clientY - state.startY) >
        tapMoveTolerancePx
    ) {
      clearHoldTimer(state)
    }

    if (isHorizontalDominant) {
      state.horizontalCarry += deltaX
      const steps = Math.trunc(state.horizontalCarry / headingStepDistancePx)
      if (steps === 0) {
        return
      }

      clearHoldTimer(state)
      state.horizontalCarry -= steps * headingStepDistancePx
      options.nudgeTargetHeading(-steps * headingStepRadians)
      vibrate()
      return
    }

    if (!isVerticalDominant) {
      return
    }

    clearHoldTimer(state)
    state.verticalCarry += deltaY
    const steps = Math.trunc(
      state.verticalCarry / singleFingerWarpStepDistancePx,
    )
    if (steps === 0) {
      return
    }

    state.verticalCarry -= steps * singleFingerWarpStepDistancePx
    const action = steps < 0 ? 'increaseTimeWarp' : 'decreaseTimeWarp'
    for (let index = 0; index < Math.abs(steps); index += 1) {
      options.onAction(action)
    }
    vibrate()
  })

  const releasePointer = (pointerId: number) => {
    const gestureState = gesturePointers.get(pointerId)
    if (gestureState) {
      clearHoldTimer(gestureState)
      gesturePointers.delete(pointerId)
    }
    if (activeThrustPointers.delete(pointerId)) {
      syncMainThrust()
    }
  }

  window.addEventListener('pointerup', (event) => {
    releasePointer(event.pointerId)
  })
  window.addEventListener('pointercancel', (event) => {
    releasePointer(event.pointerId)
  })

  options.app.appendChild(panel)

  return {
    element: panel,
    setTutorialHintTarget: (target) => {
      const showThrustHint = target === 'thrust-zone'
      tutorialHint.setVisible(showThrustHint)
      tutorialHint.element.dataset.target = target ?? ''
    },
    updateAssistMode: (_mode) => {},
  }
}
