export type DebugPanel = {
  element: HTMLElement
  setJson(payload: unknown | null): void
  setCloseHandler(handler: () => void): void
  setText(text: string): void
}

type DebugPanelSize = 'small' | 'medium' | 'big'

const debugPanelSizes: DebugPanelSize[] = ['small', 'medium', 'big']
const debugPanelSizeLabels: Record<DebugPanelSize, string> = {
  small: 'Small',
  medium: 'Medium',
  big: 'Big',
}

const stopEventPropagation = (event: Event) => {
  event.stopPropagation()
}

const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const highlightJson = (json: string) =>
  escapeHtml(json).replace(
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (token) => {
      let tokenClass = 'debug-json-number'

      if (token.startsWith('"')) {
        tokenClass = /:\s*$/.test(token)
          ? 'debug-json-key'
          : 'debug-json-string'
      } else if (token === 'true' || token === 'false') {
        tokenClass = 'debug-json-boolean'
      } else if (token === 'null') {
        tokenClass = 'debug-json-null'
      }

      return `<span class="${tokenClass}">${token}</span>`
    },
  )

export const createDebugPanel = (parent: HTMLElement): DebugPanel => {
  const element = document.createElement('div')
  element.className = 'debug-panel'
  element.dataset.size = 'medium'

  let latestJson = ''
  let latestRenderedJson = ''
  let closeHandler: (() => void) | null = null
  let panelSize: DebugPanelSize = 'medium'

  const toolbarElement = document.createElement('div')
  toolbarElement.className = 'debug-panel-toolbar'

  const textElement = document.createElement('pre')
  textElement.className = 'debug-panel-text'

  const jsonSectionElement = document.createElement('section')
  jsonSectionElement.className = 'debug-panel-json-section'
  jsonSectionElement.hidden = true

  const jsonLabelElement = document.createElement('div')
  jsonLabelElement.className = 'debug-panel-section-label'
  jsonLabelElement.textContent = 'debug json'

  const jsonElement = document.createElement('pre')
  jsonElement.className = 'debug-panel-text debug-panel-json'

  const copyButton = document.createElement('button')
  copyButton.type = 'button'
  copyButton.className = 'debug-panel-button debug-panel-copy'
  copyButton.textContent = 'Copy JSON'
  copyButton.hidden = true

  const sizeButton = document.createElement('button')
  sizeButton.type = 'button'
  sizeButton.className = 'debug-panel-button debug-panel-size'

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'debug-panel-button debug-panel-close'
  closeButton.textContent = 'Close'
  closeButton.setAttribute('aria-label', 'Close debug window')

  const contentElement = document.createElement('div')
  contentElement.className = 'debug-panel-content'

  const setPanelSize = (size: DebugPanelSize) => {
    panelSize = size
    element.dataset.size = size
    sizeButton.textContent = `Size: ${debugPanelSizeLabels[size]}`
    sizeButton.setAttribute(
      'aria-label',
      `Debug window size: ${debugPanelSizeLabels[size]}. Tap to change size.`,
    )
  }

  setPanelSize(panelSize)
  toolbarElement.append(copyButton, sizeButton, closeButton)
  jsonSectionElement.append(jsonLabelElement, jsonElement)
  contentElement.append(textElement, jsonSectionElement)
  element.append(toolbarElement, contentElement)
  parent.appendChild(element)

  for (const eventName of [
    'pointerdown',
    'pointerup',
    'mousedown',
    'mouseup',
    'click',
    'auxclick',
    'dblclick',
    'wheel',
  ]) {
    element.addEventListener(eventName, stopEventPropagation)
  }

  copyButton.addEventListener('click', async (event) => {
    event.stopPropagation()

    try {
      await navigator.clipboard.writeText(latestJson)
      copyButton.textContent = 'Copied'
      window.setTimeout(() => {
        copyButton.textContent = 'Copy JSON'
      }, 1_200)
    } catch {
      copyButton.textContent = 'Copy failed'
      window.setTimeout(() => {
        copyButton.textContent = 'Copy JSON'
      }, 1_800)
    }
  })

  sizeButton.addEventListener('click', (event) => {
    event.stopPropagation()

    const nextSize =
      debugPanelSizes[
        (debugPanelSizes.indexOf(panelSize) + 1) % debugPanelSizes.length
      ]
    setPanelSize(nextSize)
  })

  closeButton.addEventListener('click', (event) => {
    event.stopPropagation()
    closeHandler?.()
  })

  return {
    element,
    setJson(payload) {
      latestJson = payload === null ? '' : JSON.stringify(payload, null, 2)
      jsonSectionElement.hidden = !latestJson
      copyButton.hidden = !latestJson

      if (latestJson !== latestRenderedJson) {
        latestRenderedJson = latestJson
        jsonElement.innerHTML = latestJson ? highlightJson(latestJson) : ''
      }
    },
    setCloseHandler(handler) {
      closeHandler = handler
    },
    setText(text) {
      if (textElement.textContent !== text) {
        textElement.textContent = text
      }
    },
  }
}
