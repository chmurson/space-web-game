import {
  createPreactUiSurface,
  type SurfaceRootRefProps,
} from '../createPreactUiSurface'
import { addTapSafeButtonHandler } from '../tapSafeButtonHandler'
import './mobileCommandDock.css'

type MobileCommandDockDensity = 'compact' | 'spacious'
type MobileCommandDockPanelTreatment = 'glass' | 'sheet'
type MobileCommandDockEmphasis = 'subtle' | 'strong'
type MobileCommandDockItems = 'flight' | 'full'
type MobileCommandDockSafeAreaPadding = 'standard' | 'roomy'

type MobileCommandDockVariants = {
  density: MobileCommandDockDensity
  emphasis: MobileCommandDockEmphasis
  items: MobileCommandDockItems
  panelTreatment: MobileCommandDockPanelTreatment
  safeAreaPadding: MobileCommandDockSafeAreaPadding
}

type MobileCommandDockSurfaceProps = SurfaceRootRefProps &
  MobileCommandDockVariants & {
    open: boolean
  }

const densityOptions = ['compact', 'spacious'] as const
const panelTreatmentOptions = ['glass', 'sheet'] as const
const emphasisOptions = ['subtle', 'strong'] as const
const itemOptions = ['flight', 'full'] as const
const safeAreaPaddingOptions = ['standard', 'roomy'] as const

const comparisonDockItems = [
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

const readVariant = <Option extends string>(
  urlParams: URLSearchParams,
  name: string,
  options: readonly Option[],
  fallback: Option,
): Option => {
  const value = urlParams.get(name)
  return value !== null && options.includes(value as Option)
    ? (value as Option)
    : fallback
}

const readMobileCommandDockVariants = (): MobileCommandDockVariants => {
  const urlParams = new URLSearchParams(window.location.search)
  return {
    density: readVariant(
      urlParams,
      'mobileDockDensity',
      densityOptions,
      'compact',
    ),
    emphasis: readVariant(
      urlParams,
      'mobileDockEmphasis',
      emphasisOptions,
      'subtle',
    ),
    items: readVariant(urlParams, 'mobileDockItems', itemOptions, 'flight'),
    panelTreatment: readVariant(
      urlParams,
      'mobileFlightPanel',
      panelTreatmentOptions,
      'glass',
    ),
    safeAreaPadding: readVariant(
      urlParams,
      'mobileDockSafeArea',
      safeAreaPaddingOptions,
      'standard',
    ),
  }
}

const MobileCommandDockSurface = ({
  density,
  emphasis,
  items,
  open,
  panelTreatment,
  rootRef,
  safeAreaPadding,
}: MobileCommandDockSurfaceProps) => (
  <section
    aria-label="Mobile command dock"
    class="mobile-command-dock"
    data-density={density}
    data-emphasis={emphasis}
    data-items={items}
    data-open={String(open)}
    data-panel-treatment={panelTreatment}
    data-safe-area-padding={safeAreaPadding}
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
      {items === 'full' &&
        comparisonDockItems.map((item) => (
          <button
            aria-label={`${item.label} comparison button; panel unavailable`}
            class="mobile-command-dock-item"
            disabled
            key={item.label}
            title="Comparison only — panel unavailable"
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
  const variants = readMobileCommandDockVariants()
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
    options.app.dataset.mobileCommandDockDensity = variants.density
    options.app.dataset.mobileCommandDockItems = variants.items
    options.app.dataset.mobileCommandDockOpen = String(open)
    options.app.dataset.mobileCommandDockPanel = variants.panelTreatment
    options.app.dataset.mobileCommandDockSafeArea = variants.safeAreaPadding
  }

  const renderState = () => {
    syncAppState()
    surface.render({
      ...variants,
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
