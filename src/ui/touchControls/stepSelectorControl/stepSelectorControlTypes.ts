export type StepSelectorDirection = 'increase' | 'decrease'

export type StepSelectorPreview = {
  canCommit: boolean
  value: number
}

export type StepSelectorGestureSession<ControlId extends string = string> = {
  committedStepCount: number
  kind: 'step-selector'
  controlId: ControlId
  stepAnchorY: number
  startX: number
  startY: number
  touchId: number
}

export type StepSelectorControlOptions<ControlId extends string = string> = {
  ariaLabel: string
  className?: string
  commitStep(direction: StepSelectorDirection): void
  container?: HTMLElement
  controlId: ControlId
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
  beginGesture(touch: Touch): StepSelectorGestureSession<ControlId>
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
    touch: Touch,
    session: StepSelectorGestureSession<ControlId>,
  ): StepSelectorGestureSession<ControlId>
}
