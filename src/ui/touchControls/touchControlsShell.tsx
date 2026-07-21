import { render } from 'preact'

const touchControlDockDefinitions = [
  {
    className: 'touch-edge-reveal-dock touch-trajectory-horizon-reveal-dock',
    id: 'trajectory',
  },
  {
    className: 'touch-edge-reveal-dock touch-target-reveal-dock',
    id: 'target',
  },
] as const

export type TouchControlDockId =
  (typeof touchControlDockDefinitions)[number]['id']

export type TouchControlsShell = {
  docks: Record<TouchControlDockId, HTMLDivElement>
  element: HTMLElement
}

type TouchControlsShellSurfaceProps = {
  dockRefs: Record<TouchControlDockId, (element: HTMLDivElement | null) => void>
  rootRef(element: HTMLElement | null): void
}

const TouchControlsShellSurface = ({
  dockRefs,
  rootRef,
}: TouchControlsShellSurfaceProps) => (
  <section class="touch-controls" ref={rootRef}>
    {touchControlDockDefinitions.map((dock) => (
      <div
        class={dock.className}
        data-touch-control-dock={dock.id}
        key={dock.id}
        ref={dockRefs[dock.id]}
      />
    ))}
  </section>
)

const getRequiredElement = <ElementType extends Element>(
  element: ElementType | null | undefined,
  message: string,
): ElementType => {
  if (!element) {
    throw new Error(message)
  }

  return element
}

export const createTouchControlsShell = (): TouchControlsShell => {
  const host = document.createElement('div')
  let element: HTMLElement | null = null
  const docks: Partial<Record<TouchControlDockId, HTMLDivElement>> = {}
  const createDockRef =
    (dockId: TouchControlDockId) => (dock: HTMLDivElement | null) => {
      if (dock) {
        docks[dockId] = dock
      }
    }

  render(
    <TouchControlsShellSurface
      dockRefs={{
        trajectory: createDockRef('trajectory'),
        target: createDockRef('target'),
      }}
      rootRef={(root) => {
        element = root
      }}
    />,
    host,
  )

  return {
    docks: {
      trajectory: getRequiredElement<HTMLDivElement>(
        docks.trajectory,
        'Touch controls shell rendered without trajectory dock',
      ),
      target: getRequiredElement<HTMLDivElement>(
        docks.target,
        'Touch controls shell rendered without target dock',
      ),
    },
    element: getRequiredElement<HTMLElement>(
      element,
      'Touch controls shell rendered without root element',
    ),
  }
}
