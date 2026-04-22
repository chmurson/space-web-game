import type { AssistMode } from '../../assist/orbitalAssist'
import type { KeyboardInput } from '../../input/keyboardInput'
import type { ScenarioTouchHintTarget } from '../../scenario/scenarioRegistry'
import './touchControls.css'
import { createTouchControlsTutorialHint } from './touchControlsTutorialHint'

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
const timeWarpFeedbackFadeMs = 220
const thrustAppearHoldMs = 180
const thrustControlSpawnOffsetPx = 54
const thrustControlTravelPx = 48
const thrustSnapDistancePx = 30
const thrustControlHitRadiusPx = 90
const screenEdgePaddingPx = 12
const timeWarpFeedbackHalfWidthPx = 64
const timeWarpFeedbackHalfHeightPx = 20
const thrustControlHalfWidthPx = 42
const thrustControlHalfHeightPx = 88

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
  startY: number
  touchId: number
  zooming: boolean
}

type TwoFingerGestureState = {
  lastDistance: number
  touchIds: [number, number]
}

type LeftZoneGestureState = {
  previewAction: 'increaseTimeWarp' | 'decreaseTimeWarp' | null
  previewOpacity: number
  lastX: number
  startX: number
  touchId: number
}

type RightZoneGestureState = {
  holdTimer: number | null
  mode: 'pending' | 'active'
  startLatched: boolean
  startX: number
  startY: number
  touchId: number
}

type ScreenPoint = {
  x: number
  y: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const getTouchDistance = (first: Touch, second: Touch) =>
  Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)

const getTouchCenter = (first: Touch, second: Touch): ScreenPoint => ({
  x: (first.clientX + second.clientX) / 2,
  y: (first.clientY + second.clientY) / 2,
})

const getTouchById = (touches: TouchList, touchId: number) =>
  Array.from(touches).find((touch) => touch.identifier === touchId) ?? null

