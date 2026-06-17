import './scenario-prompts.css'
import { arrow, computePosition, flip, offset, shift } from '@floating-ui/dom'
import type { AppRuntimeState } from '../../runtime/appRuntimeState'
import {
  resolveScenarioPrompts,
  serializePromptAction,
} from '../../scenario/scenarioPrompts'
import type {
  ResolvedPrompt,
  ResolvedPromptState,
  ScenarioHudFocusTarget,
  ScenarioPromptAnchor,
  ScenarioTouchControlFocusTarget,
} from '../../scenario/scenarioPromptTypes'

export type ScenarioPromptUiRefs = {
  backdropElement: HTMLElement
  promptElement: HTMLElement
  arrowElement: HTMLElement
  titleElement: HTMLHeadingElement | null
  descriptionElement: HTMLParagraphElement | null
  closeButton: HTMLButtonElement | null
  confirmButton: HTMLButtonElement | null
  restartButton: HTMLButtonElement | null
  secondaryButton: HTMLButtonElement | null
  trajectoryAnchorElement: HTMLElement
  replayButton: HTMLButtonElement
  replayButtonLabel: HTMLSpanElement | null
}

type AnchorKey = ScenarioPromptAnchor
type HudFocusKey = ScenarioHudFocusTarget
type TouchControlFocusKey = ScenarioTouchControlFocusTarget
type PromptDisplayMode = 'coach' | 'modal'

const focusedHudElementClassName = 'telemetry-pill-tutorial-focused'

const hasVisibleRect = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

const getTelemetryPillElement = (
  stat: 'speed' | 'thrust' | 'time',
): HTMLElement | null =>
  document
    .querySelector<HTMLElement>(`[data-stat="${stat}"]`)
    ?.closest<HTMLElement>('.telemetry-pill') ?? null

const getHudFocusElement = (target: HudFocusKey): HTMLElement | null => {
  if (target === 'speed-pill') {
    return getTelemetryPillElement('speed')
  }
  if (target === 'time-warp-pill') {
    return getTelemetryPillElement('time')
  }
  return getTelemetryPillElement('thrust')
}

const getEdgeRevealControlAnchor = (
  controlSelector: string,
  revealSelector: string,
): HTMLElement | null => {
  const control = document.querySelector<HTMLElement>(controlSelector)
  const revealControl =
    control?.closest<HTMLElement>('.touch-edge-reveal-control') ??
    document.querySelector<HTMLElement>(revealSelector)
  const revealOpen =
    revealControl?.classList.contains('touch-edge-reveal-control-open') ?? true

  if (control && revealOpen && hasVisibleRect(control)) {
    return control
  }

  return revealControl ?? control
}

const getAnchorElement = (
  refs: ScenarioPromptUiRefs,
  anchor: AnchorKey,
): HTMLElement | null => {
  if (anchor === 'trajectory') {
    return hasVisibleRect(refs.trajectoryAnchorElement)
      ? refs.trajectoryAnchorElement
      : null
  }
  if (anchor === 'speed-pill') {
    return getTelemetryPillElement('speed')
  }
  if (anchor === 'time-warp-pill') {
    return getTelemetryPillElement('time')
  }
  if (anchor === 'time-warp-control') {
    return getEdgeRevealControlAnchor(
      '.touch-step-selector-time-warp',
      '#touch-time-warp-reveal',
    )
  }
  if (anchor === 'thrust-pill') {
    return getTelemetryPillElement('thrust')
  }
  if (anchor === 'thrust-control') {
    return getEdgeRevealControlAnchor(
      '.touch-thrust-control',
      '#touch-thrust-reveal',
    )
  }
  return null
}

const emptyElement = document.createElement('div')
/**
 * Creates the scenario prompt UI elements and returns references to them.
 * This includes the main prompt backdrop/modal and the replay button.
 */
