import type { AssistMode } from '../../assist/orbitalAssist'
import type { KeyboardInput } from '../../input/keyboardInput'
import type { TouchThrustControlUiState } from '../../runtime/appRuntimeState'
import type { AssistTargetUiState } from '../../runtime/gameQueries'
import type {
  TimeWarpAction,
  TimeWarpFeedbackReason,
} from '../../runtime/timeWarpFeedbackPolicy'
import type { TrajectoryHorizonAction } from '../../runtime/trajectoryHorizonControlPolicy'
import type {
  ScenarioTouchControlFocusTarget,
  ScenarioTouchHintTarget,
} from '../../scenario/scenarioPromptTypes'
import './touchControls.css'
import { createConfiguredTimeWarpControl } from './createTimeWarpControl'
import {
  createEdgeRevealControl,
  type EdgeRevealControl,
  type TouchControlRevealEdge,
  type TouchControlRevealPlacement,
} from './edgeRevealControl'
import type { StepSelectorGestureSession } from './stepSelectorControl/stepSelectorControlTypes'
import { createThrustControl, type ThrustGestureSession } from './thrustControl'
import { createTouchControlsTutorialHint } from './touchControlsTutorialHint'
import { createTrajectoryHorizonControl } from './trajectoryHorizonControl/createTrajectoryHorizonControl'
import {
  createTargetControl,
  type TargetControlBodyRow,
} from './targetControl/createTargetControl'

