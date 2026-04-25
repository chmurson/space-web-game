import type { TimeWarpAction } from '../../../runtime/timeWarpFeedbackPolicy'
import './selectorTimeWarpControl.css'
import type {
  SelectorTimeWarpGestureDirection,
  SelectorTimeWarpRuntimeSnapshot,
} from './selectorTimeWarpControlModel'
import { createSelectorTimeWarpControlModel } from './selectorTimeWarpControlModel'
import { presentSelectorTimeWarpControl } from './selectorTimeWarpControlPresenter'
import { createSelectorTimeWarpControlView } from './selectorTimeWarpControlView'
import type {
  TimeWarpControl,
  TimeWarpControlOptions,
  TimeWarpGestureSession,
} from '../timeWarpControlTypes'

const swipeCommitDistancePx = 46
const commitSettleDelayMs = 180
const fullSwipeAnimationDistancePx = 80
const previewStepCount = 3

export const createSelectorTimeWarpControl = (
  options: TimeWarpControlOptions,
): TimeWarpControl => {
  const model = createSelectorTimeWarpControlModel()
  const view = createSelectorTimeWarpControlView()
  options.panel.appendChild(view.element)
  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches
  let commitSettleTimer: number | null = null

  const setSession = (session: TimeWarpGestureSession) => {
    options.onSessionChange(session)
  }

  const getRuntimeSnapshot = (): SelectorTimeWarpRuntimeSnapshot => ({
    currentValue: options.getCurrentTimeWarp(),
    decreaseSteps: options.getTimeWarpPreviews(
      'decreaseTimeWarp',
      previewStepCount,
    ),
    increaseSteps: options.getTimeWarpPreviews(
      'increaseTimeWarp',
      previewStepCount,
    ),
  })

  const renderSnapshot = () => {
    view.render(presentSelectorTimeWarpControl(model.getSnapshot()))
  }

  const syncRuntimeSnapshot = () => {
    const snapshot = model.setRuntimeSnapshot(getRuntimeSnapshot())
    view.render(presentSelectorTimeWarpControl(snapshot))
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
      view.element.classList.add('touch-time-warp-selector-instant')
    }
    const snapshot = model.endGesture()
    view.render(presentSelectorTimeWarpControl(snapshot))
    if (params?.instantRender) {
      window.requestAnimationFrame(() => {
        view.element.classList.remove('touch-time-warp-selector-instant')
      })
    }
  }

  const getNearStep = (
    snapshot: SelectorTimeWarpRuntimeSnapshot,
    direction: SelectorTimeWarpGestureDirection,
  ) =>
    direction === 'increase'
      ? snapshot.increaseSteps[0]
      : snapshot.decreaseSteps[0]

  const getAction = (
    direction: SelectorTimeWarpGestureDirection,
  ): TimeWarpAction =>
    direction === 'increase' ? 'increaseTimeWarp' : 'decreaseTimeWarp'

  const updateGesturePreview = (deltaY: number) => {
    const distance = Math.abs(deltaY)
    const direction: SelectorTimeWarpGestureDirection | null =
      deltaY < 0 ? 'decrease' : deltaY > 0 ? 'increase' : null
    const visualDirection: SelectorTimeWarpGestureDirection | null =
      deltaY < 0 ? 'increase' : deltaY > 0 ? 'decrease' : null
    const progress = Math.min(1, distance / fullSwipeAnimationDistancePx)
    const runtimeSnapshot = model.getSnapshot().runtimeSnapshot
    const target = direction ? getNearStep(runtimeSnapshot, direction) : null
    const releaseWillCommit = Boolean(
      direction && target?.canCommit && distance >= swipeCommitDistancePx,
    )

    const snapshot = model.updateGesture({
      direction,
      progress,
      releaseWillCommit,
      target: target ?? null,
      visualDirection,
    })
    view.render(presentSelectorTimeWarpControl(snapshot))
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
    view.render(presentSelectorTimeWarpControl(nextSnapshot))
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

    options.commitTimeWarp(getAction(gesture.direction))
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
      const session: TimeWarpGestureSession = {
        kind: 'left-zone',
        startX: touch.clientX,
        startY: touch.clientY,
        touchId: touch.identifier,
      }
      setSession(session)
      return session
    },
    finishGesture(session, commitPreview) {
      if (session.kind !== 'left-zone') {
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
      const nextSession: TimeWarpGestureSession = { kind: 'none' }
      setSession(nextSession)
      return nextSession
    },
    ownsTouch(session, touchId) {
      return session.kind === 'left-zone' && session.touchId === touchId
    },
    setSession,
    syncUi: syncRuntimeSnapshot,
    updateGesture(touch, session) {
      if (
        session.kind !== 'left-zone' ||
        session.touchId !== touch.identifier
      ) {
        return session
      }

      const deltaY = touch.clientY - session.startY
      updateGesturePreview(deltaY)
      setSession(session)
      return session
    },
  }
}
