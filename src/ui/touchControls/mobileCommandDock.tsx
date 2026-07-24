import type { TimeWarpFeedbackReason } from '../../runtime/timeWarpFeedbackPolicy'
import type { CameraFollowSubject } from '../../scenario/scenarioDirectiveTypes'
import { cameraFollowOptions } from '../cameraControlActions'
import {
  createPreactUiSurface,
  type SurfaceRootRefProps,
} from '../createPreactUiSurface'
import { addTapSafeButtonHandler } from '../tapSafeButtonHandler'
import './mobileCommandDock.css'

export type MobileCommandDockPanel = 'flight' | 'info' | 'nav'
type MobileCommandDockTutorialFocus = 'burn' | 'warp' | null

type MobileCommandDockSurfaceProps = SurfaceRootRefProps & {
  cameraCanRecenter: boolean
  cameraControlsLocked: boolean
  cameraFollow: CameraFollowSubject
  controlsAvailable: {
    rcsYaw: boolean
    thrust: boolean
    timeWarp: boolean
  }
  openPanel: MobileCommandDockPanel | null
  timeWarpReason: TimeWarpFeedbackReason | null
  timeWarpStatus: string
  timeWarpStatusTone: 'available' | 'capped'
  tutorialFocused: MobileCommandDockTutorialFocus
}

const unavailableDockItems = [
  {
    iconPath: 'm12 3-5 5v8l5 5 5-5V8l-5-5ZM7 12h10',
    label: 'Ship',
  },
  {
    iconPath: 'M4 7h10m4 0h2m-6-3v6M4 17h2m4 0h10M6 14v6',
    label: 'Settings',
  },
] as const

const navIconPath =
  'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm3.5 5.5-2 5-5 2 2-5 5-2Z'

const getPanelButtonLabel = (options: {
  available: boolean
  label: string
  open: boolean
}) => {
  if (!options.available) {
    return `${options.label} panel unavailable`
  }

  return options.open
    ? `Close ${options.label} panel`
    : `Open ${options.label} panel`
}

