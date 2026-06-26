import { readDebugScenarioSnapshot } from '../debugScenarioSnapshot'

export type CrashMenu = {
  element: HTMLElement
  setVisible(visible: boolean): void
  syncState(input: {
    crashedBodyName: string | null
    hasCheckpoint: boolean
  }): void
}

export const createCrashMenu = (options: {
  app: HTMLElement
  onExit(): void
  onLoadGame(): void
  onRestart(): void
  onRestartFromCheckpoint(): void
}): CrashMenu => {
  const root = document.createElement('section')
  root.className = 'crash-menu'
  root.hidden = true
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-labelledby', 'crash-menu-title')
  root.setAttribute('aria-describedby', 'crash-menu-description')
  root.setAttribute('aria-hidden', 'true')
  root.innerHTML = `
    <div class="crash-menu-panel">
      <p class="crash-menu-kicker">Mission ended</p>
      <h2 id="crash-menu-title">Crashed</h2>
      <p id="crash-menu-description">Impact detected. Restart to try the approach again.</p>
      <div class="menu-actions crash-menu-actions">
        <button class="crash-menu-primary-action" type="button" data-crash-menu-action="checkpoint">Restart from checkpoint</button>
        <button type="button" data-crash-menu-action="restart">Restart</button>
        <button type="button" data-crash-menu-action="load">Load game</button>
        <button type="button" data-crash-menu-action="exit">Exit to menu</button>
      </div>
    </div>
  `
  options.app.appendChild(root)

  const title = root.querySelector<HTMLHeadingElement>('#crash-menu-title')
  const description = root.querySelector<HTMLParagraphElement>(
    '#crash-menu-description',
  )
  const loadButton = root.querySelector<HTMLButtonElement>(
    '[data-crash-menu-action="load"]',
  )
  const restartButton = root.querySelector<HTMLButtonElement>(
    '[data-crash-menu-action="restart"]',
  )
  const restartFromCheckpointButton = root.querySelector<HTMLButtonElement>(
    '[data-crash-menu-action="checkpoint"]',
  )
  const exitButton = root.querySelector<HTMLButtonElement>(
    '[data-crash-menu-action="exit"]',
  )
  let visible = false
  let restoreFocusTarget: HTMLElement | null = null

  const getFocusableButtons = () =>
    [restartFromCheckpointButton, restartButton, loadButton, exitButton].filter(
      (button): button is HTMLButtonElement =>
        button !== null && !button.hidden && !button.disabled,
    )

  const getPrimaryRecoveryButton = () =>
    restartFromCheckpointButton && !restartFromCheckpointButton.hidden
      ? restartFromCheckpointButton
      : restartButton

  const focusPrimaryAction = () => {
    const primaryButton = getPrimaryRecoveryButton() ?? getFocusableButtons()[0]
    primaryButton?.focus({ preventScroll: true })
  }

  const restartFromPrimaryAction = () => {
    if (restartFromCheckpointButton && !restartFromCheckpointButton.hidden) {
      options.onRestartFromCheckpoint()
      return
    }

    options.onRestart()
  }

  loadButton?.addEventListener('click', () => {
    if (!loadButton.disabled && !loadButton.hidden) {
      options.onLoadGame()
    }
  })
  restartButton?.addEventListener('click', options.onRestart)
  restartFromCheckpointButton?.addEventListener('click', () => {
    if (!restartFromCheckpointButton.hidden) {
      options.onRestartFromCheckpoint()
    }
  })
  exitButton?.addEventListener('click', options.onExit)

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
    if (!root.contains(activeElement)) {
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

  return {
    element: root,
    setVisible: (nextVisible) => {
      if (visible === nextVisible) {
        return
      }

      visible = nextVisible
      root.hidden = !visible
      root.setAttribute('aria-hidden', String(!visible))

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
    syncState: ({ crashedBodyName, hasCheckpoint }) => {
      const crashTitle = crashedBodyName
        ? `Crashed into ${crashedBodyName}`
        : 'Crashed'
      if (title) {
        title.textContent = crashTitle
      }
      if (description) {
        description.textContent = crashedBodyName
          ? `Impact with ${crashedBodyName} ended this run. Restart to try the approach again.`
          : 'Impact detected. Restart to try the approach again.'
      }
      if (loadButton) {
        loadButton.hidden = readDebugScenarioSnapshot() === null
      }
      if (restartFromCheckpointButton) {
        restartFromCheckpointButton.hidden = !hasCheckpoint
        restartFromCheckpointButton.classList.toggle(
          'crash-menu-primary-action',
          hasCheckpoint,
        )
      }
      if (restartButton) {
        restartButton.classList.toggle(
          'crash-menu-primary-action',
          !hasCheckpoint,
        )
      }
    },
  }
}
