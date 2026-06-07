import { readDebugScenarioSnapshot } from '../debugScenarioSnapshot'
import type { UIUserAction } from '../input/uiUserActions'
import type { TouchControlSide } from '../userSettingsStorage'
import { formatDuration } from './formatters'
import { createSegmentedControl } from './segmentedControl'

export type TopMenu = {
  close: () => void
  element: HTMLElement
  syncState: () => void
}

export const createTopMenu = (options: {
  app: HTMLElement
  getCoastPredictionHorizonHours: () => number
  getDebugModeEnabled: () => boolean
  getMaxCoastPredictionHorizonHours: () => number
  getMinCoastPredictionHorizonHours: () => number
  getTouchBurnControlSide: () => TouchControlSide
  getTouchWarpControlSide: () => TouchControlSide
  onAction: (action: UIUserAction) => void
  onTouchBurnControlSideChange(side: TouchControlSide): void
  onTouchWarpControlSideChange(side: TouchControlSide): void
}): TopMenu => {
  const menuId = 'top-menu-dropdown'
  const debugSectionLabelId = `${menuId}-debug`
  const scenarioSectionLabelId = `${menuId}-scenario`
  const controlsSectionLabelId = `${menuId}-controls`
  const trajectorySectionLabelId = `${menuId}-trajectory`
  const root = document.createElement('div')
  root.className = 'top-menu'
  root.innerHTML = `
    <button
      class="top-menu-button"
      type="button"
      aria-label="Open menu"
      aria-expanded="false"
      aria-haspopup="menu"
      aria-controls="${menuId}"
    >
      <span></span>
      <span></span>
      <span></span>
    </button>
    <div class="top-menu-dropdown" id="${menuId}" role="menu" hidden>
      <section class="menu-section" aria-labelledby="${debugSectionLabelId}">
        <div class="menu-section-label" id="${debugSectionLabelId}">Debug</div>
        <button type="button" role="menuitem" data-menu-action="toggleDebugMode" data-menu-debug-toggle></button>
        <button type="button" role="menuitem" data-menu-action="saveDebugSnapshot">Save debug snapshot</button>
        <button type="button" role="menuitem" data-menu-action="loadDebugSnapshot">Load debug snapshot</button>
      </section>

      <hr class="menu-separator" />

      <section class="menu-section" aria-labelledby="${scenarioSectionLabelId}">
        <div class="menu-section-label" id="${scenarioSectionLabelId}">Scenario</div>
        <button type="button" role="menuitem" data-menu-action="resetScenario">Restart</button>
      </section>

      <hr class="menu-separator" />

      <section class="menu-section" aria-labelledby="${controlsSectionLabelId}">
        <div class="menu-section-label" id="${controlsSectionLabelId}">Controls</div>
        <div class="menu-setting">
          <span class="menu-setting-name">Burn side</span>
          <div data-menu-touch-burn-control-side></div>
        </div>
        <div class="menu-setting">
          <span class="menu-setting-name">Warp side</span>
          <div data-menu-touch-warp-control-side></div>
        </div>
      </section>

      <hr class="menu-separator" />

      <section class="menu-section" aria-labelledby="${trajectorySectionLabelId}">
        <div class="menu-section-label" id="${trajectorySectionLabelId}">Trajectory</div>
        <div class="menu-stepper" role="group" aria-labelledby="${trajectorySectionLabelId}">
          <div class="menu-stepper-copy">
            <span class="menu-stepper-name">Prediction horizon</span>
            <span class="menu-stepper-value" data-menu-coast-horizon aria-live="polite"></span>
          </div>
          <div class="menu-stepper-controls">
            <button type="button" role="menuitem" class="menu-stepper-button" data-menu-action="decreaseCoastHorizon" aria-label="Decrease prediction horizon">−</button>
            <button type="button" role="menuitem" class="menu-stepper-button" data-menu-action="increaseCoastHorizon" aria-label="Increase prediction horizon">+</button>
          </div>
        </div>
      </section>
    </div>
  `
  const topBar = options.app.querySelector('.top-bar')
  if (!topBar) {
    throw new Error('Failed to find top bar')
  }
  topBar.prepend(root)

  const button = root.querySelector<HTMLButtonElement>('.top-menu-button')
  const dropdown = root.querySelector<HTMLDivElement>('.top-menu-dropdown')
  if (!button || !dropdown) {
    throw new Error('Failed to create top menu')
  }

  const loadSnapshotButton = dropdown.querySelector<HTMLButtonElement>(
    '[data-menu-action="loadDebugSnapshot"]',
  )
  const debugToggleButton = dropdown.querySelector<HTMLButtonElement>(
    '[data-menu-debug-toggle]',
  )
  const decreaseCoastHorizonButton = dropdown.querySelector<HTMLButtonElement>(
    '[data-menu-action="decreaseCoastHorizon"]',
  )
  const increaseCoastHorizonButton = dropdown.querySelector<HTMLButtonElement>(
    '[data-menu-action="increaseCoastHorizon"]',
  )
  const coastHorizonValue = dropdown.querySelector<HTMLElement>(
    '[data-menu-coast-horizon]',
  )
  const touchBurnControlSideMount = dropdown.querySelector<HTMLElement>(
    '[data-menu-touch-burn-control-side]',
  )
  const touchWarpControlSideMount = dropdown.querySelector<HTMLElement>(
    '[data-menu-touch-warp-control-side]',
  )
  if (!touchBurnControlSideMount || !touchWarpControlSideMount) {
    throw new Error('Failed to create top menu touch control side settings')
  }
  let syncTouchControlSides = () => {}
  const sideOptions = [
    { label: 'Left', value: 'left' },
    { label: 'Right', value: 'right' },
  ] satisfies { label: string; value: TouchControlSide }[]
  const touchBurnControlSideControl = createSegmentedControl<TouchControlSide>({
    ariaLabel: 'Burn control side',
    onChange: (side) => {
      options.onTouchBurnControlSideChange(side)
      syncTouchControlSides()
    },
    optionRole: 'menuitemradio',
    options: sideOptions,
    value: options.getTouchBurnControlSide(),
  })
  const touchWarpControlSideControl = createSegmentedControl<TouchControlSide>({
    ariaLabel: 'Warp control side',
    onChange: (side) => {
      options.onTouchWarpControlSideChange(side)
      syncTouchControlSides()
    },
    optionRole: 'menuitemradio',
    options: sideOptions,
    value: options.getTouchWarpControlSide(),
  })
  syncTouchControlSides = () => {
    touchBurnControlSideControl.sync(options.getTouchBurnControlSide())
    touchWarpControlSideControl.sync(options.getTouchWarpControlSide())
  }
  touchBurnControlSideMount.replaceWith(touchBurnControlSideControl.element)
  touchWarpControlSideMount.replaceWith(touchWarpControlSideControl.element)
  const menuItems = Array.from(
    dropdown.querySelectorAll<HTMLButtonElement>(
      'button[role="menuitem"], button[role="menuitemradio"]',
    ),
  )
  let lastCoastHorizonLabel = ''
  let lastDebugToggleLabel = ''
  let lastDecreaseDisabled: boolean | null = null
  let lastIncreaseDisabled: boolean | null = null
  const focusItem = (index: number) => {
    menuItems.at(index)?.focus()
  }
  const syncSnapshotAvailability = () => {
    if (!loadSnapshotButton) {
      return
    }

    loadSnapshotButton.disabled = readDebugScenarioSnapshot() === null
  }
  const syncState = () => {
    const debugToggleLabel = options.getDebugModeEnabled()
      ? 'Hide debug window'
      : 'Show debug window'
    const coastPredictionHorizonHours = options.getCoastPredictionHorizonHours()
    const coastHorizonLabel = formatDuration(
      coastPredictionHorizonHours * 60 * 60,
    )
    const decreaseDisabled =
      coastPredictionHorizonHours <= options.getMinCoastPredictionHorizonHours()
    const increaseDisabled =
      coastPredictionHorizonHours >= options.getMaxCoastPredictionHorizonHours()

    if (debugToggleButton) {
      if (debugToggleLabel !== lastDebugToggleLabel) {
        debugToggleButton.textContent = debugToggleLabel
        lastDebugToggleLabel = debugToggleLabel
      }
    }
    if (coastHorizonValue) {
      if (coastHorizonLabel !== lastCoastHorizonLabel) {
        coastHorizonValue.textContent = coastHorizonLabel
        lastCoastHorizonLabel = coastHorizonLabel
      }
    }
    if (decreaseCoastHorizonButton) {
      if (decreaseDisabled !== lastDecreaseDisabled) {
        decreaseCoastHorizonButton.disabled = decreaseDisabled
        lastDecreaseDisabled = decreaseDisabled
      }
    }
    if (increaseCoastHorizonButton) {
      if (increaseDisabled !== lastIncreaseDisabled) {
        increaseCoastHorizonButton.disabled = increaseDisabled
        lastIncreaseDisabled = increaseDisabled
      }
    }
    syncTouchControlSides()
  }
  const shouldKeepOpenAfterAction = (action: UIUserAction) => {
    return (
      action === 'decreaseCoastHorizon' || action === 'increaseCoastHorizon'
    )
  }

  const setOpen = (
    open: boolean,
    focusTarget: 'button' | 'first-item' | 'none' = 'none',
  ) => {
    if (open) {
      syncSnapshotAvailability()
      syncState()
    }
    button.setAttribute('aria-expanded', String(open))
    dropdown.hidden = !open
    root.classList.toggle('top-menu-open', open)

    if (open && focusTarget === 'first-item') {
      focusItem(0)
    }
    if (!open && focusTarget === 'button') {
      button.focus()
    }
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation()
    setOpen(dropdown.hidden, dropdown.hidden ? 'first-item' : 'button')
  })

  dropdown.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof HTMLButtonElement)) {
      return
    }

    const action = target.dataset.menuAction as UIUserAction | undefined
    if (!action) {
      return
    }

    options.onAction(action)
    if (action === 'saveDebugSnapshot' || action === 'loadDebugSnapshot') {
      syncSnapshotAvailability()
    }
    syncState()
    if (!shouldKeepOpenAfterAction(action)) {
      setOpen(false, 'button')
    }
  })

  document.addEventListener('pointerdown', (event) => {
    if (!root.contains(event.target as Node)) {
      setOpen(false)
    }
  })

  document.addEventListener('keydown', (event) => {
    if (!root.classList.contains('top-menu-open')) {
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false, 'button')
    }
  })

  dropdown.addEventListener('keydown', (event) => {
    const currentIndex = menuItems.indexOf(
      document.activeElement as HTMLButtonElement,
    )
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusItem((currentIndex + 1 + menuItems.length) % menuItems.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusItem((currentIndex - 1 + menuItems.length) % menuItems.length)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      focusItem(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      focusItem(menuItems.length - 1)
      return
    }
    if (event.key === 'Tab') {
      setOpen(false)
    }
  })

  syncState()

  return {
    close: () => setOpen(false),
    element: root,
    syncState,
  }
}
