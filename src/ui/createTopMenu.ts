import { readDebugScenarioSnapshot } from '../debugScenarioSnapshot'
import type { UIUserAction } from '../input/uiUserActions'
import {
  TopMenuSurface,
  type TopMenuSurfaceProps,
} from './components/TopMenuSurface'
import { createPreactUiSurface } from './createPreactUiSurface'

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
type TopMenuRenderProps = Omit<TopMenuSurfaceProps, 'rootRef'>

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
  const topBar = options.app.querySelector<HTMLElement>('.top-bar')
  if (!topBar) {
    throw new Error('Failed to find top bar')
  }

  const surface = createPreactUiSurface<TopMenuRenderProps>({
    app: topBar,
    component: TopMenuSurface,
    missingRootError: 'Failed to create top menu',
  })

  let open = false
  let debugModeEnabled = options.getDebugModeEnabled()
  let fpsIndicatorEnabled = options.getFpsIndicatorEnabled()
  let loadSnapshotAvailable = readDebugScenarioSnapshot() !== null
  let pendingConfirmationAction: ConfirmableTopMenuAction | null = null

  const getButton = () =>
    surface.element.querySelector<HTMLButtonElement>('.top-menu-button')

  const getDropdown = () =>
    surface.element.querySelector<HTMLDivElement>('.top-menu-dropdown')

  const getMenuItems = () =>
    Array.from(
      surface.element.querySelectorAll<HTMLButtonElement>(
        'button[role="menuitem"], button[role="menuitemcheckbox"], button[role="menuitemradio"]',
      ),
    ).filter((menuItem) => !menuItem.disabled)

  const focusItem = (index: number) => {
    const menuItems = getMenuItems()
    menuItems.at(index)?.focus()
  }

  const syncSnapshotAvailability = () => {
    const previousLoadSnapshotAvailable = loadSnapshotAvailable
    loadSnapshotAvailable = readDebugScenarioSnapshot() !== null
    return loadSnapshotAvailable !== previousLoadSnapshotAvailable
  }

  const syncToggleState = () => {
    const previousDebugModeEnabled = debugModeEnabled
    const previousFpsIndicatorEnabled = fpsIndicatorEnabled
    debugModeEnabled = options.getDebugModeEnabled()
    fpsIndicatorEnabled = options.getFpsIndicatorEnabled()
    return (
      debugModeEnabled !== previousDebugModeEnabled ||
      fpsIndicatorEnabled !== previousFpsIndicatorEnabled
    )
  }

  const renderMenu = () => {
    surface.render({
      debugModeEnabled,
      fpsIndicatorEnabled,
      loadSnapshotAvailable,
      menuId,
      open,
      pendingConfirmationAction,
      onAction: (action) => {
        if (
          isConfirmableAction(action) &&
          pendingConfirmationAction !== action
        ) {
          pendingConfirmationAction = action
          renderMenu()
          return
        }

        options.onAction(action)
        if (action === 'saveDebugSnapshot' || action === 'loadDebugSnapshot') {
          syncSnapshotAvailability()
        }
        syncToggleState()
        pendingConfirmationAction = null
        setOpen(false, 'button')
      },
      onMenuButtonClick: () => {
        setOpen(!open, open ? 'button' : 'first-item')
      },
    })
  }

  const syncState = () => {
    const toggleStateChanged = syncToggleState()
    const snapshotAvailabilityChanged = open
      ? syncSnapshotAvailability()
      : false

    if (!toggleStateChanged && !snapshotAvailabilityChanged) {
      return
    }

    renderMenu()
  }

  const setOpen = (
    nextOpen: boolean,
    focusTarget: 'button' | 'first-item' | 'none' = 'none',
  ) => {
    open = nextOpen
    if (nextOpen) {
      syncSnapshotAvailability()
      syncToggleState()
    }

    if (!nextOpen) {
      pendingConfirmationAction = null
    }
    renderMenu()

    if (nextOpen && focusTarget === 'first-item') {
      focusItem(0)
    }
    if (!nextOpen && focusTarget === 'button') {
      getButton()?.focus()
    }
  }

  const handleDropdownKeyDown = (event: KeyboardEvent) => {
    const menuItems = getMenuItems()
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
  }

  renderMenu()

  const root = surface.element
  const host = root.parentElement
  const dropdown = getDropdown()
  if (!host || !dropdown) {
    throw new Error('Failed to create top menu')
  }

  host.style.display = 'contents'
  topBar.prepend(host)
  dropdown.addEventListener('keydown', handleDropdownKeyDown)

  document.addEventListener('pointerdown', (event) => {
    if (!open) {
      return
    }

    if (event.target instanceof Node && !root.contains(event.target)) {
      setOpen(false)
    }
  })

  document.addEventListener('keydown', (event) => {
    if (!open) {
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false, 'button')
    }
  })

  return {
    close: () => setOpen(false),
    element: root,
    syncState,
  }
}
