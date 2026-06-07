import type { AssistMode } from '../../assist/orbitalAssist'
import type { KeyboardInput } from '../../input/keyboardInput'
import type { TouchThrustControlUiState } from '../../runtime/appRuntimeState'
import type {
  TimeWarpAction,
  TimeWarpFeedbackReason,
} from '../../runtime/timeWarpFeedbackPolicy'
import type { ScenarioTouchHintTarget } from '../../scenario/scenarioPromptTypes'
import './touchControls.css'
import { createConfiguredTimeWarpControl } from './createTimeWarpControl'
import { createThrustControl, type ThrustGestureSession } from './thrustControl'
import type { TimeWarpGestureSession } from './timeWarpControlTypes'
import { createTouchControlsTutorialHint } from './touchControlsTutorialHint'
import {
  createEdgeRevealControl,
  type EdgeRevealControl,
  type TouchControlRevealEdge,
  type TouchControlRevealPlacement,
} from './edgeRevealControl'

export type TouchControls = {
  element: HTMLElement
  setBurnControlSide(side: TouchControlRevealEdge): void
  setWarpControlSide(side: TouchControlRevealEdge): void
  setTimeWarpControlVisible(visible: boolean): void
  setTutorialHintTarget(target: ScenarioTouchHintTarget | null): void
  syncUi(): void
  updateAssistMode(mode: AssistMode): void
}

const doubleTapWindowMs = 320
const tapMoveTolerancePx = 22
const hapticPulseMs = 12
const pinchZoomMinFactor = 0.86
const pinchZoomMaxFactor = 1.16
const pinchSuppressTapMs = 140
const doubleTapZoomStartPx = 10
const doubleTapZoomMinFactor = 0.9
const doubleTapZoomMaxFactor = 1.12
const touchControlRevealTabHeightPx = 84
const touchControlRevealLayout = {
  gapPx: 66,
  startOffsetPx: 72,
  controls: {
    timeWarp: {
      edge: 'right',
      priority: 10,
    },
    thrust: {
      edge: 'right',
      priority: 10,
    },
  },
} as const

type TapState = {
  startTime: number
  startX: number
  startY: number
}

type ScreenPoint = {
  x: number
  y: number
}

type ActiveGestureSession =
  | { kind: 'none' }
  | {
      kind: 'double-tap-zoom'
      lastY: number
      startY: number
      touchId: number
      zooming: boolean
    }
  | {
      kind: 'pinch'
      lastDistance: number
      touchIds: [number, number]
    }
  | TimeWarpGestureSession
  | ThrustGestureSession

const getTouchDistance = (first: Touch, second: Touch) =>
  Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)

const getTouchById = (touches: TouchList, touchId: number) =>
  Array.from(touches).find((touch) => touch.identifier === touchId) ?? null

const vibrate = () => {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.vibrate !== 'function'
  ) {
    return
  }

  navigator.vibrate(hapticPulseMs)
}

const isEventTargetInside = (
  element: HTMLElement,
  target: EventTarget | null,
) => target instanceof Node && element.contains(target)

const syncRevealControlLayout = (revealControls: EdgeRevealControl[]) => {
  const controlsByEdge = new Map<TouchControlRevealEdge, EdgeRevealControl[]>()

  for (const revealControl of revealControls) {
    const controls = controlsByEdge.get(revealControl.placement.edge) ?? []
    controls.push(revealControl)
    controlsByEdge.set(revealControl.placement.edge, controls)
    revealControl.element.style.setProperty(
      '--touch-edge-reveal-gap',
      `${touchControlRevealLayout.gapPx}px`,
    )
    revealControl.element.style.setProperty(
      '--touch-edge-reveal-start',
      `${touchControlRevealLayout.startOffsetPx}px`,
    )
  }

  for (const controls of controlsByEdge.values()) {
    controls
      .sort((a, b) => a.placement.priority - b.placement.priority)
      .forEach((control, index) => {
        control.syncPlacement(index)
        control.element.style.setProperty(
          '--touch-edge-reveal-stack-offset',
          `${index * (touchControlRevealTabHeightPx + touchControlRevealLayout.gapPx)}px`,
        )
      })
  }
}

