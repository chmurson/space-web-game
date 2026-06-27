import { addTapSafeButtonHandler } from './tapSafeButtonHandler'

export type DebugPanel = {
  element: HTMLElement
  setCopyJson(payload: unknown | null): void
  setJson(payload: unknown | null): void
  setCloseHandler(handler: () => void): void
  setText(text: string): void
}

type DebugPanelSize = 'small' | 'medium' | 'big'
type JsonRenderParent = HTMLElement | DocumentFragment

const debugPanelSizes: DebugPanelSize[] = ['small', 'medium', 'big']
const debugPanelSizeLabels: Record<DebugPanelSize, string> = {
  small: 'Small',
  medium: 'Medium',
  big: 'Big',
}

const stopEventPropagation = (event: Event) => {
  event.stopPropagation()
}

const isObjectJsonValue = (value: unknown) =>
  typeof value === 'object' && value !== null

const isJsonRecord = (value: unknown): value is Record<string, unknown> =>
  isObjectJsonValue(value) && !Array.isArray(value)

const appendToken = (
  parent: JsonRenderParent,
  tokenClass: string,
  text: string,
) => {
  const token = document.createElement('span')
  token.className = tokenClass
  token.textContent = text
  parent.append(token)
}

const appendIndent = (parent: JsonRenderParent, depth: number) => {
  parent.append('  '.repeat(depth))
}

const appendJsonKey = (parent: JsonRenderParent, key: string) => {
  appendToken(parent, 'debug-json-key', JSON.stringify(key))
  parent.append(': ')
}

const appendPrimitiveJsonValue = (parent: JsonRenderParent, value: unknown) => {
  if (typeof value === 'string') {
    appendToken(parent, 'debug-json-string', JSON.stringify(value))
    return
  }

  if (typeof value === 'number') {
    appendToken(parent, 'debug-json-number', JSON.stringify(value))
    return
  }

  if (typeof value === 'boolean') {
    appendToken(parent, 'debug-json-boolean', JSON.stringify(value))
    return
  }

  appendToken(parent, 'debug-json-null', 'null')
}

const getCollapsedJsonPreview = (value: unknown) =>
  Array.isArray(value) ? '[ ... ]' : '{ ... }'

const getCollapsedStateKey = (collapsedKeys: Set<string>) =>
  Array.from(collapsedKeys).sort().join('\n')

const pruneCollapsedKeys = (payload: unknown, collapsedKeys: Set<string>) => {
  if (!isJsonRecord(payload)) {
    collapsedKeys.clear()
    return
  }

  for (const key of collapsedKeys) {
    if (!isObjectJsonValue(payload[key])) {
      collapsedKeys.delete(key)
    }
  }
}

type RenderJsonOptions = {
  collapsedKeys: Set<string>
  onToggleTopLevelKey: (key: string) => void
}

const createFoldButton = (
  key: string,
  collapsed: boolean,
  options: RenderJsonOptions,
) => {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'debug-json-fold-button'
  button.textContent = collapsed ? '+' : '-'
  button.title = collapsed ? `Expand ${key}` : `Collapse ${key}`
  button.setAttribute(
    'aria-label',
    collapsed ? `Expand ${key}` : `Collapse ${key}`,
  )
  button.setAttribute('aria-expanded', String(!collapsed))
  addTapSafeButtonHandler(button, () => {
    options.onToggleTopLevelKey(key)
  })

  return button
}

const appendJsonValue = (
  parent: JsonRenderParent,
  value: unknown,
  depth: number,
  options: RenderJsonOptions,
) => {
  if (!isObjectJsonValue(value)) {
    appendPrimitiveJsonValue(parent, value)
    return
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      parent.append('[]')
      return
    }

    parent.append('[\n')
    value.forEach((item, index) => {
      appendIndent(parent, depth + 1)
      appendJsonValue(parent, item, depth + 1, options)
      parent.append(index === value.length - 1 ? '\n' : ',\n')
    })
    appendIndent(parent, depth)
    parent.append(']')
    return
  }

  const entries = Object.entries(value)
  if (entries.length === 0) {
    parent.append('{}')
    return
  }

  parent.append('{\n')
  entries.forEach(([key, childValue], index) => {
    const foldable = depth === 0 && isObjectJsonValue(childValue)
    const collapsed = foldable && options.collapsedKeys.has(key)

    appendIndent(parent, depth + 1)
    if (foldable) {
      parent.append(createFoldButton(key, collapsed, options), ' ')
    }
    appendJsonKey(parent, key)
    if (collapsed) {
      parent.append(getCollapsedJsonPreview(childValue))
    } else {
      appendJsonValue(parent, childValue, depth + 1, options)
    }
    parent.append(index === entries.length - 1 ? '\n' : ',\n')
  })
  appendIndent(parent, depth)
  parent.append('}')
}

