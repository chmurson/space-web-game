import { createPreactUiSurface } from '../createPreactUiSurface'

export type TouchControlsTutorialHint = {
  element: HTMLDivElement
  setVisible(visible: boolean): void
}

type TouchControlsTutorialHintSurfaceProps = {
  rootRef(element: HTMLElement | null): void
  visible: boolean
}

type TouchControlsTutorialHintRenderProps = Omit<
  TouchControlsTutorialHintSurfaceProps,
  'rootRef'
>

const TouchControlsTutorialHintSurface = ({
  rootRef,
  visible,
}: TouchControlsTutorialHintSurfaceProps) => (
  <div
    class="touch-controls-tutorial-hint"
    ref={rootRef}
    style={{ display: visible ? 'block' : 'none' }}
  >
    <div class="touch-controls-tutorial-hint-frame" />
    <div class="touch-controls-tutorial-hint-label">Press and hold here</div>
  </div>
)

export const createTouchControlsTutorialHint = (options: {
  container: HTMLElement
}): TouchControlsTutorialHint => {
  const surface = createPreactUiSurface<TouchControlsTutorialHintRenderProps>({
    app: options.container,
    component: TouchControlsTutorialHintSurface,
    missingRootError: 'Failed to create touch controls tutorial hint',
  })
  let visible = false

  const renderHint = () => {
    surface.render({ visible })
  }

  renderHint()

  return {
    element: surface.element as HTMLDivElement,
    setVisible: (nextVisible) => {
      visible = nextVisible
      renderHint()
    },
  }
}
