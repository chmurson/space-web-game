import type { AssistMode } from '../../assist/orbitalAssist'
import type { KeyboardInput } from '../../input/keyboardInput'
import type {
  TimeWarpAction,
  TimeWarpFeedbackReason,
} from '../../runtime/timeWarpFeedbackPolicy'
import type { ScenarioTouchHintTarget } from '../../scenario/scenarioRegistry'
import './touchControls.css'
import { createTouchControlsTutorialHint } from './touchControlsTutorialHint'
import { createTouchInteractionModel } from './touchInteractionModel'
import { createTimeWarpFeedbackModel } from './timeWarpFeedbackModel'
import { presentTimeWarpFeedback } from './timeWarpFeedbackPresenter'
import { createTimeWarpFeedbackView } from './timeWarpFeedbackView'

export type TouchControls = {
  element: HTMLElement
  setTutorialHintTarget(target: ScenarioTouchHintTarget | null): void
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
const maxMobileTouchDimensionPx = 430
const committedTimeWarpFeedbackFadeMs = 1000
const thrustAppearHoldMs = 180
const thrustLatchedLabelHideDelayMs = 500
const thrustControlSpawnOffsetPx = 54
const thrustControlHitRadiusPx = 90
const screenEdgePaddingPx = 12
const timeWarpFeedbackOffsetYPx = 62
const holdIndicatorHalfSizePx = 44

type TapState = {
  startTime: number
  startX: number
  startY: number
}

type ScreenPoint = {
  x: number
  y: number
}

type OverlaySize = {
  halfHeight: number
  halfWidth: number
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
  | {
      kind: 'left-zone'
      startX: number
      touchId: number
    }
  | {
      kind: 'right-zone-pending'
      holdTimer: number
      startX: number
      startY: number
      touchId: number
    }
  | {
      kind: 'right-zone-active'
      startLatched: boolean
      startX: number
      startY: number
      touchId: number
    }

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const getTouchDistance = (first: Touch, second: Touch) =>
  Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)

const getTouchById = (touches: TouchList, touchId: number) =>
  Array.from(touches).find((touch) => touch.identifier === touchId) ?? null

const measureOverlaySize = (
  element: HTMLElement,
  fallback: OverlaySize,
): OverlaySize => {
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return fallback
  }

  return {
    halfHeight: rect.height / 2,
    halfWidth: rect.width / 2,
  }
}

const vibrate = () => {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.vibrate !== 'function'
  ) {
    return
  }

  navigator.vibrate(hapticPulseMs)
}

