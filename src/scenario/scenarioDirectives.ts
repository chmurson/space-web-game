import type { AppRuntimeState } from '../runtime/appRuntimeState'
import {
  createDefaultScenarioDirectives,
  type RuntimeScenarioDirectives,
  type GlobalScenarioDirectiveLimits,
} from './scenarioDirectiveTypes'
import { getRuntimeScenarioDefinition } from './scenarioRegistry'
import type { ScenarioSessionValue } from './scenarioSession'

type UpdateRuntimeScenarioOptions = {
  shouldAdvance?: boolean
}

type DirectiveContext = {
  limits: GlobalScenarioDirectiveLimits
  runtime: AppRuntimeState
}

type ScenarioDirectiveResolver = (
  context: DirectiveContext,
) => RuntimeScenarioDirectives

const getStringValue = (
  value: ScenarioSessionValue,
  key: string,
): string | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const nestedValue = value[key]
  return typeof nestedValue === 'string' ? nestedValue : null
}

const getStringArrayValue = (
  value: ScenarioSessionValue,
  key: string,
): string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return []
  }

  const nestedValue = value[key]
  return Array.isArray(nestedValue)
    ? nestedValue.filter((entry): entry is string => typeof entry === 'string')
    : []
}

const getNumberValue = (
  value: ScenarioSessionValue,
  key: string,
): number | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const nestedValue = value[key]
  return typeof nestedValue === 'number' ? nestedValue : null
}

const genericDirectiveResolver: ScenarioDirectiveResolver = ({ runtime }) => ({
  ...createDefaultScenarioDirectives(),
  cameraFollowBodyId: getStringValue(
    runtime.scenario.session.state,
    'cameraFollowBodyId',
  ),
  cameraFollowOffset: {
    x:
      getNumberValue(runtime.scenario.session.state, 'cameraFollowOffsetX') ??
      0,
    y:
      getNumberValue(runtime.scenario.session.state, 'cameraFollowOffsetY') ??
      0,
  },
  forcedAssistTargetId: getStringValue(
    runtime.scenario.session.state,
    'forcedAssistTargetId',
  ),
  hiddenBodyIds: getStringArrayValue(
    runtime.scenario.session.state,
    'hiddenBodyIds',
  ),
})

export const resolveRuntimeScenarioDirectives = (
  runtime: AppRuntimeState,
  limits: GlobalScenarioDirectiveLimits,
): RuntimeScenarioDirectives => {
  const baseDirectives = genericDirectiveResolver({ limits, runtime })
  const definition = getRuntimeScenarioDefinition(
    runtime.scenario.session.scenarioId,
  )

  if (
    definition?.getDirectiveOverrides &&
    (!definition.isState || definition.isState(runtime.scenario.session.state))
  ) {
    return {
      ...baseDirectives,
      ...definition.getDirectiveOverrides(
        runtime.scenario.session.state,
        limits,
      ),
    }
  }

  return baseDirectives
}

export const getConstrainedTimeWarpIndex = (
  timeWarpIndex: number,
  timeWarps: number[],
  maxTimeWarp: number | null,
) => {
  if (maxTimeWarp === null) {
    return Math.min(
      Math.max(timeWarpIndex, 0),
      Math.max(0, timeWarps.length - 1),
    )
  }

  const maxAllowedIndex = Math.max(
    0,
    timeWarps.reduce(
      (bestIndex, warp, index) => (warp <= maxTimeWarp ? index : bestIndex),
      -1,
    ),
  )
  return Math.min(Math.max(timeWarpIndex, 0), maxAllowedIndex)
}

export const applyRuntimeScenarioDirectiveConstraints = (
  runtime: AppRuntimeState,
  limits: GlobalScenarioDirectiveLimits,
) => {
  runtime.timeWarpIndex = getConstrainedTimeWarpIndex(
    runtime.timeWarpIndex,
    limits.timeWarps,
    runtime.scenario.directives.maxTimeWarp,
  )
  runtime.viewportSize = Math.min(
    runtime.scenario.directives.maxViewportSize ?? limits.maxViewportSize,
    Math.max(
      runtime.scenario.directives.minViewportSize ?? limits.minViewportSize,
      runtime.viewportSize,
    ),
  )
  runtime.coastPredictionHorizonHours = Math.min(
    runtime.scenario.directives.maxCoastPredictionHorizonHours ??
      limits.maxCoastPredictionHorizonHours,
    runtime.coastPredictionHorizonHours,
  )
}

export const syncRuntimeScenarioDirectives = (
  runtime: AppRuntimeState,
  limits: GlobalScenarioDirectiveLimits,
) => {
  runtime.scenario.directives = resolveRuntimeScenarioDirectives(
    runtime,
    limits,
  )
  applyRuntimeScenarioDirectiveConstraints(runtime, limits)
}

export const updateRuntimeScenario = (
  runtime: AppRuntimeState,
  limits: GlobalScenarioDirectiveLimits,
  options: UpdateRuntimeScenarioOptions = {},
) => {
  if (options.shouldAdvance ?? true) {
    getRuntimeScenarioDefinition(
      runtime.scenario.session.scenarioId,
    )?.advance?.(runtime)
  }

  syncRuntimeScenarioDirectives(runtime, limits)
}
