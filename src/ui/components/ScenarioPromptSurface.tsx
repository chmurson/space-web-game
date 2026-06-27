import type { ComponentChildren } from 'preact'
import type {
  PromptText,
  ScenarioHudFocusTarget,
  ScenarioPromptAnchor,
  ScenarioTouchControlFocusTarget,
} from '../../scenario/scenarioPromptTypes'

export type ScenarioPromptDisplayMode = 'coach' | 'modal'

export type ScenarioPromptActionButtonView = {
  action: string
  label: string
  visible: boolean
}

export type ScenarioPromptRestartButtonView = {
  action: string
  disabled: boolean
  label: string
  visible: boolean
}

export type ScenarioPromptView = {
  anchor?: ScenarioPromptAnchor
  closeButton: ScenarioPromptActionButtonView
  confirmButton: ScenarioPromptActionButtonView
  description: PromptText | null | undefined
  focusedHudElement?: ScenarioHudFocusTarget
  focusedTouchControl?: ScenarioTouchControlFocusTarget
  layout?: string
  mode: ScenarioPromptDisplayMode
  restartButton: ScenarioPromptRestartButtonView
  secondaryButton: ScenarioPromptActionButtonView
  title: string
  visible: boolean
}

export type ScenarioReplayPillView = {
  label: string
  visible: boolean
}

export type ScenarioPromptSurfaceView = {
  prompt: ScenarioPromptView
  replayPill: ScenarioReplayPillView
}

export type ScenarioPromptSurfaceProps = {
  rootRef(element: HTMLElement | null): void
  view: ScenarioPromptView
}

export type ScenarioReplayPillSurfaceProps = {
  rootRef(element: HTMLElement | null): void
  view: ScenarioReplayPillView
}

const getInlineFlexDisplay = (visible: boolean) => ({
  display: visible ? 'inline-flex' : 'none',
})

const renderPromptText = (
  text: PromptText | null | undefined,
): ComponentChildren => {
  if (!text || typeof text === 'string') {
    return text ?? ''
  }

  return text.map((segment, index) =>
    typeof segment === 'string' ? (
      segment
    ) : (
      <span
        class="scenario-prompt-emphasis"
        data-tone={segment.tone}
        key={index}
      >
        {segment.text}
      </span>
    ),
  )
}

export const ScenarioPromptSurface = ({
  rootRef,
  view,
}: ScenarioPromptSurfaceProps) => (
  <div
    class="scenario-prompt-backdrop"
    data-focused-hud-element={view.focusedHudElement}
    data-focused-touch-control={view.focusedTouchControl}
    data-prompt-layout={view.layout}
    data-prompt-mode={view.mode}
    ref={rootRef}
    style={{ display: view.visible ? 'grid' : 'none' }}
  >
    <svg
      class="scenario-prompt-trajectory-guide"
      aria-hidden="true"
      focusable="false"
    >
      <polyline class="scenario-prompt-trajectory-guide-line" points="" />
    </svg>
    <div class="scenario-prompt" data-anchor={view.anchor}>
      <div class="scenario-prompt-arrow" />
      <div class="scenario-prompt-header">
        <h2>{view.title}</h2>
        <button
          type="button"
          data-role="close"
          data-prompt-action={view.closeButton.action}
          class="scenario-prompt-close-button"
          aria-label="Close scenario prompt"
          style={getInlineFlexDisplay(view.closeButton.visible)}
        >
          &times;
        </button>
      </div>
      <p>{renderPromptText(view.description)}</p>
      <div class="scenario-prompt-actions">
        <button
          type="button"
          data-role="confirm"
          data-prompt-action={view.confirmButton.action}
          style={getInlineFlexDisplay(view.confirmButton.visible)}
        >
          {view.confirmButton.label}
        </button>
        <button
          type="button"
          data-role="secondary"
          data-prompt-action={view.secondaryButton.action}
          style={getInlineFlexDisplay(view.secondaryButton.visible)}
        >
          {view.secondaryButton.label}
        </button>
        <button
          type="button"
          data-role="restart"
          data-restart-action={view.restartButton.action}
          class="scenario-prompt-restart-button"
          disabled={view.restartButton.disabled}
          style={getInlineFlexDisplay(view.restartButton.visible)}
        >
          {view.restartButton.label}
        </button>
      </div>
    </div>
  </div>
)

export const ScenarioReplayPillSurface = ({
  rootRef,
  view,
}: ScenarioReplayPillSurfaceProps) => (
  <button
    type="button"
    class="hud-notice hud-notice-durable scenario-prompt-pill"
    ref={rootRef}
    style={getInlineFlexDisplay(view.visible)}
  >
    <svg class="scenario-prompt-pill-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 1.75 16.3 5.4v9.2L10 18.25 3.7 14.6V5.4Z" />
      <path d="M10 5.15v5.35" />
      <circle cx="10" cy="13.65" r="0.9" />
    </svg>
    <span class="scenario-prompt-pill-label">{view.label}</span>
  </button>
)