const MobileCommandDockSurface = ({
  cameraCanRecenter,
  cameraControlsLocked,
  cameraFollow,
  controlsAvailable,
  openPanel,
  rootRef,
  timeWarpReason,
  timeWarpStatus,
  timeWarpStatusTone,
  tutorialFocused,
}: MobileCommandDockSurfaceProps) => {
  const flightAvailable = controlsAvailable.rcsYaw || controlsAvailable.thrust
  const infoOpen = openPanel === 'info'
  const cameraRecenterDisabled = cameraControlsLocked || !cameraCanRecenter
  let cameraRecenterAriaLabel = 'Camera already centered on followed subject'
  if (cameraControlsLocked) {
    cameraRecenterAriaLabel =
      'Camera controls unavailable: Recenter followed subject'
  } else if (cameraCanRecenter) {
    cameraRecenterAriaLabel = 'Recenter followed subject'
  }

  return (
    <section
      aria-label="Mobile command dock"
      class="mobile-command-dock"
      data-camera-follow={cameraFollow}
      data-open={String(openPanel !== null)}
      data-open-panel={openPanel ?? 'none'}
      data-tutorial-focused={tutorialFocused ?? 'none'}
      ref={rootRef}
    >
      <div class="mobile-command-dock-info-rail-host" />
      <section
        aria-hidden={openPanel !== 'flight'}
        aria-labelledby="mobile-command-dock-flight-button"
        class="mobile-command-dock-panel mobile-command-dock-flight-panel"
        hidden={openPanel !== 'flight'}
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

      <section
        aria-hidden={openPanel !== 'nav'}
        aria-labelledby="mobile-command-dock-nav-button"
        class="mobile-command-dock-panel mobile-command-dock-nav-panel"
        hidden={openPanel !== 'nav'}
        id="mobile-command-dock-nav-panel"
      >
        <div
          class="mobile-command-dock-nav-time-warp"
          data-available={String(controlsAvailable.timeWarp)}
          data-reason={timeWarpReason ?? 'none'}
          hidden={!controlsAvailable.timeWarp}
        >
          <div class="mobile-command-dock-nav-heading">
            <span>Time Warp</span>
          </div>
          <div class="mobile-command-dock-time-warp-host" />
          <p
            aria-live="polite"
            class="mobile-command-dock-time-warp-status mobile-command-dock-visually-hidden"
            data-tone={timeWarpStatusTone}
          >
            {timeWarpStatus}
          </p>
        </div>
        <div
          class="mobile-command-dock-nav-camera"
          data-camera-controls-locked={String(cameraControlsLocked)}
        >
          <div class="mobile-command-dock-nav-heading">
            <span>Camera</span>
          </div>
          <div class="mobile-command-dock-camera-controls">
            <fieldset
              aria-label="Follow"
              class="mobile-command-dock-camera-options"
            >
              {cameraFollowOptions.map((option) => {
                const selected = option.follow === cameraFollow

                return (
                  <button
                    aria-label={
                      cameraControlsLocked
                        ? `Camera controls unavailable: Follow ${option.label}`
                        : `Follow ${option.label}`
                    }
                    aria-pressed={selected}
                    class={
                      selected
                        ? 'mobile-command-dock-camera-option mobile-command-dock-camera-option-selected'
                        : 'mobile-command-dock-camera-option'
                    }
                    data-camera-follow-option={option.follow}
                    disabled={cameraControlsLocked}
                    key={option.follow}
                    type="button"
                  >
                    {option.label}
                  </button>
                )
              })}
            </fieldset>
            <button
              aria-label={cameraRecenterAriaLabel}
              class="mobile-command-dock-camera-recenter ui-pressable-strong"
              data-mobile-camera-action="recenter"
              disabled={cameraRecenterDisabled}
              type="button"
            >
              Recenter
            </button>
          </div>
        </div>
      </section>

      <nav aria-label="Mobile commands" class="mobile-command-dock-bar">
        <button
          aria-controls="mobile-command-dock-flight-panel"
          aria-expanded={openPanel === 'flight'}
          aria-label={getPanelButtonLabel({
            available: flightAvailable,
            label: 'Flight',
            open: openPanel === 'flight',
          })}
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
          aria-label={getPanelButtonLabel({
            available: true,
            label: 'Info',
            open: infoOpen,
          })}
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
        <button
          aria-controls="mobile-command-dock-nav-panel"
          aria-expanded={openPanel === 'nav'}
          aria-label={getPanelButtonLabel({
            available: true,
            label: 'Nav',
            open: openPanel === 'nav',
          })}
          class="mobile-command-dock-item"
          id="mobile-command-dock-nav-button"
          type="button"
        >
          <svg
            aria-hidden="true"
            class="mobile-command-dock-item-icon"
            viewBox="0 0 24 24"
          >
            <path d={navIconPath} />
          </svg>
          <span>Nav</span>
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
  getCameraCanRecenter(): boolean
  getCameraControlsLocked(): boolean
  getCameraFollow(): CameraFollowSubject
  onCameraFollowSelect(follow: CameraFollowSubject): void
  onCameraRecenter(): void
  onViewportBottomInsetChange?(bottomInset: number): void
  onOpenPanelChange?(
    nextPanel: MobileCommandDockPanel | null,
    previousPanel: MobileCommandDockPanel | null,
  ): void
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
  const timeWarpContainer = document.createElement('div')
  timeWarpContainer.className = 'mobile-command-dock-time-warp-control'

  let controlsAvailable = {
    rcsYaw: true,
    thrust: true,
    timeWarp: true,
  }
  let openPanel: MobileCommandDockPanel | null = null
  let timeWarpReason: TimeWarpFeedbackReason | null = null
  let timeWarpStatus = ''
  let timeWarpStatusTone: 'available' | 'capped' = 'available'
  let tutorialFocused: MobileCommandDockTutorialFocus = null
  let viewportBottomInset = -1
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
    options.app.dataset.mobileCommandDockPanel = openPanel ?? 'none'
  }

  const syncControlHosts = () => {
    const flightControlsHost = surface.element.querySelector<HTMLElement>(
      '.mobile-command-dock-flight-panel .mobile-command-dock-panel-controls-host',
    )
    const timeWarpHost = surface.element.querySelector<HTMLElement>(
      '.mobile-command-dock-time-warp-host',
    )
    if (!flightControlsHost || !timeWarpHost) {
      throw new Error('Mobile command dock rendered without control hosts')
    }
    if (flightControlsElement.parentElement !== flightControlsHost) {
      flightControlsHost.appendChild(flightControlsElement)
    }
    if (timeWarpContainer.parentElement !== timeWarpHost) {
      timeWarpHost.appendChild(timeWarpContainer)
    }
    rcsYawGroup.hidden = !controlsAvailable.rcsYaw
    thrustGroup.hidden = !controlsAvailable.thrust
  }

  const syncViewportBottomInset = () => {
    const nextViewportBottomInset =
      surface.element.getBoundingClientRect().height
    if (nextViewportBottomInset > 0) {
      options.app.style.setProperty(
        '--mobile-command-dock-hud-height',
        `${Math.ceil(nextViewportBottomInset)}px`,
      )
    }
    if (viewportBottomInset === nextViewportBottomInset) {
      return
    }

    viewportBottomInset = nextViewportBottomInset
    options.onViewportBottomInsetChange?.(viewportBottomInset)
  }

  const renderState = () => {
    syncAppState()
    surface.render({
      cameraCanRecenter: options.getCameraCanRecenter(),
      cameraControlsLocked: options.getCameraControlsLocked(),
      cameraFollow: options.getCameraFollow(),
      controlsAvailable,
      openPanel,
      timeWarpReason,
      timeWarpStatus,
      timeWarpStatusTone,
      tutorialFocused,
    })
    syncControlHosts()
    syncViewportBottomInset()
  }

  const isFlightAvailable = () =>
    controlsAvailable.rcsYaw || controlsAvailable.thrust

  const setOpenPanel = (nextPanel: MobileCommandDockPanel | null) => {
    const allowedPanel =
      nextPanel === 'flight' && !isFlightAvailable() ? null : nextPanel
    if (openPanel !== allowedPanel) {
      const previousPanel = openPanel
      openPanel = allowedPanel
      options.onOpenPanelChange?.(openPanel, previousPanel)
    }

    renderState()
  }

  renderState()
  if (typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(syncViewportBottomInset)
    resizeObserver.observe(surface.element)
  }

  const flightButton = surface.element.querySelector<HTMLButtonElement>(
    '#mobile-command-dock-flight-button',
  )
  const navButton = surface.element.querySelector<HTMLButtonElement>(
    '#mobile-command-dock-nav-button',
  )
  const infoButton = surface.element.querySelector<HTMLButtonElement>(
    '#mobile-command-dock-info-button',
  )
  const infoPanelContainer = surface.element.querySelector<HTMLElement>(
    '.mobile-command-dock-info-panel-host',
  )
  const infoRailContainer = surface.element.querySelector<HTMLElement>(
    '.mobile-command-dock-info-rail-host',
  )
  if (
    !flightButton ||
    !infoButton ||
    !navButton ||
    !infoPanelContainer ||
    !infoRailContainer
  ) {
    throw new Error('Mobile command dock rendered without panel buttons')
  }

  for (const cameraFollowOption of cameraFollowOptions) {
    const button = surface.element.querySelector<HTMLButtonElement>(
      `[data-camera-follow-option="${cameraFollowOption.follow}"]`,
    )
    if (!button) {
      throw new Error('Mobile command dock rendered without camera controls')
    }
    addTapSafeButtonHandler(button, () => {
      options.onCameraFollowSelect(cameraFollowOption.follow)
      renderState()
    })
  }
  const recenterButton = surface.element.querySelector<HTMLButtonElement>(
    '[data-mobile-camera-action="recenter"]',
  )
  if (!recenterButton) {
    throw new Error('Mobile command dock rendered without Recenter')
  }
  addTapSafeButtonHandler(recenterButton, () => {
    options.onCameraRecenter()
    renderState()
  })

  addTapSafeButtonHandler(flightButton, () => {
    setOpenPanel(openPanel === 'flight' ? null : 'flight')
  })
  addTapSafeButtonHandler(infoButton, () => {
    setOpenPanel(openPanel === 'info' ? null : 'info')
  })
  addTapSafeButtonHandler(navButton, () => {
    setOpenPanel(openPanel === 'nav' ? null : 'nav')
  })

  document.addEventListener('keydown', (event) => {
    if (!openPanel || event.key !== 'Escape') {
      return
    }

    const closingPanel = openPanel
    setOpenPanel(null)
    let button = navButton
    if (closingPanel === 'flight') {
      button = flightButton
    } else if (closingPanel === 'info') {
      button = infoButton
    }
    button.focus()
  })

  return {
    element: surface.element,
    infoPanelContainer,
    infoRailContainer,
    isPanelOpen: (panel: MobileCommandDockPanel) => openPanel === panel,
    rcsYawContainer,
    setControlAvailability(nextAvailability: {
      rcsYaw: boolean
      thrust: boolean
      timeWarp: boolean
    }) {
      if (
        controlsAvailable.rcsYaw === nextAvailability.rcsYaw &&
        controlsAvailable.thrust === nextAvailability.thrust &&
        controlsAvailable.timeWarp === nextAvailability.timeWarp
      ) {
        return
      }

      controlsAvailable = { ...nextAvailability }
      if (!isFlightAvailable() && openPanel === 'flight') {
        setOpenPanel(null)
        return
      }
      if (tutorialFocused === 'burn' && isFlightAvailable()) {
        setOpenPanel('flight')
        return
      }
      if (tutorialFocused === 'warp' && controlsAvailable.timeWarp) {
        setOpenPanel('nav')
        return
      }
      renderState()
    },
    setOpenPanel,
    syncState: renderState,
    setTimeWarpState(nextState: {
      reason: TimeWarpFeedbackReason | null
      status: string
      tone: 'available' | 'capped'
    }) {
      if (
        timeWarpReason === nextState.reason &&
        timeWarpStatus === nextState.status &&
        timeWarpStatusTone === nextState.tone
      ) {
        return
      }

      timeWarpReason = nextState.reason
      timeWarpStatus = nextState.status
      timeWarpStatusTone = nextState.tone
      renderState()
    },
    setTutorialFocused(focused: MobileCommandDockTutorialFocus) {
      tutorialFocused = focused
      if (focused === 'burn' && isFlightAvailable()) {
        setOpenPanel('flight')
        return
      }
      if (focused === 'warp' && controlsAvailable.timeWarp) {
        setOpenPanel('nav')
        return
      }
      renderState()
    },
    thrustContainer,
    toggleInfoPanel: () => setOpenPanel(openPanel === 'info' ? null : 'info'),
    timeWarpContainer,
  }
}
