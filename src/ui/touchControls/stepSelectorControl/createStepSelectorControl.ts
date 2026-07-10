import './stepSelectorControl.css'
import {
  createStepSelectorControlModel,
  type StepSelectorRuntimeSnapshot,
} from './stepSelectorControlModel'
import { presentStepSelectorControl } from './stepSelectorControlPresenter'
import type {
  StepSelectorAxis,
  StepSelectorControl,
  StepSelectorControlOptions,
  StepSelectorDirection,
  StepSelectorGesturePoint,
  StepSelectorGestureSession,
} from './stepSelectorControlTypes'
import { createStepSelectorControlView } from './stepSelectorControlView'

const swipeCommitDistancePx = 46
const commitSettleDelayMs = 180
const fullSwipeAnimationDistancePx = swipeCommitDistancePx
const previewStepCount = 3

export const getStepSelectorGestureDirection = (
  gestureDelta: number,
): StepSelectorDirection | null =>
  gestureDelta < 0 ? 'increase' : gestureDelta > 0 ? 'decrease' : null

export const getStepSelectorGestureCommittedStepCount = (
  gestureDelta: number,
) => Math.floor(Math.abs(gestureDelta) / swipeCommitDistancePx)

export const getStepSelectorReleaseWillCommit = (gestureDelta: number) =>
  Math.abs(gestureDelta) > swipeCommitDistancePx / 2

export const getStepSelectorGestureDelta = (
  axis: StepSelectorAxis,
  point: Pick<StepSelectorGesturePoint, 'clientX' | 'clientY'>,
  anchor: { x: number; y: number },
) =>
  axis === 'horizontal' ? anchor.x - point.clientX : point.clientY - anchor.y

const getStepSelectorConsumedAnchorDelta = (
  axis: StepSelectorAxis,
  direction: StepSelectorDirection,
) => {
  if (axis === 'horizontal') {
    return direction === 'increase'
      ? swipeCommitDistancePx
      : -swipeCommitDistancePx
  }

  return direction === 'increase'
    ? -swipeCommitDistancePx
    : swipeCommitDistancePx
}

export const getStepSelectorGesturePreviewDeltaY = (
  currentY: number,
  stepAnchorY: number,
) =>
  getStepSelectorGestureDelta(
    'vertical',
    { clientX: 0, clientY: currentY },
    { x: 0, y: stepAnchorY },
  )

