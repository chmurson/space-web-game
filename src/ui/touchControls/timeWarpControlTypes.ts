import type {
  TimeWarpAction,
  TimeWarpFeedbackReason,
} from '../../runtime/timeWarpFeedbackPolicy'
import type {
  StepSelectorAxis,
  StepSelectorControl,
  StepSelectorGesturePoint,
  StepSelectorGestureSession,
} from './stepSelectorControl/stepSelectorControlTypes'

export type TimeWarpPreview = {
  canCommit: boolean
  reason: TimeWarpFeedbackReason | null
  value: number
}

export type TimeWarpControlId = 'time-warp' | 'time-warp-2'

export type TimeWarpGestureSession =
  | { kind: 'none' }
  | StepSelectorGestureSession<TimeWarpControlId>

export type TimeWarpControlOptions = {
  ariaLabel?: string
  axis?: StepSelectorAxis
  className?: string
  commitTimeWarp(action: TimeWarpAction): void
  controlId?: TimeWarpControlId
  enableHorizontalMomentum?: boolean
  getCurrentTimeWarp(): number
  getTimeWarpPreview(action: TimeWarpAction): TimeWarpPreview
  getTimeWarpPreviews(action: TimeWarpAction, count: number): TimeWarpPreview[]
  onSessionChange(session: TimeWarpGestureSession): void
  container?: HTMLElement
  panel: HTMLElement
}

export type TimeWarpControl = StepSelectorControl<TimeWarpControlId>

export type TimeWarpGesturePoint = StepSelectorGesturePoint
