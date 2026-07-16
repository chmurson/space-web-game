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
const preservedNonButtonInteractionSelector = [
  'a[href]',
  'canvas',
  'input:not([disabled])',
  'label',
  'select:not([disabled])',
  'summary',
  'textarea:not([disabled])',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const preventCancelableDefault = (event: Event) => {
  if (event.cancelable) {
    event.preventDefault()
  }
}

const hasMultipleTouches = (event: TouchEvent) =>
  event.touches.length > 1 ||
  event.targetTouches.length > 1 ||
  event.changedTouches.length > 1

const findRapidTapTarget = (element: HTMLElement, event: TouchEvent) => {
  if (!(event.target instanceof Element)) {
    return null
  }

  const button = event.target.closest<HTMLButtonElement>('button')
  if (button && element.contains(button)) {
    return { button, target: button }
  }

  const interactiveTarget = event.target.closest(
    preservedNonButtonInteractionSelector,
  )
  if (interactiveTarget && element.contains(interactiveTarget)) {
    return null
  }

  return element.contains(event.target)
    ? { button: null, target: event.target }
    : null
}

export const installNativeTouchZoomSuppression = (element: HTMLElement) => {
  element.dataset.nativeTouchZoomSuppressed = 'true'
  element.style.touchAction = 'none'

  let touchSequenceHadMultipleTouches = false
  let lastCompletedTap: { endedAt: number; target: Element } | undefined

  const suppressBrowserTouchZoom = (event: TouchEvent) => {
    const multiTouchEvent = hasMultipleTouches(event)
    if (multiTouchEvent) {
      touchSequenceHadMultipleTouches = true
      lastCompletedTap = undefined
      preventCancelableDefault(event)
    }

    if (event.type === 'touchcancel') {
      lastCompletedTap = undefined
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
      lastCompletedTap = undefined
      return
    }

    const rapidTapTarget = findRapidTapTarget(element, event)
    if (!rapidTapTarget) {
      lastCompletedTap = undefined
      return
    }

    const elapsedSinceLastTap = lastCompletedTap
      ? event.timeStamp - lastCompletedTap.endedAt
      : Number.POSITIVE_INFINITY
    if (
      lastCompletedTap?.target !== rapidTapTarget.target ||
      elapsedSinceLastTap < 0 ||
      elapsedSinceLastTap > doubleTapThresholdMs
    ) {
      lastCompletedTap = {
        endedAt: event.timeStamp,
        target: rapidTapTarget.target,
      }
      return
    }

    lastCompletedTap = undefined
    if (!event.cancelable) {
      return
    }

    event.preventDefault()
    if (rapidTapTarget.button) {
      // Canceling touchend also suppresses Safari's compatibility click.
      rapidTapTarget.button.click()
    }
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
