import type { ReachMoonCompletedHighscorePayload } from '../../scenario/specific-scenarios/reachMoonScenario'
import { formatReachMoonScoreSummary } from '../../scenario/specific-scenarios/reachMoonScore'
import type { ReachMoonRunReceipt } from '../../server/reachMoonRunReceipts'
import {
  MenuActionButton,
  MenuActions,
  MenuCopy,
  MenuDescription,
  MenuKicker,
  MenuPanel,
} from './MenuSurfacePrimitives'

export type MainMenuView = 'main' | 'reach-moon' | 'reach-moon-highscores'

const mainMenuActionAttribute = 'data-main-menu-action'
const mainMenuViewAttribute = 'data-main-menu-view'

export type ReachMoonHighscorePendingRun =
  ReachMoonCompletedHighscorePayload & {
    runReceipt: ReachMoonRunReceipt | null
    runReceiptError: string | null
  }

export type MainMenuSurfaceProps = {
  activeView: MainMenuView
  loadGameAvailable: boolean
  reachMoonHighscorePendingRun: ReachMoonHighscorePendingRun | null
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
  reachMoonHighscorePendingRun,
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
  const highscoreDescription = reachMoonHighscorePendingRun
    ? reachMoonHighscorePendingRun.runReceipt
      ? `Mission score ready: ${formatReachMoonScoreSummary(reachMoonHighscorePendingRun.score)}`
      : `Mission score ready, but submission is unavailable: ${reachMoonHighscorePendingRun.runReceiptError ?? 'run receipt was not prepared.'}`
    : 'No records yet.'

  return (
    <section
      class="main-menu"
      ref={rootRef}
      style={{ display: visible ? 'flex' : 'none' }}
    >
      <MenuPanel
        className="main-menu-panel"
        view="main"
        viewAttribute={mainMenuViewAttribute}
        hidden={displayedView !== 'main'}
      >
        <MenuCopy className="main-menu-copy">
          <MenuKicker className="main-menu-kicker">Space Web Game</MenuKicker>
          <MenuDescription>
            {reachMoonFeatureEnabled
              ? 'Learn the flight model, then take the Earth-Moon run.'
              : 'Drift above Earth, resume a saved snapshot, or jump straight into the tutorial.'}
          </MenuDescription>
        </MenuCopy>
        <MenuActions className="main-menu-actions">
          {reachMoonFeatureEnabled ? (
            <>
              <MenuActionButton
                action="tutorial"
                actionAttribute={mainMenuActionAttribute}
                className="main-menu-action-primary"
                variant="primary"
                onClick={onTutorial}
              >
                Tutorial
              </MenuActionButton>
              <MenuActionButton
                action="reach-moon-menu"
                actionAttribute={mainMenuActionAttribute}
                className="main-menu-action-primary"
                variant="primary"
                onClick={onReachMoonMenu}
              >
                Reach the Moon
              </MenuActionButton>
              <MenuActionButton
                action="free-roam"
                actionAttribute={mainMenuActionAttribute}
                className="main-menu-action-secondary"
                variant="secondary"
                onClick={onFreeRoam}
              >
                Free Roam
              </MenuActionButton>
              <MenuActionButton
                action="load"
                actionAttribute={mainMenuActionAttribute}
                className="main-menu-action-secondary"
                disabled={!loadGameAvailable}
                variant="secondary"
                onClick={onLoadGame}
              >
                Load Game
              </MenuActionButton>
            </>
          ) : (
            <>
              <MenuActionButton
                action="load"
                actionAttribute={mainMenuActionAttribute}
                disabled={!loadGameAvailable}
                onClick={onLoadGame}
              >
                Load Game
              </MenuActionButton>
              <MenuActionButton
                action="tutorial"
                actionAttribute={mainMenuActionAttribute}
                onClick={onTutorial}
              >
                Tutorial
              </MenuActionButton>
              <MenuActionButton
                action="free-roam"
                actionAttribute={mainMenuActionAttribute}
                onClick={onFreeRoam}
              >
                Free Roam
              </MenuActionButton>
            </>
          )}
        </MenuActions>
      </MenuPanel>

      {reachMoonFeatureEnabled ? (
        <>
          <MenuPanel
            className="main-menu-panel"
            view="reach-moon"
            viewAttribute={mainMenuViewAttribute}
            hidden={displayedView !== 'reach-moon'}
          >
            <MenuCopy className="main-menu-copy">
              <MenuKicker className="main-menu-kicker">
                Reach the Moon
              </MenuKicker>
              <MenuDescription>
                Launch into the Earth-Moon mission route.
              </MenuDescription>
            </MenuCopy>
            <MenuActions className="main-menu-actions">
              <MenuActionButton
                action="reach-moon-start"
                actionAttribute={mainMenuActionAttribute}
                className="main-menu-action-primary"
                variant="primary"
                onClick={onReachMoon}
              >
                Start
              </MenuActionButton>
              <MenuActionButton
                action="reach-moon-highscores"
                actionAttribute={mainMenuActionAttribute}
                onClick={onReachMoonHighscores}
              >
                Highscores
              </MenuActionButton>
              <MenuActionButton
                action="reach-moon-back"
                actionAttribute={mainMenuActionAttribute}
                className="main-menu-action-secondary"
                variant="secondary"
                onClick={onReachMoonBack}
              >
                Back
              </MenuActionButton>
            </MenuActions>
          </MenuPanel>

          <MenuPanel
            className="main-menu-panel"
            view="reach-moon-highscores"
            viewAttribute={mainMenuViewAttribute}
            hidden={displayedView !== 'reach-moon-highscores'}
          >
            <MenuCopy className="main-menu-copy">
              <MenuKicker className="main-menu-kicker">Highscores</MenuKicker>
              <MenuDescription>{highscoreDescription}</MenuDescription>
            </MenuCopy>
            <MenuActions className="main-menu-actions">
              <MenuActionButton
                action="reach-moon-back"
                actionAttribute={mainMenuActionAttribute}
                className="main-menu-action-secondary"
                variant="secondary"
                onClick={onReachMoonBack}
              >
                Back
              </MenuActionButton>
            </MenuActions>
          </MenuPanel>
        </>
      ) : null}
    </section>
  )
}
