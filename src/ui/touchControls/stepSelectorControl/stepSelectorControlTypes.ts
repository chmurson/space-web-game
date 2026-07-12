export type StepSelectorDirection = 'increase' | 'decrease'

export type StepSelectorAxis = 'horizontal' | 'vertical'

export type StepSelectorGesturePoint = {
  clientX: number
  clientY: number
  identifier: number
}

export type StepSelectorPreview = {
  canCommit: boolean
  value: number
}

export type StepSelectorGestureSession<ControlId extends string = string> = {
  committedStepCount: number
  kind: 'step-selector'
  horizontalMotionSamples: { time: number; x: number }[]
  axis: StepSelectorAxis
  controlId: ControlId
  stepAnchorX: number
  stepAnchorY: number
  startX: number
  startY: number
  touchId: number
}

export type StepSelectorControlOptions<ControlId extends string = string> = {
  ariaLabel: string
  axis?: StepSelectorAxis
  className?: string
  commitStep(direction: StepSelectorDirection): void
  container?: HTMLElement
  controlId: ControlId
  enableHorizontalMomentum?: boolean
  formatValue(value: number): string
  getCurrentValue(): number
  getStepPreviews(
    direction: StepSelectorDirection,
    count: number,
  ): StepSelectorPreview[]
  onSessionChange(
    session:
      | StepSelectorGestureSession<ControlId>
      | {
          kind: 'none'
        },
  ): void
  panel: HTMLElement
}

export type StepSelectorControl<ControlId extends string = string> = {
  beginGesture(
    point: StepSelectorGesturePoint,
  ): StepSelectorGestureSession<ControlId>
  element: HTMLElement
  finishGesture(
    session: StepSelectorGestureSession<ControlId>,
    commitPreview: boolean,
  ): StepSelectorGestureSession<ControlId> | { kind: 'none' }
  ownsTouch(
    session: StepSelectorGestureSession<ControlId>,
    touchId: number,
  ): boolean
  setVisible(visible: boolean): void
  setSession(
    session: StepSelectorGestureSession<ControlId> | { kind: 'none' },
  ): void
  syncUi(): void
  updateGesture(
    point: StepSelectorGesturePoint,
    session: StepSelectorGestureSession<ControlId>,
  ): StepSelectorGestureSession<ControlId>
}
