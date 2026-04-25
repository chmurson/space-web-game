import './swipeTimeWarpControl.css'
import { createTimeWarpFeedbackModel } from './timeWarpFeedbackModel'
import { presentTimeWarpFeedback } from './timeWarpFeedbackPresenter'
import { createTimeWarpFeedbackView } from './timeWarpFeedbackView'
import type {
  TimeWarpControl,
  TimeWarpControlOptions,
  TimeWarpGestureSession,
} from '../timeWarpControlTypes'

const committedTimeWarpFeedbackFadeMs = 1000
const maxMobileTouchDimensionPx = 430
const timeWarpFeedbackOffsetYPx = 62

export const createSwipeTimeWarpControl = (
  options: TimeWarpControlOptions,
): TimeWarpControl => {
  const timeWarpFeedback = document.createElement('div')
  timeWarpFeedback.className = 'touch-time-warp-feedback'
  timeWarpFeedback.setAttribute('aria-hidden', 'true')
  options.panel.appendChild(timeWarpFeedback)

  const feedbackModel = createTimeWarpFeedbackModel()
  const getPanelWidth = () =>
    options.panel.getBoundingClientRect().width || window.innerWidth
  const getPanelHeight = () =>
    options.panel.getBoundingClientRect().height || window.innerHeight
  const getTouchTravelActivationDistance = () =>
    Math.min(
      Math.min(getPanelWidth(), getPanelHeight()),
      maxMobileTouchDimensionPx,
    ) / 5

  const feedbackView = createTimeWarpFeedbackView({
    committedFadeMs: committedTimeWarpFeedbackFadeMs,
    element: timeWarpFeedback,
    getBounds: () => ({
      height: getPanelHeight(),
      width: getPanelWidth(),
    }),
  })

  const setSession = (session: TimeWarpGestureSession) => {
    options.onSessionChange(session)
  }

  const clearPreview = () => {
    feedbackView.render(presentTimeWarpFeedback(feedbackModel.cancelPreview()))
  }

  const beginGesture = (touch: Touch): TimeWarpGestureSession => ({
    kind: 'left-zone',
    startX: touch.clientX,
    startY: touch.clientY,
    touchId: touch.identifier,
  })

  const updateGesture = (
    touch: Touch,
    session: TimeWarpGestureSession,
  ): TimeWarpGestureSession => {
    if (session.kind !== 'left-zone' || session.touchId !== touch.identifier) {
      return session
    }

    const deltaX = touch.clientX - session.startX
    const opacity = Math.min(
      1,
      Math.max(0, Math.abs(deltaX) / getTouchTravelActivationDistance()),
    )
    const action = deltaX >= 0 ? 'increaseTimeWarp' : 'decreaseTimeWarp'
    const preview = options.getTimeWarpPreview(action)
    const snapshot = feedbackModel.updatePreview({
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
    feedbackView.render(presentTimeWarpFeedback(snapshot))
    return session
  }

  const finishGesture = (
    session: TimeWarpGestureSession,
    commitPreview: boolean,
  ): TimeWarpGestureSession => {
    if (session.kind !== 'left-zone') {
      return session
    }

    if (commitPreview) {
      const result = feedbackModel.commitPreview()
      feedbackView.render(presentTimeWarpFeedback(result.snapshot))
      if (result.action) {
        options.commitTimeWarp(result.action)
      }
    } else {
      clearPreview()
    }

    return { kind: 'none' }
  }

  const syncUi = () => {
    feedbackView.render(presentTimeWarpFeedback(feedbackModel.getSnapshot()))
  }

  syncUi()

  return {
    beginGesture(touch) {
      const nextSession = beginGesture(touch)
      setSession(nextSession)
      return nextSession
    },
    finishGesture(session: TimeWarpGestureSession, commitPreview: boolean) {
      const nextSession = finishGesture(session, commitPreview)
      setSession(nextSession)
      return nextSession
    },
    ownsTouch(session: TimeWarpGestureSession, touchId: number) {
      return session.kind === 'left-zone' && session.touchId === touchId
    },
    setSession,
    syncUi,
    updateGesture(touch: Touch, session: TimeWarpGestureSession) {
      const nextSession = updateGesture(touch, session)
      setSession(nextSession)
      return nextSession
    },
  }
}
