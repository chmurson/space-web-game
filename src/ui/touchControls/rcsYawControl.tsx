import './rcsYawControl.css'
import { render } from 'preact'
import {
  getNeutralRcsYawAnalogSnapshot,
  getRcsYawAnalogSnapshot,
  getRcsYawAnalogSnapshotFromTurn,
  type RcsYawAnalogSnapshot,
} from './rcsYawControlModel'

export type RcsYawGestureSession =
  | { kind: 'none' }
  | {
      kind: 'rcs-yaw-active'
      touchId: number
    }

type RcsYawControlRefs = {
  closeButton: HTMLButtonElement
  thumb: HTMLDivElement
  track: HTMLDivElement
}

const rcsYawGestureTargetAttribute = 'data-touch-edge-reveal-gesture-target'
const fallbackTrackWidthPx = 188
const fallbackThumbWidthPx = 48

const RcsYawControlMarkup = () => (
  <>
    <div class="touch-rcs-yaw-control-header">
      <span class="touch-rcs-yaw-control-title">RCS</span>
      <button
        aria-label="Hide RCS yaw control"
        class="touch-rcs-yaw-control-close"
        type="button"
      >
        X
      </button>
    </div>
    <div
      aria-label="RCS yaw"
      aria-valuemax={1}
      aria-valuemin={-1}
      aria-valuenow={0}
      aria-valuetext="Neutral"
      class="touch-rcs-yaw-control-track"
      role="slider"
      tabIndex={0}
      {...{ [rcsYawGestureTargetAttribute]: 'rcs-yaw' }}
    >
      <span
        aria-hidden="true"
        class="touch-rcs-yaw-control-indicator touch-rcs-yaw-control-indicator-left"
      >
        &lt;
      </span>
      <span
        aria-hidden="true"
        class="touch-rcs-yaw-control-indicator touch-rcs-yaw-control-indicator-right"
      >
        &gt;
      </span>
      <span aria-hidden="true" class="touch-rcs-yaw-control-center-mark" />
      <span
        aria-hidden="true"
        class="touch-rcs-yaw-control-energy touch-rcs-yaw-control-energy-left"
      />
      <span
        aria-hidden="true"
        class="touch-rcs-yaw-control-energy touch-rcs-yaw-control-energy-right"
      />
      <div class="touch-rcs-yaw-control-thumb" />
    </div>
  </>
)

const getRequiredElement = <ElementType extends Element>(
  root: ParentNode,
  selector: string,
  message: string,
): ElementType => {
  const element = root.querySelector<ElementType>(selector)
  if (!element) {
    throw new Error(message)
  }

  return element
}

const createRcsYawControlElement = () => {
  const element = document.createElement('div')
  element.className = 'touch-rcs-yaw-control'
  render(<RcsYawControlMarkup />, element)

  return {
    closeButton: getRequiredElement<HTMLButtonElement>(
      element,
      '.touch-rcs-yaw-control-close',
      'RCS yaw control rendered without close button',
    ),
    element,
    thumb: getRequiredElement<HTMLDivElement>(
      element,
      '.touch-rcs-yaw-control-thumb',
      'RCS yaw control rendered without thumb',
    ),
    track: getRequiredElement<HTMLDivElement>(
      element,
      '.touch-rcs-yaw-control-track',
      'RCS yaw control rendered without track',
    ),
  }
}

const formatTurnValue = (turn: number) => turn.toFixed(2)

const formatTurnText = (turn: number) => {
  if (turn > 0) {
    return `Yaw left ${formatTurnValue(turn)}`
  }

  if (turn < 0) {
    return `Yaw right ${formatTurnValue(Math.abs(turn))}`
  }

  return 'Neutral'
}

