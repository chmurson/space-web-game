const touchEventTypes = [
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
] as const

const safariGestureEventTypes = [
  'gesturestart',
  'gesturechange',
  'gestureend',
] as const

const nonPassiveOptions = { passive: false } satisfies AddEventListenerOptions
const doubleTapThresholdMs = 350

const preventCancelableDefault = (event: Event) => {
  if (event.cancelable) {
    event.preventDefault()
  }
}

const hasMultipleTouches = (event: TouchEvent) =>
  event.touches.length > 1 ||
  event.targetTouches.length > 1 ||
  event.changedTouches.length > 1

const findButtonTarget = (element: HTMLElement, event: TouchEvent) => {
  if (!(event.target instanceof Element)) {
    return null
  }

  const button = event.target.closest<HTMLButtonElement>('button')
  return button && element.contains(button) ? button : null
}

export const installNativeTouchZoomSuppression = (element: HTMLElement) => {
  element.dataset.nativeTouchZoomSuppressed = 'true'
  element.style.touchAction = 'none'

  let touchSequenceHadMultipleTouches = false
  let lastButtonTap: { button: HTMLButtonElement; endedAt: number } | undefined

  const suppressBrowserTouchZoom = (event: TouchEvent) => {
    const multiTouchEvent = hasMultipleTouches(event)
    if (multiTouchEvent) {
      touchSequenceHadMultipleTouches = true
      lastButtonTap = undefined
      preventCancelableDefault(event)
    }

    if (event.type === 'touchcancel') {
      lastButtonTap = undefined
      if (event.touches.length === 0) {
        touchSequenceHadMultipleTouches = false
      }
      return
    }

    if (event.type !== 'touchend') {
      return
    }

    const sequenceHadMultipleTouches =
      touchSequenceHadMultipleTouches || multiTouchEvent
    if (event.touches.length === 0) {
      touchSequenceHadMultipleTouches = false
    }

    if (
      sequenceHadMultipleTouches ||
      event.defaultPrevented ||
      event.changedTouches.length !== 1
    ) {
      lastButtonTap = undefined
      return
    }

    const button = findButtonTarget(element, event)
    if (!button) {
      lastButtonTap = undefined
      return
    }

    const elapsedSinceLastTap = lastButtonTap
      ? event.timeStamp - lastButtonTap.endedAt
      : Number.POSITIVE_INFINITY
    if (
      lastButtonTap?.button !== button ||
      elapsedSinceLastTap < 0 ||
      elapsedSinceLastTap > doubleTapThresholdMs
    ) {
      lastButtonTap = { button, endedAt: event.timeStamp }
      return
    }

    lastButtonTap = undefined
    if (!event.cancelable) {
      return
    }

    event.preventDefault()
    // Canceling touchend also suppresses Safari's compatibility click.
    button.click()
  }

  for (const eventType of touchEventTypes) {
    element.addEventListener(
      eventType,
      suppressBrowserTouchZoom,
      nonPassiveOptions,
    )
  }

  for (const eventType of safariGestureEventTypes) {
    element.addEventListener(
      eventType,
      preventCancelableDefault,
      nonPassiveOptions,
    )
  }

  element.addEventListener('dblclick', preventCancelableDefault)
}
