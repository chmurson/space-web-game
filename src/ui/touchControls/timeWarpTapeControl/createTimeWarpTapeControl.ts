import type { TimeWarpAction } from '../../../runtime/timeWarpFeedbackPolicy'
import { formatTimeWarpLabel } from '../../formatters'
import type { StepSelectorDirection } from '../stepSelectorControl/stepSelectorControlTypes'
import type {
  TimeWarpControl,
  TimeWarpControlOptions,
  TimeWarpPreview,
} from '../timeWarpControlTypes'
import './timeWarpTapeControl.css'
import {
  createTimeWarpTapeControlView,
  type TimeWarpTapeRenderState,
} from './timeWarpTapeControlView'

const tapeStepWidthPx = 28
const previewStepCount = 5

type TimeWarpTapeRuntimeSnapshot = {
  currentValue: number
  decreaseSteps: TimeWarpPreview[]
  increaseSteps: TimeWarpPreview[]
}

const getAction = (direction: StepSelectorDirection): TimeWarpAction =>
  direction === 'increase' ? 'increaseTimeWarp' : 'decreaseTimeWarp'

export const getTimeWarpTapeGestureDirection = (
  deltaX: number,
): StepSelectorDirection | null => {
  if (deltaX < 0) {
    return 'increase'
  }
  if (deltaX > 0) {
    return 'decrease'
  }
  return null
}

export const getTimeWarpTapeGestureCommittedStepCount = (deltaX: number) =>
  Math.floor(Math.abs(deltaX) / tapeStepWidthPx)

export const getTimeWarpTapeReleaseWillCommit = (deltaX: number) =>
  Math.abs(deltaX) > tapeStepWidthPx / 2

export const getTimeWarpTapeGesturePreviewDeltaX = (
  currentX: number,
  stepAnchorX: number,
) => currentX - stepAnchorX

const clampPreviewDeltaX = (deltaX: number, target: TimeWarpPreview | null) => {
  const limit = target?.canCommit ? tapeStepWidthPx : tapeStepWidthPx * 0.46
  return Math.max(-limit, Math.min(limit, deltaX))
}

const getNearStep = (
  snapshot: TimeWarpTapeRuntimeSnapshot,
  direction: StepSelectorDirection,
) =>
  direction === 'increase'
    ? snapshot.increaseSteps[0]
    : snapshot.decreaseSteps[0]

const createRenderSteps = (
  snapshot: TimeWarpTapeRuntimeSnapshot,
): TimeWarpTapeRenderState['steps'] => [
  ...snapshot.decreaseSteps
    .slice()
    .reverse()
    .map((step, index, steps) => ({
      key: `decrease-${steps.length - index}-${step.value}`,
      label: formatTimeWarpLabel(step.value),
      offset: index - steps.length,
      tone: step.canCommit ? ('available' as const) : ('blocked' as const),
    })),
  {
    key: `current-${snapshot.currentValue}`,
    label: formatTimeWarpLabel(snapshot.currentValue),
    offset: 0,
    tone: 'current' as const,
  },
  ...snapshot.increaseSteps.map((step, index) => ({
    key: `increase-${index + 1}-${step.value}`,
    label: formatTimeWarpLabel(step.value),
    offset: index + 1,
    tone: step.canCommit ? ('available' as const) : ('blocked' as const),
  })),
]

export const presentTimeWarpTapeControl = (
  snapshot: TimeWarpTapeRuntimeSnapshot,
  deltaX = 0,
): TimeWarpTapeRenderState => {
  const direction = getTimeWarpTapeGestureDirection(deltaX)
  const target = direction ? getNearStep(snapshot, direction) : null
  const dragOffsetPx = clampPreviewDeltaX(deltaX, target ?? null)

  return {
    currentLabel: formatTimeWarpLabel(snapshot.currentValue),
    dragOffsetPx,
    dragging: direction !== null,
    releaseWillCommit: Boolean(
      direction &&
        target?.canCommit &&
        getTimeWarpTapeReleaseWillCommit(deltaX),
    ),
    steps: createRenderSteps(snapshot),
    targetDirection: direction,
  }
}

type DragPoint = {
  clientX: number
  clientY: number
}

