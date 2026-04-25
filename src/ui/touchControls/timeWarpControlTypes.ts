import type {
  TimeWarpAction,
  TimeWarpFeedbackReason,
} from '../../runtime/timeWarpFeedbackPolicy'

export type TimeWarpPreview = {
  canCommit: boolean
  reason: TimeWarpFeedbackReason | null
  value: number
}

export type TimeWarpGestureSession =
  | { kind: 'none' }
  | {
      kind: 'left-zone'
      hasCommitted?: boolean
      startX: number
      startY: number
      touchId: number
    }

export type TimeWarpControlOptions = {
  commitTimeWarp(action: TimeWarpAction): void
  getCurrentTimeWarp(): number
  getTimeWarpPreview(action: TimeWarpAction): TimeWarpPreview
  getTimeWarpPreviews(action: TimeWarpAction, count: number): TimeWarpPreview[]
  onSessionChange(session: TimeWarpGestureSession): void
  panel: HTMLElement
}

export type TimeWarpControl = {
  beginGesture(touch: Touch): TimeWarpGestureSession
  finishGesture(
    session: TimeWarpGestureSession,
    commitPreview: boolean,
  ): TimeWarpGestureSession
  ownsTouch(session: TimeWarpGestureSession, touchId: number): boolean
  setVisible(visible: boolean): void
  setSession(session: TimeWarpGestureSession): void
  syncUi(): void
  updateGesture(
    touch: Touch,
    session: TimeWarpGestureSession,
  ): TimeWarpGestureSession
}
