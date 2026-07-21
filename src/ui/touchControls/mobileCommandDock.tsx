import {
  createPreactUiSurface,
  type SurfaceRootRefProps,
} from '../createPreactUiSurface'
import { addTapSafeButtonHandler } from '../tapSafeButtonHandler'
import './mobileCommandDock.css'

type MobileCommandDockSurfaceProps = SurfaceRootRefProps & {
  controlsAvailable: {
    rcsYaw: boolean
    thrust: boolean
  }
  openPanel: MobileCommandDockPanel
  tutorialFocused: boolean
}

type MobileCommandDockPanel = 'flight' | 'info' | null

const unavailableDockItems = [
  {
    iconPath: 'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm3.5 5.5-2 5-5 2 2-5 5-2Z',
    label: 'Nav',
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
  openPanel,
  rootRef,
  tutorialFocused,
}: MobileCommandDockSurfaceProps) => {
  const flightAvailable = controlsAvailable.rcsYaw || controlsAvailable.thrust
  const flightOpen = openPanel === 'flight'
  const infoOpen = openPanel === 'info'

  return (
    <section
      aria-label="Mobile command dock"
      class="mobile-command-dock"
      data-open={String(openPanel !== null)}
      data-open-panel={openPanel ?? ''}
      data-tutorial-focused={String(tutorialFocused)}
      ref={rootRef}
    >
      <div class="mobile-command-dock-info-rail-host" />
      <section
        aria-hidden={!flightOpen}
        aria-labelledby="mobile-command-dock-flight-button"
        class="mobile-command-dock-panel"
        hidden={!flightOpen}
        id="mobile-command-dock-flight-panel"
      >
        <div class="mobile-command-dock-panel-controls-host" />
      </section>
      <section
        aria-hidden={!infoOpen}
        aria-labelledby="mobile-command-dock-info-button"
        class="mobile-command-dock-panel mobile-command-dock-info-panel"
        hidden={!infoOpen}
        id="mobile-command-dock-info-panel"
      >
        <div class="mobile-command-dock-info-panel-host" />
      </section>

      <nav aria-label="Mobile commands" class="mobile-command-dock-bar">
        <button
          aria-controls="mobile-command-dock-flight-panel"
          aria-expanded={flightOpen}
          aria-label={getFlightButtonLabel(flightAvailable, flightOpen)}
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
        <button
          aria-controls="mobile-command-dock-info-panel"
          aria-expanded={infoOpen}
          aria-keyshortcuts="I"
          aria-label={infoOpen ? 'Close Info panel' : 'Open Info panel'}
          class="mobile-command-dock-item"
          id="mobile-command-dock-info-button"
          type="button"
        >
          <svg
            aria-hidden="true"
            class="mobile-command-dock-item-icon"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 10.5v6M12 7.5v.2" />
          </svg>
          <span>Info</span>
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
  let openPanel: MobileCommandDockPanel = null
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
    options.app.dataset.mobileCommandDockOpen = String(openPanel !== null)
    options.app.dataset.mobileCommandDockPanel = openPanel ?? ''
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
      openPanel,
      tutorialFocused,
    })
    syncFlightControls()
  }

  const setOpenPanel = (nextPanel: MobileCommandDockPanel) => {
    const flightAvailable = controlsAvailable.rcsYaw || controlsAvailable.thrust
    const allowedPanel =
      nextPanel === 'flight' && !flightAvailable ? null : nextPanel
    if (openPanel === allowedPanel) {
      return
    }

    openPanel = allowedPanel
    renderState()
    options.onOpenChange?.(openPanel === 'flight')
  }

  renderState()

  const flightButton = surface.element.querySelector<HTMLButtonElement>(
    '#mobile-command-dock-flight-button',
  )
  if (!flightButton) {
    throw new Error('Mobile command dock rendered without Flight button')
  }

  addTapSafeButtonHandler(flightButton, () => {
    setOpenPanel(openPanel === 'flight' ? null : 'flight')
  })

  const infoButton = surface.element.querySelector<HTMLButtonElement>(
    '#mobile-command-dock-info-button',
  )
  const infoPanelContainer = surface.element.querySelector<HTMLElement>(
    '.mobile-command-dock-info-panel-host',
  )
  const infoRailContainer = surface.element.querySelector<HTMLElement>(
    '.mobile-command-dock-info-rail-host',
  )
  if (!infoButton || !infoPanelContainer || !infoRailContainer) {
    throw new Error('Mobile command dock rendered without Info controls')
  }

  addTapSafeButtonHandler(infoButton, () => {
    setOpenPanel(openPanel === 'info' ? null : 'info')
  })

  document.addEventListener('keydown', (event) => {
    if (openPanel === null || event.key !== 'Escape') {
      return
    }

    const previouslyOpenPanel = openPanel
    setOpenPanel(null)
    if (previouslyOpenPanel === 'info') {
      infoButton.focus()
    } else {
      flightButton.focus()
    }
  })

  const syncDockHeight = () => {
    const height = Math.ceil(surface.element.getBoundingClientRect().height)
    if (height > 0) {
      options.app.style.setProperty(
        '--mobile-command-dock-hud-height',
        `${height}px`,
      )
    }
  }
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(syncDockHeight).observe(surface.element)
  }

  return {
    element: surface.element,
    infoPanelContainer,
    infoRailContainer,
    isOpen: () => openPanel === 'flight',
    rcsYawContainer,
    setControlAvailability(nextAvailability: {
      rcsYaw: boolean
      thrust: boolean
    }) {
      controlsAvailable = { ...nextAvailability }
      if (
        !controlsAvailable.rcsYaw &&
        !controlsAvailable.thrust &&
        openPanel === 'flight'
      ) {
        setOpenPanel(null)
        return
      }
      if (
        tutorialFocused &&
        (controlsAvailable.rcsYaw || controlsAvailable.thrust) &&
        openPanel !== 'flight'
      ) {
        setOpenPanel('flight')
        return
      }
      renderState()
    },
    setOpen: (open: boolean) => setOpenPanel(open ? 'flight' : null),
    setTutorialFocused(focused: boolean) {
      tutorialFocused = focused
      if (
        focused &&
        (controlsAvailable.rcsYaw || controlsAvailable.thrust) &&
        openPanel !== 'flight'
      ) {
        setOpenPanel('flight')
        return
      }
      renderState()
    },
    thrustContainer,
    toggleInfoPanel: () => setOpenPanel(openPanel === 'info' ? null : 'info'),
  }
}
