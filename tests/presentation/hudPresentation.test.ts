import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RendererProfiler } from '@/render/rendererProfiler'
import type { AppRuntimeState } from '@/runtime/appRuntimeState'
import type { BrowserGcProbeStats } from '@/runtime/browserGcProbe'
import type { GameQueries } from '@/runtime/gameQueries'
import { createDefaultScenarioDirectives } from '@/scenario/scenarioDirectiveTypes'
import { createRuntimeScenarioSession } from '@/scenario/scenarioSession'
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

class FakeStyle {
  [key: string]: string | ((name: string, value: string) => void)

  setProperty(name: string, value: string) {
    this[name] = value
  }
}

class FakeElement {
  classList = new FakeClassList(this)
  className = ''
  dataset: Record<string, string> = {}
  hidden = false
  id = ''
  isConnected = false
  parentElement: FakeElement | null = null
  readonly style = new FakeStyle()
  title = ''

  private attributes = new Map<string, string>()
  private children: FakeElement[] = []
  private ownTextContent = ''

  constructor(readonly tagName: string) {}

  get childNodes() {
    return this.children
  }

  get textContent() {
    return (
      this.ownTextContent +
      this.children.map((child) => child.textContent).join('')
    )
  }

  set textContent(value: string | null) {
    this.children = []
    this.ownTextContent = value ?? ''
  }

  append(...nodes: Array<FakeElement | Node | string>) {
    for (const node of nodes) {
      if (typeof node === 'string') {
        const text = new FakeElement('#text')
        text.textContent = node
        this.appendChild(text)
        continue
      }
      this.appendChild(node as unknown as FakeElement)
    }
  }

  appendChild<T extends FakeElement | Node>(node: T) {
    const child = node as unknown as FakeElement
    child.remove()
    child.parentElement = this
    this.children.push(child)
    child.setConnected(this.isConnected)
    return node
  }

  closest(selector: string) {
    let element: FakeElement | null = this
    while (element) {
      if (matchesSelector(element, selector)) {
        return element
      }
      element = element.parentElement
    }
    return null
  }

  getBoundingClientRect() {
    return {
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }
  }

  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null
  }

  querySelectorAll(selector: string) {
    const matches: FakeElement[] = []
    const visit = (element: FakeElement) => {
      for (const child of element.children) {
        if (matchesSelector(child, selector)) {
          matches.push(child)
        }
        visit(child)
      }
    }
    visit(this)
    return matches
  }

  remove() {
    if (!this.parentElement) {
      this.setConnected(false)
      return
    }
    const siblings = this.parentElement.children
    const index = siblings.indexOf(this)
    if (index >= 0) {
      siblings.splice(index, 1)
    }
    this.parentElement = null
    this.setConnected(false)
  }

  replaceChildren(...nodes: Array<FakeElement | Node | string>) {
    for (const child of this.children) {
      child.parentElement = null
      child.setConnected(false)
    }
    this.children = []
    this.ownTextContent = ''
    this.append(...nodes)
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
    if (name === 'id') {
      this.id = value
    }
  }

  private setConnected(connected: boolean) {
    this.isConnected = connected
    for (const child of this.children) {
      child.setConnected(connected)
    }
  }
}

const matchesSelector = (element: FakeElement, selector: string) => {
  if (selector.startsWith('.')) {
    return element.classList.contains(selector.slice(1))
  }
  if (selector.startsWith('#')) {
    return element.id === selector.slice(1)
  }
  return element.tagName.toLowerCase() === selector.toLowerCase()
}

const globals = globalThis as typeof globalThis & {
  document?: Document
  window?: Window & typeof globalThis
  ResizeObserver?: typeof ResizeObserver
  MutationObserver?: typeof MutationObserver
}
const originalDocument = globals.document
const originalWindow = globals.window
const originalResizeObserver = globals.ResizeObserver
const originalMutationObserver = globals.MutationObserver

