import { render } from 'preact'

export type TimeWarpTapeRenderStep = {
  key: string
  label: string
  offset: number
  tone: 'available' | 'blocked' | 'current'
}

export type TimeWarpTapeRenderState = {
  currentLabel: string
  dragOffsetPx: number
  dragging: boolean
  releaseWillCommit: boolean
  steps: TimeWarpTapeRenderStep[]
  targetDirection: 'decrease' | 'increase' | null
}

type TimeWarpTapeControlView = {
  element: HTMLElement
  getLastDragOffsetPx(): number
  render(renderState: TimeWarpTapeRenderState): void
}

const TimeWarpTapeControlSurface = ({
  renderState,
}: {
  renderState: TimeWarpTapeRenderState
}) => (
  <>
    <div class="touch-time-warp-tape-header">
      <span>Time Rate</span>
      <strong>{renderState.currentLabel}</strong>
    </div>
    <div class="touch-time-warp-tape-window" aria-hidden="true">
      <div class="touch-time-warp-tape-track">
        {renderState.steps.map((step) => (
          <div
            class="touch-time-warp-tape-step"
            data-tone={step.tone}
            key={step.key}
            style={{
              '--touch-time-warp-tape-step-offset': String(step.offset),
            }}
          >
            <span class="touch-time-warp-tape-tick" />
            <span class="touch-time-warp-tape-label">{step.label}</span>
          </div>
        ))}
      </div>
      <div class="touch-time-warp-tape-reader" />
    </div>
  </>
)

const getContentRenderKey = (renderState: TimeWarpTapeRenderState) =>
  JSON.stringify({
    currentLabel: renderState.currentLabel,
    steps: renderState.steps,
  })

export const createTimeWarpTapeControlView = (options: {
  ariaLabel: string
}): TimeWarpTapeControlView => {
  const element = document.createElement('div')
  element.className = 'touch-time-warp-tape'
  element.setAttribute('role', 'group')
  element.setAttribute('aria-label', options.ariaLabel)
  let lastContentRenderKey = ''
  let lastDragOffsetPx = 0

  return {
    element,
    getLastDragOffsetPx() {
      return lastDragOffsetPx
    },
    render(renderState) {
      lastDragOffsetPx = renderState.dragOffsetPx
      element.style.setProperty(
        '--touch-time-warp-tape-drag-x',
        `${renderState.dragOffsetPx.toFixed(1)}px`,
      )
      element.classList.toggle(
        'touch-time-warp-tape-dragging',
        renderState.dragging,
      )
      element.classList.toggle(
        'touch-time-warp-tape-commit-ready',
        renderState.releaseWillCommit,
      )
      element.classList.toggle(
        'touch-time-warp-tape-target-increase',
        renderState.targetDirection === 'increase',
      )
      element.classList.toggle(
        'touch-time-warp-tape-target-decrease',
        renderState.targetDirection === 'decrease',
      )

      const contentRenderKey = getContentRenderKey(renderState)
      if (contentRenderKey === lastContentRenderKey) {
        return
      }
      lastContentRenderKey = contentRenderKey

      render(<TimeWarpTapeControlSurface renderState={renderState} />, element)
    },
  }
}
