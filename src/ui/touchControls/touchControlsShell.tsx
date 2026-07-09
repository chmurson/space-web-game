import { render } from 'preact'

const touchControlDockDefinitions = [
  {
    className: 'touch-edge-reveal-dock touch-time-warp-reveal-dock',
    id: 'warp',
  },
  {
    className: 'touch-edge-reveal-dock touch-trajectory-horizon-reveal-dock',
    id: 'trajectory',
  },
  {
    className: 'touch-edge-reveal-dock touch-target-reveal-dock',
    id: 'target',
  },
  {
    className: 'touch-edge-reveal-dock touch-rcs-yaw-reveal-dock',
    id: 'rcsYaw',
  },
  {
    className: 'touch-edge-reveal-dock touch-thrust-reveal-dock',
    id: 'burn',
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
        warp: createDockRef('warp'),
        trajectory: createDockRef('trajectory'),
        target: createDockRef('target'),
        rcsYaw: createDockRef('rcsYaw'),
        burn: createDockRef('burn'),
      }}
      rootRef={(root) => {
        element = root
      }}
    />,
    host,
  )

  return {
    docks: {
      warp: getRequiredElement<HTMLDivElement>(
        docks.warp,
        'Touch controls shell rendered without warp dock',
      ),
      trajectory: getRequiredElement<HTMLDivElement>(
        docks.trajectory,
        'Touch controls shell rendered without trajectory dock',
      ),
      target: getRequiredElement<HTMLDivElement>(
        docks.target,
        'Touch controls shell rendered without target dock',
      ),
      rcsYaw: getRequiredElement<HTMLDivElement>(
        docks.rcsYaw,
        'Touch controls shell rendered without RCS yaw dock',
      ),
      burn: getRequiredElement<HTMLDivElement>(
        docks.burn,
        'Touch controls shell rendered without burn dock',
      ),
    },
    element: getRequiredElement<HTMLElement>(
      element,
      'Touch controls shell rendered without root element',
    ),
  }
}
