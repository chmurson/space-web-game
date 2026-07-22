import { render, type JSX } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import type { InfoHudRow, InfoHudView } from '../presentation/infoHudPresentation'
import type { InfoPin } from '../runtime/infoPins'
import { addTapSafeButtonHandler } from './tapSafeButtonHandler'
import './infoHud.css'

type TapSafeButtonProps = Omit<
  JSX.HTMLAttributes<HTMLButtonElement>,
  'disabled' | 'onClick' | 'ref' | 'type'
> & {
  disabled?: boolean
  onActivate(): void
  type?: 'button' | 'reset' | 'submit'
}

const TapSafeButton = ({ onActivate, ...props }: TapSafeButtonProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const activationRef = useRef(onActivate)
  activationRef.current = onActivate

  useEffect(() => {
    const button = buttonRef.current
    if (!button) {
      return
    }

    addTapSafeButtonHandler(button, () => activationRef.current())
  }, [])

  return <button {...props} ref={buttonRef} />
}

const getPinStatusGlyph = (row: InfoHudRow) => {
  if (row.scenarioOwned) {
    return '◆'
  }
  if (row.pinned) {
    return '●'
  }
  return '○'
}

const PinStatus = ({ row }: { row: InfoHudRow }) => (
  <span aria-hidden="true" class="info-hud-pin-status">
    {getPinStatusGlyph(row)}
  </span>
)

const InfoRow = (options: {
  onTogglePin(pin: InfoPin): void
  row: InfoHudRow
}) => {
  const { row } = options
  let ownershipLabel = row.pinned ? 'pinned' : 'not pinned'
  if (row.scenarioOwned) {
    ownershipLabel = 'pinned by scenario'
  }

  return (
    <TapSafeButton
      aria-checked={row.pinned}
      aria-label={`${row.accessibleLabel}, ${ownershipLabel}`}
      class="info-hud-row"
      data-info-pin={row.key}
      data-scenario-owned={String(row.scenarioOwned)}
      disabled={row.scenarioOwned}
      onActivate={() => options.onTogglePin(row.pin)}
      role="switch"
      type="button"
    >
      <span class="info-hud-row-copy">
        <span class="info-hud-row-label">{row.label}</span>
        <span aria-hidden="true" class="info-hud-row-separator">
          ·
        </span>
        <span class="info-hud-row-value">
          <span class="info-hud-row-distance">{row.distanceLabel}</span>
          <span aria-hidden="true" class="info-hud-row-secondary">
            {row.secondaryLabel}
          </span>
        </span>
      </span>
      {row.scenarioOwned ? (
        <span class="info-hud-scenario-badge">Scenario</span>
      ) : null}
      <PinStatus row={row} />
    </TapSafeButton>
  )
}

const InfoPanelContent = (options: {
  onClear(): void
  onTogglePin(pin: InfoPin): void
  titleId: string
  view: InfoHudView
}) => (
  <div class="info-hud-panel-content">
    <header class="info-hud-panel-header">
      <div>
        <h2 id={options.titleId}>Info</h2>
        <p>Pin live distances</p>
      </div>
      <TapSafeButton
        aria-keyshortcuts="Shift+I"
        class="info-hud-clear"
        disabled={!options.view.clearAvailable}
        onActivate={options.onClear}
        type="button"
      >
        Clear
      </TapSafeButton>
    </header>
    <div aria-label="Pinnable information" class="info-hud-list">
      {options.view.rows.map((row) => (
        <InfoRow
          key={row.key}
          onTogglePin={options.onTogglePin}
          row={row}
        />
      ))}
    </div>
  </div>
)

const InfoRail = (options: {
  className: string
  onTogglePin(pin: InfoPin): void
  view: InfoHudView
}) => (
  <div
    aria-label="Pinned information"
    class={`info-hud-rail ${options.className}`}
    hidden={options.view.pinnedRows.length === 0}
  >
    {options.view.pinnedRows.map((row) => (
      <TapSafeButton
        aria-label={
          row.scenarioOwned
            ? `${row.accessibleLabel}, pinned by scenario`
            : `Unpin ${row.accessibleLabel}`
        }
        class="info-hud-rail-card"
        data-info-pin={row.key}
        data-scenario-owned={String(row.scenarioOwned)}
        disabled={row.scenarioOwned}
        key={row.key}
        onActivate={() => options.onTogglePin(row.pin)}
        type="button"
      >
        <span>{row.label}</span>
        <span aria-hidden="true">·</span>
        <strong>{row.distanceLabel}</strong>
        {row.scenarioOwned ? (
          <span aria-hidden="true" class="info-hud-rail-lock">
            ◆
          </span>
        ) : null}
      </TapSafeButton>
    ))}
  </div>
)

