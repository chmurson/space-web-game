import {
  createPreactUiSurface,
  type SurfaceRootRefProps,
} from '../createPreactUiSurface'
import { addTapSafeButtonHandler } from '../tapSafeButtonHandler'
import './mobileCommandDock.css'

export type MobileFlightPanelTreatment = 'fade' | 'floating' | 'glass'

type MobileCommandDockSurfaceProps = SurfaceRootRefProps & {
  controlsAvailable: {
    rcsYaw: boolean
    thrust: boolean
  }
  open: boolean
  panelTreatment: MobileFlightPanelTreatment
  tutorialFocused: boolean
}

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

const getFlightButtonLabel = (available: boolean, open: boolean) => {
  if (!available) {
    return 'Flight panel unavailable'
  }

  return open ? 'Close Flight panel' : 'Open Flight panel'
}

const MobileCommandDockSurface = ({
  controlsAvailable,
  open,
  panelTreatment,
  rootRef,
  tutorialFocused,
}: MobileCommandDockSurfaceProps) => {
  const flightAvailable = controlsAvailable.rcsYaw || controlsAvailable.thrust

  return (
    <section
      aria-label="Mobile command dock"
      class="mobile-command-dock"
      data-open={String(open)}
      data-panel-treatment={panelTreatment}
      data-tutorial-focused={String(tutorialFocused)}
      ref={rootRef}
    >
      <section
        aria-hidden={!open}
        aria-labelledby="mobile-command-dock-flight-button"
        class="mobile-command-dock-panel"
        hidden={!open}
        id="mobile-command-dock-flight-panel"
      >
        <div class="mobile-command-dock-panel-controls-host" />
      </section>

      <nav aria-label="Mobile commands" class="mobile-command-dock-bar">
        <button
          aria-controls="mobile-command-dock-flight-panel"
          aria-expanded={open}
          aria-label={getFlightButtonLabel(flightAvailable, open)}
          class="mobile-command-dock-item"
          disabled={!flightAvailable}
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
}

export const createMobileCommandDock = (options: {
  app: HTMLElement
  container: HTMLElement
  onOpenChange?(open: boolean): void
  panelTreatment: MobileFlightPanelTreatment
}) => {
  const flightControlsElement = document.createElement('div')
  flightControlsElement.className = 'mobile-command-dock-flight-controls'
  const rcsYawGroup = document.createElement('section')
  rcsYawGroup.className =
    'mobile-command-dock-flight-control mobile-command-dock-rcs-yaw'
  rcsYawGroup.setAttribute('aria-label', 'RCS yaw control')
  const rcsYawContainer = document.createElement('div')
  rcsYawContainer.className = 'mobile-command-dock-rcs-yaw-host'
  rcsYawGroup.appendChild(rcsYawContainer)
  const thrustGroup = document.createElement('section')
  thrustGroup.className =
    'mobile-command-dock-flight-control mobile-command-dock-main-thrust'
  thrustGroup.setAttribute('aria-label', 'Main Thrust control')
  const thrustContainer = document.createElement('div')
  thrustContainer.className = 'mobile-command-dock-main-thrust-host'
  thrustGroup.appendChild(thrustContainer)
  flightControlsElement.append(rcsYawGroup, thrustGroup)

  let controlsAvailable = {
    rcsYaw: true,
    thrust: true,
  }
  let open = false
  let tutorialFocused = false
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
    options.app.dataset.mobileCommandDockPanel = options.panelTreatment
  }

  const syncFlightControls = () => {
    const controlsHost = surface.element.querySelector<HTMLElement>(
      '.mobile-command-dock-panel-controls-host',
    )
    if (!controlsHost) {
      throw new Error('Mobile command dock rendered without controls host')
    }
    if (flightControlsElement.parentElement !== controlsHost) {
      controlsHost.appendChild(flightControlsElement)
    }
    rcsYawGroup.hidden = !controlsAvailable.rcsYaw
    thrustGroup.hidden = !controlsAvailable.thrust
  }

  const renderState = () => {
    syncAppState()
    surface.render({
      controlsAvailable,
      open,
      panelTreatment: options.panelTreatment,
      tutorialFocused,
    })
    syncFlightControls()
  }

  const setOpen = (nextOpen: boolean) => {
    const flightAvailable = controlsAvailable.rcsYaw || controlsAvailable.thrust
    const allowedOpen = nextOpen && flightAvailable
    if (open === allowedOpen) {
      return
    }

    open = allowedOpen
    renderState()
    options.onOpenChange?.(open)
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
    isOpen: () => open,
    rcsYawContainer,
    setControlAvailability(nextAvailability: {
      rcsYaw: boolean
      thrust: boolean
    }) {
      controlsAvailable = { ...nextAvailability }
      if (!controlsAvailable.rcsYaw && !controlsAvailable.thrust && open) {
        setOpen(false)
        return
      }
      if (
        tutorialFocused &&
        (controlsAvailable.rcsYaw || controlsAvailable.thrust) &&
        !open
      ) {
        setOpen(true)
        return
      }
      renderState()
    },
    setOpen,
    setTutorialFocused(focused: boolean) {
      tutorialFocused = focused
      if (
        focused &&
        (controlsAvailable.rcsYaw || controlsAvailable.thrust) &&
        !open
      ) {
        setOpen(true)
        return
      }
      renderState()
    },
    thrustContainer,
  }
}
