export type MainMenuView = 'main' | 'reach-moon' | 'reach-moon-highscores'

export type MainMenuSurfaceProps = {
  activeView: MainMenuView
  loadGameAvailable: boolean
  reachMoonFeatureEnabled: boolean
  rootRef(element: HTMLElement | null): void
  visible: boolean
  onFreeRoam(): void
  onLoadGame(): void
  onReachMoon(): void
  onReachMoonBack(): void
  onReachMoonHighscores(): void
  onReachMoonMenu(): void
  onTutorial(): void
}

export const MainMenuSurface = ({
  activeView,
  loadGameAvailable,
  reachMoonFeatureEnabled,
  rootRef,
  visible,
  onFreeRoam,
  onLoadGame,
  onReachMoon,
  onReachMoonBack,
  onReachMoonHighscores,
  onReachMoonMenu,
  onTutorial,
}: MainMenuSurfaceProps) => {
  const displayedView = reachMoonFeatureEnabled ? activeView : 'main'

  return (
    <section
      class="main-menu"
      ref={rootRef}
      style={{ display: visible ? 'flex' : 'none' }}
    >
      <div
        class="main-menu-panel"
        data-main-menu-view="main"
        hidden={displayedView !== 'main'}
      >
        <div class="main-menu-copy">
          <div class="main-menu-kicker">Space Web Game</div>
          <p>
            {reachMoonFeatureEnabled
              ? 'Learn the flight model, then take the Earth-Moon run.'
              : 'Drift above Earth, resume a saved snapshot, or jump straight into the tutorial.'}
          </p>
        </div>
        <div class="menu-actions main-menu-actions">
          {reachMoonFeatureEnabled ? (
            <>
              <button
                type="button"
                class="main-menu-action-primary"
                data-main-menu-action="tutorial"
                onClick={onTutorial}
              >
                Tutorial
              </button>
              <button
                type="button"
                class="main-menu-action-primary"
                data-main-menu-action="reach-moon-menu"
                onClick={onReachMoonMenu}
              >
                Reach the Moon
              </button>
              <button
                type="button"
                class="main-menu-action-secondary"
                data-main-menu-action="free-roam"
                onClick={onFreeRoam}
              >
                Free Roam
              </button>
              <button
                type="button"
                class="main-menu-action-secondary"
                data-main-menu-action="load"
                disabled={!loadGameAvailable}
                onClick={onLoadGame}
              >
                Load Game
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                data-main-menu-action="load"
                disabled={!loadGameAvailable}
                onClick={onLoadGame}
              >
                Load Game
              </button>
              <button
                type="button"
                data-main-menu-action="tutorial"
                onClick={onTutorial}
              >
                Tutorial
              </button>
              <button
                type="button"
                data-main-menu-action="free-roam"
                onClick={onFreeRoam}
              >
                Free Roam
              </button>
            </>
          )}
        </div>
      </div>

      {reachMoonFeatureEnabled ? (
        <>
          <div
            class="main-menu-panel"
            data-main-menu-view="reach-moon"
            hidden={displayedView !== 'reach-moon'}
          >
            <div class="main-menu-copy">
              <div class="main-menu-kicker">Reach the Moon</div>
              <p>Launch into the Earth-Moon mission route.</p>
            </div>
            <div class="menu-actions main-menu-actions">
              <button
                type="button"
                class="main-menu-action-primary"
                data-main-menu-action="reach-moon-start"
                onClick={onReachMoon}
              >
                Start
              </button>
              <button
                type="button"
                data-main-menu-action="reach-moon-highscores"
                onClick={onReachMoonHighscores}
              >
                Highscores
              </button>
              <button
                type="button"
                class="main-menu-action-secondary"
                data-main-menu-action="reach-moon-back"
                onClick={onReachMoonBack}
              >
                Back
              </button>
            </div>
          </div>

          <div
            class="main-menu-panel"
            data-main-menu-view="reach-moon-highscores"
            hidden={displayedView !== 'reach-moon-highscores'}
          >
            <div class="main-menu-copy">
              <div class="main-menu-kicker">Highscores</div>
              <p>No records yet.</p>
            </div>
            <div class="menu-actions main-menu-actions">
              <button
                type="button"
                class="main-menu-action-secondary"
                data-main-menu-action="reach-moon-back"
                onClick={onReachMoonBack}
              >
                Back
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