const installFakeDom = () => {
  globals.document = {
    createElement: (tagName: string) =>
      new FakeElement(tagName) as unknown as HTMLElement,
    createElementNS: (_namespace: string, tagName: string) =>
      new FakeElement(tagName) as unknown as Element,
    querySelector: () => null,
    visibilityState: 'visible',
  } as unknown as Document
  globals.window = {
    addEventListener: () => undefined,
    clearTimeout: () => undefined,
    matchMedia: () => ({ matches: false }),
    removeEventListener: () => undefined,
    setTimeout: () => 1,
  } as unknown as Window & typeof globalThis
  globals.ResizeObserver = class {
    disconnect() {}
    observe() {}
  } as unknown as typeof ResizeObserver
  globals.MutationObserver = class {
    disconnect() {}
    observe() {}
  } as unknown as typeof MutationObserver
}

const restoreFakeDom = () => {
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

  if (originalResizeObserver) {
    globals.ResizeObserver = originalResizeObserver
  } else {
    Reflect.deleteProperty(globals, 'ResizeObserver')
  }

  if (originalMutationObserver) {
    globals.MutationObserver = originalMutationObserver
  } else {
    Reflect.deleteProperty(globals, 'MutationObserver')
  }
}

const createBody = (id: string, name: string): Body => ({
  color: '#ffffff',
  id,
  mass: 1,
  name,
  position: { x: 0, y: 0 },
  radius: 1,
  velocity: { x: 0, y: 0 },
})

const earth = createBody('earth', 'Earth')
const moon = createBody('moon', 'Moon')

const createRuntime = (): AppRuntimeState => ({
  debug: {
    debugModeEnabled: false,
    debugNoGravityEnabled: false,
    debugSnapshotStatus: '',
    fpsIndicatorEnabled: false,
  },
  scenario: {
    directives: createDefaultScenarioDirectives(),
    metadata: {
      description: 'Test scenario',
      title: 'Test',
    },
    session: createRuntimeScenarioSession('test-scenario', { phase: 'test' }),
  },
  simulation: {
    assistMode: 'off',
    assistTargetIndex: 1,
    assistTargetSelectionMode: 'manual',
    coastPredictionHorizonHours: 2,
    crashedBodyName: null,
    state: {
      bodies: [earth, moon],
      controls: { main: 0, reverse: 0, strafe: 0, turn: 0 },
      elapsed: 0,
      spacecraft: {
        dryMass: 10_000,
        fuel: 1,
        fuelCapacity: 1,
        fuelMass: 8_000,
        fuelUsed: 0,
        heading: 0,
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
      },
    },
    targetHeading: null,
    targetHeadingTurn: null,
    timeWarpIndex: 0,
    viewportSize: 100,
  },
  ui: {
    camera: { mode: 'centered', panOffset: { x: 0, y: 0 } },
    spacecraftLabelIntroUntil: 0,
    targetHeadingScreenPosition: null,
    targetHeadingSelectionEpoch: 0,
    targetHeadingWorldPosition: null,
    touchThrustControl: {
      engaged: false,
      interactive: false,
      revealed: false,
      visible: false,
    },
    uiEffectEpoch: 0,
  },
})

const createBrowserGcStats = (): BrowserGcProbeStats => ({
  eventCount: 0,
  heapSamplingSupported: false,
  isEnabled: false,
  lastEventAtMs: null,
  lastEstimatedPauseMs: null,
  lastReclaimedBytes: null,
  lastSource: null,
  longestEstimatedPauseMs: 0,
  nativeObserverSupported: false,
  recentEvents: [],
  totalEstimatedPauseMs: 0,
  totalReclaimedBytes: null,
})

const createScenarioPrompt = () => {
  const backdrop = new FakeElement('div')
  const prompt = new FakeElement('div')
  prompt.className = 'scenario-prompt'
  const arrow = new FakeElement('div')
  arrow.className = 'scenario-prompt-arrow'
  prompt.appendChild(arrow)
  backdrop.appendChild(prompt)
  return backdrop
}

