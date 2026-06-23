import { readDebugScenarioSnapshot } from '../debugScenarioSnapshot'

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
  const root = document.createElement('section')
  root.className = 'main-menu'
  root.innerHTML = `
    <div class="main-menu-panel" data-main-menu-view="main">
      <div class="main-menu-copy">
        <div class="main-menu-kicker">Space Web Game</div>
        <p>${
          options.reachMoonFeatureEnabled
            ? 'Learn the flight model, then take the Earth-Moon run.'
            : 'Drift above Earth, resume a saved snapshot, or jump straight into the tutorial.'
        }</p>
      </div>
      <div class="main-menu-actions">
        ${
          options.reachMoonFeatureEnabled
            ? `
        <button type="button" class="main-menu-action-primary" data-main-menu-action="tutorial">Tutorial</button>
        <button type="button" class="main-menu-action-primary" data-main-menu-action="reach-moon-menu">Reach the Moon</button>
        <button type="button" class="main-menu-action-secondary" data-main-menu-action="free-roam">Free Roam</button>
        <button type="button" class="main-menu-action-secondary" data-main-menu-action="load">Load Game</button>
        `
            : `
        <button type="button" data-main-menu-action="load">Load Game</button>
        <button type="button" data-main-menu-action="tutorial">Tutorial</button>
        <button type="button" data-main-menu-action="free-roam">Free Roam</button>
        `
        }
      </div>
    </div>
    ${
      options.reachMoonFeatureEnabled
        ? `
    <div class="main-menu-panel" data-main-menu-view="reach-moon" hidden>
      <div class="main-menu-copy">
        <div class="main-menu-kicker">Reach the Moon</div>
        <p>Launch into the Earth-Moon mission route.</p>
      </div>
      <div class="main-menu-actions">
        <button type="button" class="main-menu-action-primary" data-main-menu-action="reach-moon-start">Start</button>
        <button type="button" data-main-menu-action="reach-moon-highscores">Highscores</button>
        <button type="button" class="main-menu-action-secondary" data-main-menu-action="reach-moon-back">Back</button>
      </div>
    </div>
    <div class="main-menu-panel" data-main-menu-view="reach-moon-highscores" hidden>
      <div class="main-menu-copy">
        <div class="main-menu-kicker">Highscores</div>
        <p>No records yet.</p>
      </div>
      <div class="main-menu-actions">
        <button type="button" class="main-menu-action-secondary" data-main-menu-action="reach-moon-back">Back</button>
      </div>
    </div>
    `
        : ''
    }
  `
  options.app.appendChild(root)

  const panels = Array.from(
    root.querySelectorAll<HTMLElement>('[data-main-menu-view]'),
  )
  const loadGameButton = root.querySelector<HTMLButtonElement>(
    '[data-main-menu-action="load"]',
  )
  const tutorialButton = root.querySelector<HTMLButtonElement>(
    '[data-main-menu-action="tutorial"]',
  )
  const freeRoamButton = root.querySelector<HTMLButtonElement>(
    '[data-main-menu-action="free-roam"]',
  )
  const reachMoonMenuButton = root.querySelector<HTMLButtonElement>(
    '[data-main-menu-action="reach-moon-menu"]',
  )
  const reachMoonStartButton = root.querySelector<HTMLButtonElement>(
    '[data-main-menu-action="reach-moon-start"]',
  )
  const reachMoonHighscoresButton = root.querySelector<HTMLButtonElement>(
    '[data-main-menu-action="reach-moon-highscores"]',
  )
  const reachMoonBackButtons = root.querySelectorAll<HTMLButtonElement>(
    '[data-main-menu-action="reach-moon-back"]',
  )

  const showView = (view: string) => {
    const nextView = panels.some((panel) => panel.dataset.mainMenuView === view)
      ? view
      : 'main'
    for (const panel of panels) {
      panel.hidden = panel.dataset.mainMenuView !== nextView
    }
  }

  const setVisible = (visible: boolean) => {
    root.style.display = visible ? 'flex' : 'none'
    if (visible) {
      showView('main')
    }
  }

  const handleActionThatClosesMenu = (action: () => void) => {
    setVisible(false)
    action()
  }

  loadGameButton?.addEventListener('click', () => {
    if (loadGameButton.disabled) {
      return
    }

    handleActionThatClosesMenu(options.onLoadGame)
  })
  tutorialButton?.addEventListener('click', () => {
    handleActionThatClosesMenu(options.onTutorial)
  })
  freeRoamButton?.addEventListener('click', () => {
    handleActionThatClosesMenu(options.onFreeRoam)
  })
  reachMoonMenuButton?.addEventListener('click', () => {
    showView('reach-moon')
  })
  reachMoonStartButton?.addEventListener('click', () => {
    handleActionThatClosesMenu(options.onReachMoon)
  })
  reachMoonHighscoresButton?.addEventListener('click', () => {
    showView('reach-moon-highscores')
  })
  for (const button of reachMoonBackButtons) {
    button.addEventListener('click', () => {
      showView('main')
    })
  }

  return {
    element: root,
    setVisible,
    showReachMoonHighscores: () => {
      root.style.display = 'flex'
      showView('reach-moon-highscores')
    },
    syncState: () => {
      if (!loadGameButton) {
        return
      }

      loadGameButton.disabled = readDebugScenarioSnapshot() === null
    },
  }
}
