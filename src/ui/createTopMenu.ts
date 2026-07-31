import {
  type DebugScenarioSnapshotEntry,
  downloadDebugScenarioSnapshot,
  getRecentDebugScenarioSnapshots,
  loadRecentDebugScenarioSnapshot,
  markRecentDebugScenarioSnapshotExported,
  readDebugScenarioSnapshot,
} from '../debugScenarioSnapshot'
import type { UIUserAction } from '../input/uiUserActions'
import {
  TopMenuSurface,
  type TopMenuSurfaceProps,
} from './components/TopMenuSurface'
import { createPreactUiSurface } from './createPreactUiSurface'

export type TopMenu = {
  close: () => void
  element: HTMLElement
  isOpen: () => boolean
  openDebugSnapshotSave: () => void
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
  getDebugSnapshotSuggestedName: () => string
  getFpsIndicatorEnabled: () => boolean
  onAction: (action: TopMenuAction) => void
  onSaveAndExportDebugSnapshot: (name: string) => {
    downloadStarted: boolean
    recentEntrySaved: boolean
    snapshotSaved: boolean
  }
  onSaveDebugSnapshot: (name: string) => void
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
  let activeSection: TopMenuSurfaceProps['activeSection'] = 'main'
  let debugModeEnabled = options.getDebugModeEnabled()
  let debugSnapshotName = ''
  let fpsIndicatorEnabled = options.getFpsIndicatorEnabled()
  let loadSnapshotAvailable = readDebugScenarioSnapshot() !== null
  let recentSnapshots: DebugScenarioSnapshotEntry[] =
    getRecentDebugScenarioSnapshots()
  let selectedRecentSnapshotId = recentSnapshots[0]?.id ?? ''
  let snapshotExportStatus: TopMenuSurfaceProps['snapshotExportStatus'] = null
  let pendingConfirmationAction: ConfirmableTopMenuAction | null = null

  const getButton = () =>
    surface.element.querySelector<HTMLButtonElement>('.top-menu-button')

  const getDropdown = () =>
    surface.element.querySelector<HTMLDivElement>('.top-menu-dropdown')

  const getMenuItems = () =>
    Array.from(
      surface.element.querySelectorAll<
        HTMLButtonElement | HTMLInputElement | HTMLSelectElement
      >(
        [
          'button[role="menuitem"]',
          'button[role="menuitemcheckbox"]',
          'button[role="menuitemradio"]',
          'input.menu-debug-snapshot-name',
          'select.menu-recent-snapshot-select',
        ].join(', '),
      ),
    ).filter((menuItem) => !menuItem.disabled && !menuItem.closest('[hidden]'))

  const focusItem = (index: number) => {
    const menuItems = getMenuItems()
    menuItems.at(index)?.focus()
  }

  const focusAction = (action: string) => {
    surface.element
      .querySelector<HTMLButtonElement>(`[data-menu-action="${action}"]`)
      ?.focus()
  }

  const syncSnapshotAvailability = () => {
    const previousLoadSnapshotAvailable = loadSnapshotAvailable
    const previousRecentSnapshotIds = recentSnapshots
      .map((snapshot) => snapshot.id)
      .join('|')
    const previousSelectedRecentSnapshotId = selectedRecentSnapshotId

    loadSnapshotAvailable = readDebugScenarioSnapshot() !== null
    recentSnapshots = getRecentDebugScenarioSnapshots()
    if (
      selectedRecentSnapshotId === '' ||
      !recentSnapshots.some(
        (snapshot) => snapshot.id === selectedRecentSnapshotId,
      )
    ) {
      selectedRecentSnapshotId = recentSnapshots[0]?.id ?? ''
    }

    return (
      loadSnapshotAvailable !== previousLoadSnapshotAvailable ||
      previousRecentSnapshotIds !==
        recentSnapshots.map((snapshot) => snapshot.id).join('|') ||
      previousSelectedRecentSnapshotId !== selectedRecentSnapshotId
    )
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
      activeSection,
      debugModeEnabled,
      debugSnapshotName,
      fpsIndicatorEnabled,
      loadSnapshotAvailable,
      menuId,
      open,
      pendingConfirmationAction,
      recentSnapshots,
      selectedRecentSnapshotId,
      snapshotExportStatus,
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
        if (action === 'loadDebugSnapshot') {
          syncSnapshotAvailability()
        }
        syncToggleState()
        pendingConfirmationAction = null
        setOpen(false, 'button')
      },
      onMenuButtonClick: () => {
        setOpen(!open, open ? 'button' : 'first-item')
      },
      onDebugSnapshotNameChange: (name) => {
        debugSnapshotName = name
      },
      onDebugSnapshotSave: () => {
        options.onSaveDebugSnapshot(debugSnapshotName)
        syncSnapshotAvailability()
        pendingConfirmationAction = null
        setOpen(false, 'button')
      },
      onDebugSnapshotSaveAndExport: () => {
        const result = options.onSaveAndExportDebugSnapshot(debugSnapshotName)
        syncSnapshotAvailability()

        if (!result.snapshotSaved && !result.downloadStarted) {
          snapshotExportStatus = {
            message: 'Snapshot could not be saved or downloaded. Try again.',
            tone: 'error',
          }
        } else if (!result.downloadStarted) {
          snapshotExportStatus = {
            message: 'Snapshot saved, but the download could not be started.',
            tone: 'error',
          }
        } else if (!result.snapshotSaved) {
          snapshotExportStatus = {
            message: 'Download started, but the snapshot could not be saved.',
            tone: 'error',
          }
        } else if (!result.recentEntrySaved) {
          snapshotExportStatus = {
            message:
              'Snapshot saved and downloaded, but the local export time could not be saved.',
            tone: 'error',
          }
        } else {
          snapshotExportStatus = {
            message: 'Snapshot saved and download started.',
            tone: 'success',
          }
        }

        renderMenu()
        focusAction('saveAndExportDebugSnapshot')
      },
      onDebugSnapshotSaveBack: () => {
        snapshotExportStatus = null
        activeSection = 'main'
        renderMenu()
        focusAction('saveDebugSnapshot')
      },
      onDebugSnapshotSaveMenu: () => {
        snapshotExportStatus = null
        openDebugSnapshotSave()
      },
      onRecentSnapshotBack: () => {
        snapshotExportStatus = null
        activeSection = 'main'
        renderMenu()
        focusAction('openDebugSnapshotLoad')
      },
      onRecentSnapshotChange: (id) => {
        selectedRecentSnapshotId = id
        snapshotExportStatus = null
        renderMenu()
      },
      onRecentSnapshotExport: () => {
        const selectedSnapshot = recentSnapshots.find(
          (snapshot) => snapshot.id === selectedRecentSnapshotId,
        )
        if (!selectedSnapshot) {
          snapshotExportStatus = {
            message: 'The selected snapshot is no longer available.',
            tone: 'error',
          }
          syncSnapshotAvailability()
          renderMenu()
          return
        }

        try {
          downloadDebugScenarioSnapshot(selectedSnapshot.snapshot)
        } catch {
          snapshotExportStatus = {
            message: 'Snapshot download could not be started. Try again.',
            tone: 'error',
          }
          renderMenu()
          focusAction('exportRecentDebugSnapshot')
          return
        }

        if (!markRecentDebugScenarioSnapshotExported(selectedSnapshot.id)) {
          snapshotExportStatus = {
            message:
              'Download started, but the local export time could not be saved.',
            tone: 'error',
          }
          renderMenu()
          focusAction('exportRecentDebugSnapshot')
          return
        }

        syncSnapshotAvailability()
        snapshotExportStatus = {
          message: 'Snapshot download started.',
          tone: 'success',
        }
        renderMenu()
        focusAction('exportRecentDebugSnapshot')
      },
      onRecentSnapshotLoad: () => {
        if (
          selectedRecentSnapshotId &&
          loadRecentDebugScenarioSnapshot(selectedRecentSnapshotId)
        ) {
          options.onAction('loadDebugSnapshot')
          syncSnapshotAvailability()
        }
        syncToggleState()
        pendingConfirmationAction = null
        setOpen(false, 'button')
      },
      onRecentSnapshotMenu: () => {
        snapshotExportStatus = null
        activeSection = 'debug-snapshot'
        renderMenu()
        focusItem(0)
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
      activeSection = 'main'
      debugSnapshotName = ''
      snapshotExportStatus = null
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

  const openDebugSnapshotSave = () => {
    debugSnapshotName = options.getDebugSnapshotSuggestedName()
    activeSection = 'debug-snapshot-save'
    setOpen(true, 'first-item')
  }

  const handleDropdownKeyDown = (event: KeyboardEvent) => {
    const menuItems = getMenuItems()
    const currentIndex = menuItems.indexOf(
      document.activeElement as
        | HTMLButtonElement
        | HTMLInputElement
        | HTMLSelectElement,
    )
    if (
      event.target instanceof HTMLInputElement &&
      (event.key === 'Home' || event.key === 'End')
    ) {
      return
    }
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
    isOpen: () => open,
    openDebugSnapshotSave,
    syncState,
  }
}
