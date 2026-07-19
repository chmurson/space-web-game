import type { AssistMode } from '../../assist/orbitalAssist'
import { getIntentionalSwipeThresholdPoint } from '../../input/intentionalSwipeThreshold'
import type { KeyboardInput } from '../../input/keyboardInput'
import type { TouchThrustControlUiState } from '../../runtime/appRuntimeState'
import type { AssistTargetUiState } from '../../runtime/gameQueries'
import type {
  TimeWarpAction,
  TimeWarpFeedbackReason,
} from '../../runtime/timeWarpFeedbackPolicy'
import type { TrajectoryHorizonAction } from '../../runtime/trajectoryHorizonControlPolicy'
import type { CameraControlMode } from '../../scenario/scenarioDirectiveTypes'
import type {
  ScenarioTouchControlFocusTarget,
  ScenarioTouchHintTarget,
} from '../../scenario/scenarioPromptTypes'
import './touchControls.css'
import {
  createConfiguredTimeWarpControl,
  createPrototypeTimeWarpControl2,
} from './createTimeWarpControl'
import {
  createEdgeRevealControl,
  type EdgeRevealControl,
  type TouchControlRevealEdge,
  type TouchControlRevealPlacement,
} from './edgeRevealControl'
import { createMobileCommandDock } from './mobileCommandDock'
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
import type { TimeWarpControl, TimeWarpControlId } from './timeWarpControlTypes'
import { createTouchControlsShell } from './touchControlsShell'
import { createTouchControlsTutorialHint } from './touchControlsTutorialHint'
import { createTrajectoryHorizonControl } from './trajectoryHorizonControl/createTrajectoryHorizonControl'

export type TouchControls = {
  element: HTMLElement
  openTargetControl(): void
  setFlightControlsVisible(visible: boolean): void
  setTargetControlSide(side: TouchControlRevealEdge): void
  setTargetControlVisible(visible: boolean): void
  setTrajectoryControlSide(side: TouchControlRevealState): void
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
const cameraPanTapTolerancePx = 8
const targetHeadingHoldDelayMs = 320
const intentionalCameraUnlockSwipeViewportRatio = 0.5
const touchControlRevealTabHeightPx = 84
const mouseStepSelectorTouchId = -1
const touchControlRevealLayout = {
  gapPx: 66,
  startOffsetPx: 72,
  controls: {
    timeWarp: {
      edge: 'right',
      priority: 10,
    },
    target: {
      priority: 20,
    },
    trajectory: {
      priority: 10,
    },
  },
} as const

type TouchControlRevealState = TouchControlRevealEdge | 'hidden'

const getRevealEdge = (
  state: TouchControlRevealState,
): TouchControlRevealEdge => (state === 'hidden' ? 'left' : state)

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
      kind: 'target-heading-plan'
      mode: 'tap-confirm'
      hasMovedForTap: boolean
      startX: number
      startY: number
      touchId: number
    }
  | {
      kind: 'target-heading-plan'
      mode: 'drag-release'
      latestX: number
      latestY: number
      startX: number
      startY: number
      started: boolean
      timeoutId: number
      touchId: number
    }
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

