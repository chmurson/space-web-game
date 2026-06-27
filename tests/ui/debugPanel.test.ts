import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDebugPanel } from '@/ui/debugPanel'

class FakeElement {
  className = ''
  dataset: Record<string, string> = {}
  disabled = false
  hidden = false
  title = ''
  type = ''

  private attributes = new Map<string, string>()
  private children: Array<FakeElement | string> = []
  private listeners = new Map<string, EventListener[]>()
  private ownTextContent = ''

  constructor(readonly tagName: string) {}

  get textContent() {
    return (
      this.ownTextContent +
      this.children
        .map((child) =>
          typeof child === 'string' ? child : (child.textContent ?? ''),
        )
        .join('')
    )
  }

  set textContent(value: string | null) {
    this.children = []
    this.ownTextContent = value ?? ''
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
  ) {
    if (!listener) {
      return
    }

    const eventListeners = this.listeners.get(type) ?? []
    eventListeners.push(
      typeof listener === 'function'
        ? listener
        : (event) => listener.handleEvent(event),
    )
    this.listeners.set(type, eventListeners)
  }

  append(...nodes: Array<FakeElement | Node | string>) {
    for (const node of nodes) {
      this.children.push(
        typeof node === 'string' ? node : (node as unknown as FakeElement),
      )
    }
  }

  appendChild<T extends FakeElement | Node>(node: T) {
    this.children.push(node as unknown as FakeElement)
    return node
  }

  click() {
    const event = { stopPropagation: () => {} } as Event
    for (const listener of this.listeners.get('click') ?? []) {
      listener(event)
    }
  }

  dispatchTestEvent(type: string, init: Record<string, unknown> = {}) {
    let prevented = false
    let stopped = false
    const event = {
      ...init,
      preventDefault: () => {
        prevented = true
      },
      stopPropagation: () => {
        stopped = true
      },
    } as Event
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
    return { prevented, stopped }
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null
  }

  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null
  }

  querySelectorAll(selector: string) {
    const matches: FakeElement[] = []
    const className = selector.startsWith('.') ? selector.slice(1) : null

    const visit = (element: FakeElement) => {
      for (const child of element.children) {
        if (typeof child === 'string') {
          continue
        }

        if (
          className &&
          child.className.split(/\s+/).filter(Boolean).includes(className)
        ) {
          matches.push(child)
        }
        visit(child)
      }
    }

    visit(this)
    return matches
  }

  replaceChildren(...nodes: Array<FakeElement | Node | string>) {
    this.children = []
    this.ownTextContent = ''
    this.append(...nodes)
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }
}

const globals = globalThis as typeof globalThis & { document?: Document }
const originalDocument = globals.document

const installFakeDocument = () => {
  globals.document = {
    createElement: (tagName: string) =>
      new FakeElement(tagName) as unknown as HTMLElement,
  } as Document
}

const restoreDocument = () => {
  if (originalDocument) {
    globals.document = originalDocument
    return
  }

  Reflect.deleteProperty(globals, 'document')
}

const createPanel = () => {
  const parent = new FakeElement('div')
  const panel = createDebugPanel(parent as unknown as HTMLElement)
  return { panel, parent }
}

const getFoldButtons = (parent: FakeElement) =>
  parent.querySelectorAll('.debug-json-fold-button')

