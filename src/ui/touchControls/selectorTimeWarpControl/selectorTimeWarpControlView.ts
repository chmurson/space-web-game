import type { SelectorTimeWarpControlRenderState } from './selectorTimeWarpControlPresenter'

type SelectorTimeWarpControlView = {
  element: HTMLElement
  render(renderState: SelectorTimeWarpControlRenderState): void
}

const renderStep = (
  element: HTMLElement | null,
  step: SelectorTimeWarpControlRenderState['increaseNearStep'],
) => {
  if (!element) {
    return
  }

  element.textContent = step.hidden ? '' : step.label
  element.classList.toggle('touch-time-warp-selector-value-hidden', step.hidden)
  element.classList.toggle(
    'touch-time-warp-selector-value-disabled',
    !step.hidden && step.tone === 'blocked',
  )
}

export const createSelectorTimeWarpControlView =
  (): SelectorTimeWarpControlView => {
    const element = document.createElement('div')
    element.className = 'touch-time-warp-selector'
    element.setAttribute('aria-label', 'Time warp control')
    element.innerHTML = `
      <div class="touch-time-warp-selector-value touch-time-warp-selector-value-next touch-time-warp-selector-value-secondary touch-time-warp-selector-value-up-far"></div>
      <div class="touch-time-warp-selector-value touch-time-warp-selector-value-next touch-time-warp-selector-value-up-near"></div>
      <div class="touch-time-warp-selector-current">
        <div class="touch-time-warp-selector-value touch-time-warp-selector-value-current"></div>
      </div>
      <div class="touch-time-warp-selector-value touch-time-warp-selector-value-next touch-time-warp-selector-value-down-near"></div>
      <div class="touch-time-warp-selector-value touch-time-warp-selector-value-next touch-time-warp-selector-value-secondary touch-time-warp-selector-value-down-far"></div>
    `
    const increaseFarValue = element.querySelector<HTMLElement>(
      '.touch-time-warp-selector-value-up-far',
    )
    const increaseNearValue = element.querySelector<HTMLElement>(
      '.touch-time-warp-selector-value-up-near',
    )
    const currentValue = element.querySelector<HTMLElement>(
      '.touch-time-warp-selector-value-current',
    )
    const decreaseNearValue = element.querySelector<HTMLElement>(
      '.touch-time-warp-selector-value-down-near',
    )
    const decreaseFarValue = element.querySelector<HTMLElement>(
      '.touch-time-warp-selector-value-down-far',
    )

    return {
      element,
      render(renderState) {
        currentValue?.replaceChildren(renderState.currentLabel)
        renderStep(increaseFarValue, renderState.increaseFarStep)
        renderStep(increaseNearValue, renderState.increaseNearStep)
        renderStep(decreaseNearValue, renderState.decreaseNearStep)
        renderStep(decreaseFarValue, renderState.decreaseFarStep)
        element.classList.toggle(
          'touch-time-warp-selector-step-up',
          renderState.animationDirection === 'up',
        )
        element.classList.toggle(
          'touch-time-warp-selector-step-down',
          renderState.animationDirection === 'down',
        )
      },
    }
  }
