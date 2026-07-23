import { type JSX, render } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import type {
  InfoHudEntry,
  InfoHudRow,
  InfoHudView,
} from '../presentation/infoHudPresentation'
import type { InfoPin } from '../runtime/infoPins'
import { addTapSafeButtonHandler } from './tapSafeButtonHandler'
import './infoHud.css'
import './targetBodyGlyphs.css'

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
  bodyColor: string
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
      class="info-hud-row ui-pressable"
      data-info-pin={row.key}
      data-scenario-owned={String(row.scenarioOwned)}
      disabled={row.scenarioOwned}
      onActivate={() => options.onTogglePin(row.pin)}
      role="switch"
      type="button"
    >
      <span
        aria-hidden="true"
        class="target-body-sphere"
        style={
          {
            '--target-body-color': options.bodyColor,
          } as JSX.CSSProperties
        }
      />
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

const ApsisInfoRow = (options: {
  entry: Extract<InfoHudEntry, { kind: 'apsides' }>
  onTogglePin(pin: InfoPin): void
}) => {
  const { row } = options.entry
  const [periapsis, apoapsis] = options.entry.points
  let ownershipLabel = row.pinned ? 'selected' : 'not selected'
  if (row.scenarioOwned) {
    ownershipLabel = 'selected by scenario'
  }

  return (
    <fieldset class="info-hud-apsis-group" data-info-row="apsides">
      <legend class="info-hud-visually-hidden">Orbit points</legend>
      <TapSafeButton
        aria-checked={row.pinned}
        aria-label={`${row.accessibleLabel}, ${ownershipLabel}`}
        class="info-hud-row info-hud-apsis-row ui-pressable"
        data-info-pin={row.key}
        data-scenario-owned={String(row.scenarioOwned)}
        disabled={row.scenarioOwned}
        onActivate={() => options.onTogglePin(row.pin)}
        role="switch"
        type="button"
      >
        <span class="info-hud-apsis-values">
          <span>
            <span>{periapsis.label}</span>
            <span aria-hidden="true" class="info-hud-row-separator">
              {' '}
              ·{' '}
            </span>
            <span class="info-hud-row-distance">{periapsis.distanceLabel}</span>
          </span>
          <span aria-hidden="true" class="info-hud-apsis-divider">
            |
          </span>
          <span>
            <span>{apoapsis.label}</span>
            <span aria-hidden="true" class="info-hud-row-separator">
              {' '}
              ·{' '}
            </span>
            <span class="info-hud-row-distance">{apoapsis.distanceLabel}</span>
          </span>
        </span>
        <span aria-hidden="true" class="info-hud-row-secondary">
          {options.entry.secondaryLabel}
        </span>
        {row.scenarioOwned ? (
          <span class="info-hud-scenario-badge">Scenario</span>
        ) : null}
        <PinStatus row={row} />
      </TapSafeButton>
    </fieldset>
  )
}

const InfoPanelContent = (options: {
  onClear(): void
  onSelectAll(): void
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
      <div class="info-hud-header-actions">
        <TapSafeButton
          class="info-hud-select-all ui-pressable-strong"
          disabled={
            !options.view.rows.some((row) => !row.pinned && !row.scenarioOwned)
          }
          onActivate={options.onSelectAll}
          type="button"
        >
          Select all
        </TapSafeButton>
        <TapSafeButton
          aria-keyshortcuts="Shift+I"
          class="info-hud-clear ui-pressable-strong"
          disabled={!options.view.clearAvailable}
          onActivate={options.onClear}
          type="button"
        >
          Clear
        </TapSafeButton>
      </div>
    </header>
    <section aria-label="Selectable information" class="info-hud-list">
      {options.view.entries.map((entry) =>
        entry.kind === 'body' ? (
          <InfoRow
            bodyColor={entry.bodyColor}
            key={entry.key}
            onTogglePin={options.onTogglePin}
            row={entry.row}
          />
        ) : (
          <ApsisInfoRow
            entry={entry}
            key={entry.key}
            onTogglePin={options.onTogglePin}
          />
        ),
      )}
    </section>
  </div>
)

const DesktopInfoHud = (options: {
  onClear(): void
  onSelectAll(): void
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
      {options.view.selectedCount > 0 ? (
        <span
          aria-label={`${options.view.selectedCount} selected`}
          role="status"
        >
          {options.view.selectedCount}
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
        onSelectAll={options.onSelectAll}
        onTogglePin={options.onTogglePin}
        titleId="desktop-info-title"
        view={options.view}
      />
    </section>
  </div>
)

const emptyView: InfoHudView = {
  clearAvailable: false,
  entries: [],
  rows: [],
  selectedCount: 0,
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
  const selectAll = () => {
    for (const row of view.rows) {
      if (!row.pinned && !row.scenarioOwned) {
        options.onTogglePin(row.pin)
      }
    }
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
        onSelectAll={selectAll}
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
        onSelectAll={selectAll}
        onTogglePin={togglePin}
        titleId="mobile-command-dock-info-title"
        view={view}
      />,
      options.mobilePanelContainer,
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
      entries: nextView.entries.map((entry) => entry.key),
      rows: nextView.rows.map((row) => [
        row.key,
        row.distanceLabel,
        row.secondaryLabel,
        row.pinned,
        row.scenarioOwned,
      ]),
      selectedCount: nextView.selectedCount,
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
