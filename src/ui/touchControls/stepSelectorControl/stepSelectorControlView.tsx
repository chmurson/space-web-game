import { render } from 'preact'
import type {
  StepSelectorControlRenderState,
  StepSelectorRenderStep,
} from './stepSelectorControlPresenter'

type StepSelectorControlView = {
  element: HTMLElement
  render(renderState: StepSelectorControlRenderState): void
}

type StepSelectorValueProps = {
  className: string
  step: StepSelectorRenderStep
}

const getStepClassName = (className: string, step: StepSelectorRenderStep) =>
  [
    'touch-step-selector-value',
    className,
    step.hidden ? 'touch-step-selector-value-hidden' : '',
    !step.hidden && step.tone === 'blocked'
      ? 'touch-step-selector-value-disabled'
      : '',
  ]
    .filter(Boolean)
    .join(' ')

const StepSelectorValue = ({ className, step }: StepSelectorValueProps) => (
  <div class={getStepClassName(className, step)}>
    {step.hidden ? '' : step.label}
  </div>
)

const StepSelectorControlContent = ({
  renderState,
}: {
  renderState: StepSelectorControlRenderState
}) => (
  <>
    <StepSelectorValue
      className="touch-step-selector-value-next touch-step-selector-value-secondary touch-step-selector-value-extra touch-step-selector-value-up-extra"
      step={renderState.upExtraStep}
    />
    <StepSelectorValue
      className="touch-step-selector-value-next touch-step-selector-value-secondary touch-step-selector-value-up-far"
      step={renderState.upFarStep}
    />
    <StepSelectorValue
      className="touch-step-selector-value-next touch-step-selector-value-up-near"
      step={renderState.upNearStep}
    />
    <div class="touch-step-selector-current">
      <div class="touch-step-selector-value touch-step-selector-value-current">
        {renderState.currentLabel}
      </div>
    </div>
    <StepSelectorValue
      className="touch-step-selector-value-next touch-step-selector-value-down-near"
      step={renderState.downNearStep}
    />
    <StepSelectorValue
      className="touch-step-selector-value-next touch-step-selector-value-secondary touch-step-selector-value-down-far"
      step={renderState.downFarStep}
    />
    <StepSelectorValue
      className="touch-step-selector-value-next touch-step-selector-value-secondary touch-step-selector-value-extra touch-step-selector-value-down-extra"
      step={renderState.downExtraStep}
    />
  </>
)

const getContentRenderKey = (renderState: StepSelectorControlRenderState) =>
  JSON.stringify({
    currentLabel: renderState.currentLabel,
    downExtraStep: renderState.downExtraStep,
    downFarStep: renderState.downFarStep,
    downNearStep: renderState.downNearStep,
    upExtraStep: renderState.upExtraStep,
    upFarStep: renderState.upFarStep,
    upNearStep: renderState.upNearStep,
  })

export const createStepSelectorControlView = (options: {
  ariaLabel: string
  className?: string
}): StepSelectorControlView => {
  const element = document.createElement('div')
  element.className = ['touch-step-selector', options.className ?? '']
    .filter(Boolean)
    .join(' ')
  element.setAttribute('aria-label', options.ariaLabel)
  let lastContentRenderKey = ''

  return {
    element,
    render(renderState) {
      element.style.setProperty(
        '--touch-step-selector-drag-progress',
        renderState.dragProgress.toFixed(3),
      )
      element.classList.toggle(
        'touch-step-selector-dragging',
        renderState.dragDirection !== null,
      )
      element.classList.toggle(
        'touch-step-selector-target-increase',
        renderState.targetDirection === 'increase',
      )
      element.classList.toggle(
        'touch-step-selector-target-decrease',
        renderState.targetDirection === 'decrease',
      )
      element.classList.toggle(
        'touch-step-selector-drag-committable',
        renderState.releaseWillCommit,
      )
      element.classList.toggle(
        'touch-step-selector-step-up',
        renderState.animationDirection === 'up',
      )
      element.classList.toggle(
        'touch-step-selector-step-down',
        renderState.animationDirection === 'down',
      )

      const contentRenderKey = getContentRenderKey(renderState)
      if (contentRenderKey === lastContentRenderKey) {
        return
      }
      lastContentRenderKey = contentRenderKey

      render(<StepSelectorControlContent renderState={renderState} />, element)
    },
  }
}