export const createScenarioPromptUI = (
  app: HTMLElement,
  topBar: HTMLElement,
): ScenarioPromptUiRefs => {
  // Create the main prompt backdrop
  const backdropElement = document.createElement('div')
  backdropElement.className = 'scenario-prompt-backdrop'
  backdropElement.style.display = 'none'
  backdropElement.innerHTML = `
    <div class="scenario-prompt">
      <div class="scenario-prompt-arrow"></div>
      <div class="scenario-prompt-header">
        <h2></h2>
        <button type="button" data-role="close" class="scenario-prompt-close-button" aria-label="Close scenario prompt">&times;</button>
      </div>
      <p></p>
      <div class="scenario-prompt-actions">
        <button type="button" data-role="confirm"></button>
        <button type="button" data-role="secondary"></button>
        <button type="button" data-role="restart" class="scenario-prompt-restart-button">Restart scenario</button>
      </div>
    </div>
  `
  app.appendChild(backdropElement)

  // Create the replay button pill
  const replayButton = document.createElement('button')
  replayButton.type = 'button'
  replayButton.className = 'scenario-prompt-pill'
  replayButton.style.display = 'none'
  replayButton.innerHTML = `
    <svg class="scenario-prompt-pill-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 1.75 16.3 5.4v9.2L10 18.25 3.7 14.6V5.4Z"></path>
      <path d="M10 5.15v5.35"></path>
      <circle cx="10" cy="13.65" r="0.9"></circle>
    </svg>
    <span class="scenario-prompt-pill-label"></span>
  `
  topBar.appendChild(replayButton)

  const trajectoryAnchorElement = document.createElement('div')
  trajectoryAnchorElement.className = 'scenario-trajectory-coach-anchor'
  trajectoryAnchorElement.setAttribute('aria-hidden', 'true')
  trajectoryAnchorElement.style.display = 'none'
  app.appendChild(trajectoryAnchorElement)

  const promptElement =
    backdropElement.querySelector<HTMLElement>('.scenario-prompt')

  const arrowElement = promptElement?.querySelector<HTMLElement>(
    '.scenario-prompt-arrow',
  )

  return {
    backdropElement,
    promptElement: promptElement ?? emptyElement,
    arrowElement: arrowElement ?? emptyElement,
    titleElement: backdropElement.querySelector<HTMLHeadingElement>('h2'),
    descriptionElement:
      backdropElement.querySelector<HTMLParagraphElement>('p'),
    closeButton: backdropElement.querySelector<HTMLButtonElement>(
      '[data-role="close"]',
    ),
    confirmButton: backdropElement.querySelector<HTMLButtonElement>(
      '[data-role="confirm"]',
    ),
    restartButton: backdropElement.querySelector<HTMLButtonElement>(
      '[data-role="restart"]',
    ),
    secondaryButton: backdropElement.querySelector<HTMLButtonElement>(
      '[data-role="secondary"]',
    ),
    trajectoryAnchorElement,
    replayButton,
    replayButtonLabel: replayButton.querySelector<HTMLSpanElement>(
      '.scenario-prompt-pill-label',
    ),
  }
}

export type ScenarioPromptUpdater = {
  update: (
    runtime: AppRuntimeState,
    inputMode: 'desktop' | 'mobile',
    showScenarioInfoButton: boolean,
  ) => void
  cleanup: () => void
}

/**
 * Represents the content identity of a prompt.
 * Used for change detection to avoid unnecessary DOM updates when content hasn't meaningfully changed.
 *
 * DESIGN NOTE: Content-Based Change Detection
 * ============================================
 * During onboarding, the runtime.scenarioSession object is replaced every frame even when
 * the prompt content hasn't meaningfully changed. This makes reference equality checks
 * unreliable for detecting actual changes.
 *
 * Instead, we compute a PromptIdentity that captures the essential prompt content
 * (title, description, mode, anchor, button labels, etc.) and compare identities frame-to-frame.
 * If the identity hasn't changed, we skip DOM updates and positioning computations.
 *
 * This approach:
 * - Avoids unnecessary DOM writes every frame
 * - Avoids expensive Floating UI computePosition calls when content is stable
 * - Maintains correctness even when runtime objects are recreated
 * - Keeps repositioning responsive (via ResizeObserver and window resize handler)
 */
type PromptIdentity = {
  activePromptTitle: string
  activePromptDescription: string
  activePromptMode: PromptDisplayMode | null
  activePromptAnchor: string | null
  activePromptFocusedHudElement: string | null
  activePromptFocusedTouchControl: string | null
  activePromptLayout: string | null
  activePromptPrimaryButtonLabel: string
  activePromptPrimaryButtonAction: string
  activePromptSecondaryButtonLabel: string
  activePromptSecondaryButtonAction: string
  closeButtonVisible: boolean
  restartButtonAction: ReplayPromptRestartAction | null
  replayPromptLabel: string
  showScenarioInfoButton: boolean
  inputMode: 'desktop' | 'mobile'
}