const createOverlayUi = (app: FakeElement): OverlayUiRefs => {
  const bottomPillArea = new FakeElement('div')
  app.appendChild(bottomPillArea)
  return {
    bodyLabels: new Map(),
    bottomPillArea: bottomPillArea as unknown as HTMLElement,
    cameraUnlockNotice: new FakeElement('div') as unknown as HTMLElement,
    cameraUnlockNoticeBody: null,
    cameraUnlockNoticeTitle: null,
    debugPanel: {
      element: new FakeElement('div') as unknown as HTMLElement,
      setCloseHandler: vi.fn(),
      setCopyJson: vi.fn(),
      setJson: vi.fn(),
      setText: vi.fn(),
    },
    fpsIndicator: new FakeElement('div') as unknown as HTMLElement,
    fuelDepletedNotice: new FakeElement('div') as unknown as HTMLElement,
    fuelPill: null,
    headingTargetDot: new FakeElement('div') as unknown as HTMLElement,
    headingTargetLine: new FakeElement('line') as unknown as SVGLineElement,
    headingTargetOverlay: new FakeElement('svg') as unknown as SVGSVGElement,
    headingTargetTurnSlice: new FakeElement(
      'path',
    ) as unknown as SVGPathElement,
    offscreenIndicators: new Map(),
    scenarioPrompt: createScenarioPrompt() as unknown as HTMLElement,
    scenarioPromptCloseButton: null,
    scenarioPromptConfirmButton: null,
    scenarioPromptDescription: null,
    scenarioPromptReplayButton: new FakeElement(
      'button',
    ) as unknown as HTMLButtonElement,
    scenarioPromptReplayButtonLabel: null,
    scenarioPromptRestartButton: null,
    scenarioPromptSecondaryButton: null,
    scenarioPromptTitle: null,
    scenarioPromptTrajectoryGuide: null,
    scenarioPromptTrajectoryGuideLine: null,
    spacecraftCallout: new FakeElement('div') as unknown as HTMLElement,
    spacecraftCalloutLabel: null,
    spacecraftIconThrust: new FakeElement('div') as unknown as HTMLElement,
    speedIcon: null,
    statAssist: null,
    statEngine: null,
    statFuel: null,
    statGuidance: null,
    statSpeed: null,
    statTarget: null,
    statTargetSpeed: null,
    statThrust: null,
    statTime: null,
    statWarp: null,
    statZoom: null,
    targetPill: null,
    targetRecommendationNotice: new FakeElement(
      'div',
    ) as unknown as HTMLElement,
    targetRecommendationNoticeDismissButton: null,
    targetRecommendationNoticeMessage: null,
    targetRecommendationNoticeOpenButton: null,
    targetSphere: null,
    targetStatus: null,
    timeIcon: null,
    timeIconHand: null,
    trajectoryCoachAnchor: new FakeElement('div') as unknown as HTMLElement,
  }
}

const createQueries = (
  captureMetricsOverrides: Partial<
    ReturnType<GameQueries['getCaptureMetrics']>
  > = {},
): GameQueries =>
  ({
    getAssistTargetUiState: () => ({
      activeTarget: moon,
      mode: 'manual',
      recommendedTarget: null,
    }),
    getCaptureMetrics: () => ({
      circularSpeed: 1,
      distance: 1_000,
      insideRange: true,
      relativeSpeed: 1,
      roughAssistRange: 2_000,
      specificEnergy: -1,
      surfaceDistance: 999,
      ...captureMetricsOverrides,
    }),
    getCoastPredictionHorizonSeconds: () => 3_600,
    getCircularizePlan: () => null,
    getPredictionConfig: () => ({ stepSeconds: 30 }),
  }) as unknown as GameQueries