const DesktopInfoHud = (options: {
  onClear(): void
  onToggleOpen(): void
  onTogglePin(pin: InfoPin): void
  open: boolean
  view: InfoHudView
}) => (
  <div
    class={`desktop-info-hud${options.open ? ' desktop-info-hud-open' : ''}`}
  >
    <TapSafeButton
      aria-controls="desktop-info-popover"
      aria-expanded={options.open}
      aria-haspopup="dialog"
      aria-keyshortcuts="I"
      aria-label="Toggle Info panel (I)"
      class="desktop-info-pill"
      onActivate={options.onToggleOpen}
      type="button"
    >
      Info
      {options.view.pinnedRows.length > 0 ? (
        <span aria-label={`${options.view.pinnedRows.length} pinned`}>
          {options.view.pinnedRows.length}
        </span>
      ) : null}
    </TapSafeButton>
    <section
      aria-labelledby="desktop-info-title"
      class="desktop-info-popover"
      hidden={!options.open}
      id="desktop-info-popover"
      role="dialog"
    >
      <InfoPanelContent
        onClear={options.onClear}
        onTogglePin={options.onTogglePin}
        titleId="desktop-info-title"
        view={options.view}
      />
    </section>
    <InfoRail
      className="desktop-info-rail"
      onTogglePin={options.onTogglePin}
      view={options.view}
    />
  </div>
)

const emptyView: InfoHudView = {
  clearAvailable: false,
  pinnedRows: [],
  rows: [],
}

export type InfoHud = {
  sync(): void
  toggleSurface(): void
}

export const createInfoHud = (options: {
  desktopContainer: HTMLElement
  getMobileSurfaceActive(): boolean
  getView(): InfoHudView
  mobilePanelContainer: HTMLElement
  mobileRailContainer: HTMLElement
  onClear(): void
  onTogglePin(pin: InfoPin): void
  toggleMobileInfoPanel(): void
}): InfoHud => {
  let desktopOpen = false
  let view = emptyView
  let viewSignature = ''

  const syncAfterAction = () => {
    viewSignature = ''
    sync()
  }
  const clear = () => {
    options.onClear()
    syncAfterAction()
  }
  const togglePin = (pin: InfoPin) => {
    options.onTogglePin(pin)
    syncAfterAction()
  }
  const renderSurfaces = () => {
    render(
      <DesktopInfoHud
        onClear={clear}
        onToggleOpen={() => setDesktopOpen(!desktopOpen)}
        onTogglePin={togglePin}
        open={desktopOpen}
        view={view}
      />,
      options.desktopContainer,
    )
    render(
      <InfoPanelContent
        onClear={clear}
        onTogglePin={togglePin}
        titleId="mobile-command-dock-info-title"
        view={view}
      />,
      options.mobilePanelContainer,
    )
    render(
      <InfoRail
        className="mobile-info-rail"
        onTogglePin={togglePin}
        view={view}
      />,
      options.mobileRailContainer,
    )
  }
  const setDesktopOpen = (open: boolean) => {
    if (desktopOpen === open) {
      return
    }
    desktopOpen = open
    renderSurfaces()
  }
  const getViewSignature = (nextView: InfoHudView) =>
    JSON.stringify({
      clearAvailable: nextView.clearAvailable,
      pinned: nextView.pinnedRows.map((row) => row.key),
      rows: nextView.rows.map((row) => [
        row.key,
        row.distanceLabel,
        row.secondaryLabel,
        row.pinned,
        row.scenarioOwned,
      ]),
    })
  const sync = () => {
    const nextView = options.getView()
    const nextSignature = getViewSignature(nextView)
    if (viewSignature === nextSignature) {
      return
    }

    view = nextView
    viewSignature = nextSignature
    renderSurfaces()
  }

  document.addEventListener('pointerdown', (event) => {
    if (
      desktopOpen &&
      event.target instanceof Node &&
      !options.desktopContainer.contains(event.target)
    ) {
      setDesktopOpen(false)
    }
  })
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && desktopOpen) {
      setDesktopOpen(false)
      options.desktopContainer
        .querySelector<HTMLButtonElement>('.desktop-info-pill')
        ?.focus()
    }
  })

  sync()

  return {
    sync,
    toggleSurface: () => {
      if (options.getMobileSurfaceActive()) {
        setDesktopOpen(false)
        options.toggleMobileInfoPanel()
        return
      }
      setDesktopOpen(!desktopOpen)
    },
  }
}
