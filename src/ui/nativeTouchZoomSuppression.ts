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

const preventCancelableDefault = (event: Event) => {
  if (event.cancelable) {
    event.preventDefault()
  }
}

const hasMultipleTouches = (event: TouchEvent) =>
  event.touches.length > 1 ||
  event.targetTouches.length > 1 ||
  event.changedTouches.length > 1

const preventMultiTouchDefault = (event: TouchEvent) => {
  if (hasMultipleTouches(event)) {
    preventCancelableDefault(event)
  }
}

export const installNativeTouchZoomSuppression = (element: HTMLElement) => {
  element.dataset.nativeTouchZoomSuppressed = 'true'
  element.style.touchAction = 'none'

  for (const eventType of touchEventTypes) {
    element.addEventListener(
      eventType,
      preventMultiTouchDefault,
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