export const createTouchControls = (options: {
  app: HTMLElement
  commitTimeWarp(action: 'increaseTimeWarp' | 'decreaseTimeWarp'): void
  getTimeWarpPreview(action: 'increaseTimeWarp' | 'decreaseTimeWarp'): {
    canCommit: boolean
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

  const tapTouches = new Map<number, TapState>()
  let pinchSuppressTapUntil = 0
  let doubleTapZoom: DoubleTapZoomState | null = null
  let twoFingerGesture: TwoFingerGestureState | null = null
  let leftZoneGesture: LeftZoneGestureState | null = null
  let rightZoneGesture: RightZoneGestureState | null = null
  let lastTap: (ScreenPoint & { time: number }) | null = null
  let timeWarpFadeTimer: number | null = null
  const thrustState = {
    anchorX: 0,
    anchorY: 0,
    engaged: false,
    latched: false,
    offset: 0,
    visible: false,
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
    halfWidth: number,
    halfHeight: number,
  ): ScreenPoint => ({
    x: clamp(
      point.x,
      halfWidth + screenEdgePaddingPx,
      getPanelWidth() - halfWidth - screenEdgePaddingPx,
    ),
    y: clamp(
      point.y,
      halfHeight + screenEdgePaddingPx,
      getPanelHeight() - halfHeight - screenEdgePaddingPx,
    ),
  })

  const syncMainThrust = () => {
    options.keyboardInput.setVirtualKey('main', thrustState.engaged)
  }

  const hideThrustControl = () => {
    thrustState.visible = false
    thrustState.offset = 0
    syncThrustControlUi()
  }

  const syncThrustControlUi = () => {
    thrustControl.classList.toggle(
      'touch-thrust-control-visible',
      thrustState.visible,
    )
    thrustControl.classList.toggle(
      'touch-thrust-control-on',
      thrustState.engaged,
    )
    const clampedAnchor = clampOverlayPoint(
      { x: thrustState.anchorX, y: thrustState.anchorY },
      thrustControlHalfWidthPx,
      thrustControlHalfHeightPx,
    )
    thrustControl.style.left = `${clampedAnchor.x}px`
    thrustControl.style.top = `${clampedAnchor.y}px`
    thrustControl.style.setProperty(
      '--thrust-thumb-offset',
      `${thrustState.offset}px`,
    )
    if (thrustControlLabel) {
      thrustControlLabel.textContent = thrustState.engaged
        ? 'Thrust On'
        : 'Thrust Off'
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
      44,
      44,
    )
    thrustHoldIndicator.style.left = `${clampedPoint.x}px`
    thrustHoldIndicator.style.top = `${clampedPoint.y}px`
    thrustHoldIndicator.classList.add('touch-thrust-hold-indicator-visible')
  }

  const setThrustState = (nextEngaged: boolean) => {
    const changed = thrustState.engaged !== nextEngaged
    thrustState.engaged = nextEngaged
    syncMainThrust()
    if (changed) {
      vibrate()
    }
  }

  const hideTimeWarpFeedbackLater = () => {
    if (timeWarpFadeTimer !== null) {
      window.clearTimeout(timeWarpFadeTimer)
    }
    timeWarpFeedback.classList.add('touch-time-warp-feedback-fade')
    timeWarpFadeTimer = window.setTimeout(() => {
      timeWarpFeedback.classList.remove(
        'touch-time-warp-feedback-visible',
        'touch-time-warp-feedback-fade',
      )
      timeWarpFadeTimer = null
    }, timeWarpFeedbackFadeMs)
  }

  const showTimeWarpFeedback = (
    direction: 'increaseTimeWarp' | 'decreaseTimeWarp',
    touch: Pick<Touch, 'clientX' | 'clientY'>,
    value: number,
    opacity: number,
  ) => {
    if (timeWarpFadeTimer !== null) {
      window.clearTimeout(timeWarpFadeTimer)
      timeWarpFadeTimer = null
    }

    timeWarpFeedback.textContent = `${
      direction === 'increaseTimeWarp' ? '>>' : '<<'
    } x${value}`
    const clampedPoint = clampOverlayPoint(
      { x: touch.clientX, y: touch.clientY - 38 },
      timeWarpFeedbackHalfWidthPx,
      timeWarpFeedbackHalfHeightPx,
    )
    timeWarpFeedback.style.left = `${clampedPoint.x}px`
    timeWarpFeedback.style.top = `${clampedPoint.y}px`
    timeWarpFeedback.style.setProperty(
      '--touch-time-warp-feedback-opacity',
      `${opacity}`,
    )
    timeWarpFeedback.classList.add('touch-time-warp-feedback-visible')
    timeWarpFeedback.classList.remove('touch-time-warp-feedback-fade')
  }

  const clearZoneGestures = () => {
    leftZoneGesture = null
    const pendingHoldTimer = rightZoneGesture?.holdTimer ?? null
    if (pendingHoldTimer !== null) {
      window.clearTimeout(pendingHoldTimer)
    }
    rightZoneGesture = null
    thrustState.offset = thrustState.latched ? -thrustControlTravelPx : 0
    setThrustState(thrustState.latched)
    if (!thrustState.latched) {
      hideThrustControl()
    } else {
      syncThrustControlUi()
    }
    hideThrustHoldIndicator()
    hideTimeWarpFeedbackLater()
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

  const startPinch = (touches: TouchList) => {
    if (touches.length !== 2) {
      return
    }

    const [first, second] = Array.from(touches)
    clearZoneGestures()
    tapTouches.clear()
    lastTap = null
    twoFingerGesture = {
      lastDistance: getTouchDistance(first, second),
      touchIds: [first.identifier, second.identifier],
    }
    pinchSuppressTapUntil = performance.now() + pinchSuppressTapMs
  }

  const updateRightZoneGesture = (touch: Touch) => {
    if (!rightZoneGesture || rightZoneGesture.touchId !== touch.identifier) {
      return
    }
    if (rightZoneGesture.mode === 'pending') {
      if (
        Math.hypot(
          touch.clientX - rightZoneGesture.startX,
          touch.clientY - rightZoneGesture.startY,
        ) > tapMoveTolerancePx
      ) {
        if (rightZoneGesture.holdTimer !== null) {
          window.clearTimeout(rightZoneGesture.holdTimer)
        }
        rightZoneGesture = null
        hideThrustHoldIndicator()
      }
      return
    }

    const rawOffset = clamp(
      (rightZoneGesture.startLatched ? -thrustControlTravelPx : 0) +
        (touch.clientY - rightZoneGesture.startY),
      -thrustControlTravelPx,
      0,
    )
    const shouldLatch = rightZoneGesture.startLatched
      ? touch.clientY - rightZoneGesture.startY < thrustSnapDistancePx
      : touch.clientY - rightZoneGesture.startY <= -thrustSnapDistancePx

    thrustState.latched = shouldLatch
    thrustState.offset = shouldLatch ? -thrustControlTravelPx : rawOffset
    setThrustState(shouldLatch)
    syncThrustControlUi()
  }

  const beginRightZoneGesture = (touch: Touch) => {
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
      thrustState.visible &&
      thrustState.latched &&
      Math.hypot(
        touchPoint.x - thrustState.anchorX,
        touchPoint.y - thrustState.anchorY,
      ) <= thrustControlHitRadiusPx

    if (thrustState.visible && !canReuseLatchedControl) {
      return
    }

    if (!canReuseLatchedControl && !isInBottomRightQuarter(touch)) {
      return
    }

    if (leftZoneGesture && !thrustState.visible) {
      return
    }

    if (canReuseLatchedControl) {
      hideThrustHoldIndicator()
      rightZoneGesture = {
        holdTimer: null,
        mode: 'active',
        startLatched: thrustState.latched,
        startX: touch.clientX,
        startY: touch.clientY,
        touchId: touch.identifier,
      }
      thrustState.visible = true
      thrustState.offset = thrustState.latched ? -thrustControlTravelPx : 0
      setThrustState(thrustState.latched)
      syncThrustControlUi()
      return
    }

    if (!isInBottomRightQuarter(touch)) {
      return
    }

    showThrustHoldIndicator(touch)
    rightZoneGesture = {
      holdTimer: window.setTimeout(() => {
        if (
          !rightZoneGesture ||
          rightZoneGesture.touchId !== touch.identifier
        ) {
          return
        }
        if (rightZoneGesture.mode !== 'pending') {
          return
        }
        const pendingGesture = rightZoneGesture

        thrustState.anchorX = clamp(pendingGesture.startX, minX, maxX)
        thrustState.anchorY = clamp(
          pendingGesture.startY - thrustControlSpawnOffsetPx,
          minY,
          maxY,
        )
        hideThrustHoldIndicator()
        rightZoneGesture = {
          holdTimer: null,
          mode: 'active',
          startLatched: thrustState.latched,
          startX: pendingGesture.startX,
          startY: pendingGesture.startY,
          touchId: touch.identifier,
        }
        thrustState.visible = true
        thrustState.offset = 0
        setThrustState(thrustState.latched)
        syncThrustControlUi()
      }, thrustAppearHoldMs),
      mode: 'pending',
      startLatched: false,
      startX: touch.clientX,
      startY: touch.clientY,
      touchId: touch.identifier,
    }

    if (!canReuseLatchedControl) {
      thrustState.anchorX = clamp(touch.clientX, minX, maxX)
      thrustState.anchorY = clamp(
        touch.clientY - thrustControlSpawnOffsetPx,
        minY,
        maxY,
      )
    }
  }

  const beginLeftZoneGesture = (touch: Touch) => {
    leftZoneGesture = {
      lastX: touch.clientX,
      previewAction: null,
      previewOpacity: 0,
      startX: touch.clientX,
      touchId: touch.identifier,
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

      if (doubleTapZoom || twoFingerGesture) {
        return
      }

      for (const touch of Array.from(event.changedTouches)) {
        const isDoubleTapCandidate =
          event.touches.length === 1 &&
          lastTap &&
          now - lastTap.time <= doubleTapWindowMs &&
          Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y) <=
            tapMoveTolerancePx * 2

        if (isDoubleTapCandidate) {
          clearZoneGestures()
          doubleTapZoom = {
            lastY: touch.clientY,
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

      if (!doubleTapZoom && shouldStartPinch(event.touches)) {
        startPinch(event.touches)
        return
      }

      const midpointX = getMidpointX()
      for (const touch of Array.from(event.changedTouches)) {
        if (doubleTapZoom?.touchId === touch.identifier) {
          continue
        }
        if (touch.clientX < midpointX) {
          if (!leftZoneGesture) {
            beginLeftZoneGesture(touch)
          }
          continue
        }

        if (!rightZoneGesture) {
          beginRightZoneGesture(touch)
        }
      }
    },
    { passive: false },
  )

  panel.addEventListener(
    'touchmove',
    (event) => {
      if (twoFingerGesture) {
        const first = getTouchById(event.touches, twoFingerGesture.touchIds[0])
        const second = getTouchById(event.touches, twoFingerGesture.touchIds[1])

        if (!first || !second) {
          return
        }

        pinchSuppressTapUntil = performance.now() + pinchSuppressTapMs
        const distance = getTouchDistance(first, second)
        const factor = clamp(
          twoFingerGesture.lastDistance / distance,
          pinchZoomMinFactor,
          pinchZoomMaxFactor,
        )

        if (Math.abs(factor - 1) > 0.01) {
          options.onZoom(factor)
        }
        twoFingerGesture.lastDistance = distance

        const center = getTouchCenter(first, second)
        timeWarpFeedback.style.left = `${center.x}px`
        timeWarpFeedback.style.top = `${center.y}px`
        return
      }

      if (doubleTapZoom) {
        const touch = getTouchById(event.touches, doubleTapZoom.touchId)
        if (!touch) {
          return
        }

        const movedY = touch.clientY - doubleTapZoom.startY
        if (
          !doubleTapZoom.zooming &&
          Math.abs(movedY) >= doubleTapZoomStartPx
        ) {
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
      }

      if (leftZoneGesture) {
        const touch = getTouchById(event.touches, leftZoneGesture.touchId)
        if (touch) {
          const deltaX = touch.clientX - leftZoneGesture.startX
          leftZoneGesture.lastX = touch.clientX
          const threshold = getTouchTravelActivationDistance()
          const opacity = clamp(Math.abs(deltaX) / threshold, 0, 1)
          const direction =
            deltaX >= 0 ? 'increaseTimeWarp' : 'decreaseTimeWarp'
          const preview = options.getTimeWarpPreview(direction)

          leftZoneGesture.previewOpacity = opacity
          if (opacity > 0 && preview.canCommit) {
            leftZoneGesture.previewAction = opacity >= 1 ? direction : null
            showTimeWarpFeedback(direction, touch, preview.value, opacity)
          } else {
            leftZoneGesture.previewAction = null
            hideTimeWarpFeedbackLater()
          }
        }
      }

      if (rightZoneGesture) {
        const touch = getTouchById(event.touches, rightZoneGesture.touchId)
        if (touch) {
          updateRightZoneGesture(touch)
        }
      }
    },
    { passive: false },
  )

  panel.addEventListener(
    'touchend',
    (event) => {
      const now = performance.now()

      if (
        twoFingerGesture &&
        twoFingerGesture.touchIds.some((touchId) =>
          Array.from(event.changedTouches).some(
            (touch) => touch.identifier === touchId,
          ),
        )
      ) {
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

        if (leftZoneGesture?.touchId === touch.identifier) {
          if (leftZoneGesture.previewAction) {
            options.commitTimeWarp(leftZoneGesture.previewAction)
            vibrate()
          }
          leftZoneGesture = null
          hideTimeWarpFeedbackLater()
        }

        if (rightZoneGesture?.touchId === touch.identifier) {
          if (rightZoneGesture.holdTimer !== null) {
            window.clearTimeout(rightZoneGesture.holdTimer)
          }
          rightZoneGesture = null
          thrustState.offset = thrustState.latched ? -thrustControlTravelPx : 0
          setThrustState(thrustState.latched)
          if (!thrustState.latched) {
            hideThrustControl()
          } else {
            syncThrustControlUi()
          }
          hideThrustHoldIndicator()
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
      lastTap = null

      if (
        twoFingerGesture &&
        twoFingerGesture.touchIds.some((touchId) =>
          Array.from(event.changedTouches).some(
            (touch) => touch.identifier === touchId,
          ),
        )
      ) {
        twoFingerGesture = null
      }

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
        if (leftZoneGesture?.touchId === touch.identifier) {
          leftZoneGesture = null
          hideTimeWarpFeedbackLater()
        }
        if (rightZoneGesture?.touchId === touch.identifier) {
          if (rightZoneGesture.holdTimer !== null) {
            window.clearTimeout(rightZoneGesture.holdTimer)
          }
          rightZoneGesture = null
          thrustState.offset = thrustState.latched ? -thrustControlTravelPx : 0
          setThrustState(thrustState.latched)
          if (!thrustState.latched) {
            hideThrustControl()
          } else {
            syncThrustControlUi()
          }
          hideThrustHoldIndicator()
        }
      }
    },
    { passive: false },
  )

  options.app.appendChild(panel)
  syncThrustControlUi()

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
