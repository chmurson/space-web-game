import type { AppRuntimeState } from '../runtime/appRuntimeState'
import {
  createDefaultScenarioDirectives,
  type RuntimeScenarioDirectives,
  type GlobalScenarioDirectiveLimits,
} from './scenarioDirectiveTypes'
import { getRuntimeScenarioDefinition } from './scenarioRegistry'
import type { ScenarioRuntimeTransition } from './scenarioRuntimeTransition'
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

type CommonScenarioDirectiveState = {
  cameraFollowBodyId?: string
  cameraFollowOffsetX?: number
  cameraFollowOffsetY?: number
  forcedAssistTargetId?: string
  hiddenBodyIds?: string[]
}

const getCommonScenarioDirectiveState = (
  value: ScenarioSessionValue,
): CommonScenarioDirectiveState | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value
}

const getStringArrayValue = (value: string[] | undefined): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []

const getNumberValue = (value: number | undefined): number | null =>
  typeof value === 'number' ? value : null

const getStringValue = (value: string | undefined): string | null =>
  typeof value === 'string' ? value : null

const resolveBaseScenarioDirectives = (
  state: ScenarioSessionValue,
): Pick<
  RuntimeScenarioDirectives,
  | 'cameraFollowBodyId'
  | 'cameraFollowOffset'
  | 'forcedAssistTargetId'
  | 'hiddenBodyIds'
> => {
  const commonState = getCommonScenarioDirectiveState(state)

  if (!commonState) {
    return {
      cameraFollowBodyId: null,
      cameraFollowOffset: { x: 0, y: 0 },
      forcedAssistTargetId: null,
      hiddenBodyIds: [],
    }
  }

  return {
    cameraFollowBodyId: getStringValue(commonState.cameraFollowBodyId),
    cameraFollowOffset: {
      x: getNumberValue(commonState.cameraFollowOffsetX) ?? 0,
      y: getNumberValue(commonState.cameraFollowOffsetY) ?? 0,
    },
    forcedAssistTargetId: getStringValue(commonState.forcedAssistTargetId),
    hiddenBodyIds: getStringArrayValue(commonState.hiddenBodyIds),
  }
}

const genericDirectiveResolver: ScenarioDirectiveResolver = ({ runtime }) => ({
  ...createDefaultScenarioDirectives(),
  ...resolveBaseScenarioDirectives(runtime.scenario.session.state),
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
  runtime.simulation.timeWarpIndex = getConstrainedTimeWarpIndex(
    runtime.simulation.timeWarpIndex,
    limits.timeWarps,
    runtime.scenario.directives.maxTimeWarp,
  )
  runtime.simulation.viewportSize = Math.min(
    runtime.scenario.directives.maxViewportSize ?? limits.maxViewportSize,
    Math.max(
      runtime.scenario.directives.minViewportSize ?? limits.minViewportSize,
      runtime.simulation.viewportSize,
    ),
  )
  runtime.simulation.coastPredictionHorizonHours = Math.min(
    runtime.scenario.directives.maxCoastPredictionHorizonHours ??
      limits.maxCoastPredictionHorizonHours,
    runtime.simulation.coastPredictionHorizonHours,
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

export const applyScenarioRuntimeTransition = (
  runtime: AppRuntimeState,
  limits: GlobalScenarioDirectiveLimits,
  transition: ScenarioRuntimeTransition | null | undefined,
) => {
  if (!transition) {
    return false
  }

  runtime.scenario.session = {
    ...runtime.scenario.session,
    checkpoint:
      transition.checkpoint === undefined
        ? runtime.scenario.session.checkpoint
        : transition.checkpoint,
    completed:
      transition.completed === undefined
        ? runtime.scenario.session.completed
        : transition.completed,
    state:
      transition.nextState === undefined
        ? runtime.scenario.session.state
        : transition.nextState,
  }
  syncRuntimeScenarioDirectives(runtime, limits)
  return true
}

export const updateRuntimeScenario = (
  runtime: AppRuntimeState,
  limits: GlobalScenarioDirectiveLimits,
  options: UpdateRuntimeScenarioOptions = {},
) => {
  const transition =
    (options.shouldAdvance ?? true)
      ? (getRuntimeScenarioDefinition(
          runtime.scenario.session.scenarioId,
        )?.advance?.(runtime) ?? null)
      : null

  if (!applyScenarioRuntimeTransition(runtime, limits, transition)) {
    syncRuntimeScenarioDirectives(runtime, limits)
  }
}
