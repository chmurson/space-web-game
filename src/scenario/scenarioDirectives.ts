import type { AppRuntimeState } from '../runtime/appRuntimeState'
import {
  type CameraFollowSubject,
  type CameraViewMode,
  createDefaultScenarioDirectives,
  type GlobalScenarioDirectiveLimits,
  isCameraFollowSubject,
  isCameraViewMode,
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
  cameraControlsLocked?: boolean
  cameraFollow?: CameraFollowSubject
  cameraFollowBodyId?: string
  cameraFollowOffsetX?: number
  cameraFollowOffsetY?: number
  cameraMode?: 'centered' | 'target' | 'unlocked'
  cameraModeChangesLocked?: boolean
  cameraView?: CameraViewMode
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

const getCameraFollowValue = (
  value: CameraFollowSubject | undefined,
): CameraFollowSubject | null => (isCameraFollowSubject(value) ? value : null)

const getCameraViewValue = (
  value: CameraViewMode | undefined,
): CameraViewMode | null => (isCameraViewMode(value) ? value : null)

const getLegacyCameraFollow = (
  cameraMode: CommonScenarioDirectiveState['cameraMode'],
): CameraFollowSubject | null => {
  if (cameraMode === 'centered') {
    return 'spacecraft'
  }
  if (cameraMode === 'target') {
    return 'target'
  }

  return null
}

const getLegacyCameraView = (
  cameraMode: CommonScenarioDirectiveState['cameraMode'],
): CameraViewMode | null => {
  if (cameraMode === 'unlocked') {
    return 'free'
  }
  if (cameraMode === 'centered' || cameraMode === 'target') {
    return 'locked'
  }

  return null
}

const resolveBaseScenarioDirectives = (
  state: ScenarioSessionValue,
): Pick<
  RuntimeScenarioDirectives,
  | 'cameraControlsLocked'
  | 'cameraFollow'
  | 'cameraFollowBodyId'
  | 'cameraFollowOffset'
  | 'cameraView'
  | 'forcedAssistTargetId'
  | 'hiddenBodyIds'
> => {
  const commonState = getCommonScenarioDirectiveState(state)

  if (!commonState) {
    return {
      cameraControlsLocked: false,
      cameraFollow: null,
      cameraFollowBodyId: null,
      cameraFollowOffset: { x: 0, y: 0 },
      cameraView: null,
      forcedAssistTargetId: null,
      hiddenBodyIds: [],
    }
  }

  const legacyCameraMode = commonState.cameraMode

  return {
    cameraControlsLocked: getBooleanValue(
      commonState.cameraControlsLocked ?? commonState.cameraModeChangesLocked,
    ),
    cameraFollow:
      getCameraFollowValue(commonState.cameraFollow) ??
      getLegacyCameraFollow(legacyCameraMode),
    cameraFollowBodyId: getStringValue(commonState.cameraFollowBodyId),
    cameraFollowOffset: {
      x: getNumberValue(commonState.cameraFollowOffsetX) ?? 0,
      y: getNumberValue(commonState.cameraFollowOffsetY) ?? 0,
    },
    cameraView:
      getCameraViewValue(commonState.cameraView) ??
      getLegacyCameraView(legacyCameraMode),
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
  const forcedCameraFollow = runtime.scenario.directives.cameraFollow
  if (forcedCameraFollow) {
    runtime.ui.camera.follow = forcedCameraFollow
  }
  const forcedCameraView = runtime.scenario.directives.cameraControlsLocked
    ? 'locked'
    : runtime.scenario.directives.cameraView
  if (forcedCameraView) {
    runtime.ui.camera.view = forcedCameraView
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
