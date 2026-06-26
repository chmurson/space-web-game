import {
  MenuActionButton,
  MenuActions,
  MenuDescription,
  MenuKicker,
  MenuPanel,
  MenuTitle,
} from './MenuSurfacePrimitives'

const crashMenuActionAttribute = 'data-crash-menu-action'

export type CrashMenuSurfaceProps = {
  crashedBodyName: string | null
  hasCheckpoint: boolean
  loadGameAvailable: boolean
  rootRef(element: HTMLElement | null): void
  visible: boolean
  onExit(): void
  onLoadGame(): void
  onRestart(): void
  onRestartFromCheckpoint(): void
}

export const CrashMenuSurface = ({
  crashedBodyName,
  hasCheckpoint,
  loadGameAvailable,
  rootRef,
  visible,
  onExit,
  onLoadGame,
  onRestart,
  onRestartFromCheckpoint,
}: CrashMenuSurfaceProps) => {
  const title = crashedBodyName ? `Crashed into ${crashedBodyName}` : 'Crashed'
  const description = crashedBodyName
    ? `Impact with ${crashedBodyName} ended this run. Restart to try the approach again.`
    : 'Impact detected. Restart to try the approach again.'

  return (
    <section
      class="crash-menu"
      ref={rootRef}
      hidden={!visible}
      role="dialog"
      aria-modal="true"
      aria-labelledby="crash-menu-title"
      aria-describedby="crash-menu-description"
      aria-hidden={!visible}
    >
      <MenuPanel className="crash-menu-panel">
        <MenuKicker className="crash-menu-kicker">Mission ended</MenuKicker>
        <MenuTitle id="crash-menu-title" className="crash-menu-title">
          {title}
        </MenuTitle>
        <MenuDescription
          id="crash-menu-description"
          className="crash-menu-description"
        >
          {description}
        </MenuDescription>
        <MenuActions className="crash-menu-actions">
          <MenuActionButton
            action="checkpoint"
            actionAttribute={crashMenuActionAttribute}
            className={hasCheckpoint ? 'crash-menu-primary-action' : undefined}
            hidden={!hasCheckpoint}
            tone="danger"
            variant="primary"
            onClick={onRestartFromCheckpoint}
          >
            Restart from checkpoint
          </MenuActionButton>
          <MenuActionButton
            action="restart"
            actionAttribute={crashMenuActionAttribute}
            className={hasCheckpoint ? undefined : 'crash-menu-primary-action'}
            tone={hasCheckpoint ? 'neutral' : 'danger'}
            variant={hasCheckpoint ? 'default' : 'primary'}
            onClick={onRestart}
          >
            Restart
          </MenuActionButton>
          <MenuActionButton
            action="load"
            actionAttribute={crashMenuActionAttribute}
            hidden={!loadGameAvailable}
            onClick={onLoadGame}
          >
            Load game
          </MenuActionButton>
          <MenuActionButton
            action="exit"
            actionAttribute={crashMenuActionAttribute}
            onClick={onExit}
          >
            Exit to menu
          </MenuActionButton>
        </MenuActions>
      </MenuPanel>
    </section>
  )
}
