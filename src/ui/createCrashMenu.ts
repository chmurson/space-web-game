import {
  CrashMenuSurface,
  type CrashMenuSurfaceProps,
} from './components/CrashMenuSurface'
import { createPreactUiSurface } from './createPreactUiSurface'
import { isLoadGameAvailable, runLoadGameAction } from './loadGameAvailability'

export type CrashMenu = {
  element: HTMLElement
  setVisible(visible: boolean): void
  syncState(input: {
    crashedBodyName: string | null
    hasCheckpoint: boolean
  }): void
}

type CrashMenuRenderProps = Omit<CrashMenuSurfaceProps, 'rootRef'>

export const createCrashMenu = (options: {
  app: HTMLElement
  onExit(): void
  onLoadGame(): void
  onRestart(): void
  onRestartFromCheckpoint(): void
}): CrashMenu => {
  const surface = createPreactUiSurface<CrashMenuRenderProps>({
    app: options.app,
    component: CrashMenuSurface,
    missingRootError: 'Failed to create crash menu',
  })

  let crashedBodyName: string | null = null
  let hasCheckpoint = false
  let loadGameAvailable = isLoadGameAvailable()
  let visible = false
  let restoreFocusTarget: HTMLElement | null = null

  const getButton = (action: string) =>
    surface.element.querySelector<HTMLButtonElement>(
      `[data-crash-menu-action="${action}"]`,
    ) ?? null

  const getFocusableButtons = () =>
    [
      getButton('checkpoint'),
      getButton('restart'),
      getButton('load'),
      getButton('exit'),
    ].filter(
      (button): button is HTMLButtonElement =>
        button !== null && !button.hidden && !button.disabled,
    )

  const getPrimaryRecoveryButton = () =>
    hasCheckpoint ? getButton('checkpoint') : getButton('restart')

  const focusPrimaryAction = () => {
    const primaryButton = getPrimaryRecoveryButton() ?? getFocusableButtons()[0]
    primaryButton?.focus({ preventScroll: true })
  }

  const restartFromPrimaryAction = () => {
    if (hasCheckpoint) {
      options.onRestartFromCheckpoint()
      return
    }

    options.onRestart()
  }

  const renderMenu = () => {
    surface.render({
      crashedBodyName,
      hasCheckpoint,
      loadGameAvailable,
      visible,
      onExit: options.onExit,
      onLoadGame: () => {
        runLoadGameAction(options.onLoadGame)
      },
      onRestart: options.onRestart,
      onRestartFromCheckpoint: () => {
        if (hasCheckpoint) {
          options.onRestartFromCheckpoint()
        }
      },
    })
  }

  document.addEventListener('keydown', (event) => {
    if (!visible) {
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      options.onExit()
      return
    }

    if (
      event.code === 'KeyR' &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault()
      restartFromPrimaryAction()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const buttons = getFocusableButtons()
    if (buttons.length === 0) {
      return
    }

    const firstButton = buttons[0]
    const lastButton = buttons[buttons.length - 1]
    const activeElement = document.activeElement
    if (!surface.element.contains(activeElement)) {
      event.preventDefault()
      focusPrimaryAction()
      return
    }

    if (event.shiftKey && activeElement === firstButton) {
      event.preventDefault()
      lastButton.focus({ preventScroll: true })
      return
    }

    if (!event.shiftKey && activeElement === lastButton) {
      event.preventDefault()
      firstButton.focus({ preventScroll: true })
    }
  })

  renderMenu()
  const element = surface.element

  return {
    element,
    setVisible: (nextVisible) => {
      if (visible === nextVisible) {
        return
      }

      visible = nextVisible
      renderMenu()

      if (visible) {
        restoreFocusTarget =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null
        focusPrimaryAction()
        return
      }

      if (
        restoreFocusTarget &&
        restoreFocusTarget !== document.body &&
        document.contains(restoreFocusTarget)
      ) {
        restoreFocusTarget.focus({ preventScroll: true })
      }
      restoreFocusTarget = null
    },
    syncState: (nextState) => {
      crashedBodyName = nextState.crashedBodyName
      hasCheckpoint = nextState.hasCheckpoint
      loadGameAvailable = isLoadGameAvailable()
      renderMenu()
    },
  }
}
