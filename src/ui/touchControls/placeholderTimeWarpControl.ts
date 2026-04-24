import type {
  TimeWarpControl,
  TimeWarpControlOptions,
  TimeWarpGestureSession,
} from './timeWarpControl'

const warnNotImplemented = (method: string) => {
  console.warn(`Alternate time-warp control ${method} not implemented`)
}

export const createPlaceholderTimeWarpControl = (
  options: TimeWarpControlOptions,
): TimeWarpControl => {
  const setSession = (session: TimeWarpGestureSession) => {
    options.onSessionChange(session)
  }

  return {
    beginGesture(touch) {
      warnNotImplemented('beginGesture')
      const session: TimeWarpGestureSession = {
        kind: 'left-zone',
        startX: touch.clientX,
        startY: touch.clientY,
        touchId: touch.identifier,
      }
      setSession(session)
      return session
    },
    finishGesture(_session, _commitPreview) {
      warnNotImplemented('finishGesture')
      const session: TimeWarpGestureSession = { kind: 'none' }
      setSession(session)
      return session
    },
    ownsTouch(session, touchId) {
      warnNotImplemented('ownsTouch')
      return session.kind === 'left-zone' && session.touchId === touchId
    },
    setSession,
    syncUi() {
      warnNotImplemented('syncUi')
    },
    updateGesture(_touch, session) {
      warnNotImplemented('updateGesture')
      setSession(session)
      return session
    },
  }
}
