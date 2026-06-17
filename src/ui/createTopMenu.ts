import { readDebugScenarioSnapshot } from '../debugScenarioSnapshot'
import type { UIUserAction } from '../input/uiUserActions'

export type TopMenu = {
  close: () => void
  element: HTMLElement
  syncState: () => void
}

export type TopMenuAction = UIUserAction | 'enterMainMenu'
type ConfirmableTopMenuAction = Extract<
  TopMenuAction,
  'enterMainMenu' | 'resetScenario'
>

const isConfirmableAction = (
  action: TopMenuAction,
): action is ConfirmableTopMenuAction =>
  action === 'enterMainMenu' || action === 'resetScenario'

export const createTopMenu = (options: {
  app: HTMLElement
  getDebugModeEnabled: () => boolean
  getFpsIndicatorEnabled: () => boolean
  onAction: (action: TopMenuAction) => void
}): TopMenu => {
  const menuId = 'top-menu-dropdown'
  const debugSectionLabelId = `${menuId}-debug`
  const scenarioSectionLabelId = `${menuId}-scenario`
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
        <button type="button" role="menuitemcheckbox" data-menu-action="toggleDebugMode" data-menu-debug-toggle></button>
        <button type="button" role="menuitemcheckbox" data-menu-action="toggleFpsIndicator" data-menu-fps-toggle></button>
        <button type="button" role="menuitem" data-menu-action="saveDebugSnapshot">Save debug snapshot</button>
        <button type="button" role="menuitem" data-menu-action="loadDebugSnapshot">Load debug snapshot</button>
      </section>

      <hr class="menu-separator" />

      <section class="menu-section" aria-labelledby="${scenarioSectionLabelId}">
        <div class="menu-section-label" id="${scenarioSectionLabelId}">Scenario</div>
        <button type="button" role="menuitem" data-menu-action="resetScenario">Restart</button>
        <button type="button" role="menuitem" data-menu-action="enterMainMenu">Exit</button>
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

  const exitButton = dropdown.querySelector<HTMLButtonElement>(
    '[data-menu-action="enterMainMenu"]',
  )
  const restartButton = dropdown.querySelector<HTMLButtonElement>(
    '[data-menu-action="resetScenario"]',
  )
  const loadSnapshotButton = dropdown.querySelector<HTMLButtonElement>(
    '[data-menu-action="loadDebugSnapshot"]',
  )
  const debugToggleButton = dropdown.querySelector<HTMLButtonElement>(
    '[data-menu-debug-toggle]',
  )
  const fpsToggleButton = dropdown.querySelector<HTMLButtonElement>(
    '[data-menu-fps-toggle]',
  )
  const menuItems = Array.from(
    dropdown.querySelectorAll<HTMLButtonElement>(
      'button[role="menuitem"], button[role="menuitemcheckbox"], button[role="menuitemradio"]',
    ),
  )
  let pendingConfirmationAction: ConfirmableTopMenuAction | null = null
  let lastDebugToggleLabel = ''
  let lastDebugToggleChecked: boolean | null = null
  let lastFpsToggleLabel = ''
  let lastFpsToggleChecked: boolean | null = null
  const focusItem = (index: number) => {
    menuItems.at(index)?.focus()
  }
  const syncConfirmationLabels = () => {
    if (restartButton) {
      restartButton.textContent =
        pendingConfirmationAction === 'resetScenario'
          ? 'Confirm restart'
          : 'Restart'
    }
    if (exitButton) {
      exitButton.textContent =
        pendingConfirmationAction === 'enterMainMenu' ? 'Confirm exit' : 'Exit'
    }
  }
  const resetConfirmation = () => {
    pendingConfirmationAction = null
    syncConfirmationLabels()
  }
  const syncSnapshotAvailability = () => {
    if (!loadSnapshotButton) {
      return
    }

    loadSnapshotButton.disabled = readDebugScenarioSnapshot() === null
  }
  const syncState = () => {
    const debugModeEnabled = options.getDebugModeEnabled()
    const fpsIndicatorEnabled = options.getFpsIndicatorEnabled()
    const debugToggleLabel = debugModeEnabled
      ? 'Hide debug window'
      : 'Show debug window'
    const fpsToggleLabel = fpsIndicatorEnabled
      ? 'Hide FPS meter'
      : 'Show FPS meter'
    if (debugToggleButton) {
      if (debugToggleLabel !== lastDebugToggleLabel) {
        debugToggleButton.textContent = debugToggleLabel
        lastDebugToggleLabel = debugToggleLabel
      }
      if (debugModeEnabled !== lastDebugToggleChecked) {
        debugToggleButton.setAttribute('aria-checked', String(debugModeEnabled))
        lastDebugToggleChecked = debugModeEnabled
      }
    }
    if (fpsToggleButton) {
      if (fpsToggleLabel !== lastFpsToggleLabel) {
        fpsToggleButton.textContent = fpsToggleLabel
        lastFpsToggleLabel = fpsToggleLabel
      }
      if (fpsIndicatorEnabled !== lastFpsToggleChecked) {
        fpsToggleButton.setAttribute(
          'aria-checked',
          String(fpsIndicatorEnabled),
        )
        lastFpsToggleChecked = fpsIndicatorEnabled
      }
    }
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

    if (!open) {
      resetConfirmation()
    }

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

    const action = target.dataset.menuAction as TopMenuAction | undefined
    if (!action) {
      return
    }

    if (isConfirmableAction(action) && pendingConfirmationAction !== action) {
      pendingConfirmationAction = action
      syncConfirmationLabels()
      return
    }

    options.onAction(action)
    if (action === 'saveDebugSnapshot' || action === 'loadDebugSnapshot') {
      syncSnapshotAvailability()
    }
    syncState()
    resetConfirmation()
    setOpen(false, 'button')
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
  syncConfirmationLabels()

  return {
    close: () => setOpen(false),
    element: root,
    syncState,
  }
}
