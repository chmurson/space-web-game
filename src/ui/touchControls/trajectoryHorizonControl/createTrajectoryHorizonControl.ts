import type { TrajectoryHorizonAction } from '../../../runtime/trajectoryHorizonControlPolicy'
import { formatTrajectoryHorizonDuration } from '../../formatters'
import { createStepSelectorControl } from '../stepSelectorControl/createStepSelectorControl'
import type {
  StepSelectorControl,
  StepSelectorDirection,
  StepSelectorGestureSession,
  StepSelectorPreview,
} from '../stepSelectorControl/stepSelectorControlTypes'

export type TrajectoryHorizonControlId = 'trajectory-horizon'

export type TrajectoryHorizonGestureSession =
  StepSelectorGestureSession<TrajectoryHorizonControlId>

export type TrajectoryHorizonControl =
  StepSelectorControl<TrajectoryHorizonControlId>

export type TrajectoryHorizonControlOptions = {
  commitTrajectoryHorizon(action: TrajectoryHorizonAction): void
  container?: HTMLElement
  getCurrentTrajectoryHorizonHours(): number
  getTrajectoryHorizonPreviews(
    action: TrajectoryHorizonAction,
    count: number,
  ): StepSelectorPreview[]
  onSessionChange(
    session: TrajectoryHorizonGestureSession | { kind: 'none' },
  ): void
  panel: HTMLElement
}

const getAction = (
  direction: StepSelectorDirection,
): TrajectoryHorizonAction =>
  direction === 'increase' ? 'increaseCoastHorizon' : 'decreaseCoastHorizon'

const formatTrajectoryHorizonLabel = (hours: number) =>
  formatTrajectoryHorizonDuration(hours * 60 * 60)

export const createTrajectoryHorizonControl = (
  options: TrajectoryHorizonControlOptions,
): TrajectoryHorizonControl =>
  createStepSelectorControl({
    ariaLabel: 'Trajectory prediction horizon control',
    className: 'touch-step-selector-trajectory',
    commitStep: (direction) => {
      options.commitTrajectoryHorizon(getAction(direction))
    },
    container: options.container,
    controlId: 'trajectory-horizon',
    formatValue: formatTrajectoryHorizonLabel,
    getCurrentValue: options.getCurrentTrajectoryHorizonHours,
    getStepPreviews: (direction, count) =>
      options.getTrajectoryHorizonPreviews(getAction(direction), count),
    onSessionChange: options.onSessionChange,
    panel: options.panel,
  })
