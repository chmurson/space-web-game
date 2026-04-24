import type {
  TimeWarpAction,
  TimeWarpFeedbackReason,
} from '../../runtime/timeWarpFeedbackPolicy'
import './selectorTimeWarpControl.css'
import type {
  TimeWarpControl,
  TimeWarpControlOptions,
  TimeWarpGestureSession,
} from './timeWarpControl'

const swipeCommitDistancePx = 46
const animationResetDelayMs = 260

const timeIconMarkup = `
  <svg class="touch-time-warp-selector-icon" viewBox="0 0 16 16" aria-hidden="true">
    <circle class="touch-time-warp-selector-icon-face" cx="8" cy="8" r="6.25"></circle>
    <line class="touch-time-warp-selector-icon-hand" x1="8" y1="8" x2="8" y2="3.5"></line>
    <circle class="touch-time-warp-selector-icon-center" cx="8" cy="8" r="0.9"></circle>
  </svg>
`

const formatWarpValue = (value: number) => `x${value}`

const getPreview = (
  options: Pick<TimeWarpControlOptions, 'getTimeWarpPreview'>,
  action: TimeWarpAction,
): {
  canCommit: boolean
  reason: TimeWarpFeedbackReason | null
  value: number
} => options.getTimeWarpPreview(action)

export const createSelectorTimeWarpControl = (
  options: TimeWarpControlOptions,
): TimeWarpControl => {
  const selector = document.createElement('div')
  selector.className = 'touch-time-warp-selector'
  selector.setAttribute('aria-label', 'Time warp selector')
  selector.innerHTML = `
    <button class="touch-time-warp-selector-button touch-time-warp-selector-button-up" type="button" aria-label="Increase time warp">
      <span class="touch-time-warp-selector-caret" aria-hidden="true"></span>
    </button>
    <div class="touch-time-warp-selector-value touch-time-warp-selector-value-next touch-time-warp-selector-value-up"></div>
    <div class="touch-time-warp-selector-current">
      ${timeIconMarkup}
      <div class="touch-time-warp-selector-value touch-time-warp-selector-value-current"></div>
    </div>
    <div class="touch-time-warp-selector-value touch-time-warp-selector-value-next touch-time-warp-selector-value-down"></div>
    <button class="touch-time-warp-selector-button touch-time-warp-selector-button-down" type="button" aria-label="Decrease time warp">
      <span class="touch-time-warp-selector-caret" aria-hidden="true"></span>
    </button>
  `
  options.panel.appendChild(selector)

  const upButton = selector.querySelector<HTMLButtonElement>(
    '.touch-time-warp-selector-button-up',
  )
  const downButton = selector.querySelector<HTMLButtonElement>(
    '.touch-time-warp-selector-button-down',
  )
  const upValue = selector.querySelector<HTMLElement>(
    '.touch-time-warp-selector-value-up',
  )
  const currentValue = selector.querySelector<HTMLElement>(
    '.touch-time-warp-selector-value-current',
  )
  const downValue = selector.querySelector<HTMLElement>(
    '.touch-time-warp-selector-value-down',
  )
  let animationTimer: number | null = null

  const setSession = (session: TimeWarpGestureSession) => {
    options.onSessionChange(session)
  }

  const render = () => {
    const current = options.getCurrentTimeWarp()
    const increasePreview = getPreview(options, 'increaseTimeWarp')
    const decreasePreview = getPreview(options, 'decreaseTimeWarp')

    if (upValue) {
      upValue.textContent = formatWarpValue(increasePreview.value)
      upValue.classList.toggle(
        'touch-time-warp-selector-value-disabled',
        !increasePreview.canCommit,
      )
    }
    if (currentValue) {
      currentValue.textContent = formatWarpValue(current)
    }
    if (downValue) {
      downValue.textContent = formatWarpValue(decreasePreview.value)
      downValue.classList.toggle(
        'touch-time-warp-selector-value-disabled',
        !decreasePreview.canCommit,
      )
    }
    upButton?.toggleAttribute('disabled', !increasePreview.canCommit)
    downButton?.toggleAttribute('disabled', !decreasePreview.canCommit)
  }

  const playStepAnimation = (direction: 'up' | 'down') => {
    if (animationTimer !== null) {
      window.clearTimeout(animationTimer)
      animationTimer = null
    }
    selector.classList.remove(
      'touch-time-warp-selector-step-up',
      'touch-time-warp-selector-step-down',
    )
    void selector.getBoundingClientRect()
    selector.classList.add(`touch-time-warp-selector-step-${direction}`)
    animationTimer = window.setTimeout(() => {
      selector.classList.remove(
        'touch-time-warp-selector-step-up',
        'touch-time-warp-selector-step-down',
      )
      animationTimer = null
    }, animationResetDelayMs)
  }

  const commitAction = (action: TimeWarpAction) => {
    const preview = getPreview(options, action)
    if (!preview.canCommit) {
      render()
      return false
    }

    options.commitTimeWarp(action)
    playStepAnimation(action === 'increaseTimeWarp' ? 'up' : 'down')
    render()
    return true
  }

  const handleButtonTouch = (action: TimeWarpAction) => (event: Event) => {
    event.preventDefault()
    event.stopPropagation()
    commitAction(action)
  }

  upButton?.addEventListener(
    'touchstart',
    handleButtonTouch('increaseTimeWarp'),
    {
      passive: false,
    },
  )
  downButton?.addEventListener(
    'touchstart',
    handleButtonTouch('decreaseTimeWarp'),
    { passive: false },
  )
  upButton?.addEventListener('click', handleButtonTouch('increaseTimeWarp'))
  downButton?.addEventListener('click', handleButtonTouch('decreaseTimeWarp'))

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
