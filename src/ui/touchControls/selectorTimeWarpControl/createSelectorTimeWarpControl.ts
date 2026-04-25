import type { TimeWarpAction } from '../../../runtime/timeWarpFeedbackPolicy'
import './selectorTimeWarpControl.css'
import { createSelectorTimeWarpControlModel } from './selectorTimeWarpControlModel'
import { presentSelectorTimeWarpControl } from './selectorTimeWarpControlPresenter'
import { createSelectorTimeWarpControlView } from './selectorTimeWarpControlView'
import type {
  TimeWarpControl,
  TimeWarpControlOptions,
  TimeWarpGestureSession,
} from '../timeWarpControlTypes'

const swipeCommitDistancePx = 46
const animationResetDelayMs = 260
const previewStepCount = 2

export const createSelectorTimeWarpControl = (
  options: TimeWarpControlOptions,
): TimeWarpControl => {
  const model = createSelectorTimeWarpControlModel()
  const view = createSelectorTimeWarpControlView()
  options.panel.appendChild(view.element)

  let animationTimer: number | null = null

  const setSession = (session: TimeWarpGestureSession) => {
    options.onSessionChange(session)
  }

  const renderSnapshot = () => {
    view.render(presentSelectorTimeWarpControl(model.getSnapshot()))
  }

  const render = () => {
    const snapshot = model.setValues({
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
    view.render(presentSelectorTimeWarpControl(snapshot))
  }

  const clearAnimationTimer = () => {
    if (animationTimer === null) {
      return
    }

    window.clearTimeout(animationTimer)
    animationTimer = null
  }

  const playStepAnimation = (direction: 'up' | 'down') => {
    clearAnimationTimer()
    model.startStepAnimation(direction)
    renderSnapshot()
    animationTimer = window.setTimeout(() => {
      model.clearStepAnimation()
      animationTimer = null
      render()
    }, animationResetDelayMs)
  }

  const commitAction = (action: TimeWarpAction) => {
    const preview = options.getTimeWarpPreview(action)
    if (!preview.canCommit) {
      render()
      return false
    }

    options.commitTimeWarp(action)
    model.setValues({
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
    playStepAnimation(action === 'increaseTimeWarp' ? 'up' : 'down')
    return true
  }

  const handleButtonTouch = (action: TimeWarpAction) => (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    commitAction(action)
  }

  view.upButton?.addEventListener(
    'touchstart',
    handleButtonTouch('increaseTimeWarp'),
    {
      passive: false,
    },
  )
  view.downButton?.addEventListener(
    'touchstart',
    handleButtonTouch('decreaseTimeWarp'),
    { passive: false },
  )
  view.upButton?.addEventListener(
    'click',
    handleButtonTouch('increaseTimeWarp'),
  )
  view.downButton?.addEventListener(
    'click',
    handleButtonTouch('decreaseTimeWarp'),
  )

  render()

  return {
    beginGesture(touch) {
      const session: TimeWarpGestureSession = {
        kind: 'left-zone',
        startX: touch.clientX,
        startY: touch.clientY,
        touchId: touch.identifier,
      }
      setSession(session)
      return session
    },
    finishGesture(session) {
      if (session.kind !== 'left-zone') {
        return session
      }
      const nextSession: TimeWarpGestureSession = { kind: 'none' }
      setSession(nextSession)
      render()
      return nextSession
    },
    ownsTouch(session, touchId) {
      return session.kind === 'left-zone' && session.touchId === touchId
    },
    setSession,
    syncUi: render,
    updateGesture(touch, session) {
      if (
        session.kind !== 'left-zone' ||
        session.touchId !== touch.identifier ||
        session.hasCommitted
      ) {
        return session
      }

      const deltaY = touch.clientY - session.startY
      if (Math.abs(deltaY) < swipeCommitDistancePx) {
        return session
      }

      const action = deltaY < 0 ? 'increaseTimeWarp' : 'decreaseTimeWarp'
      const nextSession = {
        ...session,
        hasCommitted: commitAction(action),
      }
      setSession(nextSession)
      return nextSession
    },
  }
}
