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

const getPinStatusGlyph = (row: InfoHudRow, selected: boolean) => {
  if (row.scenarioOwned) {
    return '◆'
  }
  if (selected) {
    return '●'
  }
  return '○'
}

const PinStatus = ({
  row,
  selected,
}: {
  row: InfoHudRow
  selected: boolean
}) => (
  <span aria-hidden="true" class="info-hud-pin-status">
    {getPinStatusGlyph(row, selected)}
  </span>
)

const getTargetStatusLabel = (mode: NonNullable<InfoHudView['targetMode']>) => {
  if (mode === 'auto') {
    return 'tracking target'
  }
  if (mode === 'manual') {
    return 'pinned target'
  }
  return 'locked target'
}

const InfoRow = (options: {
  bodyColor: string
  onTogglePin(pin: InfoPin): void
  row: InfoHudRow
  targetMode: InfoHudView['targetMode']
}) => {
  const { row } = options
  const target = options.targetMode !== null
  const selected = target || row.pinned
  let ownershipLabel = selected ? 'selected' : 'not selected'
  if (row.scenarioOwned) {
    ownershipLabel = 'selected by scenario'
  }
  if (target) {
    ownershipLabel = row.scenarioOwned
      ? 'selected as active target and by scenario; cannot be changed'
      : 'selected as active target; cannot be changed'
  }
  const targetLabel = options.targetMode
    ? `, active target, ${getTargetStatusLabel(options.targetMode)}`
    : ''

  return (
    <TapSafeButton
      aria-checked={selected}
      aria-label={`${row.accessibleLabel}${targetLabel}, ${ownershipLabel}`}
      class="info-hud-row ui-pressable"
      data-info-pin={row.key}
      data-scenario-owned={String(row.scenarioOwned)}
      disabled={target || row.scenarioOwned}
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
      {options.targetMode ? (
        <span
          aria-hidden="true"
          class={`target-status-mark target-status-mark-${options.targetMode}`}
        />
      ) : null}
      {row.scenarioOwned ? (
        <span class="info-hud-scenario-badge">Scenario</span>
      ) : null}
      <PinStatus row={row} selected={selected} />
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
        <PinStatus row={row} selected={row.pinned} />
      </TapSafeButton>
    </fieldset>
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
        <p>Select live distances</p>
      </div>
      <div class="info-hud-header-actions">
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
            targetMode={entry.target ? options.view.targetMode : null}
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

const InfoRail = (options: {
  className: string
  onTogglePin(pin: InfoPin): void
  view: InfoHudView
}) => {
  const selectedEntries = options.view.entries.filter((entry) => {
    if (entry.kind === 'body' && entry.target) {
      return false
    }
    return entry.row.pinned
  })

  return (
    <section
      aria-label="Selected information"
      class={`info-hud-rail ${options.className}`}
      hidden={selectedEntries.length === 0}
    >
      {selectedEntries.map((entry) => {
        const row = entry.row
        return (
          <TapSafeButton
            aria-checked="true"
            aria-label={
              row.scenarioOwned
                ? `${row.accessibleLabel}, selected by scenario; cannot be changed`
                : `${row.accessibleLabel}; unselect in Info`
            }
            class="info-hud-rail-card"
            data-info-pin={row.key}
            data-scenario-owned={String(row.scenarioOwned)}
            disabled={row.scenarioOwned}
            key={entry.key}
            onActivate={() => options.onTogglePin(row.pin)}
            role="switch"
            type="button"
          >
            <span class="info-hud-rail-pill telemetry-pill">
              {entry.kind === 'body' ? (
                <>
                  <span
                    aria-hidden="true"
                    class="target-body-sphere"
                    style={
                      {
                        '--target-body-color': entry.bodyColor,
                      } as JSX.CSSProperties
                    }
                  />
                  <span class="info-hud-rail-value">
                    <strong>{row.label}</strong>
                    <span aria-hidden="true" class="telemetry-pill-secondary">
                      ·
                    </span>
                    <span class="info-hud-rail-distance telemetry-pill-secondary">
                      {row.distanceLabel}
                    </span>
                  </span>
                </>
              ) : (
                <span class="info-hud-rail-apsides">
                  <span class="info-hud-rail-apsis">
                    <strong>Pe</strong>
                    <span aria-hidden="true" class="telemetry-pill-secondary">
                      ·
                    </span>
                    <span class="info-hud-rail-distance telemetry-pill-secondary">
                      {entry.points[0].distanceLabel}
                    </span>
                  </span>
                  <span aria-hidden="true" class="telemetry-pill-secondary">
                    |
                  </span>
                  <span class="info-hud-rail-apsis">
                    <strong>Ap</strong>
                    <span aria-hidden="true" class="telemetry-pill-secondary">
                      ·
                    </span>
                    <span class="info-hud-rail-distance telemetry-pill-secondary">
                      {entry.points[1].distanceLabel}
                    </span>
                  </span>
                </span>
              )}
              {row.scenarioOwned ? (
                <span class="info-hud-rail-scenario">Scenario</span>
              ) : null}
            </span>
          </TapSafeButton>
        )
      })}
    </section>
  )
}

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
  entries: [],
  targetMode: null,
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
      entries: nextView.entries.map((entry) => [
        entry.key,
        entry.kind === 'body' && entry.target,
      ]),
      rows: nextView.entries.map(({ row }) => [
        row.key,
        row.distanceLabel,
        row.secondaryLabel,
        row.pinned,
        row.scenarioOwned,
      ]),
      targetMode: nextView.targetMode,
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
