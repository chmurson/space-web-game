import { render } from 'preact'
import type { TouchControlRevealEdge } from './edgeRevealControl'

type EdgeRevealControlViewOptions = {
  className?: string
  contentId: string
  edge: TouchControlRevealEdge
  icon: string
  id: string
  label: string
}

type EdgeRevealControlView = {
  content: HTMLElement
  element: HTMLElement
  tab: HTMLButtonElement
}

const getEdgeRevealClassName = (options: EdgeRevealControlViewOptions) =>
  [
    'touch-edge-reveal-control',
    `touch-edge-reveal-control-${options.edge}`,
    options.className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

const EdgeRevealControlSurface = (options: EdgeRevealControlViewOptions) => (
  <section
    class={getEdgeRevealClassName(options)}
    data-edge-reveal-id={options.id}
    id={options.id}
  >
    <button
      aria-controls={options.contentId}
      aria-expanded="false"
      aria-label={options.label}
      class="touch-edge-reveal-tab"
      type="button"
    >
      {options.icon}
    </button>
    <div class="touch-edge-reveal-content" id={options.contentId} />
  </section>
)

const getRequiredElement = <ElementType extends Element>(
  root: ParentNode,
  selector: string,
  message: string,
): ElementType => {
  const element = root.querySelector<ElementType>(selector)
  if (!element) {
    throw new Error(message)
  }
  return element
}

export const createEdgeRevealControlView = (
  options: EdgeRevealControlViewOptions,
): EdgeRevealControlView => {
  const host = document.createElement('div')
  render(<EdgeRevealControlSurface {...options} />, host)

  const element = host.firstElementChild
  if (!(element instanceof HTMLElement)) {
    throw new Error('Edge reveal control rendered without a root element')
  }

  return {
    content: getRequiredElement<HTMLElement>(
      element,
      '.touch-edge-reveal-content',
      'Edge reveal control rendered without content',
    ),
    element,
    tab: getRequiredElement<HTMLButtonElement>(
      element,
      '.touch-edge-reveal-tab',
      'Edge reveal control rendered without a tab',
    ),
  }
}
