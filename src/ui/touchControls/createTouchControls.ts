import type { AssistMode } from '../../assist/orbitalAssist'
import type { KeyboardInput } from '../../input/keyboardInput'
import type { TouchThrustControlUiState } from '../../runtime/appRuntimeState'
import type { AssistTargetUiState } from '../../runtime/gameQueries'
import type {
  TimeWarpAction,
  TimeWarpFeedbackReason,
} from '../../runtime/timeWarpFeedbackPolicy'
import type { TrajectoryHorizonAction } from '../../runtime/trajectoryHorizonControlPolicy'
import type { CameraFollowSubject } from '../../scenario/scenarioDirectiveTypes'
import type {
  ScenarioTouchControlFocusTarget,
  ScenarioTouchHintTarget,
} from '../../scenario/scenarioPromptTypes'
import './touchControls.css'
import { createConfiguredTimeWarpControl } from './createTimeWarpControl'
import {
  createMobileCommandDock,
  type MobileCommandDockPanel,
} from './mobileCommandDock'
import { createRcsYawControl, type RcsYawGestureSession } from './rcsYawControl'
import type {
  StepSelectorGesturePoint,
  StepSelectorGestureSession,
} from './stepSelectorControl/stepSelectorControlTypes'
import {
  createTargetControl,
  type TargetControlBodyRow,
} from './targetControl/createTargetControl'
import { createThrustControl, type ThrustGestureSession } from './thrustControl'
import { getTimeWarpControlStatus } from './timeWarpControlStatus'
import type { TimeWarpControlId } from './timeWarpControlTypes'
import { createTouchControlsShell } from './touchControlsShell'
import { createTouchControlsTutorialHint } from './touchControlsTutorialHint'
import { createTrajectoryHorizonControl } from './trajectoryHorizonControl/createTrajectoryHorizonControl'

export type TouchControls = {
  element: HTMLElement
  infoPanelContainer: HTMLElement
  infoRailContainer: HTMLElement
  openTargetControl(): void
  setFlightControlsVisible(visible: boolean): void
  setTargetControlVisible(visible: boolean): void
  setTrajectoryControlVisible(visible: boolean): void
  setTimeWarpControlVisible(visible: boolean): void
  setTutorialFocusedControl(
    target: ScenarioTouchControlFocusTarget | null,
  ): void
  setTutorialHintTarget(target: ScenarioTouchHintTarget | null): void
  syncUi(): void
  toggleInfoPanel(): void
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
const cameraPanTapTolerancePx = 8
const mouseStepSelectorTouchId = -1

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
      kind: 'camera-pan'
      hasMovedForTap: boolean
      hasPanned: boolean
      previousX: number
      previousY: number
      startX: number
      startY: number
      touchId: number
    }
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
  | RcsYawGestureSession
  | StepSelectorGestureSession<TimeWarpControlId>
  | StepSelectorGestureSession<'trajectory-horizon'>
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