type ReplayPromptRestartAction = 'checkpoint' | 'scenario'

const replayPromptCancelLabel = 'Cancel'
const replayPromptCancelAction = serializePromptAction({
  kind: 'builtin',
  id: 'dismiss_to_replay',
})

const isReplayPromptActive = (
  activePrompt: ResolvedPrompt | null,
  replayPrompt: ResolvedPromptState['replay'],
): boolean =>
  activePrompt !== null &&
  replayPrompt !== null &&
  activePrompt.id === replayPrompt.id

const getReplayPromptRestartAction = (
  runtime: AppRuntimeState,
  activePrompt: ResolvedPrompt | null,
  replayPrompt: ResolvedPromptState['replay'],
): ReplayPromptRestartAction | null => {
  if (!isReplayPromptActive(activePrompt, replayPrompt)) {
    return null
  }

  return runtime.scenario.session.checkpoint !== null
    ? 'checkpoint'
    : 'scenario'
}

const getRestartButtonLabel = (action: ReplayPromptRestartAction): string =>
  action === 'checkpoint' ? 'Restart from checkpoint' : 'Restart scenario'

const getPromptButtonLabel = (options: {
  label: string
  replayPromptActive: boolean
}): string =>
  options.replayPromptActive && options.label === 'Start'
    ? 'Restart'
    : options.label

const getPromptDisplayMode = (
  activePrompt: ResolvedPrompt | null,
): PromptDisplayMode | null =>
  activePrompt?.kind === 'coach' &&
  (activePrompt.layout === 'anchored' || activePrompt.layout === 'floating')
    ? 'coach'
    : activePrompt
      ? 'modal'
      : null

/**
 * Computes a compact identity key from the current runtime state.
 * This is used to detect meaningful changes in prompt content without relying on
 * reference equality of the runtime state object (which can change every frame during onboarding).
 */
const computePromptIdentity = (
  runtime: AppRuntimeState,
  inputMode: 'desktop' | 'mobile',
  showScenarioInfoButton: boolean,
): PromptIdentity => {
  const prompts = resolveScenarioPrompts(runtime, inputMode)
  const activePrompt = prompts.active
  const replayPrompt = prompts.replay
  const replayPromptActive = isReplayPromptActive(activePrompt, replayPrompt)
  const restartButtonAction = getReplayPromptRestartAction(
    runtime,
    activePrompt,
    replayPrompt,
  )
  const promptButtonsVisible = restartButtonAction !== 'scenario'
  const primaryButton = activePrompt?.buttons[0]
  const secondaryButton = activePrompt?.buttons[1]

  return {
    activePromptTitle: activePrompt?.title ?? '',
    activePromptDescription: activePrompt?.description ?? '',
    activePromptMode: getPromptDisplayMode(activePrompt),
    activePromptAnchor:
      activePrompt?.kind === 'coach' ? activePrompt.anchor : null,
    activePromptFocusedHudElement:
      activePrompt?.kind === 'coach'
        ? (activePrompt.focusedHudElement ?? null)
        : null,
    activePromptFocusedTouchControl:
      activePrompt?.kind === 'coach'
        ? (activePrompt.focusedTouchControl ?? null)
        : null,
    activePromptLayout:
      activePrompt?.kind === 'coach' ? activePrompt.layout : null,
    activePromptPrimaryButtonLabel: promptButtonsVisible
      ? getPromptButtonLabel({
          label: primaryButton?.label ?? '',
          replayPromptActive,
        })
      : '',
    activePromptPrimaryButtonAction:
      promptButtonsVisible && primaryButton
        ? serializePromptAction(primaryButton.action)
        : '',
    activePromptSecondaryButtonLabel: promptButtonsVisible
      ? (secondaryButton?.label ?? '')
      : restartButtonAction === 'scenario'
        ? replayPromptCancelLabel
        : '',
    activePromptSecondaryButtonAction:
      promptButtonsVisible && secondaryButton
        ? serializePromptAction(secondaryButton.action)
        : restartButtonAction === 'scenario'
          ? replayPromptCancelAction
          : '',
    closeButtonVisible: replayPromptActive,
    restartButtonAction,
    replayPromptLabel: replayPrompt?.label ?? '',
    showScenarioInfoButton,
    inputMode,
  }
}

