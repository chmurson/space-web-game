import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'

import { updateOffscreenIndicators } from '@/presentation/bodyPresentation/updateOffscreenIndicators'
import type { Body } from '@/simulation/types'
import type { OverlayUiRefs } from '@/ui/overlayUI/createOverlayUi'

class FakeClassList {
  constructor(private readonly element: FakeElement) {}

  add(...classNames: string[]) {
    const classes = new Set(this.values())
    for (const className of classNames) {
      classes.add(className)
    }
    this.element.className = Array.from(classes).join(' ')
  }

  contains(className: string) {
    return this.values().includes(className)
  }

  remove(...classNames: string[]) {
    const removed = new Set(classNames)
    this.element.className = this.values()
      .filter((className) => !removed.has(className))
      .join(' ')
  }

  toggle(className: string, force?: boolean) {
    const enabled = force ?? !this.contains(className)
    if (enabled) {
      this.add(className)
    } else {
      this.remove(className)
    }
    return enabled
  }

  private values() {
    return this.element.className.split(/\s+/).filter(Boolean)
  }
}

class FakeElement {
  readonly classList = new FakeClassList(this)
  readonly dataset: Record<string, string> = {}
  readonly label = { style: {}, textContent: '' }
  readonly pointer = { style: {} }
  readonly style: Record<string, string> = {}
  className = 'offscreen-indicator'
  hidden = false
  private readonly attributes = new Map<string, string>()

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null
  }

  getBoundingClientRect() {
    return {
      bottom: 12,
      height: 12,
      left: 0,
      right: 12,
      top: 0,
      width: 12,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }
  }

  querySelector(selector: string) {
    if (selector === '.label') {
      return this.label
    }
    if (selector === '.pointer') {
      return this.pointer
    }
    return null
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }
}

const globals = globalThis as unknown as {
  document?: Document
  window?: Window
}
const originalDocument = globals.document
const originalWindow = globals.window

const createBody = (id: string, name: string, x: number, y: number): Body => ({
  color: '#fff',
  id,
  mass: 1,
  name,
  position: { x, y },
  radius: 1_000,
  velocity: { x: 0, y: 0 },
})

describe('updateOffscreenIndicators', () => {
  afterEach(() => {
    if (originalDocument) {
      globals.document = originalDocument
    } else {
      Reflect.deleteProperty(globals, 'document')
    }
    if (originalWindow) {
      globals.window = originalWindow
    } else {
      Reflect.deleteProperty(globals, 'window')
    }
  })

  it('presents unlabeled bodies, an emphasized target, and spacecraft', () => {
    globals.document = {
      querySelector: () => null,
      querySelectorAll: () => [],
    } as unknown as Document
    globals.window = {
      getComputedStyle: () =>
        ({
          display: 'none',
          opacity: '1',
          visibility: 'visible',
        }) as CSSStyleDeclaration,
      innerHeight: 600,
      innerWidth: 800,
      matchMedia: () => ({ matches: false }) as MediaQueryList,
    } as unknown as Window

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
    camera.position.set(0, 10, 10)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()

    const earth = createBody('earth', 'Earth', 2_000_000, 0)
    const moon = createBody('moon', 'Moon', 0, 3_000_000)
    const indicators = new Map(
      ['earth', 'moon', '__spacecraft__'].map((id) => [id, new FakeElement()]),
    )

    updateOffscreenIndicators({
      bodies: [earth, moon],
      gameScene: { camera } as unknown as Parameters<
        typeof updateOffscreenIndicators
      >[0]['gameScene'],
      overlayUi: {
        offscreenIndicators: indicators,
      } as unknown as OverlayUiRefs,
      spacecraftPosition: { x: -2_000_000, y: 0 },
      targetBodyId: 'earth',
    })

    const earthIndicator = indicators.get('earth')
    const moonIndicator = indicators.get('moon')
    const spacecraftIndicator = indicators.get('__spacecraft__')

    expect(earthIndicator?.classList.contains('offscreen-indicator-body')).toBe(
      true,
    )
    expect(
      earthIndicator?.classList.contains('offscreen-indicator-active-target'),
    ).toBe(true)
    expect(
      earthIndicator?.classList.contains('offscreen-indicator-unlabeled'),
    ).toBe(true)
    expect(earthIndicator?.label.textContent).toBe('')
    expect(earthIndicator?.getAttribute('aria-label')).toBe('Earth, off screen')

    expect(moonIndicator?.classList.contains('offscreen-indicator-body')).toBe(
      true,
    )
    expect(
      moonIndicator?.classList.contains('offscreen-indicator-active-target'),
    ).toBe(false)
    expect(moonIndicator?.label.textContent).toBe('')
    expect(moonIndicator?.getAttribute('aria-label')).toBe('Moon, off screen')

    expect(
      spacecraftIndicator?.classList.contains('offscreen-indicator-spacecraft'),
    ).toBe(true)
    expect(spacecraftIndicator?.label.textContent).toBe('')
    expect(spacecraftIndicator?.getAttribute('aria-label')).toBe(
      'Spacecraft, off screen',
    )
  })
})