const parseRenderedJsonPayload = (json: string) => {
  try {
    return JSON.parse(json) as unknown
  } catch {
    return null
  }
}

export const createDebugPanel = (parent: HTMLElement): DebugPanel => {
  const element = document.createElement('div')
  element.className = 'debug-panel'
  element.dataset.size = 'medium'

  let latestJson = ''
  let latestCopyJson = ''
  let latestJsonPayload: unknown = null
  let latestRenderedJson = ''
  let latestRenderedCollapsedState = ''
  let closeHandler: (() => void) | null = null
  const collapsedJsonKeys = new Set<string>()
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

  const copyStateButton = document.createElement('button')
  copyStateButton.type = 'button'
  copyStateButton.className = 'debug-panel-button debug-panel-copy-state'
  copyStateButton.textContent = 'Copy State'
  copyStateButton.hidden = true

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

  const renderLatestJson = () => {
    const collapsedState = getCollapsedStateKey(collapsedJsonKeys)
    if (
      latestJson === latestRenderedJson &&
      collapsedState === latestRenderedCollapsedState
    ) {
      return
    }

    latestRenderedJson = latestJson
    latestRenderedCollapsedState = collapsedState
    jsonElement.replaceChildren()

    if (!latestJson) {
      return
    }

    appendJsonValue(jsonElement, latestJsonPayload, 0, {
      collapsedKeys: collapsedJsonKeys,
      onToggleTopLevelKey(key) {
        if (collapsedJsonKeys.has(key)) {
          collapsedJsonKeys.delete(key)
        } else {
          collapsedJsonKeys.add(key)
        }
        renderLatestJson()
      },
    })
  }

  setPanelSize(panelSize)
  toolbarElement.append(copyButton, copyStateButton, sizeButton, closeButton)
  jsonSectionElement.append(jsonLabelElement, jsonElement)
  contentElement.append(textElement, jsonSectionElement)
  element.append(toolbarElement, contentElement)
  parent.appendChild(element)

  for (const eventName of [
    'pointerdown',
    'pointerup',
    'pointercancel',
    'touchstart',
    'touchmove',
    'touchend',
    'touchcancel',
    'mousedown',
    'mouseup',
    'click',
    'auxclick',
    'dblclick',
    'wheel',
  ]) {
    element.addEventListener(eventName, stopEventPropagation)
  }

  const copyTextToClipboard = async (
    button: HTMLButtonElement,
    text: string,
    defaultLabel: string,
  ) => {
    try {
      await navigator.clipboard.writeText(text)
      button.textContent = 'Copied'
      window.setTimeout(() => {
        button.textContent = defaultLabel
      }, 1_200)
    } catch {
      button.textContent = 'Copy failed'
      window.setTimeout(() => {
        button.textContent = defaultLabel
      }, 1_800)
    }
  }

  addTapSafeButtonHandler(copyButton, () => {
    void copyTextToClipboard(copyButton, latestJson, 'Copy JSON')
  })

  addTapSafeButtonHandler(copyStateButton, () => {
    void copyTextToClipboard(copyStateButton, latestCopyJson, 'Copy State')
  })

  addTapSafeButtonHandler(sizeButton, () => {
    const nextSize =
      debugPanelSizes[
        (debugPanelSizes.indexOf(panelSize) + 1) % debugPanelSizes.length
      ]
    setPanelSize(nextSize)
  })

  addTapSafeButtonHandler(closeButton, () => {
    closeHandler?.()
  })

  return {
    element,
    setCopyJson(payload) {
      latestCopyJson =
        payload === null ? '' : (JSON.stringify(payload, null, 2) ?? '')
      copyStateButton.hidden = !latestCopyJson
    },
    setJson(payload) {
      const nextJson =
        payload === null ? '' : (JSON.stringify(payload, null, 2) ?? '')
      latestJson = nextJson
      latestJsonPayload = nextJson ? parseRenderedJsonPayload(nextJson) : null
      pruneCollapsedKeys(latestJsonPayload, collapsedJsonKeys)
      jsonSectionElement.hidden = !latestJson
      copyButton.hidden = !latestJson

      renderLatestJson()
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