/**
 * Compares two prompt identities for equality.
 */
const identitiesEqual = (a: PromptIdentity, b: PromptIdentity): boolean => {
  return (
    a.activePromptTitle === b.activePromptTitle &&
    a.activePromptDescription === b.activePromptDescription &&
    a.activePromptMode === b.activePromptMode &&
    a.activePromptAnchor === b.activePromptAnchor &&
    a.activePromptFocusedHudElement === b.activePromptFocusedHudElement &&
    a.activePromptFocusedTouchControl === b.activePromptFocusedTouchControl &&
    a.activePromptLayout === b.activePromptLayout &&
    a.activePromptPrimaryButtonLabel === b.activePromptPrimaryButtonLabel &&
    a.activePromptPrimaryButtonAction === b.activePromptPrimaryButtonAction &&
    a.activePromptSecondaryButtonLabel === b.activePromptSecondaryButtonLabel &&
    a.activePromptSecondaryButtonAction ===
      b.activePromptSecondaryButtonAction &&
    a.closeButtonVisible === b.closeButtonVisible &&
    a.restartButtonAction === b.restartButtonAction &&
    a.replayPromptLabel === b.replayPromptLabel &&
    a.showScenarioInfoButton === b.showScenarioInfoButton &&
    a.inputMode === b.inputMode
  )
}

