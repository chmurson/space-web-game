import type { AppRuntimeState } from '../runtime/appRuntimeState'
import type {
  PromptAction,
  PromptActionEffect,
  PromptDefinition,
  PromptText,
  PromptResolverContext,
  PromptValue,
  ResolvedPrompt,
  ResolvedPromptState,
} from './scenarioPromptTypes'
import { getRuntimeScenarioDefinition } from './scenarioRegistry'
import type { ScenarioRuntimeTransition } from './scenarioRuntimeTransition'
import { resolveCurrentScenarioScene } from './scenarioScenes'

const resolvePromptValue = <T>(
  value: PromptValue<T>,
  context: PromptResolverContext,
): T =>
  typeof value === 'function'
    ? (value as (context: PromptResolverContext) => T)(context)
    : value

export const getPromptTextContent = (
  text: PromptText | null | undefined,
): string => {
  if (!text) {
    return ''
  }
  if (typeof text === 'string') {
    return text
  }
  return text
    .map((segment) => (typeof segment === 'string' ? segment : segment.text))
    .join('')
}

export const getPromptTextIdentity = (
  text: PromptText | null | undefined,
): string => JSON.stringify(text ?? '')

const getScenarioPromptDefinition = (
  runtime: AppRuntimeState,
  promptId: string | null,
): PromptDefinition | null => {
  if (!promptId) {
    return null
  }

  const definition = getRuntimeScenarioDefinition(
    runtime.scenario.session.scenarioId,
  )
  if (
    !definition ||
    (definition.isState && !definition.isState(runtime.scenario.session.state))
  ) {
    return null
  }

  return definition.prompts?.[promptId] ?? null
}

const resolvePrompt = (
  runtime: AppRuntimeState,
  promptId: string | null,
  inputMode: 'desktop' | 'mobile',
): ResolvedPrompt | null => {
  const definition = getScenarioPromptDefinition(runtime, promptId)
  if (!definition) {
    return null
  }

  const context: PromptResolverContext = { inputMode, runtime }
  const presentation = definition.presentation
  const basePrompt = {
    buttons: definition.buttons.map((button) => ({
      action: button.action,
      label: resolvePromptValue(button.label, context),
      tone: button.tone,
    })),
    description: resolvePromptValue(definition.description, context),
    id: definition.id,
    pausesGameplay:
      definition.pausesGameplay ?? definition.presentation.kind === 'blocking',
    title: resolvePromptValue(definition.title, context),
  }

  if (presentation.kind === 'coach') {
    return {
      ...basePrompt,
      kind: 'coach',
      anchor: presentation.anchor
        ? resolvePromptValue(presentation.anchor, context)
        : undefined,
      focusedTouchControl: presentation.focusedTouchControl
        ? resolvePromptValue(presentation.focusedTouchControl, context)
        : undefined,
      focusedHudElement: presentation.focusedHudElement
        ? resolvePromptValue(presentation.focusedHudElement, context)
        : undefined,
      layout: presentation.layout
        ? (resolvePromptValue(presentation.layout, context) ?? 'anchored')
        : 'anchored',
      touchHintTarget: presentation.touchHintTarget
        ? resolvePromptValue(presentation.touchHintTarget, context)
        : undefined,
    }
  }

  return {
    ...basePrompt,
    kind: 'blocking',
  }
}

export const resolveScenarioPrompts = (
  runtime: AppRuntimeState,
  inputMode: 'desktop' | 'mobile',
): ResolvedPromptState => {
  const active = resolvePrompt(
    runtime,
    runtime.scenario.session.promptUi.activePromptId,
    inputMode,
  )
  const replayDefinition = getScenarioPromptDefinition(
    runtime,
    runtime.scenario.session.promptUi.replayPromptId,
  )

  return {
    active,
    replay: replayDefinition
      ? {
          id: replayDefinition.id,
          label:
            resolvePromptValue(
              replayDefinition.shortLabel ?? replayDefinition.title,
              {
                inputMode,
                runtime,
              },
            ) ?? '',
        }
      : null,
  }
}

const clearActivePrompt = (
  runtime: AppRuntimeState,
): ScenarioRuntimeTransition => ({
  promptUi: {
    ...runtime.scenario.session.promptUi,
    activePromptId: null,
  },
})

export const reopenScenarioReplayPrompt = (
  runtime: AppRuntimeState,
): boolean => {
  if (
    runtime.scenario.session.promptUi.activePromptId !== null ||
    runtime.scenario.session.promptUi.replayPromptId === null
  ) {
    return false
  }

  runtime.scenario.session.promptUi = {
    ...runtime.scenario.session.promptUi,
    activePromptId: runtime.scenario.session.promptUi.replayPromptId,
  }
  return true
}

export const dispatchScenarioPromptAction = (
  runtime: AppRuntimeState,
  action: PromptAction,
): {
  effect?: PromptActionEffect
  handled: boolean
  transition?: ScenarioRuntimeTransition | null
} => {
  if (action.kind === 'builtin') {
    const activePromptId = runtime.scenario.session.promptUi.activePromptId
    if (!activePromptId) {
      return { handled: false }
    }

    if (action.id === 'dismiss') {
      return {
        handled: true,
        transition: clearActivePrompt(runtime),
      }
    }

    if (action.id === 'dismiss_to_replay') {
      return {
        handled: true,
        transition: {
          promptUi: {
            activePromptId: null,
            replayPromptId: activePromptId,
          },
        },
      }
    }

    if (action.id === 'start_free_roam') {
      return {
        handled: true,
        effect: 'start-free-roam',
        transition: clearActivePrompt(runtime),
      }
    }

    if (action.id === 'show_reach_moon_highscores') {
      return {
        handled: true,
        effect: 'show-reach-moon-highscores',
        transition: clearActivePrompt(runtime),
      }
    }

    return {
      handled: true,
      effect: 'exit-to-menu',
      transition: clearActivePrompt(runtime),
    }
  }

  const resolvedScene = resolveCurrentScenarioScene(runtime)
  if (!resolvedScene) {
    return { handled: false }
  }

  const actionHandler = resolvedScene.scene.actions?.[action.id]
  if (!actionHandler) {
    return { handled: false }
  }

  return actionHandler({
    runtime,
    state: resolvedScene.state,
  })
}

export const serializePromptAction = (action: PromptAction): string =>
  `${action.kind}:${action.kind === 'builtin' ? action.id : action.id}`

export const parsePromptAction = (
  value: string | undefined,
): PromptAction | null => {
  if (!value) {
    return null
  }

  const separatorIndex = value.indexOf(':')
  if (separatorIndex <= 0) {
    return null
  }

  const kind = value.slice(0, separatorIndex)
  const id = value.slice(separatorIndex + 1)
  if (
    kind === 'builtin' &&
    (id === 'dismiss' ||
      id === 'dismiss_to_replay' ||
      id === 'start_free_roam' ||
      id === 'exit_to_menu' ||
      id === 'show_reach_moon_highscores')
  ) {
    return { kind, id }
  }

  if (kind === 'scenario' && id.length > 0) {
    return { kind, id }
  }

  return null
}
