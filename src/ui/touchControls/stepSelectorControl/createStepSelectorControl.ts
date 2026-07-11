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
const horizontalPreviewStepCount = 16

export const getStepSelectorGestureDirection = (
  gestureDelta: number,
): StepSelectorDirection | null =>
  gestureDelta < 0 ? 'increase' : gestureDelta > 0 ? 'decrease' : null

export const getStepSelectorGestureCommittedStepCount = (
  gestureDelta: number,
) => Math.floor(Math.abs(gestureDelta) / swipeCommitDistancePx + 0.5)

export const getStepSelectorReleaseWillCommit = (gestureDelta: number) =>
  Math.abs(gestureDelta) > swipeCommitDistancePx / 2

const getStepSelectorFullStepCount = (gestureDelta: number) =>
  Math.floor(Math.abs(gestureDelta) / swipeCommitDistancePx)

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

const trimStepsAfterFirstBlocked = <Step extends { canCommit: boolean }>(
  steps: Step[],
) => {
  const firstBlockedIndex = steps.findIndex((step) => !step.canCommit)
  return firstBlockedIndex === -1
    ? steps
    : steps.slice(0, firstBlockedIndex + 1)
}

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

  const getRuntimeSnapshot = (): StepSelectorRuntimeSnapshot => {
    const stepCount =
      axis === 'horizontal' ? horizontalPreviewStepCount : previewStepCount
    const decreaseSteps = options.getStepPreviews('decrease', stepCount)
    const increaseSteps = options.getStepPreviews('increase', stepCount)

    return {
      currentValue: options.getCurrentValue(),
      decreaseSteps:
        axis === 'horizontal'
          ? trimStepsAfterFirstBlocked(decreaseSteps)
          : decreaseSteps,
      increaseSteps:
        axis === 'horizontal'
          ? trimStepsAfterFirstBlocked(increaseSteps)
          : increaseSteps,
    }
  }

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
        axis,
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

  const commitHorizontalGestureSteps = (
    gestureDelta: number,
    session: StepSelectorGestureSession<ControlId>,
  ): StepSelectorGestureSession<ControlId> => {
    const direction = getStepSelectorGestureDirection(gestureDelta)
    const crossedStepCount =
      getStepSelectorGestureCommittedStepCount(gestureDelta)
    let desiredStepOffset = 0
    if (direction === 'increase') {
      desiredStepOffset = crossedStepCount
    } else if (direction === 'decrease') {
      desiredStepOffset = -crossedStepCount
    }

    let committedStepCount = session.committedStepCount
    while (committedStepCount !== desiredStepOffset) {
      const commitDirection: StepSelectorDirection =
        committedStepCount < desiredStepOffset ? 'increase' : 'decrease'
      const runtimeSnapshot = getRuntimeSnapshot()
      const target = getNearStep(runtimeSnapshot, commitDirection)
      if (!target?.canCommit) {
        break
      }

      options.commitStep(commitDirection)
      const nextRuntimeSnapshot = getRuntimeSnapshot()
      if (nextRuntimeSnapshot.currentValue === runtimeSnapshot.currentValue) {
        break
      }

      model.setRuntimeSnapshot(nextRuntimeSnapshot)
      committedStepCount += commitDirection === 'increase' ? 1 : -1
    }

    return {
      ...session,
      committedStepCount,
    }
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
      getStepSelectorFullStepCount(
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
    params?: {
      instantRender?: boolean
      visualStepOffset?: number
    },
  ) => {
    const distance = Math.abs(deltaY)
    const direction: StepSelectorDirection | null =
      getStepSelectorGestureDirection(deltaY)
    const visualDirection = direction
    const progress = Math.min(1, distance / fullSwipeAnimationDistancePx)
    const runtimeSnapshot = model.getSnapshot().runtimeSnapshot
    const target = direction ? getNearStep(runtimeSnapshot, direction) : null
    const crossedReleaseThreshold =
      axis === 'horizontal'
        ? getStepSelectorGestureCommittedStepCount(deltaY) > 0
        : getStepSelectorReleaseWillCommit(deltaY)
    const releaseWillCommit = Boolean(
      direction && target?.canCommit && crossedReleaseThreshold,
    )

    const snapshot = model.updateGesture({
      direction,
      progress,
      releaseWillCommit,
      target: target ?? null,
      visualDirection,
      visualStepOffset: params?.visualStepOffset,
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
      visualStepOffset: gesture.visualStepOffset,
    })
    renderControlSnapshot(nextSnapshot)
  }

  const settleHorizontalGesture = (committedStepCount: number) => {
    const snapshot = model.updateGesture({
      direction: null,
      progress: 0,
      releaseWillCommit: false,
      target: null,
      visualDirection: null,
      visualStepOffset: committedStepCount,
    })
    renderControlSnapshot(snapshot)
    clearCommitSettleTimer()
    commitSettleTimer = window.setTimeout(() => {
      commitSettleTimer = null
      finishCommitSettle({ instantRender: true })
    }, commitSettleDelayMs)
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
        finishCommitSettle({ instantRender: axis === 'horizontal' })
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

      if (axis === 'horizontal') {
        model.setRuntimeSnapshot(getRuntimeSnapshot())
        if (commitPreview && !reducedMotion) {
          settleHorizontalGesture(session.committedStepCount)
        } else {
          finishCommitSettle()
        }
        const nextSession = { kind: 'none' } as const
        setSession(nextSession)
        return nextSession
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

      if (axis === 'horizontal') {
        const gestureDelta = getStepSelectorGestureDelta(axis, point, {
          x: session.startX,
          y: session.startY,
        })
        const nextSession = commitHorizontalGestureSteps(gestureDelta, session)
        updateGesturePreview(gestureDelta, {
          visualStepOffset: -gestureDelta / swipeCommitDistancePx,
        })
        setSession(nextSession)
        return nextSession
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