export const createTouchControls = (options: {
  app: HTMLElement
  commitTimeWarp(action: TimeWarpAction): void
  getCurrentTimeWarp(): number
  getTimeWarpPreview(action: TimeWarpAction): {
    canCommit: boolean
    reason: TimeWarpFeedbackReason | null
    value: number
  }
  getTimeWarpPreviews(
    action: TimeWarpAction,
    count: number,
  ): {
    canCommit: boolean
    reason: TimeWarpFeedbackReason | null
    value: number
  }[]
  initialBurnControlSide: TouchControlRevealEdge
  initialWarpControlSide: TouchControlRevealEdge
  keyboardInput: KeyboardInput
  onTargetHeadingSelected(screenX: number, screenY: number): void
  onThrustControlUiStateChange(state: TouchThrustControlUiState): void
  onZoom(factor: number): void
}): TouchControls => {
  const panel = document.createElement('section')
  panel.className = 'touch-controls'

  const tutorialHint = createTouchControlsTutorialHint()
  panel.appendChild(tutorialHint.element)

  const tapTouches = new Map<number, TapState>()
  let activeSession: ActiveGestureSession = { kind: 'none' }
  let lastTap: (ScreenPoint & { time: number }) | null = null
  let pinchSuppressTapUntil = 0
  let timeWarpControlVisible = true

  const syncMainThrust = (engaged: boolean) => {
    options.keyboardInput.setVirtualKey('main', engaged)
  }

  const timeWarpDock = document.createElement('div')
  timeWarpDock.className = 'touch-edge-reveal-dock touch-time-warp-reveal-dock'
  const timeWarpControl = createConfiguredTimeWarpControl({
    container: timeWarpDock,
    commitTimeWarp: options.commitTimeWarp,
    getCurrentTimeWarp: options.getCurrentTimeWarp,
    getTimeWarpPreview: options.getTimeWarpPreview,
    getTimeWarpPreviews: options.getTimeWarpPreviews,
    onSessionChange: (session) => {
      activeSession = session
    },
    panel,
  })

  const thrustDock = document.createElement('div')
  thrustDock.className = 'touch-edge-reveal-dock touch-thrust-reveal-dock'
  const thrustControl = createThrustControl({
    container: thrustDock,
    onSessionChange: (session) => {
      activeSession = session
    },
    onUiStateChange: options.onThrustControlUiStateChange,
    panel,
    setMainThrust: syncMainThrust,
    tapMoveTolerancePx,
    vibrate,
  })

  const timeWarpRevealPlacement: TouchControlRevealPlacement = {
    edge: options.initialWarpControlSide,
    priority: touchControlRevealLayout.controls.timeWarp.priority,
  }
  const thrustRevealPlacement: TouchControlRevealPlacement = {
    edge: options.initialBurnControlSide,
    priority: touchControlRevealLayout.controls.thrust.priority,
  }

  const timeWarpRevealControl = createEdgeRevealControl({
    content: timeWarpDock,
    icon: 'Warp',
    id: 'touch-time-warp-reveal',
    label: 'Reveal time warp control',
    placement: timeWarpRevealPlacement,
  })
  const thrustRevealControl = createEdgeRevealControl({
    content: thrustDock,
    icon: 'Burn',
    id: 'touch-thrust-reveal',
    label: 'Reveal thrust control',
    placement: thrustRevealPlacement,
  })
  const revealControls = [timeWarpRevealControl, thrustRevealControl]
  syncRevealControlLayout(revealControls)
  panel.append(timeWarpRevealControl.element, thrustRevealControl.element)

  const clearActiveSession = () => {
    if (activeSession.kind === 'right-zone-pending') {
      thrustControl.clearGesture(activeSession)
    }
    activeSession = { kind: 'none' }
  }

  const clearPendingTapState = () => {
    tapTouches.clear()
    lastTap = null
  }

  const finishLeftZoneGesture = (commitPreview: boolean) => {
    if (activeSession.kind !== 'left-zone') {
      return
    }

    activeSession = timeWarpControl.finishGesture(
      activeSession,
      commitPreview && timeWarpControlVisible,
    )
  }

  const setTimeWarpControlVisible = (visible: boolean) => {
    timeWarpControlVisible = visible
    if (!visible && activeSession.kind === 'left-zone') {
      finishLeftZoneGesture(false)
    }
    timeWarpRevealControl.setAvailable(visible)
    timeWarpControl.setVisible(visible)
  }

  const clearRightZoneGesture = () => {
    activeSession = thrustControl.clearGesture(
      activeSession as ThrustGestureSession,
    )
  }

  const clearZoneGesture = () => {
    if (activeSession.kind === 'left-zone') {
      finishLeftZoneGesture(false)
      return
    }

    if (
      activeSession.kind === 'right-zone-pending' ||
      activeSession.kind === 'right-zone-active'
    ) {
      clearRightZoneGesture()
    }
  }

  const shouldStartPinch = (touches: TouchList) => {
    return touches.length === 2
  }

  const beginPinchSession = (touches: TouchList) => {
    if (touches.length !== 2) {
      return
    }

    const [first, second] = Array.from(touches)
    clearZoneGesture()
    clearPendingTapState()
    activeSession = {
      kind: 'pinch',
      lastDistance: getTouchDistance(first, second),
      touchIds: [first.identifier, second.identifier],
    }
    pinchSuppressTapUntil = performance.now() + pinchSuppressTapMs
  }

  const beginLeftZoneSession = (touch: Touch) => {
    if (!timeWarpControlVisible || !timeWarpRevealControl.isOpen()) {
      return
    }

    activeSession = timeWarpControl.beginGesture(touch)
  }

  const beginDockedThrustSession = (touch: Touch) => {
    if (!thrustRevealControl.isOpen()) {
      return
    }

    activeSession = thrustControl.beginDockedGesture(
      touch,
      activeSession as ThrustGestureSession,
    )
  }

  const updateRightZoneSession = (touch: Touch) => {
    activeSession = thrustControl.updateGesture(
      touch,
      activeSession as ThrustGestureSession,
    )
  }

  const beginDoubleTapZoomSession = (touch: Touch) => {
    clearZoneGesture()
    activeSession = {
      kind: 'double-tap-zoom',
      lastY: touch.clientY,
      startY: touch.clientY,
      touchId: touch.identifier,
      zooming: false,
    }
  }

  const sessionOwnsTouch = (touchId: number) => {
    switch (activeSession.kind) {
      case 'double-tap-zoom':
      case 'left-zone':
      case 'right-zone-pending':
      case 'right-zone-active':
        return activeSession.kind === 'right-zone-pending' ||
          activeSession.kind === 'right-zone-active'
          ? thrustControl.ownsTouch(activeSession, touchId)
          : activeSession.kind === 'left-zone'
            ? timeWarpControl.ownsTouch(activeSession, touchId)
            : activeSession.touchId === touchId
      case 'pinch':
        return activeSession.touchIds.includes(touchId)
      case 'none':
        return false
    }
  }

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
      const eventTarget = event.target
      const isTimeWarpTarget =
        timeWarpRevealControl.isOpen() &&
        isEventTargetInside(timeWarpRevealControl.element, eventTarget)
      const isThrustTarget =
        thrustRevealControl.isOpen() &&
        isEventTargetInside(thrustRevealControl.element, eventTarget)
      const isRevealControlTarget = isTimeWarpTarget || isThrustTarget
      let startedDoubleTapZoom = false

      if (
        activeSession.kind === 'pinch' ||
        activeSession.kind === 'double-tap-zoom'
      ) {
        return
      }

      for (const touch of Array.from(event.changedTouches)) {
        if (isRevealControlTarget) {
          continue
        }

        const isDoubleTapCandidate =
          activeSession.kind === 'none' &&
          event.touches.length === 1 &&
          lastTap &&
          now - lastTap.time <= doubleTapWindowMs &&
          Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y) <=
            tapMoveTolerancePx * 2

        if (isDoubleTapCandidate) {
          beginDoubleTapZoomSession(touch)
          startedDoubleTapZoom = true
          continue
        }

        tapTouches.set(touch.identifier, {
          startTime: now,
          startX: touch.clientX,
          startY: touch.clientY,
        })
      }

      if (startedDoubleTapZoom) {
        return
      }

      if (isRevealControlTarget) {
        if (activeSession.kind !== 'none' || event.touches.length !== 1) {
          return
        }

        for (const touch of Array.from(event.changedTouches)) {
          if (isTimeWarpTarget) {
            beginLeftZoneSession(touch)
          } else if (isThrustTarget) {
            beginDockedThrustSession(touch)
          }

          if (activeSession.kind !== 'none') {
            return
          }
        }
        return
      }

      if (shouldStartPinch(event.touches)) {
        beginPinchSession(event.touches)
        return
      }
    },
    { passive: false },
  )

  panel.addEventListener(
    'touchmove',
    (event) => {
      switch (activeSession.kind) {
        case 'pinch': {
          const first = getTouchById(event.touches, activeSession.touchIds[0])
          const second = getTouchById(event.touches, activeSession.touchIds[1])
          if (!first || !second) {
            return
          }

          pinchSuppressTapUntil = performance.now() + pinchSuppressTapMs
          const distance = getTouchDistance(first, second)
          const factor = Math.min(
            pinchZoomMaxFactor,
            Math.max(pinchZoomMinFactor, activeSession.lastDistance / distance),
          )

          if (Math.abs(factor - 1) > 0.01) {
            options.onZoom(factor)
          }

          activeSession.lastDistance = distance
          return
        }
        case 'double-tap-zoom': {
          const touch = getTouchById(event.touches, activeSession.touchId)
          if (!touch) {
            return
          }

          const movedY = touch.clientY - activeSession.startY
          if (
            !activeSession.zooming &&
            Math.abs(movedY) >= doubleTapZoomStartPx
          ) {
            activeSession.zooming = true
            lastTap = null
          }

          if (!activeSession.zooming) {
            return
          }

          const deltaY = touch.clientY - activeSession.lastY
          activeSession.lastY = touch.clientY
          const factor = Math.min(
            doubleTapZoomMaxFactor,
            Math.max(doubleTapZoomMinFactor, Math.exp(deltaY * 0.01)),
          )
          if (Math.abs(factor - 1) > 0.002) {
            options.onZoom(factor)
          }
          return
        }
        case 'left-zone': {
          if (!timeWarpControlVisible) {
            finishLeftZoneGesture(false)
            return
          }

          const touch = getTouchById(event.touches, activeSession.touchId)
          if (!touch) {
            return
          }

          activeSession = timeWarpControl.updateGesture(touch, activeSession)
          return
        }
        case 'right-zone-pending':
        case 'right-zone-active': {
          const touch = getTouchById(event.touches, activeSession.touchId)
          if (!touch) {
            return
          }

          updateRightZoneSession(touch)
          return
        }
        case 'none':
          return
      }
    },
    { passive: false },
  )

  panel.addEventListener(
    'touchend',
    (event) => {
      const now = performance.now()

      if (
        activeSession.kind === 'pinch' &&
        activeSession.touchIds.some((touchId) =>
          Array.from(event.changedTouches).some(
            (touch) => touch.identifier === touchId,
          ),
        )
      ) {
        clearActiveSession()
      }

      for (const touch of Array.from(event.changedTouches)) {
        if (
          activeSession.kind === 'double-tap-zoom' &&
          activeSession.touchId === touch.identifier
        ) {
          const completedZoom = activeSession.zooming
          clearActiveSession()
          lastTap = null
          if (!completedZoom) {
            options.onTargetHeadingSelected(touch.clientX, touch.clientY)
            vibrate()
          }
          continue
        }

        if (
          activeSession.kind === 'left-zone' &&
          activeSession.touchId === touch.identifier
        ) {
          finishLeftZoneGesture(true)
        }

        if (
          (activeSession.kind === 'right-zone-pending' ||
            activeSession.kind === 'right-zone-active') &&
          activeSession.touchId === touch.identifier
        ) {
          clearRightZoneGesture()
        }

        const tapState = tapTouches.get(touch.identifier)
        tapTouches.delete(touch.identifier)
        if (!tapState || now < pinchSuppressTapUntil) {
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
      pinchSuppressTapUntil = performance.now() + pinchSuppressTapMs
      clearPendingTapState()

      if (
        Array.from(event.changedTouches).some((touch) =>
          sessionOwnsTouch(touch.identifier),
        )
      ) {
        if (activeSession.kind === 'left-zone') {
          finishLeftZoneGesture(false)
        } else if (
          activeSession.kind === 'right-zone-pending' ||
          activeSession.kind === 'right-zone-active'
        ) {
          clearRightZoneGesture()
        } else {
          clearActiveSession()
        }
      }

      timeWarpControl.syncUi()
    },
    { passive: false },
  )

  options.app.appendChild(panel)
  thrustControl.syncUi()

  window.addEventListener('resize', () => {
    thrustControl.syncUi()
    timeWarpControl.syncUi()
  })

  return {
    element: panel,
    setBurnControlSide: (side) => {
      thrustRevealControl.setEdge(side)
      syncRevealControlLayout(revealControls)
    },
    setWarpControlSide: (side) => {
      timeWarpRevealControl.setEdge(side)
      syncRevealControlLayout(revealControls)
    },
    setTimeWarpControlVisible,
    setTutorialHintTarget: (target) => {
      const showThrustHint = target === 'thrust-zone'
      tutorialHint.setVisible(showThrustHint)
      tutorialHint.element.dataset.target = target ?? ''
    },
    syncUi: () => {
      timeWarpControl.syncUi()
      thrustControl.syncUi()
    },
    updateAssistMode: (_mode) => {},
  }
}