const syncRevealControlLayout = (revealControls: EdgeRevealControl[]) => {
  const controlsByEdge = new Map<TouchControlRevealEdge, EdgeRevealControl[]>()

  for (const revealControl of revealControls) {
    if (revealControl.element.hidden) {
      continue
    }

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
  getInteractionsEnabled(): boolean
  getMobileManeuverStartByDrag(): boolean
  getSpacecraftVisible(): boolean
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
  initialTargetControlSide: TouchControlRevealEdge
  initialTrajectoryControlSide: TouchControlRevealState
  initialWarpControlSide: TouchControlRevealEdge
  keyboardInput: KeyboardInput
  getCameraMode(): CameraControlMode
  getCameraModeChangesLocked(): boolean
  onCameraUnlockedBySwipe?(): void
  onCameraModeSelected(mode: CameraControlMode): boolean
  onCameraPanGesture(previous: ScreenPoint, next: ScreenPoint): boolean
  onReturnToAutomaticTarget(): boolean
  onSelectTargetIndex(index: number): boolean
  onTargetStateChange?(): void
  onTargetHeadingPlan(screenX: number, screenY: number): void
  onTargetHeadingPlanCanceled(): void
  onTargetHeadingPlanCommitted(): boolean
  onThrustControlUiStateChange(state: TouchThrustControlUiState): void
  onZoom(factor: number, focalPoint?: ScreenPoint): void
}): TouchControls => {
  const touchControlsShell = createTouchControlsShell()
  const panel = touchControlsShell.element
  const {
    target: targetDock,
    trajectory: trajectoryHorizonDock,
    warp: timeWarpDock,
    warpPrototype: timeWarpPrototypeDock,
  } = touchControlsShell.docks

  let handleFlightPanelOpenChange = (_open: boolean) => {}
  const mobileCommandDock = createMobileCommandDock({
    app: options.app,
    container: panel,
    onOpenChange: (open) => handleFlightPanelOpenChange(open),
  })
  const tutorialHint = createTouchControlsTutorialHint({ container: panel })

  const tapTouches = new Map<number, TapState>()
  let activeSession: ActiveGestureSession = { kind: 'none' }
  let lastTap: (ScreenPoint & { time: number }) | null = null
  let pinchSuppressTapUntil = 0
  let targetHeadingPlanActive = false
  let timeWarpControlVisible = true
  let syncTargetRecommendationCue = () => {}

  const syncMainThrust = (engaged: boolean) => {
    options.keyboardInput.setVirtualKey('main', engaged)
  }

  const syncRcsYawTurn = (turn: number) => {
    options.keyboardInput.setVirtualTurn(turn)
  }

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
  const timeWarpControl2 = createPrototypeTimeWarpControl2({
    container: timeWarpPrototypeDock,
    commitTimeWarp: options.commitTimeWarp,
    getCurrentTimeWarp: options.getCurrentTimeWarp,
    getTimeWarpPreview: options.getTimeWarpPreview,
    getTimeWarpPreviews: options.getTimeWarpPreviews,
    onSessionChange: (session) => {
      activeSession = session
    },
    panel,
  })
  const isTimeWarpControlId = (
    controlId: string,
  ): controlId is TimeWarpControlId =>
    controlId === 'time-warp' || controlId === 'time-warp-2'
  const isTimeWarpStepSelectorSession = (
    session: ActiveGestureSession,
  ): session is StepSelectorGestureSession<TimeWarpControlId> =>
    session.kind === 'step-selector' && isTimeWarpControlId(session.controlId)
  const isTrajectoryHorizonStepSelectorSession = (
    session: ActiveGestureSession,
  ): session is StepSelectorGestureSession<'trajectory-horizon'> =>
    session.kind === 'step-selector' &&
    session.controlId === 'trajectory-horizon'
  const getTimeWarpControlForSession = (
    session: StepSelectorGestureSession<TimeWarpControlId>,
  ): TimeWarpControl =>
    session.controlId === 'time-warp-2' ? timeWarpControl2 : timeWarpControl
  const getTimeWarpControlForTarget = (
    target: EventTarget | null,
  ): TimeWarpControl | null => {
    if (isEventTargetInside(timeWarpControl2.element, target)) {
      return timeWarpControl2
    }
    if (isEventTargetInside(timeWarpControl.element, target)) {
      return timeWarpControl
    }
    return null
  }

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

  let closeTargetControl = () => {}
  const targetControl = createTargetControl({
    automaticTargetingAvailable: options.automaticTargetingAvailable,
    getRows: options.getTargetControlRows,
    getTargetState: options.getAssistTargetUiState,
    onCommit: () => closeTargetControl(),
    onReturnToAutomaticTarget: options.onReturnToAutomaticTarget,
    onSelectTargetIndex: options.onSelectTargetIndex,
    onStateChange: () => {
      syncTargetRecommendationCue()
      options.onTargetStateChange?.()
    },
  })
  targetDock.appendChild(targetControl.element)

  const thrustControl = createThrustControl({
    container: mobileCommandDock.thrustContainer,
    onSessionChange: (session) => {
      activeSession = session
    },
    onUiStateChange: (state) => {
      const panelOpen = mobileCommandDock.isOpen()
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
    onCloseRequest: () => mobileCommandDock.setOpen(false),
    onSessionChange: (session) => {
      activeSession = session
    },
    setTurn: syncRcsYawTurn,
  })

  const timeWarpRevealPlacement: TouchControlRevealPlacement = {
    edge: options.initialWarpControlSide,
    priority: touchControlRevealLayout.controls.timeWarp.priority,
  }
  const timeWarpPrototypeRevealPlacement: TouchControlRevealPlacement = {
    edge: options.initialWarpControlSide,
    priority: touchControlRevealLayout.controls.timeWarp.priority,
  }
  const trajectoryHorizonRevealPlacement: TouchControlRevealPlacement = {
    edge: getRevealEdge(options.initialTrajectoryControlSide),
    priority: touchControlRevealLayout.controls.trajectory.priority,
  }
  const targetRevealPlacement: TouchControlRevealPlacement = {
    edge: options.initialTargetControlSide,
    priority: touchControlRevealLayout.controls.target.priority,
  }
  const timeWarpRevealControl = createEdgeRevealControl({
    content: timeWarpDock,
    icon: 'Warp',
    id: 'touch-time-warp-reveal',
    label: 'Reveal time warp control',
    placement: timeWarpRevealPlacement,
  })
  const timeWarpPrototypeRevealControl = createEdgeRevealControl({
    allowContentSwipeClose: false,
    content: timeWarpPrototypeDock,
    icon: 'Warp 2',
    id: 'touch-time-warp-prototype-reveal',
    label: 'Reveal Time Warp control 2',
    placement: timeWarpPrototypeRevealPlacement,
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
  const revealControls = [
    timeWarpRevealControl,
    timeWarpPrototypeRevealControl,
    trajectoryHorizonRevealControl,
    targetRevealControl,
  ]
  const tutorialFocusTargets: Record<
    Exclude<ScenarioTouchControlFocusTarget, 'burn'>,
    EdgeRevealControl
  > = {
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

    mobileCommandDock.setTutorialFocused(target === 'burn')

    for (const [controlTarget, revealControl] of Object.entries(
      tutorialFocusTargets,
    ) as [
      Exclude<ScenarioTouchControlFocusTarget, 'burn'>,
      EdgeRevealControl,
    ][]) {
      revealControl.element.classList.toggle(
        'touch-edge-reveal-control-tutorial-focused',
        target === controlTarget,
      )
    }
  }
  syncRevealControlLayout(revealControls)
  panel.append(
    timeWarpRevealControl.element,
    timeWarpPrototypeRevealControl.element,
    trajectoryHorizonRevealControl.element,
    targetRevealControl.element,
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
      activeSession = getTimeWarpControlForSession(activeSession).finishGesture(
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

  const setTimeWarpControlVisible = (visible: boolean) => {
    timeWarpControlVisible = visible
    if (!visible && isTimeWarpStepSelectorSession(activeSession)) {
      finishStepSelectorGesture(false)
    }
    timeWarpRevealControl.setAvailable(visible)
    timeWarpPrototypeRevealControl.setAvailable(visible)
    timeWarpControl.setVisible(visible)
    timeWarpControl2.setVisible(visible)
    syncRevealControlLayout(revealControls)
  }

  let trajectoryHorizonScenarioVisible = true
  let trajectoryHorizonUserVisible =
    options.initialTrajectoryControlSide !== 'hidden'
  let trajectoryHorizonControlVisible = false

  const syncTrajectoryControlVisibility = () => {
    const visible =
      trajectoryHorizonScenarioVisible && trajectoryHorizonUserVisible
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
    syncRevealControlLayout(revealControls)
  }

  const setTrajectoryControlVisible = (visible: boolean) => {
    trajectoryHorizonScenarioVisible = visible
    syncTrajectoryControlVisibility()
  }

  const setTargetControlVisible = (visible: boolean) => {
    if (!visible) {
      closeTargetControl()
    }
    targetRevealControl.setAvailable(visible)
    syncRevealControlLayout(revealControls)
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

  const clearFlightInputs = () => {
    if (activeSession.kind === 'rcs-yaw-active') {
      clearRcsYawGesture()
    } else {
      rcsYawControl.clearInput()
    }
    thrustControl.clearInput()
  }

  handleFlightPanelOpenChange = (open) => {
    if (!open) {
      clearFlightInputs()
    }
    thrustControl.syncUi()
  }

  const setFlightControlsVisible = (visible: boolean) => {
    rcsYawControl.setAvailable(visible)
    thrustControl.setAvailable(visible)
    mobileCommandDock.setControlAvailability({
      rcsYaw: visible,
      thrust: visible,
    })
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
    cancelTargetHeadingPlan()
    clearZoneGesture()
    clearFlightInputs()
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
    cancelTargetHeadingPlan()
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
    if (!timeWarpControlVisible) {
      return
    }

    const timeWarpSessionControl = getTimeWarpControlForTarget(target)
    if (!timeWarpSessionControl) {
      return
    }

    const revealControl =
      timeWarpSessionControl === timeWarpControl2
        ? timeWarpPrototypeRevealControl
        : timeWarpRevealControl
    if (!revealControl.isOpen()) {
      return
    }

    activeSession = timeWarpSessionControl.beginGesture(point)
  }

  const beginTrajectoryHorizonSession = (point: StepSelectorGesturePoint) => {
    if (
      !trajectoryHorizonControlVisible ||
      !trajectoryHorizonRevealControl.isOpen()
    ) {
      return
    }

    activeSession = trajectoryHorizonControl.beginGesture(point)
  }

  const beginDockedThrustSession = (touch: Touch) => {
    if (!mobileCommandDock.isOpen()) {
      return
    }

    activeSession = thrustControl.beginDockedGesture(
      touch,
      activeSession as ThrustGestureSession,
    )
  }

  const beginRcsYawSession = (touch: Touch) => {
    if (!mobileCommandDock.isOpen()) {
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

      activeSession = getTimeWarpControlForSession(activeSession).updateGesture(
        point,
        activeSession,
      )
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

  const beginTapConfirmTargetHeadingPlanSession = (touch: Touch) => {
    if (!targetHeadingPlanActive || !options.getSpacecraftVisible()) {
      return
    }

    activeSession = {
      kind: 'target-heading-plan',
      mode: 'tap-confirm',
      hasMovedForTap: false,
      startX: touch.clientX,
      startY: touch.clientY,
      touchId: touch.identifier,
    }
  }

  const beginDragReleaseTargetHeadingPlanSession = (touch: Touch) => {
    if (!options.getSpacecraftVisible()) {
      return false
    }

    const touchId = touch.identifier
    activeSession = {
      kind: 'target-heading-plan',
      mode: 'drag-release',
      latestX: touch.clientX,
      latestY: touch.clientY,
      startX: touch.clientX,
      startY: touch.clientY,
      started: false,
      timeoutId: window.setTimeout(() => {
        if (
          activeSession.kind !== 'target-heading-plan' ||
          activeSession.mode !== 'drag-release' ||
          activeSession.touchId !== touchId
        ) {
          return
        }
        if (!options.getSpacecraftVisible()) {
          cancelTargetHeadingPlan()
          return
        }
        targetHeadingPlanActive = true
        activeSession.started = true
        options.onTargetHeadingPlan(
          activeSession.latestX,
          activeSession.latestY,
        )
      }, targetHeadingHoldDelayMs),
      touchId,
    }
    return true
  }

  const clearTargetHeadingPlanSession = () => {
    if (activeSession.kind !== 'target-heading-plan') {
      return
    }
    if (activeSession.mode === 'drag-release') {
      window.clearTimeout(activeSession.timeoutId)
    }
    activeSession = { kind: 'none' }
  }

  const cancelTargetHeadingPlan = () => {
    if (!targetHeadingPlanActive) {
      clearTargetHeadingPlanSession()
      return
    }

    targetHeadingPlanActive = false
    clearTargetHeadingPlanSession()
    options.onTargetHeadingPlanCanceled()
  }

  const beginTargetHeadingPlan = (touch: Touch) => {
    if (!options.getSpacecraftVisible()) {
      return false
    }

    targetHeadingPlanActive = true
    options.onTargetHeadingPlan(touch.clientX, touch.clientY)
    return true
  }

  const commitTargetHeadingPlan = () => {
    if (!targetHeadingPlanActive) {
      return false
    }

    targetHeadingPlanActive = false
    clearTargetHeadingPlanSession()
    return options.onTargetHeadingPlanCommitted()
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
            return getTimeWarpControlForSession(activeSession).ownsTouch(
              activeSession,
              touchId,
            )
          }

          return trajectoryHorizonControl.ownsTouch(activeSession, touchId)
        }

        return activeSession.touchId === touchId
      case 'pinch':
        return activeSession.touchIds.includes(touchId)
      case 'target-heading-plan':
      case 'camera-pan':
        return activeSession.touchId === touchId
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
      if (!options.getInteractionsEnabled()) {
        clearGameplayTouchInput()
        return
      }

      const now = performance.now()
      if (targetHeadingPlanActive && !options.getSpacecraftVisible()) {
        cancelTargetHeadingPlan()
        return
      }

      const eventTarget = event.target
      const isMobileCommandDockTarget = isEventTargetInside(
        mobileCommandDock.element,
        eventTarget,
      )
      const isTimeWarpTarget =
        timeWarpRevealControl.isOpen() &&
        isEventTargetInside(timeWarpRevealControl.element, eventTarget)
      const isTimeWarpPrototypeTarget =
        timeWarpPrototypeRevealControl.isOpen() &&
        isEventTargetInside(timeWarpPrototypeRevealControl.element, eventTarget)
      const isTrajectoryHorizonTarget =
        trajectoryHorizonRevealControl.isOpen() &&
        isEventTargetInside(trajectoryHorizonRevealControl.element, eventTarget)
      const isTargetControlTarget =
        targetRevealControl.isOpen() &&
        isEventTargetInside(targetRevealControl.element, eventTarget)
      const isRcsYawGestureTarget =
        mobileCommandDock.isOpen() &&
        rcsYawControl.containsGestureTarget(eventTarget)
      const isThrustTarget =
        mobileCommandDock.isOpen() &&
        isEventTargetInside(thrustControl.element, eventTarget)
      const isRevealControlTarget =
        isMobileCommandDockTarget ||
        isTimeWarpTarget ||
        isTimeWarpPrototypeTarget ||
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

      if (
        targetHeadingPlanActive &&
        !isRevealControlTarget &&
        event.touches.length >= 2
      ) {
        event.preventDefault()
        pinchSuppressTapUntil = now + pinchSuppressTapMs
        clearPendingTapState()
        cancelTargetHeadingPlan()
        return
      }

      for (const touch of Array.from(event.changedTouches)) {
        if (isRevealControlTarget) {
          continue
        }

        tapTouches.set(touch.identifier, {
          startTime: now,
          startX: touch.clientX,
          startY: touch.clientY,
        })

        if (targetHeadingPlanActive) {
          if (activeSession.kind === 'none' && event.touches.length === 1) {
            beginTapConfirmTargetHeadingPlanSession(touch)
          }
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

        if (
          options.getMobileManeuverStartByDrag() &&
          activeSession.kind === 'none' &&
          event.touches.length === 1
        ) {
          if (beginDragReleaseTargetHeadingPlanSession(touch)) {
            continue
          }
        }

        if (activeSession.kind === 'none' && event.touches.length === 1) {
          beginCameraPanSession(touch)
        }
      }

      if (startedDoubleTapZoom) {
        return
      }

      if (isRevealControlTarget) {
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
          if (isTimeWarpTarget || isTimeWarpPrototypeTarget) {
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
        case 'target-heading-plan': {
          if (!options.getSpacecraftVisible()) {
            cancelTargetHeadingPlan()
            return
          }

          const touch = getTouchById(event.touches, activeSession.touchId)
          if (!touch) {
            return
          }

          if (activeSession.mode === 'drag-release') {
            activeSession.latestX = touch.clientX
            activeSession.latestY = touch.clientY

            if (activeSession.started) {
              options.onTargetHeadingPlan(touch.clientX, touch.clientY)
              return
            }

            if (
              Math.hypot(
                touch.clientX - activeSession.startX,
                touch.clientY - activeSession.startY,
              ) >= cameraPanTapTolerancePx
            ) {
              cancelTargetHeadingPlan()
              beginCameraPanSession(touch)
            }
            return
          }

          if (
            Math.hypot(
              touch.clientX - activeSession.startX,
              touch.clientY - activeSession.startY,
            ) >= cameraPanTapTolerancePx
          ) {
            activeSession.hasMovedForTap = true
            options.onTargetHeadingPlan(touch.clientX, touch.clientY)
          }
          return
        }
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

          if (options.getCameraMode() !== 'unlocked') {
            const unlockThresholdX =
              window.innerWidth * intentionalCameraUnlockSwipeViewportRatio
            const unlockThresholdY =
              window.innerHeight * intentionalCameraUnlockSwipeViewportRatio
            const shouldUnlock =
              !options.getCameraModeChangesLocked() &&
              (Math.abs(totalDeltaX) >= unlockThresholdX ||
                Math.abs(totalDeltaY) >= unlockThresholdY)

            if (!shouldUnlock) {
              return
            }

            const thresholdPoint = getIntentionalSwipeThresholdPoint({
              currentX: touch.clientX,
              currentY: touch.clientY,
              startX: activeSession.startX,
              startY: activeSession.startY,
              thresholdX: unlockThresholdX,
              thresholdY: unlockThresholdY,
            })

            if (thresholdPoint && options.onCameraModeSelected('unlocked')) {
              options.onCameraUnlockedBySwipe?.()
              activeSession.hasPanned =
                options.onCameraPanGesture(thresholdPoint, {
                  x: touch.clientX,
                  y: touch.clientY,
                }) || activeSession.hasPanned
            }
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
          activeSession.kind === 'target-heading-plan' &&
          activeSession.touchId === touch.identifier
        ) {
          if (activeSession.mode === 'drag-release') {
            const shouldCommit = activeSession.started
            window.clearTimeout(activeSession.timeoutId)
            activeSession = { kind: 'none' }
            if (shouldCommit) {
              commitTargetHeadingPlan()
              tapTouches.delete(touch.identifier)
              lastTap = null
              continue
            }
          } else {
            const shouldCommit = !activeSession.hasMovedForTap
            activeSession = { kind: 'none' }
            if (shouldCommit) {
              commitTargetHeadingPlan()
              tapTouches.delete(touch.identifier)
              lastTap = null
              continue
            }

            tapTouches.delete(touch.identifier)
            lastTap = null
            continue
          }
        }

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

        if (
          !options.getMobileManeuverStartByDrag() &&
          !targetHeadingPlanActive &&
          beginTargetHeadingPlan(touch)
        ) {
          lastTap = null
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
        if (activeSession.kind === 'target-heading-plan') {
          cancelTargetHeadingPlan()
        } else if (activeSession.kind === 'step-selector') {
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
      timeWarpControl2.syncUi()
      syncTargetRecommendationCue()
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
      timeWarpRevealControl.isOpen() &&
      isEventTargetInside(timeWarpRevealControl.element, eventTarget)
    const isTimeWarpPrototypeTarget =
      timeWarpPrototypeRevealControl.isOpen() &&
      isEventTargetInside(timeWarpPrototypeRevealControl.element, eventTarget)
    const isTrajectoryHorizonTarget =
      trajectoryHorizonRevealControl.isOpen() &&
      isEventTargetInside(trajectoryHorizonRevealControl.element, eventTarget)

    if (
      !isTimeWarpTarget &&
      !isTimeWarpPrototypeTarget &&
      !isTrajectoryHorizonTarget
    ) {
      return
    }

    event.preventDefault()
    clearPendingTapState()
    const point = getMouseStepSelectorPoint(event)
    if (isTimeWarpTarget || isTimeWarpPrototypeTarget) {
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
  timeWarpControl2.syncUi()
  syncTargetRecommendationCue()
  targetControl.syncUi()
  syncTrajectoryControlVisibility()
  trajectoryHorizonControl.syncUi()
  rcsYawControl.syncUi()

  window.addEventListener('resize', () => {
    thrustControl.syncUi()
    timeWarpControl.syncUi()
    timeWarpControl2.syncUi()
    syncTargetRecommendationCue()
    targetControl.syncUi()
    trajectoryHorizonControl.syncUi()
    rcsYawControl.syncUi()
  })

  return {
    element: panel,
    openTargetControl: () => {
      targetRevealControl.setOpen(true)
      syncTargetRecommendationCue()
      targetControl.syncUi()
    },
    setFlightControlsVisible,
    setTargetControlSide: (side) => {
      targetRevealControl.setEdge(side)
      syncRevealControlLayout(revealControls)
    },
    setTrajectoryControlSide: (side) => {
      trajectoryHorizonUserVisible = side !== 'hidden'
      if (side !== 'hidden') {
        trajectoryHorizonRevealControl.setEdge(side)
      }
      syncTrajectoryControlVisibility()
    },
    setTargetControlVisible,
    setTrajectoryControlVisible,
    setWarpControlSide: (side) => {
      timeWarpRevealControl.setEdge(side)
      timeWarpPrototypeRevealControl.setEdge(side)
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
      timeWarpControl2.syncUi()
      syncTargetRecommendationCue()
      targetControl.syncUi()
      trajectoryHorizonControl.syncUi()
      thrustControl.syncUi()
      rcsYawControl.syncUi()
    },
    updateAssistMode: (_mode) => {},
  }
}