export type TouchControls = {
  element: HTMLElement
  setBurnControlSide(side: TouchControlRevealEdge): void
  setTargetControlVisible(visible: boolean): void
  setTrajectoryControlSide(side: TouchControlRevealEdge): void
  setTrajectoryControlVisible(visible: boolean): void
  setWarpControlSide(side: TouchControlRevealEdge): void
  setTimeWarpControlVisible(visible: boolean): void
  setTutorialFocusedControl(
    target: ScenarioTouchControlFocusTarget | null,
  ): void
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
    target: {
      edge: 'left',
      priority: 20,
    },
    trajectory: {
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
  | StepSelectorGestureSession<'time-warp'>
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
  automaticTargetingAvailable: boolean
  commitTrajectoryHorizon(action: TrajectoryHorizonAction): void
  commitTimeWarp(action: TimeWarpAction): void
  getCurrentTrajectoryHorizonHours(): number
  getCurrentTimeWarp(): number
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
  initialBurnControlSide: TouchControlRevealEdge
  initialTrajectoryControlSide: TouchControlRevealEdge
  initialWarpControlSide: TouchControlRevealEdge
  keyboardInput: KeyboardInput
  onReturnToAutomaticTarget(): boolean
  onSelectTargetIndex(index: number): boolean
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
  let syncTargetRecommendationCue = () => {}

  const syncMainThrust = (engaged: boolean) => {
    options.keyboardInput.setVirtualKey('main', engaged)
  }

  const timeWarpDock = document.createElement('div')
  timeWarpDock.className = 'touch-edge-reveal-dock touch-time-warp-reveal-dock'
  timeWarpDock.dataset.touchControlDock = 'warp'
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

  const trajectoryHorizonDock = document.createElement('div')
  trajectoryHorizonDock.className =
    'touch-edge-reveal-dock touch-trajectory-horizon-reveal-dock'
  trajectoryHorizonDock.dataset.touchControlDock = 'trajectory'
  const trajectoryHorizonControl = createTrajectoryHorizonControl({
    container: trajectoryHorizonDock,
    commitTrajectoryHorizon: options.commitTrajectoryHorizon,
    getCurrentTrajectoryHorizonHours: options.getCurrentTrajectoryHorizonHours,
    getTrajectoryHorizonPreviews: options.getTrajectoryHorizonPreviews,
    onSessionChange: (session) => {
      activeSession = session
    },
    panel,
  })

  const targetDock = document.createElement('div')
  targetDock.className = 'touch-edge-reveal-dock touch-target-reveal-dock'
  targetDock.dataset.touchControlDock = 'target'
  let closeTargetControl = () => {}
  const targetControl = createTargetControl({
    automaticTargetingAvailable: options.automaticTargetingAvailable,
    getRows: options.getTargetControlRows,
    getTargetState: options.getAssistTargetUiState,
    onCommit: () => closeTargetControl(),
    onReturnToAutomaticTarget: options.onReturnToAutomaticTarget,
    onSelectTargetIndex: options.onSelectTargetIndex,
    onStateChange: () => syncTargetRecommendationCue(),
  })
  targetDock.appendChild(targetControl.element)

  const thrustDock = document.createElement('div')
  thrustDock.className = 'touch-edge-reveal-dock touch-thrust-reveal-dock'
  thrustDock.dataset.touchControlDock = 'burn'
  let burnControlRevealed = false
  const thrustControl = createThrustControl({
    container: thrustDock,
    onSessionChange: (session) => {
      activeSession = session
    },
    onUiStateChange: (state) => {
      options.onThrustControlUiStateChange({
        ...state,
        revealed: burnControlRevealed,
      })
    },
    panel,
    setMainThrust: syncMainThrust,
    tapMoveTolerancePx,
    vibrate,
  })

  const timeWarpRevealPlacement: TouchControlRevealPlacement = {
    edge: options.initialWarpControlSide,
    priority: touchControlRevealLayout.controls.timeWarp.priority,
  }
  const trajectoryHorizonRevealPlacement: TouchControlRevealPlacement = {
    edge: options.initialTrajectoryControlSide,
    priority: touchControlRevealLayout.controls.trajectory.priority,
  }
  const targetRevealPlacement: TouchControlRevealPlacement = {
    edge: touchControlRevealLayout.controls.target.edge,
    priority: touchControlRevealLayout.controls.target.priority,
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
  const trajectoryHorizonRevealControl = createEdgeRevealControl({
    content: trajectoryHorizonDock,
    icon: 'Traj',
    id: 'touch-trajectory-horizon-reveal',
    label: 'Reveal trajectory prediction horizon control',
    placement: trajectoryHorizonRevealPlacement,
  })
  const targetRevealControl = createEdgeRevealControl({
    content: targetDock,
    icon: 'Target',
    id: 'touch-target-reveal',
    label: 'Reveal target body selector',
    placement: targetRevealPlacement,
  })
  closeTargetControl = targetRevealControl.close
  const targetRevealTab =
    targetRevealControl.element.querySelector<HTMLButtonElement>(
      '.touch-edge-reveal-tab',
    )
  const thrustRevealControl = createEdgeRevealControl({
    content: thrustDock,
    icon: 'Burn',
    id: 'touch-thrust-reveal',
    label: 'Reveal thrust control',
    onOpenChange: (open) => {
      burnControlRevealed = open
      thrustControl.syncUi()
    },
    placement: thrustRevealPlacement,
  })
  const revealControls = [
    timeWarpRevealControl,
    trajectoryHorizonRevealControl,
    targetRevealControl,
    thrustRevealControl,
  ]
  const tutorialFocusTargets: Record<
    ScenarioTouchControlFocusTarget,
    EdgeRevealControl
  > = {
    burn: thrustRevealControl,
    trajectory: trajectoryHorizonRevealControl,
    warp: timeWarpRevealControl,
  }

  const setTutorialFocusedControl = (
    target: ScenarioTouchControlFocusTarget | null,
  ) => {
    if (target) {
      panel.dataset.tutorialFocusedControl = target
    } else {
      delete panel.dataset.tutorialFocusedControl
    }

    for (const [controlTarget, revealControl] of Object.entries(
      tutorialFocusTargets,
    ) as [ScenarioTouchControlFocusTarget, EdgeRevealControl][]) {
      revealControl.element.classList.toggle(
        'touch-edge-reveal-control-tutorial-focused',
        target === controlTarget,
      )
    }
  }
  syncRevealControlLayout(revealControls)
  panel.append(
    timeWarpRevealControl.element,
    trajectoryHorizonRevealControl.element,
    targetRevealControl.element,
    thrustRevealControl.element,
  )

  syncTargetRecommendationCue = () => {
    const targetState = options.getAssistTargetUiState()
    const recommendedTarget = targetState.recommendedTarget
    const hasRecommendation =
      targetState.mode === 'manual' && recommendedTarget !== null
    targetRevealControl.element.classList.remove(
      'touch-target-reveal-recommended',
    )
    const targetRevealLabel =
      hasRecommendation && recommendedTarget
        ? `Reveal target body selector; ${recommendedTarget.name} recommended`
        : 'Reveal target body selector'
    targetRevealTab?.setAttribute('aria-label', targetRevealLabel)
  }

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

  const finishStepSelectorGesture = (commitPreview: boolean) => {
    if (activeSession.kind !== 'step-selector') {
      return
    }

    if (activeSession.controlId === 'time-warp') {
      activeSession = timeWarpControl.finishGesture(
        activeSession,
        commitPreview && timeWarpControlVisible,
      )
      return
    }

    activeSession = trajectoryHorizonControl.finishGesture(
      activeSession,
      commitPreview && trajectoryHorizonControlVisible,
    )
  }

  const setTimeWarpControlVisible = (visible: boolean) => {
    timeWarpControlVisible = visible
    if (
      !visible &&
      activeSession.kind === 'step-selector' &&
      activeSession.controlId === 'time-warp'
    ) {
      finishStepSelectorGesture(false)
    }
    timeWarpRevealControl.setAvailable(visible)
    timeWarpControl.setVisible(visible)
  }

  let trajectoryHorizonControlVisible = true
  const setTrajectoryControlVisible = (visible: boolean) => {
    trajectoryHorizonControlVisible = visible
    if (
      !visible &&
      activeSession.kind === 'step-selector' &&
      activeSession.controlId === 'trajectory-horizon'
    ) {
      finishStepSelectorGesture(false)
    }
    trajectoryHorizonRevealControl.setAvailable(visible)
    trajectoryHorizonControl.setVisible(visible)
  }

  const setTargetControlVisible = (visible: boolean) => {
    if (!visible) {
      closeTargetControl()
    }
    targetRevealControl.setAvailable(visible)
  }

  const clearRightZoneGesture = () => {
    activeSession = thrustControl.clearGesture(
      activeSession as ThrustGestureSession,
    )
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

  const beginTimeWarpSession = (touch: Touch) => {
    if (!timeWarpControlVisible || !timeWarpRevealControl.isOpen()) {
      return
    }

    activeSession = timeWarpControl.beginGesture(touch)
  }

  const beginTrajectoryHorizonSession = (touch: Touch) => {
    if (
      !trajectoryHorizonControlVisible ||
      !trajectoryHorizonRevealControl.isOpen()
    ) {
      return
    }

    activeSession = trajectoryHorizonControl.beginGesture(touch)
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
      case 'step-selector':
      case 'right-zone-pending':
      case 'right-zone-active':
        return activeSession.kind === 'right-zone-pending' ||
          activeSession.kind === 'right-zone-active'
          ? thrustControl.ownsTouch(activeSession, touchId)
          : activeSession.kind === 'step-selector'
            ? activeSession.controlId === 'time-warp'
              ? timeWarpControl.ownsTouch(activeSession, touchId)
              : trajectoryHorizonControl.ownsTouch(activeSession, touchId)
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
      const isTrajectoryHorizonTarget =
        trajectoryHorizonRevealControl.isOpen() &&
        isEventTargetInside(trajectoryHorizonRevealControl.element, eventTarget)
      const isTargetControlTarget =
        targetRevealControl.isOpen() &&
        isEventTargetInside(targetRevealControl.element, eventTarget)
      const isThrustTarget =
        thrustRevealControl.isOpen() &&
        isEventTargetInside(thrustRevealControl.element, eventTarget)
      const isRevealControlTarget =
        isTimeWarpTarget ||
        isTrajectoryHorizonTarget ||
        isTargetControlTarget ||
        isThrustTarget
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
            beginTimeWarpSession(touch)
          } else if (isTrajectoryHorizonTarget) {
            beginTrajectoryHorizonSession(touch)
          } else if (isTargetControlTarget) {
            continue
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
        case 'step-selector': {
          if (
            (activeSession.controlId === 'time-warp' &&
              !timeWarpControlVisible) ||
            (activeSession.controlId === 'trajectory-horizon' &&
              !trajectoryHorizonControlVisible)
          ) {
            finishStepSelectorGesture(false)
            return
          }

          const touch = getTouchById(event.touches, activeSession.touchId)
          if (!touch) {
            return
          }

          activeSession =
            activeSession.controlId === 'time-warp'
              ? timeWarpControl.updateGesture(touch, activeSession)
              : trajectoryHorizonControl.updateGesture(touch, activeSession)
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
        if (activeSession.kind === 'step-selector') {
          finishStepSelectorGesture(false)
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
      syncTargetRecommendationCue()
      targetControl.syncUi()
      trajectoryHorizonControl.syncUi()
    },
    { passive: false },
  )

  options.app.appendChild(panel)
  thrustControl.syncUi()
  syncTargetRecommendationCue()
  targetControl.syncUi()
  trajectoryHorizonControl.syncUi()

  window.addEventListener('resize', () => {
    thrustControl.syncUi()
    timeWarpControl.syncUi()
    syncTargetRecommendationCue()
    targetControl.syncUi()
    trajectoryHorizonControl.syncUi()
  })

  return {
    element: panel,
    setBurnControlSide: (side) => {
      thrustRevealControl.setEdge(side)
      syncRevealControlLayout(revealControls)
    },
    setTrajectoryControlSide: (side) => {
      trajectoryHorizonRevealControl.setEdge(side)
      syncRevealControlLayout(revealControls)
    },
    setTargetControlVisible,
    setTrajectoryControlVisible,
    setWarpControlSide: (side) => {
      timeWarpRevealControl.setEdge(side)
      syncRevealControlLayout(revealControls)
    },
    setTimeWarpControlVisible,
    setTutorialFocusedControl,
    setTutorialHintTarget: (target) => {
      const showThrustHint = target === 'thrust-zone'
      tutorialHint.setVisible(showThrustHint)
      tutorialHint.element.dataset.target = target ?? ''
    },
    syncUi: () => {
      timeWarpControl.syncUi()
      syncTargetRecommendationCue()
      targetControl.syncUi()
      trajectoryHorizonControl.syncUi()
      thrustControl.syncUi()
    },
    updateAssistMode: (_mode) => {},
  }
}