export const createTimeWarpTapeControl = (
  options: TimeWarpControlOptions,
): TimeWarpControl => {
  const view = createTimeWarpTapeControlView({
    ariaLabel: 'Time warp control',
  })
  const parentElement = options.container ?? options.panel
  parentElement.appendChild(view.element)
  let mouseSession:
    | ReturnType<TimeWarpControl['beginGesture']>
    | { kind: 'none' }
    | null = null

  const setSession = (session: ReturnType<TimeWarpControl['beginGesture']>) => {
    options.onSessionChange(session)
  }

  const clearSession = () => {
    const nextSession = { kind: 'none' } as const
    options.onSessionChange(nextSession)
    return nextSession
  }

  const getRuntimeSnapshot = (): TimeWarpTapeRuntimeSnapshot => ({
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

  const renderSnapshot = (deltaX = 0) => {
    view.render(presentTimeWarpTapeControl(getRuntimeSnapshot(), deltaX))
  }

  const getSessionAnchorX = (
    session: ReturnType<TimeWarpControl['beginGesture']>,
  ) => session.stepAnchorX ?? session.startX

  const beginGestureFromPoint = (point: DragPoint, touchId: number) => {
    renderSnapshot()
    const session: ReturnType<TimeWarpControl['beginGesture']> = {
      committedStepCount: 0,
      controlId: 'time-warp',
      kind: 'step-selector',
      startX: point.clientX,
      startY: point.clientY,
      stepAnchorX: point.clientX,
      stepAnchorY: point.clientY,
      touchId,
    }
    setSession(session)
    return session
  }

  const commitContinuousGestureSteps = (
    currentX: number,
    session: ReturnType<TimeWarpControl['beginGesture']>,
  ) => {
    let nextSession = session

    while (
      getTimeWarpTapeGestureCommittedStepCount(
        currentX - getSessionAnchorX(nextSession),
      ) > 0
    ) {
      const deltaX = currentX - getSessionAnchorX(nextSession)
      const direction = getTimeWarpTapeGestureDirection(deltaX)
      if (!direction) {
        break
      }

      const target = getNearStep(getRuntimeSnapshot(), direction)
      if (!target?.canCommit) {
        break
      }

      options.commitTimeWarp(getAction(direction))
      const consumedDistance =
        direction === 'increase' ? -tapeStepWidthPx : tapeStepWidthPx
      nextSession = {
        ...nextSession,
        committedStepCount: nextSession.committedStepCount + 1,
        stepAnchorX: getSessionAnchorX(nextSession) + consumedDistance,
      }
    }

    return nextSession
  }

  const updateGestureFromPoint = (
    point: DragPoint,
    session: ReturnType<TimeWarpControl['beginGesture']>,
  ) => {
    const nextSession = commitContinuousGestureSteps(point.clientX, session)
    const previewDeltaX = getTimeWarpTapeGesturePreviewDeltaX(
      point.clientX,
      getSessionAnchorX(nextSession),
    )
    renderSnapshot(previewDeltaX)
    setSession(nextSession)
    return nextSession
  }

  const finishGestureFromSession = (commitPreview: boolean) => {
    if (commitPreview) {
      const deltaX = view.getLastDragOffsetPx()
      const direction = getTimeWarpTapeGestureDirection(deltaX)
      const target = direction
        ? getNearStep(getRuntimeSnapshot(), direction)
        : null
      if (
        direction &&
        target?.canCommit &&
        getTimeWarpTapeReleaseWillCommit(deltaX)
      ) {
        options.commitTimeWarp(getAction(direction))
      }
    }

    renderSnapshot()
    return clearSession()
  }

  const finishMouseGesture = (commitPreview: boolean) => {
    if (!mouseSession || mouseSession.kind !== 'step-selector') {
      return
    }
    finishGestureFromSession(commitPreview)
    mouseSession = null
  }

  view.element.addEventListener('mousedown', (event) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    mouseSession = beginGestureFromPoint(event, -1)
  })

  window.addEventListener('mousemove', (event) => {
    if (!mouseSession || mouseSession.kind !== 'step-selector') {
      return
    }
    event.preventDefault()
    mouseSession = updateGestureFromPoint(event, mouseSession)
  })

  window.addEventListener('mouseup', () => {
    finishMouseGesture(true)
  })

  window.addEventListener('blur', () => {
    finishMouseGesture(false)
  })

  renderSnapshot()

  return {
    beginGesture(touch) {
      return beginGestureFromPoint(touch, touch.identifier)
    },
    finishGesture(session, commitPreview) {
      if (
        session.kind !== 'step-selector' ||
        session.controlId !== 'time-warp'
      ) {
        return session
      }
      return finishGestureFromSession(commitPreview)
    },
    ownsTouch(session, touchId) {
      return (
        session.kind === 'step-selector' &&
        session.controlId === 'time-warp' &&
        session.touchId === touchId
      )
    },
    setVisible(visible) {
      if (!visible) {
        finishMouseGesture(false)
      }
      view.element.style.display = visible ? 'grid' : 'none'
    },
    setSession(session) {
      options.onSessionChange(session)
    },
    syncUi() {
      renderSnapshot()
    },
    updateGesture(touch, session) {
      if (
        session.kind !== 'step-selector' ||
        session.controlId !== 'time-warp' ||
        session.touchId !== touch.identifier
      ) {
        return session
      }

      return updateGestureFromPoint(touch, session)
    },
  }
}
