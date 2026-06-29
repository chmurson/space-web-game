import {
  MainMenuSurface,
  type MainMenuSurfaceProps,
  type MainMenuView,
  type ReachMoonHighscorePendingRun,
} from './components/MainMenuSurface'
import { createPreactUiSurface } from './createPreactUiSurface'
import { isLoadGameAvailable, runLoadGameAction } from './loadGameAvailability'

export type MainMenu = {
  element: HTMLElement
  setVisible(visible: boolean): void
  showReachMoonHighscores(pendingRun?: ReachMoonHighscorePendingRun): void
  syncState(): void
}

type MainMenuRenderProps = Omit<MainMenuSurfaceProps, 'rootRef'>

export const createMainMenu = (options: {
  app: HTMLElement
  reachMoonFeatureEnabled: boolean
  onFreeRoam(): void
  onLoadGame(): void
  onReachMoon(): void
  onTutorial(): void
}): MainMenu => {
  const surface = createPreactUiSurface<MainMenuRenderProps>({
    app: options.app,
    component: MainMenuSurface,
    missingRootError: 'Failed to create main menu',
  })

  let activeView: MainMenuView = 'main'
  let loadGameAvailable = isLoadGameAvailable()
  let reachMoonHighscorePendingRun: ReachMoonHighscorePendingRun | null = null
  let visible = true

  const refreshLoadGameAvailable = () => {
    const nextLoadGameAvailable = isLoadGameAvailable()
    if (loadGameAvailable === nextLoadGameAvailable) {
      return false
    }

    loadGameAvailable = nextLoadGameAvailable
    return true
  }

  const setActiveView = (view: MainMenuView) => {
    activeView = options.reachMoonFeatureEnabled ? view : 'main'
  }

  const renderMenu = () => {
    surface.render({
      activeView,
      loadGameAvailable,
      reachMoonHighscorePendingRun,
      reachMoonFeatureEnabled: options.reachMoonFeatureEnabled,
      visible,
      onFreeRoam: () => handleActionThatClosesMenu(options.onFreeRoam),
      onLoadGame: () => {
        const didLoad = runLoadGameAction(() =>
          handleActionThatClosesMenu(options.onLoadGame),
        )
        if (!didLoad && refreshLoadGameAvailable()) {
          renderMenu()
        }
      },
      onReachMoon: () => handleActionThatClosesMenu(options.onReachMoon),
      onReachMoonBack: () => {
        setActiveView('main')
        renderMenu()
      },
      onReachMoonHighscores: () => {
        reachMoonHighscorePendingRun = null
        setActiveView('reach-moon-highscores')
        renderMenu()
      },
      onReachMoonMenu: () => {
        setActiveView('reach-moon')
        renderMenu()
      },
      onTutorial: () => handleActionThatClosesMenu(options.onTutorial),
    })
  }

  const setVisible = (nextVisible: boolean) => {
    visible = nextVisible
    if (nextVisible) {
      setActiveView('main')
    }
    renderMenu()
  }

  const handleActionThatClosesMenu = (action: () => void) => {
    setVisible(false)
    action()
  }

  renderMenu()
  const element = surface.element

  return {
    element,
    setVisible,
    showReachMoonHighscores: (pendingRun) => {
      visible = true
      reachMoonHighscorePendingRun = pendingRun ?? null
      setActiveView('reach-moon-highscores')
      renderMenu()
    },
    syncState: () => {
      if (refreshLoadGameAvailable()) {
        renderMenu()
      }
    },
  }
}
