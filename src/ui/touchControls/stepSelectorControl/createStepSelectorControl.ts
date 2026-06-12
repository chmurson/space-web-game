import './stepSelectorControl.css'
import {
  createStepSelectorControlModel,
  type StepSelectorRuntimeSnapshot,
} from './stepSelectorControlModel'
import { presentStepSelectorControl } from './stepSelectorControlPresenter'
import type {
  StepSelectorControl,
  StepSelectorControlOptions,
  StepSelectorDirection,
  StepSelectorGestureSession,
} from './stepSelectorControlTypes'
import { createStepSelectorControlView } from './stepSelectorControlView'

const swipeCommitDistancePx = 46
const commitSettleDelayMs = 180
const fullSwipeAnimationDistancePx = swipeCommitDistancePx
const previewStepCount = 3

export const getStepSelectorGestureDirection = (
  deltaY: number,
): StepSelectorDirection | null =>
  deltaY < 0 ? 'increase' : deltaY > 0 ? 'decrease' : null

export const getStepSelectorGestureCommittedStepCount = (deltaY: number) =>
  Math.floor(Math.abs(deltaY) / swipeCommitDistancePx)

export const getStepSelectorReleaseWillCommit = (deltaY: number) =>
  Math.abs(deltaY) > swipeCommitDistancePx / 2

export const getStepSelectorGesturePreviewDeltaY = (
  currentY: number,
  stepAnchorY: number,
) => {
  const previewDeltaY = currentY - stepAnchorY
  if (previewDeltaY === 0) {
    return 0
  }

  return previewDeltaY
}

export const createStepSelectorControl = <ControlId extends string>(
  options: StepSelectorControlOptions<ControlId>,
): StepSelectorControl<ControlId> => {
  const model = createStepSelectorControlModel()
  const view = createStepSelectorControlView({
    ariaLabel: options.ariaLabel,
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
    currentY: number,
    session: StepSelectorGestureSession<ControlId>,
  ): {
    didCommit: boolean
    session: StepSelectorGestureSession<ControlId>
  } => {
    let didCommit = false
    let nextSession = session

    while (
      getStepSelectorGestureCommittedStepCount(
        currentY - nextSession.stepAnchorY,
      ) > 0
    ) {
      const deltaY = currentY - nextSession.stepAnchorY
      const direction = getStepSelectorGestureDirection(deltaY)
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
      const consumedDistance =
        direction === 'increase'
          ? -swipeCommitDistancePx
          : swipeCommitDistancePx
      nextSession = {
        ...nextSession,
        committedStepCount: nextSession.committedStepCount + 1,
        stepAnchorY: nextSession.stepAnchorY + consumedDistance,
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
    beginGesture(touch) {
      if (commitSettleTimer !== null) {
        finishCommitSettle()
      }
      syncRuntimeSnapshot()
      model.startGesture()
      renderSnapshot()
      const session: StepSelectorGestureSession<ControlId> = {
        committedStepCount: 0,
        kind: 'step-selector',
        controlId: options.controlId,
        stepAnchorY: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY,
        touchId: touch.identifier,
      }
      setSession(session)
      return session
    },
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
    updateGesture(touch, session) {
      if (
        session.kind !== 'step-selector' ||
        session.controlId !== options.controlId ||
        session.touchId !== touch.identifier
      ) {
        return session
      }

      const commitResult = commitContinuousGestureSteps(touch.clientY, session)
      const nextSession = commitResult.session
      const previewDeltaY = getStepSelectorGesturePreviewDeltaY(
        touch.clientY,
        nextSession.stepAnchorY,
      )
      updateGesturePreview(previewDeltaY, {
        instantRender: commitResult.didCommit,
      })
      setSession(nextSession)
      return nextSession
    },
  }
}