export const createStepSelectorControl = <ControlId extends string>(
  options: StepSelectorControlOptions<ControlId>,
): StepSelectorControl<ControlId> => {
  const axis = options.axis ?? 'vertical'
  const model = createStepSelectorControlModel()
  const view = createStepSelectorControlView({
    ariaLabel: options.ariaLabel,
    axis,
    className: options.className,
  })
  const parentElement = options.container ?? options.panel
  parentElement.appendChild(view.element)
  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches
  let commitSettleTimer: number | null = null
  let instantRenderFrameId: number | null = null

  const setSession = (
    session: StepSelectorGestureSession<ControlId> | { kind: 'none' },
  ) => {
    options.onSessionChange(session)
  }

  const getRuntimeSnapshot = (): StepSelectorRuntimeSnapshot => ({
    currentValue: options.getCurrentValue(),
    decreaseSteps: options.getStepPreviews('decrease', previewStepCount),
    increaseSteps: options.getStepPreviews('increase', previewStepCount),
  })

  const renderControlSnapshot = (
    snapshot: ReturnType<typeof model.getSnapshot>,
    params?: { instantRender?: boolean },
  ) => {
    if (params?.instantRender) {
      if (instantRenderFrameId !== null) {
        window.cancelAnimationFrame(instantRenderFrameId)
      }
      view.element.classList.add('touch-step-selector-instant')
    }

    view.render(
      presentStepSelectorControl(snapshot, {
        formatValue: options.formatValue,
      }),
    )

    if (params?.instantRender) {
      instantRenderFrameId = window.requestAnimationFrame(() => {
        view.element.classList.remove('touch-step-selector-instant')
        instantRenderFrameId = null
      })
    }
  }

  const renderSnapshot = () => {
    renderControlSnapshot(model.getSnapshot())
  }

  const syncRuntimeSnapshot = () => {
    const snapshot = model.setRuntimeSnapshot(getRuntimeSnapshot())
    renderControlSnapshot(snapshot)
  }

  const clearCommitSettleTimer = () => {
    if (commitSettleTimer === null) {
      return
    }

    window.clearTimeout(commitSettleTimer)
    commitSettleTimer = null
  }

  const finishCommitSettle = (params?: { instantRender?: boolean }) => {
    clearCommitSettleTimer()
    if (params?.instantRender) {
      if (instantRenderFrameId !== null) {
        window.cancelAnimationFrame(instantRenderFrameId)
        instantRenderFrameId = null
      }
    }
    const snapshot = model.endGesture()
    renderControlSnapshot(snapshot, params)
  }

  const getNearStep = (
    snapshot: StepSelectorRuntimeSnapshot,
    direction: StepSelectorDirection,
  ) =>
    direction === 'increase'
      ? snapshot.increaseSteps[0]
      : snapshot.decreaseSteps[0]

  const syncCommittedRuntimeSnapshot = (
    runtimeSnapshot: StepSelectorRuntimeSnapshot,
  ) => {
    model.endGesture()
    model.setRuntimeSnapshot(runtimeSnapshot)
    model.startGesture()
  }

  const commitContinuousGestureSteps = (
    point: StepSelectorGesturePoint,
    session: StepSelectorGestureSession<ControlId>,
  ): {
    didCommit: boolean
    session: StepSelectorGestureSession<ControlId>
  } => {
    let didCommit = false
    let nextSession = session

    while (
      getStepSelectorGestureCommittedStepCount(
        getStepSelectorGestureDelta(nextSession.axis, point, {
          x: nextSession.stepAnchorX,
          y: nextSession.stepAnchorY,
        }),
      ) > 0
    ) {
      const gestureDelta = getStepSelectorGestureDelta(
        nextSession.axis,
        point,
        {
          x: nextSession.stepAnchorX,
          y: nextSession.stepAnchorY,
        },
      )
      const direction = getStepSelectorGestureDirection(gestureDelta)
      if (!direction) {
        break
      }

      const runtimeSnapshot = getRuntimeSnapshot()
      const target = getNearStep(runtimeSnapshot, direction)
      if (!target?.canCommit) {
        break
      }

      options.commitStep(direction)
      const nextRuntimeSnapshot = getRuntimeSnapshot()
      if (nextRuntimeSnapshot.currentValue === runtimeSnapshot.currentValue) {
        break
      }

      syncCommittedRuntimeSnapshot(nextRuntimeSnapshot)
      didCommit = true
      const consumedDistance = getStepSelectorConsumedAnchorDelta(
        nextSession.axis,
        direction,
      )
      nextSession = {
        ...nextSession,
        committedStepCount: nextSession.committedStepCount + 1,
        stepAnchorX:
          nextSession.stepAnchorX +
          (nextSession.axis === 'horizontal' ? consumedDistance : 0),
        stepAnchorY:
          nextSession.stepAnchorY +
          (nextSession.axis === 'vertical' ? consumedDistance : 0),
      }
    }

    return { didCommit, session: nextSession }
  }

  const updateGesturePreview = (
    deltaY: number,
    params?: { instantRender?: boolean },
  ) => {
    const distance = Math.abs(deltaY)
    const direction: StepSelectorDirection | null =
      getStepSelectorGestureDirection(deltaY)
    const visualDirection = direction
    const progress = Math.min(1, distance / fullSwipeAnimationDistancePx)
    const runtimeSnapshot = model.getSnapshot().runtimeSnapshot
    const target = direction ? getNearStep(runtimeSnapshot, direction) : null
    const releaseWillCommit = Boolean(
      direction &&
        target?.canCommit &&
        getStepSelectorReleaseWillCommit(deltaY),
    )

    const snapshot = model.updateGesture({
      direction,
      progress,
      releaseWillCommit,
      target: target ?? null,
      visualDirection,
    })
    renderControlSnapshot(snapshot, params)
  }

  const completeGestureVisual = () => {
    const snapshot = model.getSnapshot()
    const gesture = snapshot.gesture
    if (!gesture) {
      return
    }

    const nextSnapshot = model.updateGesture({
      direction: gesture.direction,
      progress: 1,
      releaseWillCommit: gesture.releaseWillCommit,
      target: gesture.target,
      visualDirection: gesture.visualDirection,
    })
    renderControlSnapshot(nextSnapshot)
  }

  const resolveReleaseCommit = () => {
    const snapshot = model.getSnapshot()
    const gesture = snapshot.gesture
    const latestRuntimeSnapshot = getRuntimeSnapshot()
    model.setRuntimeSnapshot(latestRuntimeSnapshot)

    if (!gesture?.direction || !gesture.target || !gesture.releaseWillCommit) {
      return false
    }

    if (latestRuntimeSnapshot.currentValue !== gesture.startCurrentValue) {
      return false
    }

    const latestTarget = getNearStep(latestRuntimeSnapshot, gesture.direction)
    if (
      !latestTarget?.canCommit ||
      latestTarget.value !== gesture.target.value
    ) {
      return false
    }

    options.commitStep(gesture.direction)
    model.setRuntimeSnapshot(getRuntimeSnapshot())
    return true
  }

  syncRuntimeSnapshot()

  return {
    beginGesture(point) {
      if (commitSettleTimer !== null) {
        finishCommitSettle()
      }
      syncRuntimeSnapshot()
      model.startGesture()
      renderSnapshot()
      const session: StepSelectorGestureSession<ControlId> = {
        axis,
        committedStepCount: 0,
        kind: 'step-selector',
        controlId: options.controlId,
        stepAnchorX: point.clientX,
        stepAnchorY: point.clientY,
        startX: point.clientX,
        startY: point.clientY,
        touchId: point.identifier,
      }
      setSession(session)
      return session
    },
    element: view.element,
    finishGesture(session, commitPreview) {
      if (
        session.kind !== 'step-selector' ||
        session.controlId !== options.controlId
      ) {
        return session
      }
      const didCommit = commitPreview ? resolveReleaseCommit() : false
      if (!commitPreview) {
        model.setRuntimeSnapshot(getRuntimeSnapshot())
      }
      if (didCommit && !reducedMotion) {
        completeGestureVisual()
        clearCommitSettleTimer()
        commitSettleTimer = window.setTimeout(() => {
          commitSettleTimer = null
          finishCommitSettle({ instantRender: true })
        }, commitSettleDelayMs)
      } else {
        finishCommitSettle()
      }
      const nextSession = { kind: 'none' } as const
      setSession(nextSession)
      return nextSession
    },
    ownsTouch(session, touchId) {
      return (
        session.kind === 'step-selector' &&
        session.controlId === options.controlId &&
        session.touchId === touchId
      )
    },
    setVisible(visible) {
      view.element.style.display = visible ? 'grid' : 'none'
    },
    setSession,
    syncUi: syncRuntimeSnapshot,
    updateGesture(point, session) {
      if (
        session.kind !== 'step-selector' ||
        session.controlId !== options.controlId ||
        session.touchId !== point.identifier
      ) {
        return session
      }

      const commitResult = commitContinuousGestureSteps(point, session)
      const nextSession = commitResult.session
      const previewDelta = getStepSelectorGestureDelta(
        nextSession.axis,
        point,
        {
          x: nextSession.stepAnchorX,
          y: nextSession.stepAnchorY,
        },
      )
      updateGesturePreview(previewDelta, {
        instantRender: commitResult.didCommit,
      })
      setSession(nextSession)
      return nextSession
    },
  }
}
