import type { RuntimeScenario } from '../debugScenarioSnapshot'
import { EARTH_MOON_VIEWPORT_SIZE } from '../domain/viewportPresets'
import type { AppRuntimeState } from '../runtime/appRuntimeState'
import {
  createEarthMoonScenario,
  createMoonCaptureDebugScenario,
} from '../simulation/scenarios/earthMoon'
import type {
  RuntimeScenarioDirectives,
  GlobalScenarioDirectiveLimits,
} from './scenarioDirectiveTypes'
import type { ScenarioRuntimeTransition } from './scenarioRuntimeTransition'
import type { ScenarioSessionValue } from './scenarioSession'
import { registerMenuBackgroundScenario } from './specific-scenarios/menuBackgroundScenario'
import { registerTutorialScenario } from './specific-scenarios/tutorial/tutorialScenario'

export type ScenarioPromptAction = 'exit-to-menu' | 'start-free-roam'

export type ScenarioPromptMode = 'blocking' | 'coach'

export type ScenarioPromptAnchor =
  | 'time-warp-pill'
  | 'speed-pill'
  | 'trajectory'

export type ScenarioTouchHintTarget = 'thrust-zone'

export type ScenarioPromptButton = {
  action?: ScenarioPromptAction
  label: string
}

export type PromptActionEffect = 'start-free-roam' | 'exit-to-menu'

export type PromptAcknowledgeResult = {
  acknowledged: boolean
  effect?: PromptActionEffect
}

export type ScenarioPromptAcknowledgeResult<
  TState extends ScenarioSessionValue = ScenarioSessionValue,
> = PromptAcknowledgeResult & {
  transition?: ScenarioRuntimeTransition<TState> | null
}

export type RuntimePromptContent = {
  anchor?: ScenarioPromptAnchor
  confirmButton?: ScenarioPromptButton
  description: string
  mode: ScenarioPromptMode
  secondaryButton?: ScenarioPromptButton
  touchHintTarget?: ScenarioTouchHintTarget
  title: string
}

/** @deprecated Use RuntimePromptContent instead */
export type ScenarioPromptContent = {
  confirmAction?: ScenarioPromptAction
  confirmLabel: string
  description: string
  secondaryAction?: ScenarioPromptAction
  secondaryLabel?: string
  title: string
}

export type RuntimeScenarioDefinition<
  TState extends ScenarioSessionValue = ScenarioSessionValue,
> = {
  acknowledgePrompt?(
    runtime: AppRuntimeState,
  ): ScenarioPromptAcknowledgeResult<TState>
  advance?(runtime: AppRuntimeState): ScenarioRuntimeTransition<TState> | null
  createScenario(): RuntimeScenario
  getActivePrompt?(
    runtime: AppRuntimeState,
    inputMode: 'desktop' | 'mobile',
  ): RuntimePromptContent | null
  getDirectiveOverrides?(
    state: TState,
    limits: GlobalScenarioDirectiveLimits,
  ): Partial<RuntimeScenarioDirectives>
  getHudContent?(state: TState): { description: string; title: string }
  /** @deprecated Use getActivePrompt instead */
  getPromptContent?(state: TState): ScenarioPromptContent | null
  getReplayPromptContent?(state: TState): ScenarioPromptContent | null
  id: string
  isState?(value: unknown): value is TState
  reopenPrompt?(
    runtime: AppRuntimeState,
  ): ScenarioRuntimeTransition<TState> | null
  shouldAutoRestartOnCrash?(runtime: AppRuntimeState): boolean
}

const runtimeScenarioDefinitions = {
  'earth-moon': {
    id: 'earth-moon',
    createScenario: createEarthMoonScenario,
    getDirectiveOverrides: () => ({
      maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
    }),
  },
  'moon-capture-debug': {
    id: 'moon-capture-debug',
    createScenario: createMoonCaptureDebugScenario,
    getDirectiveOverrides: () => ({
      maxViewportSize: EARTH_MOON_VIEWPORT_SIZE,
    }),
  },
  'menu-background': registerMenuBackgroundScenario(),
  tutorial: registerTutorialScenario(),
} satisfies Record<string, RuntimeScenarioDefinition>

const getRuntimeScenarioPromptContent = (
  runtime: AppRuntimeState,
): ScenarioPromptContent | null => {
  const definition = getRuntimeScenarioDefinition(
    runtime.scenario.session.scenarioId,
  )
  if (!definition?.getPromptContent) {
    return null
  }

  if (
    definition.isState &&
    !definition.isState(runtime.scenario.session.state)
  ) {
    return null
  }

  return definition.getPromptContent(runtime.scenario.session.state)
}

export const getRuntimeScenarioDefinition = (
  scenarioId: string,
): RuntimeScenarioDefinition | null =>
  runtimeScenarioDefinitions[
    scenarioId as keyof typeof runtimeScenarioDefinitions
  ] ?? null

export const getRuntimeActivePrompt = (
  runtime: AppRuntimeState,
  inputMode: 'desktop' | 'mobile',
): RuntimePromptContent | null => {
  const definition = getRuntimeScenarioDefinition(
    runtime.scenario.session.scenarioId,
  )

  if (definition?.getActivePrompt) {
    if (
      definition.isState &&
      !definition.isState(runtime.scenario.session.state)
    ) {
      return null
    }
    return definition.getActivePrompt(runtime, inputMode)
  }

  // Fallback to legacy getPromptContent (blocking mode)
  const legacyContent = getRuntimeScenarioPromptContent(runtime)
  if (legacyContent) {
    return {
      mode: 'blocking',
      title: legacyContent.title,
      description: legacyContent.description,
      confirmButton: legacyContent.confirmLabel
        ? {
            label: legacyContent.confirmLabel,
            action: legacyContent.confirmAction,
          }
        : undefined,
      secondaryButton: legacyContent.secondaryLabel
        ? {
            label: legacyContent.secondaryLabel,
            action: legacyContent.secondaryAction,
          }
        : undefined,
    }
  }

  return null
}

export const acknowledgeRuntimeScenarioPrompt = (
  runtime: AppRuntimeState,
): ScenarioPromptAcknowledgeResult => {
  const definition = getRuntimeScenarioDefinition(
    runtime.scenario.session.scenarioId,
  )
  return definition?.acknowledgePrompt?.(runtime) ?? { acknowledged: false }
}

export const getRuntimeScenarioReplayPromptContent = (
  runtime: AppRuntimeState,
): ScenarioPromptContent | null => {
  const definition = getRuntimeScenarioDefinition(
    runtime.scenario.session.scenarioId,
  )
  if (!definition?.getReplayPromptContent) {
    return null
  }

  if (
    definition.isState &&
    !definition.isState(runtime.scenario.session.state)
  ) {
    return null
  }

  return definition.getReplayPromptContent(runtime.scenario.session.state)
}

export const reopenRuntimeScenarioPrompt = (runtime: AppRuntimeState) => {
  const definition = getRuntimeScenarioDefinition(
    runtime.scenario.session.scenarioId,
  )
  return definition?.reopenPrompt?.(runtime) ?? null
}

export const shouldAutoRestartRuntimeScenarioOnCrash = (
  runtime: AppRuntimeState,
) => {
  const definition = getRuntimeScenarioDefinition(
    runtime.scenario.session.scenarioId,
  )
  return definition?.shouldAutoRestartOnCrash?.(runtime) ?? false
}