const createMetrics = (
  fpsMeterVisible = false,
  overrides: Partial<{
    frameIntervalMs: number
    fpsGraphNowMs: number
    nowMs: number
  }> = {},
) => ({
  browserGcStats: createBrowserGcStats(),
  frameIntervalMs: overrides.frameIntervalMs ?? 16,
  fpsFrameSamples: [{ atMs: 1_000, frameMs: 16 }],
  fpsGraphNowMs: overrides.fpsGraphNowMs ?? overrides.nowMs ?? 1_000,
  fpsMeterVisible,
  nowMs: overrides.nowMs ?? 1_000,
  smoothedCpuMs: 4,
  smoothedFps: 60,
})

describe('createHudPresentation', () => {
  beforeEach(() => {
    installFakeDom()
  })

  afterEach(() => {
    restoreFakeDom()
    vi.restoreAllMocks()
  })

  it('mounts and renders the FPS meter only while it is visible', async () => {
    const { createHudPresentation } = await import(
      '@/presentation/hudPresentation'
    )
    const app = new FakeElement('div')
    app.id = 'app'
    app.isConnected = true
    const overlayUi = createOverlayUi(app)
    const runtime = createRuntime()
    const rendererProfiler = {
      getSmoothedGpuMs: vi.fn(() => 8),
    } as unknown as RendererProfiler
    const presentation = createHudPresentation({
      defaultViewport: 100,
      overlayUi,
      physicsEngineName: 'test',
      queries: createQueries(),
      rendererProfiler,
      runtime,
      timeWarps: [1],
      trajectoryPresentation: {
        getCoachAnchorScreenPoint: () => null,
        getPredictionState: () => ({
          predictedImpact: null,
          predictedTargetClosestApproach: null,
        }),
      } as never,
    })

    presentation.update(createMetrics())

    const fpsIndicator = overlayUi.fpsIndicator as unknown as FakeElement
    expect(fpsIndicator.isConnected).toBe(false)
    expect(fpsIndicator.childNodes).toHaveLength(0)
    expect(rendererProfiler.getSmoothedGpuMs).not.toHaveBeenCalled()

    runtime.debug.fpsIndicatorEnabled = true
    presentation.update(createMetrics(false))

    expect(fpsIndicator.isConnected).toBe(false)
    expect(fpsIndicator.childNodes).toHaveLength(0)
    expect(rendererProfiler.getSmoothedGpuMs).not.toHaveBeenCalled()

    presentation.update(createMetrics(true))

    expect(fpsIndicator.parentElement).toBe(app)
    expect(fpsIndicator.isConnected).toBe(true)
    expect(fpsIndicator.childNodes).toHaveLength(2)
    expect(fpsIndicator.textContent).toContain('FPS 60.0')
    expect(rendererProfiler.getSmoothedGpuMs).toHaveBeenCalledOnce()

    runtime.debug.fpsIndicatorEnabled = false
    presentation.update(createMetrics())

    expect(fpsIndicator.isConnected).toBe(false)
    expect(fpsIndicator.childNodes).toHaveLength(0)
  })

  it('throttles debug panel content updates while the panel stays open', async () => {
    const { createHudPresentation } = await import(
      '@/presentation/hudPresentation'
    )
    const app = new FakeElement('div')
    app.id = 'app'
    app.isConnected = true
    const overlayUi = createOverlayUi(app)
    const runtime = createRuntime()
    runtime.debug.debugModeEnabled = true
    const presentation = createHudPresentation({
      defaultViewport: 100,
      overlayUi,
      physicsEngineName: 'test',
      queries: createQueries(),
      rendererProfiler: {
        getSmoothedGpuMs: vi.fn(() => 8),
      } as unknown as RendererProfiler,
      runtime,
      timeWarps: [1],
      trajectoryPresentation: {
        getCoachAnchorScreenPoint: () => null,
        getPredictionState: () => ({
          predictedImpact: null,
          predictedTargetClosestApproach: null,
        }),
      } as never,
    })

    presentation.update(createMetrics(false, { nowMs: 1_000 }))
    presentation.update(createMetrics(false, { nowMs: 1_250 }))
    presentation.update(createMetrics(false, { nowMs: 1_500 }))

    expect(overlayUi.debugPanel.setText).toHaveBeenCalledTimes(2)
    expect(overlayUi.debugPanel.setJson).toHaveBeenCalledTimes(2)
  })

  it('renders viewport and trail detail in the debug window', async () => {
    const { createHudPresentation } = await import(
      '@/presentation/hudPresentation'
    )
    const app = new FakeElement('div')
    app.id = 'app'
    app.isConnected = true
    const overlayUi = createOverlayUi(app)
    const runtime = createRuntime()
    runtime.debug.debugModeEnabled = true
    runtime.simulation.viewportSize = 25
    const captureMetricsOverrides = { specificEnergy: -1 }
    const presentation = createHudPresentation({
      defaultViewport: 100,
      getTrailRenderedSliceCount: () => 12,
      overlayUi,
      physicsEngineName: 'test',
      queries: createQueries(captureMetricsOverrides),
      rendererProfiler: {
        getSmoothedGpuMs: vi.fn(() => 8),
      } as unknown as RendererProfiler,
      runtime,
      timeWarps: [1],
      trajectoryPresentation: {
        getCoachAnchorScreenPoint: () => null,
        getPredictionState: () => ({
          targetId: 'moon',
          predictedImpact: null,
          predictedTargetClosestApproach: null,
          targetRelativePredictionPoints: [{ x: 10, y: 20 }],
        }),
      } as never,
    })

    presentation.update(createMetrics())

    const debugText = vi
      .mocked(overlayUi.debugPanel.setText)
      .mock.calls.at(-1)
      ?.at(0)
    const debugJson = vi
      .mocked(overlayUi.debugPanel.setJson)
      .mock.calls.at(-1)
      ?.at(0) as
      | {
          trail?: {
            captureSampleDistanceMeters?: number
            renderFrame?: string
            renderedSliceCount?: number
            renderTargetId?: string | null
            renderSampleDistanceMeters?: number
            targetBound?: boolean
          }
          viewport?: { size?: number; zoom?: number }
        }
      | undefined
    const debugCopyJson = vi
      .mocked(overlayUi.debugPanel.setCopyJson)
      .mock.calls.at(-1)
      ?.at(0) as
      | {
          simulation?: {
            assistTarget?: { id?: string }
            state?: { bodies?: unknown[] }
          }
          trajectoryPrediction?: {
            targetId?: string
            targetRelativePredictionPoints?: Array<{ x: number; y: number }>
          }
          trail?: {
            renderFrame?: string
            renderTargetId?: string | null
            targetBound?: boolean
          }
        }
      | undefined

    expect(debugText).toContain('viewport: 25.00 | zoom: 4.0x')
    expect(debugText).toContain(
      'trail detail: L6/7 close | slices 12 | render 417 km | capture 250 km | frame target-relative Moon',
    )
    expect(debugJson?.viewport).toEqual({ size: 25, zoom: 4 })
    expect(debugJson?.trail).toMatchObject({
      captureSampleDistanceMeters: 250_000,
      detailLabel: 'close',
      detailLevel: 6,
      detailLevelCount: 7,
      renderFrame: 'target-relative',
      renderedSliceCount: 12,
      renderTargetId: 'moon',
      targetBound: true,
    })
    expect(debugJson?.trail?.renderSampleDistanceMeters).toBeCloseTo(
      416_666.67,
      2,
    )
    expect(debugCopyJson?.simulation?.assistTarget?.id).toBe('moon')
    expect(debugCopyJson?.simulation?.state?.bodies).toHaveLength(2)
    expect(debugCopyJson?.trajectoryPrediction).toMatchObject({
      targetId: 'moon',
      targetRelativePredictionPoints: [{ x: 10, y: 20 }],
    })
    expect(debugCopyJson?.trail).toMatchObject({
      renderFrame: 'target-relative',
      renderTargetId: 'moon',
      targetBound: true,
    })

    captureMetricsOverrides.specificEnergy = 1
    presentation.update(createMetrics(false, { nowMs: 1_500 }))
    const inertialDebugText = vi
      .mocked(overlayUi.debugPanel.setText)
      .mock.calls.at(-1)
      ?.at(0)
    const inertialDebugCopyJson = vi
      .mocked(overlayUi.debugPanel.setCopyJson)
      .mock.calls.at(-1)
      ?.at(0) as
      | {
          trail?: {
            renderFrame?: string
            renderTargetId?: string | null
            targetBound?: boolean
          }
        }
      | undefined

    expect(inertialDebugText).toContain('target: Moon')
    expect(inertialDebugText).toContain('frame inertial')
    expect(inertialDebugCopyJson?.trail).toMatchObject({
      renderFrame: 'inertial',
      renderTargetId: null,
      targetBound: false,
    })
  })

  it('throttles FPS meter content to every four visible frame cycles', async () => {
    const { createHudPresentation } = await import(
      '@/presentation/hudPresentation'
    )
    const app = new FakeElement('div')
    app.id = 'app'
    app.isConnected = true
    const overlayUi = createOverlayUi(app)
    const runtime = createRuntime()
    runtime.debug.fpsIndicatorEnabled = true
    const rendererProfiler = {
      getSmoothedGpuMs: vi.fn(() => 8),
    } as unknown as RendererProfiler
    const presentation = createHudPresentation({
      defaultViewport: 100,
      overlayUi,
      physicsEngineName: 'test',
      queries: createQueries(),
      rendererProfiler,
      runtime,
      timeWarps: [1],
      trajectoryPresentation: {
        getCoachAnchorScreenPoint: () => null,
        getPredictionState: () => ({
          predictedImpact: null,
          predictedTargetClosestApproach: null,
        }),
      } as never,
    })

    presentation.update(createMetrics(true, { nowMs: 1_000 }))
    for (let cycle = 1; cycle < 4; cycle += 1) {
      presentation.update(createMetrics(true, { nowMs: 1_000 + cycle * 16 }))
    }

    expect(rendererProfiler.getSmoothedGpuMs).toHaveBeenCalledOnce()

    presentation.update(createMetrics(true, { nowMs: 1_064 }))

    expect(rendererProfiler.getSmoothedGpuMs).toHaveBeenCalledTimes(2)
  })

  it('updates FPS meter content immediately after a slow visible frame', async () => {
    const { createHudPresentation } = await import(
      '@/presentation/hudPresentation'
    )
    const app = new FakeElement('div')
    app.id = 'app'
    app.isConnected = true
    const overlayUi = createOverlayUi(app)
    const runtime = createRuntime()
    runtime.debug.fpsIndicatorEnabled = true
    const rendererProfiler = {
      getSmoothedGpuMs: vi.fn(() => 8),
    } as unknown as RendererProfiler
    const presentation = createHudPresentation({
      defaultViewport: 100,
      overlayUi,
      physicsEngineName: 'test',
      queries: createQueries(),
      rendererProfiler,
      runtime,
      timeWarps: [1],
      trajectoryPresentation: {
        getCoachAnchorScreenPoint: () => null,
        getPredictionState: () => ({
          predictedImpact: null,
          predictedTargetClosestApproach: null,
        }),
      } as never,
    })

    presentation.update(createMetrics(true, { nowMs: 1_000 }))
    presentation.update(
      createMetrics(true, { frameIntervalMs: 70, nowMs: 1_070 }),
    )

    expect(rendererProfiler.getSmoothedGpuMs).toHaveBeenCalledTimes(2)
  })
})