export const createTouchControls = (options: {
  app: HTMLElement
  commitTimeWarp(action: TimeWarpAction): void
  getTimeWarpPreview(action: TimeWarpAction): {
    canCommit: boolean
    reason: TimeWarpFeedbackReason | null
    value: number
  }
  keyboardInput: KeyboardInput
  onTargetHeadingSelected(screenX: number, screenY: number): void
  onZoom(factor: number): void
}): TouchControls => {
  const panel = document.createElement('section')
  panel.className = 'touch-controls'

  const tutorialHint = createTouchControlsTutorialHint()
  panel.appendChild(tutorialHint.element)

  const timeWarpFeedback = document.createElement('div')
  timeWarpFeedback.className = 'touch-time-warp-feedback'
  timeWarpFeedback.setAttribute('aria-hidden', 'true')
  panel.appendChild(timeWarpFeedback)

  const thrustHoldIndicator = document.createElement('div')
  thrustHoldIndicator.className = 'touch-thrust-hold-indicator'
  thrustHoldIndicator.setAttribute('aria-hidden', 'true')
  panel.appendChild(thrustHoldIndicator)

  const thrustControl = document.createElement('div')
  thrustControl.className = 'touch-thrust-control'
  thrustControl.setAttribute('aria-hidden', 'true')
  thrustControl.innerHTML = `
    <div class="touch-thrust-control-track">
      <div class="touch-thrust-control-thumb"></div>
    </div>
    <div class="touch-thrust-control-label">Thrust</div>
  `
  panel.appendChild(thrustControl)
  const thrustControlLabel = thrustControl.querySelector<HTMLDivElement>(
    '.touch-thrust-control-label',
  )
  const thrustControlThumb = thrustControl.querySelector<HTMLDivElement>(
    '.touch-thrust-control-thumb',
  )

  const interactionModel = createTouchInteractionModel()
  const timeWarpFeedbackModel = createTimeWarpFeedbackModel()
  const tapTouches = new Map<number, TapState>()
  let activeSession: ActiveGestureSession = { kind: 'none' }
  let lastTap: (ScreenPoint & { time: number }) | null = null
  let pinchSuppressTapUntil = 0
  let thrustLabelHideTimer: number | null = null
  let isThrustLabelVisible = true
  let thrustControlSize: OverlaySize = {
    halfHeight: 88,
    halfWidth: 42,
  }

  const getPanelWidth = () =>
    panel.getBoundingClientRect().width || window.innerWidth
  const getPanelHeight = () =>
    panel.getBoundingClientRect().height || window.innerHeight
  const getMidpointX = () => getPanelWidth() / 2
  const getTouchTravelActivationDistance = () =>
    Math.min(
      Math.min(getPanelWidth(), getPanelHeight()),
      maxMobileTouchDimensionPx,
    ) / 5
  const isInBottomRightQuarter = (touch: Pick<Touch, 'clientX' | 'clientY'>) =>
    touch.clientX >= getPanelWidth() / 2 &&
    touch.clientY >= getPanelHeight() / 2

  const clampOverlayPoint = (
    point: ScreenPoint,
    overlaySize: OverlaySize,
  ): ScreenPoint => ({
    x: clamp(
      point.x,
      overlaySize.halfWidth + screenEdgePaddingPx,
      getPanelWidth() - overlaySize.halfWidth - screenEdgePaddingPx,
    ),
    y: clamp(
      point.y,
      overlaySize.halfHeight + screenEdgePaddingPx,
      getPanelHeight() - overlaySize.halfHeight - screenEdgePaddingPx,
    ),
  })

  const refreshThrustControlSize = () => {
    thrustControlSize = measureOverlaySize(thrustControl, thrustControlSize)
  }

  const timeWarpFeedbackView = createTimeWarpFeedbackView({
    committedFadeMs: committedTimeWarpFeedbackFadeMs,
    element: timeWarpFeedback,
    getBounds: () => ({
      height: getPanelHeight(),
      width: getPanelWidth(),
    }),
  })

  const syncMainThrust = (engaged: boolean) => {
    options.keyboardInput.setVirtualKey('main', engaged)
  }

  const clearThrustLabelHideTimer = () => {
    if (thrustLabelHideTimer !== null) {
      window.clearTimeout(thrustLabelHideTimer)
      thrustLabelHideTimer = null
    }
  }

  const showThrustLabel = () => {
    clearThrustLabelHideTimer()
    isThrustLabelVisible = true
    thrustControl.classList.remove('touch-thrust-control-label-hidden')
  }

  const scheduleLatchedThrustLabelHide = () => {
    clearThrustLabelHideTimer()
    thrustLabelHideTimer = window.setTimeout(() => {
      isThrustLabelVisible = false
      thrustControl.classList.add('touch-thrust-control-label-hidden')
      thrustLabelHideTimer = null
    }, thrustLatchedLabelHideDelayMs)
  }

  const syncThrustControlUi = () => {
    const snapshot = interactionModel.getSnapshot()
    thrustControl.classList.toggle(
      'touch-thrust-control-visible',
      snapshot.thrust.visible,
    )
    thrustControl.classList.toggle(
      'touch-thrust-control-on',
      snapshot.thrust.engaged,
    )
    if (thrustControlLabel) {
      thrustControlLabel.textContent = snapshot.thrust.engaged
        ? 'Thrust On'
        : 'Thrust Off'
    }
    thrustControl.classList.toggle(
      'touch-thrust-control-label-hidden',
      !isThrustLabelVisible,
    )
    refreshThrustControlSize()
    const clampedAnchor = clampOverlayPoint(
      snapshot.thrust.anchor,
      thrustControlSize,
    )
    thrustControl.style.left = `${clampedAnchor.x}px`
    thrustControl.style.top = `${clampedAnchor.y}px`
    thrustControl.style.setProperty(
      '--thrust-thumb-offset',
      `${snapshot.thrust.offset}px`,
    )
  }

  const applyInteractionSnapshot = (
    snapshot: ReturnType<typeof interactionModel.getSnapshot>,
  ) => {
    syncMainThrust(snapshot.thrust.engaged)
    syncThrustControlUi()
    if (snapshot.shouldPulseHaptics) {
      vibrate()
    }
  }

  const hideThrustHoldIndicator = () => {
    thrustHoldIndicator.classList.remove('touch-thrust-hold-indicator-visible')
  }

  const showThrustHoldIndicator = (
    touch: Pick<Touch, 'clientX' | 'clientY'>,
  ) => {
    const clampedPoint = clampOverlayPoint(
      { x: touch.clientX, y: touch.clientY },
      {
        halfHeight: holdIndicatorHalfSizePx,
        halfWidth: holdIndicatorHalfSizePx,
      },
    )
    thrustHoldIndicator.style.left = `${clampedPoint.x}px`
    thrustHoldIndicator.style.top = `${clampedPoint.y}px`
    thrustHoldIndicator.classList.add('touch-thrust-hold-indicator-visible')
  }

  const isTouchOnThrustThumb = (touch: Pick<Touch, 'clientX' | 'clientY'>) => {
    if (!thrustControlThumb) {
      return false
    }

    const thumbRect = thrustControlThumb.getBoundingClientRect()
    return (
      touch.clientX >= thumbRect.left &&
      touch.clientX <= thumbRect.right &&
      touch.clientY >= thumbRect.top &&
      touch.clientY <= thumbRect.bottom
    )
  }

  const clearPendingHoldTimer = () => {
    if (activeSession.kind === 'right-zone-pending') {
      window.clearTimeout(activeSession.holdTimer)
    }
  }

  const clearActiveSession = () => {
    clearPendingHoldTimer()
    activeSession = { kind: 'none' }
  }

  const clearPendingTapState = () => {
    tapTouches.clear()
    lastTap = null
  }

  const clearTimeWarpPreview = () => {
    timeWarpFeedbackView.render(
      presentTimeWarpFeedback(timeWarpFeedbackModel.cancelPreview()),
    )
  }

  const finishLeftZoneGesture = (commitPreview: boolean) => {
    if (activeSession.kind !== 'left-zone') {
      return
    }

    if (commitPreview) {
      const result = timeWarpFeedbackModel.commitPreview()
      timeWarpFeedbackView.render(presentTimeWarpFeedback(result.snapshot))
      if (result.action) {
        options.commitTimeWarp(result.action)
      }
    } else {
      clearTimeWarpPreview()
    }

    clearActiveSession()
  }

  const clearRightZoneGesture = () => {
    if (
      activeSession.kind !== 'right-zone-pending' &&
      activeSession.kind !== 'right-zone-active'
    ) {
      return
    }

    hideThrustHoldIndicator()
    clearPendingHoldTimer()
    const snapshot = interactionModel.hideThrust()
    applyInteractionSnapshot(snapshot)
    if (snapshot.thrust.visible && snapshot.thrust.latched) {
      scheduleLatchedThrustLabelHide()
    }
    activeSession = { kind: 'none' }
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
    if (touches.length !== 2) {
      return false
    }

    const [first, second] = Array.from(touches)
    const midpointX = getMidpointX()
    return (
      (first.clientX < midpointX && second.clientX < midpointX) ||
      (first.clientX >= midpointX && second.clientX >= midpointX)
    )
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
    activeSession = {
      kind: 'left-zone',
      startX: touch.clientX,
      touchId: touch.identifier,
    }
  }

  const promotePendingThrustSession = () => {
    if (activeSession.kind !== 'right-zone-pending') {
      return
    }

    const pendingSession = activeSession
    hideThrustHoldIndicator()
    showThrustLabel()
    const anchor = interactionModel.getSnapshot().thrust.anchor
    activeSession = {
      kind: 'right-zone-active',
      startLatched: interactionModel.getSnapshot().thrust.latched,
      startX: pendingSession.startX,
      startY: pendingSession.startY,
      touchId: pendingSession.touchId,
    }
    applyInteractionSnapshot(interactionModel.showThrust(anchor))
  }

  const beginRightZoneSession = (touch: Touch) => {
    const thrustSnapshot = interactionModel.getSnapshot().thrust
    const panelWidth = getPanelWidth()
    const panelHeight = getPanelHeight()
    const minX = Math.max(
      panelWidth / 2 + screenEdgePaddingPx,
      screenEdgePaddingPx,
    )
    const maxX = panelWidth - screenEdgePaddingPx
    const minY = Math.max(
      panelHeight / 2 + screenEdgePaddingPx,
      screenEdgePaddingPx + thrustControlSpawnOffsetPx,
    )
    const maxY = panelHeight - screenEdgePaddingPx - thrustControlSpawnOffsetPx
    const touchPoint = { x: touch.clientX, y: touch.clientY }
    const canReuseLatchedControl =
      thrustSnapshot.visible &&
      thrustSnapshot.latched &&
      Math.hypot(
        touchPoint.x - thrustSnapshot.anchor.x,
        touchPoint.y - thrustSnapshot.anchor.y,
      ) <= thrustControlHitRadiusPx

    if (thrustSnapshot.visible && !canReuseLatchedControl) {
      return
    }

    if (!canReuseLatchedControl && !isInBottomRightQuarter(touch)) {
      return
    }

    if (canReuseLatchedControl) {
      hideThrustHoldIndicator()
      if (isTouchOnThrustThumb(touch)) {
        showThrustLabel()
      }
      activeSession = {
        kind: 'right-zone-active',
        startLatched: thrustSnapshot.latched,
        startX: touch.clientX,
        startY: touch.clientY,
        touchId: touch.identifier,
      }
      applyInteractionSnapshot(
        interactionModel.reuseLatchedThrust(thrustSnapshot.latched),
      )
      return
    }

    showThrustLabel()
    const anchor = {
      x: clamp(touch.clientX, minX, maxX),
      y: clamp(touch.clientY - thrustControlSpawnOffsetPx, minY, maxY),
    }
    applyInteractionSnapshot(interactionModel.setPendingThrustAnchor(anchor))
    showThrustHoldIndicator(touch)
    const holdTimer = window.setTimeout(() => {
      if (
        activeSession.kind !== 'right-zone-pending' ||
        activeSession.touchId !== touch.identifier
      ) {
        return
      }
      promotePendingThrustSession()
    }, thrustAppearHoldMs)
    activeSession = {
      kind: 'right-zone-pending',
      holdTimer,
      startX: touch.clientX,
      startY: touch.clientY,
      touchId: touch.identifier,
    }
  }

  const updateRightZoneSession = (touch: Touch) => {
    if (activeSession.kind === 'right-zone-pending') {
      if (
        Math.hypot(
          touch.clientX - activeSession.startX,
          touch.clientY - activeSession.startY,
        ) > tapMoveTolerancePx
      ) {
        clearRightZoneGesture()
      }
      return
    }

    if (
      activeSession.kind === 'right-zone-active' &&
      activeSession.touchId === touch.identifier
    ) {
      applyInteractionSnapshot(
        interactionModel.updateThrustDrag({
          currentY: touch.clientY,
          startLatched: activeSession.startLatched,
          startY: activeSession.startY,
        }),
      )
    }
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
        return activeSession.touchId === touchId
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
      let startedDoubleTapZoom = false

      if (
        activeSession.kind === 'pinch' ||
        activeSession.kind === 'double-tap-zoom'
      ) {
        return
      }

      for (const touch of Array.from(event.changedTouches)) {
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

      if (shouldStartPinch(event.touches)) {
        beginPinchSession(event.touches)
        return
      }

      if (activeSession.kind !== 'none') {
        return
      }

      const midpointX = getMidpointX()
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.clientX < midpointX) {
          beginLeftZoneSession(touch)
        } else {
          beginRightZoneSession(touch)
        }

        if (activeSession.kind !== 'none') {
          return
        }
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
          const factor = clamp(
            activeSession.lastDistance / distance,
            pinchZoomMinFactor,
            pinchZoomMaxFactor,
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
          const factor = clamp(
            Math.exp(deltaY * 0.01),
            doubleTapZoomMinFactor,
            doubleTapZoomMaxFactor,
          )
          if (Math.abs(factor - 1) > 0.002) {
            options.onZoom(factor)
          }
          return
        }
        case 'left-zone': {
          const touch = getTouchById(event.touches, activeSession.touchId)
          if (!touch) {
            return
          }

          const deltaX = touch.clientX - activeSession.startX
          const opacity = clamp(
            Math.abs(deltaX) / getTouchTravelActivationDistance(),
            0,
            1,
          )
          const action = deltaX >= 0 ? 'increaseTimeWarp' : 'decreaseTimeWarp'
          const preview = options.getTimeWarpPreview(action)
          const snapshot = timeWarpFeedbackModel.updatePreview({
            action,
            anchor: {
              x: touch.clientX,
              y: touch.clientY - timeWarpFeedbackOffsetYPx,
            },
            isCommitEligible: preview.canCommit && opacity >= 1,
            opacity,
            reason: preview.reason,
            value: preview.value,
          })
          timeWarpFeedbackView.render(presentTimeWarpFeedback(snapshot))
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

      timeWarpFeedbackView.render(
        presentTimeWarpFeedback(timeWarpFeedbackModel.getSnapshot()),
      )
    },
    { passive: false },
  )

  options.app.appendChild(panel)
  refreshThrustControlSize()
  syncThrustControlUi()

  window.addEventListener('resize', () => {
    refreshThrustControlSize()
    syncThrustControlUi()
    timeWarpFeedbackView.render(
      presentTimeWarpFeedback(timeWarpFeedbackModel.getSnapshot()),
    )
  })

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