export const createScenarioPromptUpdater = (
  refs: ScenarioPromptUiRefs,
): ScenarioPromptUpdater => {
  let anchorResizeObserver: ResizeObserver | null = null
  let windowResizeTimeoutId: number | null = null
  let anchorMutationObserver: MutationObserver | null = null
  let focusedHudElement: HTMLElement | null = null
  let lastAnchorKey: AnchorKey | undefined
  let lastPromptMode: PromptDisplayMode | null = null
  let lastPromptIdentity: PromptIdentity | null = null

  const resetPromptToDefault = (): void => {
    refs.promptElement.style.position = ''
    refs.promptElement.style.left = ''
    refs.promptElement.style.top = ''
    refs.promptElement.style.transform = ''
    refs.arrowElement.style.display = 'none'
    delete refs.promptElement.dataset.arrowPlacement
  }

  const setFocusedHudElement = (target: HudFocusKey | null): void => {
    focusedHudElement?.classList.remove(focusedHudElementClassName)
    focusedHudElement = target ? getHudFocusElement(target) : null
    focusedHudElement?.classList.add(focusedHudElementClassName)

    const appElement = refs.backdropElement.closest<HTMLElement>('#app')
    if (!appElement) {
      return
    }

    if (target) {
      appElement.dataset.tutorialFocusedHudElement = target
    } else {
      delete appElement.dataset.tutorialFocusedHudElement
    }
  }

  const updatePromptPosition = async (): Promise<void> => {
    const anchorKey = refs.promptElement.dataset.anchor as AnchorKey | undefined

    if (!anchorKey) {
      // No anchor, use CSS default positioning
      resetPromptToDefault()
      return
    }

    const anchorElement = getAnchorElement(refs, anchorKey)
    if (!anchorElement || refs.backdropElement.style.display === 'none') {
      // Anchor not found, use CSS default positioning
      resetPromptToDefault()
      return
    }

    try {
      const {
        x,
        y,
        placement: finalPlacement,
        middlewareData,
      } = await computePosition(anchorElement, refs.promptElement, {
        placement: 'top-end',
        middleware: [
          offset(12), // 12px gap from anchor
          flip({
            padding: 10,
          }),
          shift({
            padding: 10,
          }),
          arrow({
            element: refs.arrowElement,
            padding: 8,
          }),
        ],
      })

      // Position the prompt
      // Override CSS defaults with anchor positioning
      refs.promptElement.style.position = 'fixed'
      refs.promptElement.style.left = `${x}px`
      refs.promptElement.style.top = `${y}px`
      refs.promptElement.style.transform = 'none'

      // Position the arrow
      refs.arrowElement.style.display = ''
      const { x: arrowX, y: arrowY } = middlewareData.arrow || {}
      const placementSide = finalPlacement.split('-')[0] as
        | 'top'
        | 'right'
        | 'bottom'
        | 'left'
      const staticSide = {
        top: 'bottom',
        right: 'left',
        bottom: 'top',
        left: 'right',
      }[placementSide]

      refs.arrowElement.style.position = 'absolute'
      refs.arrowElement.style.setProperty('top', '')
      refs.arrowElement.style.setProperty('right', '')
      refs.arrowElement.style.setProperty('bottom', '')
      refs.arrowElement.style.setProperty('left', '')
      refs.arrowElement.style.left = arrowX !== undefined ? `${arrowX}px` : ''
      refs.arrowElement.style.top = arrowY !== undefined ? `${arrowY}px` : ''
      refs.arrowElement.style.setProperty(staticSide, '-6px')
      refs.arrowElement.dataset.side = staticSide
    } catch (error) {
      console.error('Failed to position prompt:', error)
      resetPromptToDefault()
    }
  }

  const setupAnchorObserver = (anchorElement: HTMLElement): void => {
    if (anchorResizeObserver) {
      anchorResizeObserver.disconnect()
    }

    anchorResizeObserver = new ResizeObserver(() => {
      updatePromptPosition()
    })

    anchorResizeObserver.observe(anchorElement)

    // Also observe for DOM changes that might affect positioning
    if (anchorMutationObserver) {
      anchorMutationObserver.disconnect()
    }

    anchorMutationObserver = new MutationObserver(() => {
      updatePromptPosition()
    })

    anchorMutationObserver.observe(anchorElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
      subtree: false,
    })
  }

  const handleWindowResize = () => {
    if (windowResizeTimeoutId !== null) {
      window.clearTimeout(windowResizeTimeoutId)
    }
    windowResizeTimeoutId = window.setTimeout(() => {
      updatePromptPosition()
      windowResizeTimeoutId = null
    }, 100)
  }

  window.addEventListener('resize', handleWindowResize)

  return {
    update: (
      runtime: AppRuntimeState,
      inputMode: 'desktop' | 'mobile',
      showScenarioInfoButton: boolean,
    ) => {
      // Compute the current prompt identity based on derived content, not runtime object references.
      // This handles the case where onboarding creates a new runtime.scenarioSession object each frame
      // even when the prompt content hasn't meaningfully changed.
      const currentPromptIdentity = computePromptIdentity(
        runtime,
        inputMode,
        showScenarioInfoButton,
      )

      // Early exit if prompt identity hasn't changed.
      // This prevents expensive DOM updates and Floating UI positioning calculations when
      // the visible prompt content hasn't actually changed—which is common during onboarding
      // when the runtime state object is recreated every frame despite stable content.
      if (
        lastPromptIdentity !== null &&
        identitiesEqual(lastPromptIdentity, currentPromptIdentity)
      ) {
        if (refs.promptElement.dataset.anchor === 'trajectory') {
          updatePromptPosition()
        }
        return
      }

      // Cache the current identity for next frame comparison
      lastPromptIdentity = currentPromptIdentity

      const prompts = resolveScenarioPrompts(runtime, inputMode)
      const activePrompt = prompts.active
      const replayPrompt = prompts.replay
      const replayPromptActive = isReplayPromptActive(
        activePrompt,
        replayPrompt,
      )
      const restartButtonAction = getReplayPromptRestartAction(
        runtime,
        activePrompt,
        replayPrompt,
      )
      const promptButtonsVisible = restartButtonAction !== 'scenario'
      const primaryButton = activePrompt?.buttons[0]
      const secondaryButton = activePrompt?.buttons[1]

      // Show/hide backdrop
      refs.backdropElement.style.display = activePrompt ? 'grid' : 'none'

      // Set prompt mode
      const promptMode = getPromptDisplayMode(activePrompt) ?? 'modal'
      refs.backdropElement.dataset.promptMode = promptMode

      // Set anchor if present
      const currentAnchorKey =
        activePrompt?.kind === 'coach' &&
        promptMode === 'coach' &&
        activePrompt.layout === 'anchored'
          ? (activePrompt.anchor as AnchorKey)
          : undefined
      if (currentAnchorKey) {
        refs.promptElement.dataset.anchor = currentAnchorKey
      } else {
        delete refs.promptElement.dataset.anchor
      }
      const focusedTouchControl: TouchControlFocusKey | undefined =
        activePrompt?.kind === 'coach' && promptMode === 'coach'
          ? activePrompt.focusedTouchControl
          : undefined
      const focusedHudElementKey: HudFocusKey | undefined =
        activePrompt?.kind === 'coach' && promptMode === 'coach'
          ? activePrompt.focusedHudElement
          : undefined

      if (focusedTouchControl) {
        refs.backdropElement.dataset.focusedTouchControl = focusedTouchControl
      } else {
        delete refs.backdropElement.dataset.focusedTouchControl
      }
      if (focusedHudElementKey) {
        refs.backdropElement.dataset.focusedHudElement = focusedHudElementKey
      } else {
        delete refs.backdropElement.dataset.focusedHudElement
      }
      setFocusedHudElement(focusedHudElementKey ?? null)

      // Track if mode or anchor changed
      const modeChanged = lastPromptMode !== promptMode
      const anchorChanged = lastAnchorKey !== currentAnchorKey
      lastPromptMode = promptMode
      lastAnchorKey = currentAnchorKey

      // Reset to default when mode or anchor changes
      if (modeChanged || anchorChanged) {
        resetPromptToDefault()
        // Clean up observers
        if (anchorResizeObserver) {
          anchorResizeObserver.disconnect()
          anchorResizeObserver = null
        }
        if (anchorMutationObserver) {
          anchorMutationObserver.disconnect()
          anchorMutationObserver = null
        }
      }

      // Update anchor positioning for coach prompts with anchors
      if (promptMode === 'coach' && currentAnchorKey) {
        const anchorElement = getAnchorElement(refs, currentAnchorKey)
        if (anchorElement) {
          setupAnchorObserver(anchorElement)
          updatePromptPosition()
        }
      }

      // Update content
      if (refs.titleElement) {
        refs.titleElement.textContent = activePrompt?.title ?? ''
      }
      if (refs.descriptionElement) {
        refs.descriptionElement.textContent = activePrompt?.description ?? ''
      }

      // Update buttons
      if (refs.closeButton) {
        refs.closeButton.style.display = replayPromptActive
          ? 'inline-flex'
          : 'none'
        refs.closeButton.dataset.promptAction = replayPromptActive
          ? replayPromptCancelAction
          : ''
      }
      if (refs.confirmButton) {
        refs.confirmButton.style.display =
          promptButtonsVisible && primaryButton ? 'inline-flex' : 'none'
        refs.confirmButton.textContent = promptButtonsVisible
          ? getPromptButtonLabel({
              label: primaryButton?.label ?? '',
              replayPromptActive,
            })
          : ''
        refs.confirmButton.dataset.promptAction =
          promptButtonsVisible && primaryButton
            ? serializePromptAction(primaryButton.action)
            : ''
      }
      if (refs.secondaryButton) {
        refs.secondaryButton.style.display =
          (promptButtonsVisible && secondaryButton) ||
          restartButtonAction === 'scenario'
            ? 'inline-flex'
            : 'none'
        refs.secondaryButton.textContent = promptButtonsVisible
          ? (secondaryButton?.label ?? '')
          : restartButtonAction === 'scenario'
            ? replayPromptCancelLabel
            : ''
        refs.secondaryButton.dataset.promptAction =
          promptButtonsVisible && secondaryButton
            ? serializePromptAction(secondaryButton.action)
            : restartButtonAction === 'scenario'
              ? replayPromptCancelAction
              : ''
      }
      if (refs.restartButton) {
        refs.restartButton.style.display = restartButtonAction
          ? 'inline-flex'
          : 'none'
        refs.restartButton.disabled = restartButtonAction === null
        refs.restartButton.textContent = restartButtonAction
          ? getRestartButtonLabel(restartButtonAction)
          : ''
        refs.restartButton.dataset.restartAction = restartButtonAction ?? ''
      }

      // Update replay button
      refs.replayButton.style.display =
        showScenarioInfoButton && !activePrompt && replayPrompt
          ? 'inline-flex'
          : 'none'
      if (refs.replayButtonLabel) {
        refs.replayButtonLabel.textContent = replayPrompt?.label ?? ''
      }
    },

    cleanup: () => {
      if (anchorResizeObserver) {
        anchorResizeObserver.disconnect()
      }
      if (anchorMutationObserver) {
        anchorMutationObserver.disconnect()
      }
      if (windowResizeTimeoutId !== null) {
        window.clearTimeout(windowResizeTimeoutId)
      }
      setFocusedHudElement(null)
      window.removeEventListener('resize', handleWindowResize)
    },
  }
}
