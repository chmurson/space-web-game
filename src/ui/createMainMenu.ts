import { h, render } from 'preact'
import { readDebugScenarioSnapshot } from '../debugScenarioSnapshot'
import {
  MainMenuSurface,
  type MainMenuView,
} from './components/MainMenuSurface'

export type MainMenu = {
  element: HTMLElement
  setVisible(visible: boolean): void
  showReachMoonHighscores(): void
  syncState(): void
}

export const createMainMenu = (options: {
  app: HTMLElement
  reachMoonFeatureEnabled: boolean
  onFreeRoam(): void
  onLoadGame(): void
  onReachMoon(): void
  onTutorial(): void
}): MainMenu => {
  const host = document.createElement('div')
  options.app.appendChild(host)

  let activeView: MainMenuView = 'main'
  let loadGameAvailable = readDebugScenarioSnapshot() !== null
  let root: HTMLElement | null = null
  let visible = true

  const setActiveView = (view: MainMenuView) => {
    activeView = options.reachMoonFeatureEnabled ? view : 'main'
  }

  const renderMenu = () => {
    render(
      h(MainMenuSurface, {
        activeView,
        loadGameAvailable,
        reachMoonFeatureEnabled: options.reachMoonFeatureEnabled,
        rootRef: (element) => {
          root = element
        },
        visible,
        onFreeRoam: () => handleActionThatClosesMenu(options.onFreeRoam),
        onLoadGame: () => {
          if (loadGameAvailable) {
            handleActionThatClosesMenu(options.onLoadGame)
          }
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
      }),
      host,
    )
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
  const element = root
  if (!element) {
    throw new Error('Failed to create main menu')
  }

  return {
    element,
    setVisible,
    showReachMoonHighscores: () => {
      visible = true
      setActiveView('reach-moon-highscores')
      renderMenu()
    },
    syncState: () => {
      const nextLoadGameAvailable = readDebugScenarioSnapshot() !== null
      if (loadGameAvailable === nextLoadGameAvailable) {
        return
      }

      loadGameAvailable = nextLoadGameAvailable
      renderMenu()
    },
  }
}
