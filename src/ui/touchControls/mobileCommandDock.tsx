import {
  createPreactUiSurface,
  type SurfaceRootRefProps,
} from '../createPreactUiSurface'
import { addTapSafeButtonHandler } from '../tapSafeButtonHandler'
import './mobileCommandDock.css'

type MobileCommandDockPanelTreatment = 'glass' | 'sheet'

type MobileCommandDockSurfaceProps = SurfaceRootRefProps & {
  open: boolean
}

const flightPanelTreatment: MobileCommandDockPanelTreatment = 'glass'

const unavailableDockItems = [
  {
    iconPath: 'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm3.5 5.5-2 5-5 2 2-5 5-2Z',
    label: 'Nav',
  },
  {
    iconPath: 'M6 21V4m0 1h10l-2.5 3L16 11H6',
    label: 'Mission',
  },
  {
    iconPath: 'm12 3-5 5v8l5 5 5-5V8l-5-5ZM7 12h10',
    label: 'Ship',
  },
  {
    iconPath: 'M4 7h10m4 0h2m-6-3v6M4 17h2m4 0h10M6 14v6',
    label: 'Settings',
  },
] as const

const MobileCommandDockSurface = ({
  open,
  rootRef,
}: MobileCommandDockSurfaceProps) => (
  <section
    aria-label="Mobile command dock"
    class="mobile-command-dock"
    data-open={String(open)}
    data-panel-treatment={flightPanelTreatment}
    ref={rootRef}
  >
    <section
      aria-hidden={!open}
      aria-labelledby="mobile-command-dock-flight-button"
      class="mobile-command-dock-panel"
      hidden={!open}
      id="mobile-command-dock-flight-panel"
    >
      <div class="mobile-command-dock-panel-heading">
        <span class="mobile-command-dock-panel-kicker">Flight</span>
        <strong>Manual controls</strong>
      </div>
      <div class="mobile-command-dock-panel-status">
        <span aria-hidden="true" class="mobile-command-dock-status-dot" />
        <span>Edge controls active</span>
      </div>
      <p>Use RCS and Burn at the screen edges.</p>
    </section>

    <nav aria-label="Mobile commands" class="mobile-command-dock-bar">
      <button
        aria-controls="mobile-command-dock-flight-panel"
        aria-expanded={open}
        aria-label={open ? 'Close Flight panel' : 'Open Flight panel'}
        class="mobile-command-dock-item"
        id="mobile-command-dock-flight-button"
        type="button"
      >
        <svg
          aria-hidden="true"
          class="mobile-command-dock-item-icon"
          viewBox="0 0 24 24"
        >
          <path d="M12 20V4M6.5 9.5 12 4l5.5 5.5" />
        </svg>
        <span>Flight</span>
      </button>
      {unavailableDockItems.map((item) => (
        <button
          aria-label={`${item.label} panel unavailable`}
          class="mobile-command-dock-item"
          disabled
          key={item.label}
          title="Panel unavailable"
          type="button"
        >
          <svg
            aria-hidden="true"
            class="mobile-command-dock-item-icon"
            viewBox="0 0 24 24"
          >
            <path d={item.iconPath} />
          </svg>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  </section>
)

export const createMobileCommandDock = (options: {
  app: HTMLElement
  container: HTMLElement
}) => {
  let open = false
  const surface = createPreactUiSurface<
    Omit<MobileCommandDockSurfaceProps, keyof SurfaceRootRefProps>
  >({
    app: options.container,
    component: MobileCommandDockSurface,
    missingRootError: 'Failed to create mobile command dock',
  })

  const syncAppState = () => {
    options.app.dataset.mobileCommandDock = 'true'
    options.app.dataset.mobileCommandDockOpen = String(open)
    options.app.dataset.mobileCommandDockPanel = flightPanelTreatment
  }

  const renderState = () => {
    syncAppState()
    surface.render({
      open,
    })
  }

  const setOpen = (nextOpen: boolean) => {
    if (open === nextOpen) {
      return
    }

    open = nextOpen
    renderState()
  }

  renderState()

  const flightButton = surface.element.querySelector<HTMLButtonElement>(
    '#mobile-command-dock-flight-button',
  )
  if (!flightButton) {
    throw new Error('Mobile command dock rendered without Flight button')
  }

  addTapSafeButtonHandler(flightButton, () => {
    setOpen(!open)
  })

  document.addEventListener('keydown', (event) => {
    if (!open || event.key !== 'Escape') {
      return
    }

    setOpen(false)
    flightButton.focus()
  })

  return {
    element: surface.element,
  }
}
