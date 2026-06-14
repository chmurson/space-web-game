import type { AppRuntimeState } from '../runtime/appRuntimeState'
import {
  type CameraControlMode,
  createDefaultScenarioDirectives,
  type GlobalScenarioDirectiveLimits,
  type RuntimeScenarioDirectives,
} from './scenarioDirectiveTypes'
import { resolveCurrentScenarioScene } from './scenarioScenes'
import type { ScenarioSessionValue } from './scenarioSession'

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
  cameraMode?: CameraControlMode
  cameraModeChangesLocked?: boolean
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

const getBooleanValue = (value: boolean | undefined): boolean =>
  typeof value === 'boolean' ? value : false

const getCameraModeValue = (
  value: CameraControlMode | undefined,
): CameraControlMode | null =>
  value === 'centered' || value === 'unlocked' ? value : null

const resolveBaseScenarioDirectives = (
  state: ScenarioSessionValue,
): Pick<
  RuntimeScenarioDirectives,
  | 'cameraFollowBodyId'
  | 'cameraFollowOffset'
  | 'cameraMode'
  | 'cameraModeChangesLocked'
  | 'forcedAssistTargetId'
  | 'hiddenBodyIds'
> => {
  const commonState = getCommonScenarioDirectiveState(state)

  if (!commonState) {
    return {
      cameraFollowBodyId: null,
      cameraFollowOffset: { x: 0, y: 0 },
      cameraMode: null,
      cameraModeChangesLocked: false,
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
    cameraMode: getCameraModeValue(commonState.cameraMode),
    cameraModeChangesLocked: getBooleanValue(
      commonState.cameraModeChangesLocked,
    ),
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
  const resolvedScene = resolveCurrentScenarioScene(runtime)

  if (resolvedScene?.scene.directives) {
    return {
      ...baseDirectives,
      ...resolvedScene.scene.directives({
        limits,
        state: resolvedScene.state,
      }),
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
  const forcedCameraMode = runtime.scenario.directives.cameraMode
  if (forcedCameraMode && forcedCameraMode !== runtime.ui.camera.mode) {
    runtime.ui.camera.mode = forcedCameraMode
    if (forcedCameraMode === 'unlocked') {
      runtime.ui.camera.panOffset = {
        ...runtime.simulation.state.spacecraft.position,
      }
    }
  }
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