export const createTouchControls = (options: {
  app: HTMLElement
  automaticTargetingAvailable: boolean
  commitTrajectoryHorizon(action: TrajectoryHorizonAction): void
  commitTimeWarp(action: TimeWarpAction): void
  getCurrentTrajectoryHorizonHours(): number
  getCurrentTimeWarp(): number
  getInteractionsEnabled(): boolean
  getAssistTargetUiState(): AssistTargetUiState
  getTargetControlRows(): TargetControlBodyRow[]
  getTrajectoryHorizonPreviews(
    action: TrajectoryHorizonAction,
    count: number,
  ): {
    canCommit: boolean
    value: number
  }[]
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
  keyboardInput: KeyboardInput
  getCameraCanRecenter(): boolean
  getCameraControlsLocked(): boolean
  getCameraFollow(): CameraFollowSubject
  onCameraFollowSelect(follow: CameraFollowSubject): void
  onCameraRecenter(): void
  onFollowCameraViewportBottomInsetChange?(bottomInset: number): void
  onCameraPanGesture(previous: ScreenPoint, next: ScreenPoint): boolean
  onReturnToAutomaticTarget(): boolean
  onSelectTargetIndex(index: number): boolean
  onTargetStateChange?(): void
  onThrustControlUiStateChange(state: TouchThrustControlUiState): void
  onZoom(factor: number, focalPoint?: ScreenPoint): void
}): TouchControls => {
  const touchControlsShell = createTouchControlsShell()
  const panel = touchControlsShell.element

  let handleDockPanelChange = (
    _nextPanel: MobileCommandDockPanel | null,
    _previousPanel: MobileCommandDockPanel | null,
  ) => {}
  const mobileCommandDock = createMobileCommandDock({
    app: options.app,
    container: panel,
    getCameraCanRecenter: options.getCameraCanRecenter,
    getCameraControlsLocked: options.getCameraControlsLocked,
    getCameraFollow: options.getCameraFollow,
    getTargetState: options.getAssistTargetUiState,
    onCameraFollowSelect: options.onCameraFollowSelect,
    onCameraRecenter: options.onCameraRecenter,
    onViewportBottomInsetChange:
      options.onFollowCameraViewportBottomInsetChange,
    onOpenPanelChange: (nextPanel, previousPanel) =>
      handleDockPanelChange(nextPanel, previousPanel),
  })
  const tutorialHint = createTouchControlsTutorialHint({ container: panel })

  const tapTouches = new Map<number, TapState>()
  let activeSession: ActiveGestureSession = { kind: 'none' }
  let lastTap: (ScreenPoint & { time: number }) | null = null
  let pinchSuppressTapUntil = 0
  let flightControlsVisible = true
  let timeWarpControlVisible = true

  const syncMainThrust = (engaged: boolean) => {
    options.keyboardInput.setVirtualKey('main', engaged)
  }

  const syncRcsYawTurn = (turn: number) => {
    options.keyboardInput.setVirtualTurn(turn)
  }

  const timeWarpControl = createConfiguredTimeWarpControl({
    container: mobileCommandDock.timeWarpContainer,
    commitTimeWarp: options.commitTimeWarp,
    getCurrentTimeWarp: options.getCurrentTimeWarp,
    getTimeWarpPreview: options.getTimeWarpPreview,
    getTimeWarpPreviews: options.getTimeWarpPreviews,
    onSessionChange: (session) => {
      activeSession = session
    },
    panel,
  })
  const isTimeWarpStepSelectorSession = (
    session: ActiveGestureSession,
  ): session is StepSelectorGestureSession<TimeWarpControlId> =>
    session.kind === 'step-selector' && session.controlId === 'time-warp'
  const isTrajectoryHorizonStepSelectorSession = (
    session: ActiveGestureSession,
  ): session is StepSelectorGestureSession<'trajectory-horizon'> =>
    session.kind === 'step-selector' &&
    session.controlId === 'trajectory-horizon'

  const trajectoryHorizonControl = createTrajectoryHorizonControl({
    container: mobileCommandDock.trajectoryContainer,
    commitTrajectoryHorizon: options.commitTrajectoryHorizon,
    getCurrentTrajectoryHorizonHours: options.getCurrentTrajectoryHorizonHours,
    getTrajectoryHorizonPreviews: options.getTrajectoryHorizonPreviews,
    onSessionChange: (session) => {
      activeSession = session
    },
    panel,
  })

  const targetControl = createTargetControl({
    automaticTargetingAvailable: options.automaticTargetingAvailable,
    getRows: options.getTargetControlRows,
    getTargetState: options.getAssistTargetUiState,
    onReturnToAutomaticTarget: options.onReturnToAutomaticTarget,
    onSelectTargetIndex: options.onSelectTargetIndex,
    onStateChange: () => {
      mobileCommandDock.syncState()
      options.onTargetStateChange?.()
    },
  })
  mobileCommandDock.targetContainer.appendChild(targetControl.element)

  const thrustControl = createThrustControl({
    container: mobileCommandDock.thrustContainer,
    onSessionChange: (session) => {
      activeSession = session
    },
    onUiStateChange: (state) => {
      const panelOpen = mobileCommandDock.isPanelOpen('flight')
      options.onThrustControlUiStateChange({
        ...state,
        interactive: state.interactive && panelOpen,
        revealed: state.revealed && panelOpen,
        visible: state.visible && panelOpen,
      })
    },
    panel,
    setMainThrust: syncMainThrust,
    tapMoveTolerancePx,
    vibrate,
  })
  const rcsYawControl = createRcsYawControl({
    container: mobileCommandDock.rcsYawContainer,
    onSessionChange: (session) => {
      activeSession = session
    },
    setTurn: syncRcsYawTurn,
  })

  const setTutorialFocusedControl = (
    target: ScenarioTouchControlFocusTarget | null,
  ) => {
    if (target) {
      panel.dataset.tutorialFocusedControl = target
    } else {
      delete panel.dataset.tutorialFocusedControl
    }

    mobileCommandDock.setTutorialFocused(target)
  }

  const clearActiveSession = () => {
    if (activeSession.kind === 'right-zone-pending') {
      thrustControl.clearGesture(activeSession)
    }
    if (activeSession.kind === 'rcs-yaw-active') {
      rcsYawControl.clearGesture(activeSession)
    }
    activeSession = { kind: 'none' }
  }

  const clearPendingTapState = () => {
    tapTouches.clear()
    lastTap = null
  }

  const finishStepSelectorGesture = (commitPreview: boolean) => {
    if (activeSession.kind !== 'step-selector') {
      return
    }

    if (isTimeWarpStepSelectorSession(activeSession)) {
      activeSession = timeWarpControl.finishGesture(
        activeSession,
        commitPreview && timeWarpControlVisible,
      )
      return
    }

    if (isTrajectoryHorizonStepSelectorSession(activeSession)) {
      activeSession = trajectoryHorizonControl.finishGesture(
        activeSession,
        commitPreview && trajectoryHorizonControlVisible,
      )
    }
  }

  const syncTimeWarpDockState = () => {
    const status = getTimeWarpControlStatus({
      decreasePreview: options.getTimeWarpPreview('decreaseTimeWarp'),
      increasePreview: options.getTimeWarpPreview('increaseTimeWarp'),
    })
    mobileCommandDock.setTimeWarpState({
      reason: status.reason,
      status: status.text,
      tone: status.tone,
    })
  }

  let targetControlVisible = true
  let trajectoryHorizonControlVisible = true

  const syncMobileCommandDockAvailability = () => {
    mobileCommandDock.setControlAvailability({
      rcsYaw: flightControlsVisible,
      target: targetControlVisible,
      thrust: flightControlsVisible,
      timeWarp: timeWarpControlVisible,
      trajectory: trajectoryHorizonControlVisible,
    })
  }

  const setTimeWarpControlVisible = (visible: boolean) => {
    timeWarpControlVisible = visible
    if (!visible && isTimeWarpStepSelectorSession(activeSession)) {
      finishStepSelectorGesture(false)
    }
    timeWarpControl.setVisible(visible)
    syncMobileCommandDockAvailability()
    syncTimeWarpDockState()
  }

  const setTrajectoryControlVisible = (visible: boolean) => {
    trajectoryHorizonControlVisible = visible
    if (
      !visible &&
      activeSession.kind === 'step-selector' &&
      activeSession.controlId === 'trajectory-horizon'
    ) {
      finishStepSelectorGesture(false)
    }
    trajectoryHorizonControl.setVisible(visible)
    syncMobileCommandDockAvailability()
  }

  const setTargetControlVisible = (visible: boolean) => {
    targetControlVisible = visible
    syncMobileCommandDockAvailability()
  }

  const clearRcsYawGesture = () => {
    activeSession = rcsYawControl.clearGesture(
      activeSession as RcsYawGestureSession,
    )
  }

  const clearRightZoneGesture = () => {
    activeSession = thrustControl.clearGesture(
      activeSession as ThrustGestureSession,
    )
  }

  const releaseFlightPanelInputs = () => {
    if (activeSession.kind === 'rcs-yaw-active') {
      clearRcsYawGesture()
    } else {
      rcsYawControl.clearInput()
    }
    if (
      activeSession.kind === 'right-zone-pending' ||
      activeSession.kind === 'right-zone-active'
    ) {
      clearRightZoneGesture()
    }
  }

  handleDockPanelChange = (_nextPanel, previousPanel) => {
    if (previousPanel === 'flight') {
      releaseFlightPanelInputs()
    }
    if (previousPanel === 'nav' && activeSession.kind === 'step-selector') {
      finishStepSelectorGesture(false)
    }
    thrustControl.syncUi()
  }

  const setFlightControlsVisible = (visible: boolean) => {
    flightControlsVisible = visible
    rcsYawControl.setAvailable(visible)
    thrustControl.setAvailable(visible)
    syncMobileCommandDockAvailability()
  }

  const clearZoneGesture = () => {
    if (activeSession.kind === 'step-selector') {
      finishStepSelectorGesture(false)
      return
    }

    if (
      activeSession.kind === 'right-zone-pending' ||
      activeSession.kind === 'right-zone-active'
    ) {
      clearRightZoneGesture()
      return
    }

    if (activeSession.kind === 'rcs-yaw-active') {
      clearRcsYawGesture()
    }
  }

  const clearGameplayTouchInput = () => {
    clearPendingTapState()
    clearZoneGesture()
    releaseFlightPanelInputs()
    thrustControl.clearInput()
    clearActiveSession()
    options.keyboardInput.clear()
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

  const beginTimeWarpSession = (
    point: StepSelectorGesturePoint,
    target: EventTarget | null,
  ) => {
    if (
      !timeWarpControlVisible ||
      !mobileCommandDock.isPanelOpen('nav') ||
      !isEventTargetInside(timeWarpControl.element, target)
    ) {
      return
    }

    activeSession = timeWarpControl.beginGesture(point)
  }

  const beginTrajectoryHorizonSession = (point: StepSelectorGesturePoint) => {
    if (
      !trajectoryHorizonControlVisible ||
      !mobileCommandDock.isPanelOpen('nav')
    ) {
      return
    }

    activeSession = trajectoryHorizonControl.beginGesture(point)
  }

  const beginDockedThrustSession = (touch: Touch) => {
    if (!mobileCommandDock.isPanelOpen('flight')) {
      return
    }

    activeSession = thrustControl.beginDockedGesture(
      touch,
      activeSession as ThrustGestureSession,
    )
  }

  const beginRcsYawSession = (touch: Touch) => {
    if (!mobileCommandDock.isPanelOpen('flight')) {
      return
    }

    activeSession = rcsYawControl.beginGesture(
      touch,
      activeSession as RcsYawGestureSession,
    )
  }

  const updateRcsYawSession = (touch: Touch) => {
    activeSession = rcsYawControl.updateGesture(
      touch,
      activeSession as RcsYawGestureSession,
    )
  }

  const getMouseStepSelectorPoint = (
    event: MouseEvent,
  ): StepSelectorGesturePoint => ({
    clientX: event.clientX,
    clientY: event.clientY,
    identifier: mouseStepSelectorTouchId,
  })

  const isMouseStepSelectorSession = () =>
    activeSession.kind === 'step-selector' &&
    activeSession.touchId === mouseStepSelectorTouchId

  const updateStepSelectorSession = (point: StepSelectorGesturePoint) => {
    if (activeSession.kind !== 'step-selector') {
      return
    }

    if (isTimeWarpStepSelectorSession(activeSession)) {
      if (!timeWarpControlVisible) {
        finishStepSelectorGesture(false)
        return
      }

      activeSession = timeWarpControl.updateGesture(point, activeSession)
      return
    }

    if (isTrajectoryHorizonStepSelectorSession(activeSession)) {
      if (!trajectoryHorizonControlVisible) {
        finishStepSelectorGesture(false)
        return
      }

      activeSession = trajectoryHorizonControl.updateGesture(
        point,
        activeSession,
      )
    }
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

  const beginCameraPanSession = (touch: Touch) => {
    activeSession = {
      kind: 'camera-pan',
      hasMovedForTap: false,
      hasPanned: false,
      previousX: touch.clientX,
      previousY: touch.clientY,
      startX: touch.clientX,
      startY: touch.clientY,
      touchId: touch.identifier,
    }
  }

  const sessionOwnsTouch = (touchId: number) => {
    switch (activeSession.kind) {
      case 'double-tap-zoom':
      case 'step-selector':
      case 'rcs-yaw-active':
      case 'right-zone-pending':
      case 'right-zone-active':
        if (activeSession.kind === 'rcs-yaw-active') {
          return rcsYawControl.ownsTouch(activeSession, touchId)
        }

        if (
          activeSession.kind === 'right-zone-pending' ||
          activeSession.kind === 'right-zone-active'
        ) {
          return thrustControl.ownsTouch(activeSession, touchId)
        }

        if (activeSession.kind === 'step-selector') {
          if (isTimeWarpStepSelectorSession(activeSession)) {
            return timeWarpControl.ownsTouch(activeSession, touchId)
          }

          return trajectoryHorizonControl.ownsTouch(activeSession, touchId)
        }

        return activeSession.touchId === touchId
      case 'pinch':
        return activeSession.touchIds.includes(touchId)
      case 'camera-pan':
        return activeSession.touchId === touchId
      case 'none':
        return false
    }
  }

  const suppressDefaultTouchBehavior = (event: TouchEvent) => {
    const navPanel = mobileCommandDock.element.querySelector<HTMLElement>(
      '#mobile-command-dock-nav-panel',
    )
    const isScrollableNavTarget =
      mobileCommandDock.isPanelOpen('nav') &&
      navPanel !== null &&
      isEventTargetInside(navPanel, event.target) &&
      !isEventTargetInside(timeWarpControl.element, event.target) &&
      !isEventTargetInside(trajectoryHorizonControl.element, event.target)
    if (isScrollableNavTarget) {
      return
    }

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
      if (!options.getInteractionsEnabled()) {
        clearGameplayTouchInput()
        return
      }

      const now = performance.now()

      const eventTarget = event.target
      const isMobileCommandDockTarget = isEventTargetInside(
        mobileCommandDock.element,
        eventTarget,
      )
      const isTimeWarpTarget =
        mobileCommandDock.isPanelOpen('nav') &&
        isEventTargetInside(timeWarpControl.element, eventTarget)
      const isTrajectoryHorizonTarget =
        mobileCommandDock.isPanelOpen('nav') &&
        isEventTargetInside(trajectoryHorizonControl.element, eventTarget)
      const isTargetControlTarget =
        mobileCommandDock.isPanelOpen('nav') &&
        isEventTargetInside(targetControl.element, eventTarget)
      const isRcsYawGestureTarget =
        mobileCommandDock.isPanelOpen('flight') &&
        rcsYawControl.containsGestureTarget(eventTarget)
      const isThrustTarget =
        mobileCommandDock.isPanelOpen('flight') &&
        isEventTargetInside(thrustControl.element, eventTarget)
      const isTouchControlTarget =
        isMobileCommandDockTarget ||
        isTimeWarpTarget ||
        isTrajectoryHorizonTarget ||
        isTargetControlTarget ||
        isRcsYawGestureTarget ||
        isThrustTarget
      let startedDoubleTapZoom = false

      if (
        activeSession.kind === 'pinch' ||
        activeSession.kind === 'double-tap-zoom'
      ) {
        return
      }

      for (const touch of Array.from(event.changedTouches)) {
        if (isTouchControlTarget) {
          continue
        }

        tapTouches.set(touch.identifier, {
          startTime: now,
          startX: touch.clientX,
          startY: touch.clientY,
        })

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

        if (activeSession.kind === 'none' && event.touches.length === 1) {
          beginCameraPanSession(touch)
        }
      }

      if (startedDoubleTapZoom) {
        return
      }

      if (isTouchControlTarget) {
        // A rapid follow-up touch can arrive before the prior touchend.
        const wasZoneGestureActive =
          activeSession.kind === 'step-selector' ||
          activeSession.kind === 'right-zone-pending' ||
          activeSession.kind === 'right-zone-active'
        if (wasZoneGestureActive) {
          clearZoneGesture()
        }
        const isSingleReplacementTouch =
          wasZoneGestureActive && event.changedTouches.length === 1
        if (
          activeSession.kind !== 'none' ||
          (event.touches.length !== 1 && !isSingleReplacementTouch)
        ) {
          return
        }

        for (const touch of Array.from(event.changedTouches)) {
          if (isTimeWarpTarget) {
            beginTimeWarpSession(touch, eventTarget)
          } else if (isTrajectoryHorizonTarget) {
            beginTrajectoryHorizonSession(touch)
          } else if (isTargetControlTarget) {
            continue
          } else if (isRcsYawGestureTarget) {
            beginRcsYawSession(touch)
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
      if (!options.getInteractionsEnabled()) {
        clearGameplayTouchInput()
        return
      }

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
            options.onZoom(factor, {
              x: (first.clientX + second.clientX) / 2,
              y: (first.clientY + second.clientY) / 2,
            })
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
        case 'camera-pan': {
          const touch = getTouchById(event.touches, activeSession.touchId)
          if (!touch) {
            return
          }

          const totalDeltaX = touch.clientX - activeSession.startX
          const totalDeltaY = touch.clientY - activeSession.startY
          const previousDeltaX = touch.clientX - activeSession.previousX
          const previousDeltaY = touch.clientY - activeSession.previousY
          const previousDistance = Math.hypot(previousDeltaX, previousDeltaY)
          if (Math.hypot(totalDeltaX, totalDeltaY) >= cameraPanTapTolerancePx) {
            activeSession.hasMovedForTap = true
          }

          if (options.getCameraControlsLocked()) {
            activeSession.previousX = touch.clientX
            activeSession.previousY = touch.clientY
            return
          }

          if (previousDistance <= 0) {
            return
          }

          activeSession.hasPanned =
            options.onCameraPanGesture(
              {
                x: activeSession.previousX,
                y: activeSession.previousY,
              },
              { x: touch.clientX, y: touch.clientY },
            ) || activeSession.hasPanned
          activeSession.previousX = touch.clientX
          activeSession.previousY = touch.clientY
          return
        }
        case 'step-selector': {
          const touch = getTouchById(event.touches, activeSession.touchId)
          if (!touch) {
            return
          }

          updateStepSelectorSession(touch)
          return
        }
        case 'rcs-yaw-active': {
          const touch = getTouchById(event.touches, activeSession.touchId)
          if (!touch) {
            return
          }

          updateRcsYawSession(touch)
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
      if (!options.getInteractionsEnabled()) {
        clearGameplayTouchInput()
        return
      }

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
          activeSession.kind === 'camera-pan' &&
          activeSession.touchId === touch.identifier
        ) {
          const completedPan =
            activeSession.hasMovedForTap || activeSession.hasPanned
          clearActiveSession()
          if (completedPan) {
            tapTouches.delete(touch.identifier)
            lastTap = null
            continue
          }
        }

        if (
          activeSession.kind === 'double-tap-zoom' &&
          activeSession.touchId === touch.identifier
        ) {
          clearActiveSession()
          lastTap = null
          continue
        }

        if (
          activeSession.kind === 'step-selector' &&
          activeSession.touchId === touch.identifier
        ) {
          finishStepSelectorGesture(true)
        }

        if (
          (activeSession.kind === 'right-zone-pending' ||
            activeSession.kind === 'right-zone-active') &&
          activeSession.touchId === touch.identifier
        ) {
          clearRightZoneGesture()
        }

        if (
          activeSession.kind === 'rcs-yaw-active' &&
          activeSession.touchId === touch.identifier
        ) {
          clearRcsYawGesture()
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

        lastTap = { time: now, x: touch.clientX, y: touch.clientY }
      }
    },
    { passive: false },
  )

  panel.addEventListener(
    'touchcancel',
    (event) => {
      if (!options.getInteractionsEnabled()) {
        clearGameplayTouchInput()
        return
      }

      pinchSuppressTapUntil = performance.now() + pinchSuppressTapMs
      clearPendingTapState()

      if (
        Array.from(event.changedTouches).some((touch) =>
          sessionOwnsTouch(touch.identifier),
        )
      ) {
        if (activeSession.kind === 'step-selector') {
          finishStepSelectorGesture(false)
        } else if (
          activeSession.kind === 'right-zone-pending' ||
          activeSession.kind === 'right-zone-active'
        ) {
          clearRightZoneGesture()
        } else if (activeSession.kind === 'rcs-yaw-active') {
          clearRcsYawGesture()
        } else {
          clearActiveSession()
        }
      }

      timeWarpControl.syncUi()
      mobileCommandDock.syncState()
      targetControl.syncUi()
      trajectoryHorizonControl.syncUi()
      rcsYawControl.syncUi()
    },
    { passive: false },
  )

  panel.addEventListener('mousedown', (event) => {
    if (event.button !== 0) {
      return
    }

    if (!options.getInteractionsEnabled()) {
      clearGameplayTouchInput()
      return
    }

    if (activeSession.kind !== 'none') {
      return
    }

    const eventTarget = event.target
    const isTimeWarpTarget =
      mobileCommandDock.isPanelOpen('nav') &&
      isEventTargetInside(timeWarpControl.element, eventTarget)
    const isTrajectoryHorizonTarget =
      mobileCommandDock.isPanelOpen('nav') &&
      isEventTargetInside(trajectoryHorizonControl.element, eventTarget)

    if (!isTimeWarpTarget && !isTrajectoryHorizonTarget) {
      return
    }

    event.preventDefault()
    clearPendingTapState()
    const point = getMouseStepSelectorPoint(event)
    if (isTimeWarpTarget) {
      beginTimeWarpSession(point, eventTarget)
      return
    }

    beginTrajectoryHorizonSession(point)
  })

  window.addEventListener('mousemove', (event) => {
    if (!isMouseStepSelectorSession()) {
      return
    }

    if (!options.getInteractionsEnabled()) {
      clearGameplayTouchInput()
      return
    }

    event.preventDefault()
    updateStepSelectorSession(getMouseStepSelectorPoint(event))
  })

  window.addEventListener('mouseup', (event) => {
    if (!isMouseStepSelectorSession()) {
      return
    }

    if (!options.getInteractionsEnabled()) {
      clearGameplayTouchInput()
      return
    }

    event.preventDefault()
    finishStepSelectorGesture(true)
  })

  window.addEventListener('blur', () => {
    if (isMouseStepSelectorSession()) {
      finishStepSelectorGesture(false)
    }
    clearGameplayTouchInput()
  })

  options.app.appendChild(panel)
  thrustControl.syncUi()
  timeWarpControl.syncUi()
  mobileCommandDock.syncState()
  syncTimeWarpDockState()
  targetControl.syncUi()
  syncMobileCommandDockAvailability()
  trajectoryHorizonControl.syncUi()
  rcsYawControl.syncUi()

  window.addEventListener('resize', () => {
    thrustControl.syncUi()
    timeWarpControl.syncUi()
    mobileCommandDock.syncState()
    syncTimeWarpDockState()
    targetControl.syncUi()
    trajectoryHorizonControl.syncUi()
    rcsYawControl.syncUi()
  })

  return {
    element: panel,
    infoPanelContainer: mobileCommandDock.infoPanelContainer,
    infoRailContainer: mobileCommandDock.infoRailContainer,
    openTargetControl: () => {
      if (!targetControlVisible) {
        return
      }

      targetControl.syncUi()
      mobileCommandDock.openTargetPopup()
      const focusTarget =
        targetControl.element.querySelector<HTMLElement>(
          'button:not([disabled])',
        ) ??
        mobileCommandDock.element.querySelector<HTMLElement>(
          '#mobile-command-dock-target-button',
        )
      focusTarget?.focus()
    },
    setFlightControlsVisible,
    setTargetControlVisible,
    setTrajectoryControlVisible,
    setTimeWarpControlVisible,
    setTutorialFocusedControl,
    setTutorialHintTarget: (target) => {
      const showThrustHint = target === 'thrust-zone'
      tutorialHint.setVisible(showThrustHint)
      tutorialHint.element.dataset.target = target ?? ''
    },
    syncUi: () => {
      if (!options.getInteractionsEnabled()) {
        clearGameplayTouchInput()
      }
      timeWarpControl.syncUi()
      mobileCommandDock.syncState()
      syncTimeWarpDockState()
      targetControl.syncUi()
      trajectoryHorizonControl.syncUi()
      thrustControl.syncUi()
      rcsYawControl.syncUi()
    },
    toggleInfoPanel: mobileCommandDock.toggleInfoPanel,
    updateAssistMode: (_mode) => {},
  }
}