describe('debugPanel', () => {
  beforeEach(() => {
    installFakeDocument()
  })

  afterEach(() => {
    restoreDocument()
  })

  it('adds fold buttons only to first-level object fields', () => {
    const { panel, parent } = createPanel()

    panel.setJson({
      primitive: 'value',
      nested: {
        child: {
          deep: true,
        },
        leaf: 'ok',
      },
      list: [{ id: 1 }],
      nil: null,
    })

    expect(
      getFoldButtons(parent).map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Collapse nested', 'Collapse list'])
    expect(parent.textContent).toContain('"primitive": "value"')
    expect(parent.textContent).toContain('"child": {')
    expect(parent.textContent).toContain('"deep": true')
    expect(parent.textContent).toContain('"nil": null')
  })

  it('collapses a top-level object field and keeps it collapsed after updates', () => {
    const { panel, parent } = createPanel()

    panel.setJson({
      nested: {
        leaf: 'ok',
      },
      list: [{ id: 1 }],
    })
    getFoldButtons(parent)[0]?.click()

    expect(parent.textContent).toContain('"nested": { ... }')
    expect(parent.textContent).not.toContain('"leaf": "ok"')
    expect(getFoldButtons(parent)[0]?.textContent).toBe('+')
    expect(getFoldButtons(parent)[0]?.getAttribute('aria-expanded')).toBe(
      'false',
    )

    panel.setJson({
      nested: {
        leaf: 'changed',
      },
      list: [{ id: 2 }],
    })

    expect(parent.textContent).toContain('"nested": { ... }')
    expect(parent.textContent).not.toContain('"leaf": "changed"')
    expect(parent.textContent).toContain('"list": [')
  })

  it('clears stale collapse state when a field stops being an object', () => {
    const { panel, parent } = createPanel()

    panel.setJson({
      nested: {
        leaf: 'ok',
      },
    })
    getFoldButtons(parent)[0]?.click()

    panel.setJson({
      nested: 'flat',
    })

    expect(getFoldButtons(parent)).toHaveLength(0)
    expect(parent.textContent).toContain('"nested": "flat"')

    panel.setJson({
      nested: {
        leaf: 'again',
      },
    })

    expect(getFoldButtons(parent)).toHaveLength(1)
    expect(parent.textContent).toContain('"leaf": "again"')
  })

  it('shows the copy-state button only when a separate copy payload exists', () => {
    const { panel, parent } = createPanel()
    const copyStateButton = parent.querySelector('.debug-panel-copy-state')

    expect(copyStateButton?.hidden).toBe(true)

    panel.setCopyJson({
      simulation: {
        state: 'full',
      },
    })

    expect(copyStateButton?.hidden).toBe(false)

    panel.setCopyJson(null)

    expect(copyStateButton?.hidden).toBe(true)
  })

  it('keeps debug panel pointer and touch events from reaching gameplay layers', () => {
    const { panel } = createPanel()
    const element = panel.element as unknown as FakeElement

    for (const eventName of [
      'pointerdown',
      'pointerup',
      'pointercancel',
      'touchstart',
      'touchmove',
      'touchend',
      'touchcancel',
      'click',
      'wheel',
    ]) {
      expect(element.dispatchTestEvent(eventName).stopped).toBe(true)
    }
  })

  it('activates toolbar buttons on touch pointerup without double running the synthetic click', () => {
    const { panel, parent } = createPanel()
    const sizeButton = parent.querySelector('.debug-panel-size')
    const closeButton = parent.querySelector('.debug-panel-close')
    let closeCount = 0

    panel.setCloseHandler(() => {
      closeCount += 1
    })

    expect(panel.element.dataset.size).toBe('medium')

    expect(
      sizeButton?.dispatchTestEvent('pointerup', { pointerType: 'touch' }),
    ).toEqual({
      prevented: true,
      stopped: true,
    })
    expect(panel.element.dataset.size).toBe('big')

    sizeButton?.dispatchTestEvent('click')
    expect(panel.element.dataset.size).toBe('big')

    sizeButton?.dispatchTestEvent('click')
    expect(panel.element.dataset.size).toBe('small')

    closeButton?.dispatchTestEvent('pointerup', { pointerType: 'touch' })
    closeButton?.dispatchTestEvent('click')

    expect(closeCount).toBe(1)
  })

  it('activates fold buttons on touch pointerup without double toggling from the synthetic click', () => {
    const { panel, parent } = createPanel()

    panel.setJson({
      nested: {
        leaf: 'ok',
      },
    })
    const foldButton = getFoldButtons(parent)[0]

    foldButton?.dispatchTestEvent('pointerup', { pointerType: 'touch' })
    expect(parent.textContent).toContain('"nested": { ... }')
    expect(parent.textContent).not.toContain('"leaf": "ok"')

    foldButton?.dispatchTestEvent('click')
    expect(parent.textContent).toContain('"nested": { ... }')
    expect(parent.textContent).not.toContain('"leaf": "ok"')
  })
})