export const createRcsYawControl = (options: {
  container: HTMLElement
  onCloseRequest(): void
  onSessionChange(session: RcsYawGestureSession): void
  setTurn(turn: number): void
}) => {
  const {
    closeButton,
    element,
    thumb: _thumb,
    track,
  }: {
    element: HTMLDivElement
  } & RcsYawControlRefs = createRcsYawControlElement()
  let currentSnapshot = getNeutralRcsYawAnalogSnapshot()
  options.container.appendChild(element)

  const setSession = (session: RcsYawGestureSession) => {
    options.onSessionChange(session)
  }

  const renderSnapshot = (snapshot: RcsYawAnalogSnapshot) => {
    element.classList.toggle(
      'touch-rcs-yaw-control-active',
      snapshot.turn !== 0,
    )
    element.style.setProperty(
      '--rcs-yaw-thumb-offset',
      `${snapshot.offsetPx}px`,
    )
    element.style.setProperty('--rcs-yaw-left-fill', `${snapshot.leftFillPx}px`)
    element.style.setProperty(
      '--rcs-yaw-right-fill',
      `${snapshot.rightFillPx}px`,
    )
    track.setAttribute('aria-valuenow', formatTurnValue(snapshot.turn))
    track.setAttribute('aria-valuetext', formatTurnText(snapshot.turn))
    track.dataset.rcsYawTurn = formatTurnValue(snapshot.turn)
  }

  const applySnapshot = (snapshot: RcsYawAnalogSnapshot) => {
    currentSnapshot = snapshot
    options.setTurn(snapshot.turn)
    renderSnapshot(snapshot)
  }

  const getTrackMetrics = () => {
    const trackRect = track.getBoundingClientRect()
    const thumbRect = _thumb.getBoundingClientRect()

    return {
      thumbWidth: thumbRect.width || fallbackThumbWidthPx,
      trackLeft: trackRect.left,
      trackWidth: trackRect.width || fallbackTrackWidthPx,
    }
  }

  const getTrackSnapshot = (touch: Pick<Touch, 'clientX'>) => {
    const metrics = getTrackMetrics()

    return getRcsYawAnalogSnapshot({
      clientX: touch.clientX,
      thumbWidth: metrics.thumbWidth,
      trackLeft: metrics.trackLeft,
      trackWidth: metrics.trackWidth,
    })
  }

  const applyTurn = (turn: number) => {
    const metrics = getTrackMetrics()
    applySnapshot(
      getRcsYawAnalogSnapshotFromTurn({
        thumbWidth: metrics.thumbWidth,
        trackWidth: metrics.trackWidth,
        turn,
      }),
    )
  }

  const clearInput = () => {
    applySnapshot(getNeutralRcsYawAnalogSnapshot())
  }

  closeButton.addEventListener('click', (event) => {
    event.stopPropagation()
    options.onCloseRequest()
  })

  track.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return
    }

    event.preventDefault()
    applyTurn(event.key === 'ArrowLeft' ? 1 : -1)
  })
  track.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      clearInput()
    }
  })
  track.addEventListener('blur', clearInput)

  renderSnapshot(currentSnapshot)

  return {
    beginGesture(touch: Touch, session: RcsYawGestureSession) {
      if (session.kind !== 'none') {
        return session
      }

      applySnapshot(getTrackSnapshot(touch))
      const nextSession: RcsYawGestureSession = {
        kind: 'rcs-yaw-active',
        touchId: touch.identifier,
      }
      setSession(nextSession)
      return nextSession
    },
    clearGesture(session: RcsYawGestureSession) {
      if (session.kind !== 'rcs-yaw-active') {
        clearInput()
        return session
      }

      clearInput()
      const nextSession: RcsYawGestureSession = { kind: 'none' }
      setSession(nextSession)
      return nextSession
    },
    clearInput,
    containsGestureTarget(target: EventTarget | null) {
      return (
        target instanceof Element &&
        Boolean(target.closest(`[${rcsYawGestureTargetAttribute}]`))
      )
    },
    element,
    ownsTouch(session: RcsYawGestureSession, touchId: number) {
      return session.kind === 'rcs-yaw-active' && session.touchId === touchId
    },
    syncUi() {
      renderSnapshot(currentSnapshot)
    },
    updateGesture(touch: Touch, session: RcsYawGestureSession) {
      if (
        session.kind !== 'rcs-yaw-active' ||
        session.touchId !== touch.identifier
      ) {
        return session
      }

      applySnapshot(getTrackSnapshot(touch))
      return session
    },
  }
}
