import {
  formatTimeWarpFeedbackLabel,
  type TimeWarpFeedbackReason,
} from '../../runtime/timeWarpFeedbackPolicy'
import type {
  TimeWarpFeedbackSnapshot,
  TouchOverlayPoint,
} from './timeWarpFeedbackModel'

type OverlaySize = {
  halfHeight: number
  halfWidth: number
}

type TimeWarpFeedbackView = {
  clear(): void
  render(snapshot: TimeWarpFeedbackSnapshot): void
}

const screenEdgePaddingPx = 12

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const measureOverlaySize = (
  element: HTMLElement,
  fallback: OverlaySize,
): OverlaySize => {
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return fallback
  }

  return {
    halfHeight: rect.height / 2,
    halfWidth: rect.width / 2,
  }
}

const getVariant = (action: TimeWarpFeedbackSnapshot['action']) =>
  action === 'increaseTimeWarp' ? 'v2' : 'v4'

const getState = (reason: TimeWarpFeedbackReason | null) =>
  reason ? 'blocked' : 'available'

export const createTimeWarpFeedbackView = (options: {
  committedFadeMs: number
  element: HTMLElement
  getBounds(): { height: number; width: number }
}): TimeWarpFeedbackView => {
  let fadeTimer: number | null = null
  let overlaySize: OverlaySize = {
    halfHeight: 20,
    halfWidth: 64,
  }

  const clampPoint = (point: TouchOverlayPoint): TouchOverlayPoint => {
    const bounds = options.getBounds()

    return {
      x: clamp(
        point.x,
        overlaySize.halfWidth + screenEdgePaddingPx,
        bounds.width - overlaySize.halfWidth - screenEdgePaddingPx,
      ),
      y: clamp(
        point.y,
        overlaySize.halfHeight + screenEdgePaddingPx,
        bounds.height - overlaySize.halfHeight - screenEdgePaddingPx,
      ),
    }
  }

  const clearFadeTimer = () => {
    if (fadeTimer !== null) {
      window.clearTimeout(fadeTimer)
      fadeTimer = null
    }
  }

  const resetConfirmationState = () => {
    options.element.classList.remove('touch-time-warp-feedback-confirm')
    options.element.style.removeProperty('--warp-feedback-duration')
  }

  const clear = () => {
    clearFadeTimer()
    options.element.classList.remove(
      'touch-time-warp-feedback-confirm',
      'touch-time-warp-feedback-fade',
      'touch-time-warp-feedback-visible',
    )
    delete options.element.dataset.timeWarpFeedbackState
    delete options.element.dataset.warpFeedbackVariant
    options.element.textContent = ''
    options.element.style.removeProperty('--touch-time-warp-feedback-opacity')
    options.element.style.removeProperty(
      '--touch-time-warp-feedback-transition-duration',
    )
    resetConfirmationState()
  }

  const render = (snapshot: TimeWarpFeedbackSnapshot) => {
    if (
      snapshot.mode === 'hidden' ||
      snapshot.action === null ||
      snapshot.anchor === null ||
      snapshot.value === null
    ) {
      clear()
      return
    }

    clearFadeTimer()
    resetConfirmationState()

    options.element.textContent = formatTimeWarpFeedbackLabel({
      action: snapshot.action,
      reason: snapshot.reason,
      value: snapshot.value,
    })
    overlaySize = measureOverlaySize(options.element, overlaySize)
    const clampedPoint = clampPoint(snapshot.anchor)
    options.element.style.left = `${clampedPoint.x}px`
    options.element.style.top = `${clampedPoint.y}px`
    options.element.dataset.warpFeedbackVariant = getVariant(snapshot.action)
    options.element.dataset.timeWarpFeedbackState = getState(snapshot.reason)
    options.element.classList.add('touch-time-warp-feedback-visible')
    options.element.classList.remove('touch-time-warp-feedback-fade')

    if (snapshot.mode === 'preview') {
      options.element.style.setProperty(
        '--touch-time-warp-feedback-opacity',
        `${snapshot.opacity}`,
      )
      options.element.style.removeProperty(
        '--touch-time-warp-feedback-transition-duration',
      )
      return
    }

    options.element.style.setProperty('--touch-time-warp-feedback-opacity', '1')
    options.element.style.setProperty(
      '--touch-time-warp-feedback-transition-duration',
      `${options.committedFadeMs}ms`,
    )
    options.element.style.setProperty(
      '--warp-feedback-duration',
      `${options.committedFadeMs}ms`,
    )
    void options.element.getBoundingClientRect()
    options.element.classList.add('touch-time-warp-feedback-confirm')
    options.element.classList.add('touch-time-warp-feedback-fade')
    fadeTimer = window.setTimeout(() => {
      clear()
    }, options.committedFadeMs)
  }

  return {
    clear,
    render,
  }
}
