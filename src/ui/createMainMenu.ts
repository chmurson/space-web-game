import {
  MainMenuSurface,
  type MainMenuSurfaceProps,
  type MainMenuView,
} from './components/MainMenuSurface'
import { createPreactUiSurface } from './createPreactUiSurface'
import { isLoadGameAvailable, runLoadGameAction } from './loadGameAvailability'

export type MainMenu = {
  element: HTMLElement
  setVisible(visible: boolean): void
  showReachMoonHighscores(): void
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
  let visible = true

  const setActiveView = (view: MainMenuView) => {
    activeView = options.reachMoonFeatureEnabled ? view : 'main'
  }

  const renderMenu = () => {
    surface.render({
      activeView,
      loadGameAvailable,
      reachMoonFeatureEnabled: options.reachMoonFeatureEnabled,
      visible,
      onFreeRoam: () => handleActionThatClosesMenu(options.onFreeRoam),
      onLoadGame: () => {
        runLoadGameAction(() => handleActionThatClosesMenu(options.onLoadGame))
      },
      onReachMoon: () => handleActionThatClosesMenu(options.onReachMoon),
      onReachMoonBack: () => {
        setActiveView('main')
        renderMenu()
      },
      onReachMoonHighscores: () => {
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
    showReachMoonHighscores: () => {
      visible = true
      setActiveView('reach-moon-highscores')
      renderMenu()
    },
    syncState: () => {
      const nextLoadGameAvailable = isLoadGameAvailable()
      if (loadGameAvailable === nextLoadGameAvailable) {
        return
      }

      loadGameAvailable = nextLoadGameAvailable
      renderMenu()
    },
  }
}
