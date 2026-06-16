let nextDialogId = 0

export type AppDialog = {
  body: HTMLElement
  close: (restoreFocus?: boolean) => void
  element: HTMLElement
  open: () => void
  panel: HTMLElement
}

let activeDialog: AppDialog | null = null

const joinClassNames = (classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(' ')

export const createDialogButton = (options: {
  ariaLabel?: string
  className?: string
  label: string
}): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = joinClassNames(['app-dialog-button', options.className])
  button.textContent = options.label

  if (options.ariaLabel) {
    button.setAttribute('aria-label', options.ariaLabel)
  }

  return button
}

export const createDialogSettingRow = (options: {
  control: HTMLElement
  label: string
}): HTMLElement => {
  const row = document.createElement('div')
  row.className = 'app-dialog-setting'

  const label = document.createElement('span')
  label.className = 'app-dialog-setting-name'
  label.textContent = options.label

  row.append(label, options.control)

  return row
}

export const createDialog = (options: {
  app: HTMLElement
  className?: string
  closeAriaLabel?: string
  closeLabel?: string
  id?: string
  kicker?: string
  onOpenChange?: (open: boolean) => void
  title: string
}): AppDialog => {
  const id = options.id ?? `app-dialog-${++nextDialogId}`
  const titleId = `${id}-title`
  const root = document.createElement('div')
  root.className = joinClassNames(['app-dialog', options.className])
  root.hidden = true

  const backdrop = document.createElement('div')
  backdrop.className = 'app-dialog-backdrop'
  backdrop.dataset.dialogClose = 'true'

  const panel = document.createElement('section')
  panel.className = 'app-dialog-panel'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-labelledby', titleId)
  panel.tabIndex = -1

  const header = document.createElement('header')
  header.className = 'app-dialog-header'

  const titleGroup = document.createElement('div')
  if (options.kicker) {
    const kicker = document.createElement('div')
    kicker.className = 'app-dialog-kicker'
    kicker.textContent = options.kicker
    titleGroup.append(kicker)
  }

  const title = document.createElement('h2')
  title.id = titleId
  title.className = 'app-dialog-title'
  title.textContent = options.title
  titleGroup.append(title)

  const closeButton = createDialogButton({
    ariaLabel: options.closeAriaLabel ?? `Close ${options.title}`,
    className: 'app-dialog-close',
    label: options.closeLabel ?? 'Close',
  })
  closeButton.dataset.dialogClose = 'true'
  header.append(titleGroup, closeButton)

  const body = document.createElement('div')
  body.className = 'app-dialog-body'

  panel.append(header, body)
  root.append(backdrop, panel)
  options.app.appendChild(root)

  let lastFocusedElement: HTMLElement | null = null
  let dialog: AppDialog

  const getFocusableElements = () =>
    Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )

  const close = (restoreFocus = true) => {
    if (root.hidden) {
      return
    }

    root.hidden = true
    options.onOpenChange?.(false)

    if (activeDialog === dialog) {
      activeDialog = null
    }

    if (restoreFocus && lastFocusedElement?.isConnected) {
      lastFocusedElement.focus()
    }
    lastFocusedElement = null
  }

  const open = () => {
    if (activeDialog && activeDialog !== dialog) {
      activeDialog.close(false)
    }

    if (root.hidden) {
      lastFocusedElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      root.hidden = false
      options.onOpenChange?.(true)
    }

    activeDialog = dialog
    const focusTarget = getFocusableElements()[0] ?? panel
    focusTarget.focus()
  }

  root.addEventListener('click', (event) => {
    const target = event.target
    if (
      target instanceof HTMLElement &&
      target.closest('[data-dialog-close]')
    ) {
      close()
    }
  })

  document.addEventListener('keydown', (event) => {
    if (root.hidden || activeDialog !== dialog) {
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const focusableElements = getFocusableElements()
    if (focusableElements.length === 0) {
      event.preventDefault()
      panel.focus()
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements.at(-1)
    if (!firstElement || !lastElement) {
      return
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
      return
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  })

  dialog = {
    body,
    close,
    element: root,
    open,
    panel,
  }

  return dialog
}
