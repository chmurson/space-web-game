import type {
  TimeWarpAction,
  TimeWarpFeedbackReason,
} from '../../runtime/timeWarpFeedbackPolicy'
import type {
  StepSelectorControl,
  StepSelectorGestureSession,
} from './stepSelectorControl/stepSelectorControlTypes'

export type TimeWarpPreview = {
  canCommit: boolean
  reason: TimeWarpFeedbackReason | null
  value: number
}

export type TimeWarpGestureSession =
  | { kind: 'none' }
  | StepSelectorGestureSession<'time-warp'>

export type TimeWarpControlOptions = {
  commitTimeWarp(action: TimeWarpAction): void
  getCurrentTimeWarp(): number
  getTimeWarpPreview(action: TimeWarpAction): TimeWarpPreview
  getTimeWarpPreviews(action: TimeWarpAction, count: number): TimeWarpPreview[]
  onSessionChange(session: TimeWarpGestureSession): void
  container?: HTMLElement
  panel: HTMLElement
}

export type TimeWarpControl = StepSelectorControl<'time-warp'>
