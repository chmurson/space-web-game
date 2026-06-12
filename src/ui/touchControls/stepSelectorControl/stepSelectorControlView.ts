import type { StepSelectorControlRenderState } from './stepSelectorControlPresenter'
import type { StepSelectorRenderStep } from './stepSelectorControlPresenter'

type StepSelectorControlView = {
  element: HTMLElement
  render(renderState: StepSelectorControlRenderState): void
}

const renderStep = (
  element: HTMLElement | null,
  step: StepSelectorRenderStep,
) => {
  if (!element) {
    return
  }

  element.textContent = step.hidden ? '' : step.label
  element.classList.toggle('touch-step-selector-value-hidden', step.hidden)
  element.classList.toggle(
    'touch-step-selector-value-disabled',
    !step.hidden && step.tone === 'blocked',
  )
}

export const createStepSelectorControlView = (options: {
  ariaLabel: string
  className?: string
}): StepSelectorControlView => {
  const element = document.createElement('div')
  element.className = ['touch-step-selector', options.className ?? '']
    .filter(Boolean)
    .join(' ')
  element.setAttribute('aria-label', options.ariaLabel)
  element.innerHTML = `
    <div class="touch-step-selector-value touch-step-selector-value-next touch-step-selector-value-secondary touch-step-selector-value-extra touch-step-selector-value-up-extra"></div>
    <div class="touch-step-selector-value touch-step-selector-value-next touch-step-selector-value-secondary touch-step-selector-value-up-far"></div>
    <div class="touch-step-selector-value touch-step-selector-value-next touch-step-selector-value-up-near"></div>
    <div class="touch-step-selector-current">
      <div class="touch-step-selector-value touch-step-selector-value-current"></div>
    </div>
    <div class="touch-step-selector-value touch-step-selector-value-next touch-step-selector-value-down-near"></div>
    <div class="touch-step-selector-value touch-step-selector-value-next touch-step-selector-value-secondary touch-step-selector-value-down-far"></div>
    <div class="touch-step-selector-value touch-step-selector-value-next touch-step-selector-value-secondary touch-step-selector-value-extra touch-step-selector-value-down-extra"></div>
  `
  const upExtraValue = element.querySelector<HTMLElement>(
    '.touch-step-selector-value-up-extra',
  )
  const upFarValue = element.querySelector<HTMLElement>(
    '.touch-step-selector-value-up-far',
  )
  const upNearValue = element.querySelector<HTMLElement>(
    '.touch-step-selector-value-up-near',
  )
  const currentValue = element.querySelector<HTMLElement>(
    '.touch-step-selector-value-current',
  )
  const downNearValue = element.querySelector<HTMLElement>(
    '.touch-step-selector-value-down-near',
  )
  const downFarValue = element.querySelector<HTMLElement>(
    '.touch-step-selector-value-down-far',
  )
  const downExtraValue = element.querySelector<HTMLElement>(
    '.touch-step-selector-value-down-extra',
  )
  let lastRenderKey = ''

  return {
    element,
    render(renderState) {
      const renderKey = JSON.stringify(renderState)
      if (renderKey === lastRenderKey) {
        return
      }
      lastRenderKey = renderKey

      currentValue?.replaceChildren(renderState.currentLabel)
      renderStep(upExtraValue, renderState.upExtraStep)
      renderStep(upFarValue, renderState.upFarStep)
      renderStep(upNearValue, renderState.upNearStep)
      renderStep(downNearValue, renderState.downNearStep)
      renderStep(downFarValue, renderState.downFarStep)
      renderStep(downExtraValue, renderState.downExtraStep)
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
    },
  }
}
