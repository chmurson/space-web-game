export type ScenarioLoadingOverlay = {
  setVisible(visible: boolean, label?: string): void
}

const defaultLabel = 'Loading scenario'

export const createScenarioLoadingOverlay = (options: {
  app: HTMLElement
}): ScenarioLoadingOverlay => {
  const root = document.createElement('div')
  root.className = 'scenario-loading-overlay'
  root.hidden = true
  root.setAttribute('aria-hidden', 'true')
  root.innerHTML = `
    <div class="scenario-loading-panel" role="status" aria-live="polite">
      <div class="scenario-loading-spinner" aria-hidden="true"></div>
      <div class="scenario-loading-label">${defaultLabel}</div>
    </div>
  `
  options.app.appendChild(root)

  const labelElement = root.querySelector<HTMLElement>(
    '.scenario-loading-label',
  )

  return {
    setVisible(visible, label = defaultLabel) {
      if (labelElement) {
        labelElement.textContent = label
      }

      root.hidden = false
      root.dataset.visible = visible ? 'true' : 'false'
      root.setAttribute('aria-hidden', visible ? 'false' : 'true')

      if (!visible) {
        window.setTimeout(() => {
          if (root.dataset.visible !== 'true') {
            root.hidden = true
          }
        }, 160)
      }
    },
  }
}
