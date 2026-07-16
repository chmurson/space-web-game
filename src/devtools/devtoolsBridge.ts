import type { AppMode } from '../app/createAppConfigContext'
import { getCaptureMetricsForState } from '../assist/orbitalAssist'
import { isUIUserAction, type UIUserAction } from '../input/uiUserActions'
import {
  getCoastTrajectoryPredictionMaxIntegrationStepSeconds,
  getTrajectoryPredictionConfig,
  type TrajectoryPredictionSamplingConfig,
} from '../prediction/trajectoryPrediction'
import type {
  AppRuntimeDebugSlice,
  AppRuntimeState,
} from '../runtime/appRuntimeState'
import type { RuntimeActions } from '../runtime/runtimeActions'
import type { TrajectoryPredictionDiagnostics } from '../runtime/trajectoryPredictionRuntime'
import { getConstrainedTimeWarpIndex } from '../scenario/scenarioDirectives'
import {
  type CameraControlMode,
  isCameraControlMode,
} from '../scenario/scenarioDirectiveTypes'
import type { Body, ControlInput, Spacecraft } from '../simulation/types'
import type { Vec2 } from '../simulation/vector'

const devtoolsBridgeName = '__SPACE_WEB_GAME_DEVTOOLS__'
const requestMessageType = 'space-web-game-devtools:request'
const responseMessageType = 'space-web-game-devtools:response'

type WritableDebugFlag = Exclude<
  keyof AppRuntimeDebugSlice,
  'debugSnapshotStatus'
>

type DevtoolsBridgeOptions = {
  dispatchRuntimeAction(action: UIUserAction): void
  getAppMode(): AppMode
  getTrajectoryPredictionDiagnostics(): TrajectoryPredictionDiagnostics
  maxPredictionLoopRevolutions: number
  predictionSampling: TrajectoryPredictionSamplingConfig
  runtime: AppRuntimeState
  runtimeActions: Pick<RuntimeActions, 'setCameraMode'>
  setTrajectoryPredictionFarCoalescingMinIntervalOverrideSeconds(
    value: number | null,
  ): boolean
  timeWarps: number[]
}

type DevtoolsVec2 = {
  x: number
  y: number
}

type DevtoolsBodySnapshot = {
  color: string
  id: string
  mass: number
  name: string
  position: DevtoolsVec2
  radius: number
  speed: number
  velocity: DevtoolsVec2
}

type DevtoolsSpacecraftSnapshot = Spacecraft & {
  position: DevtoolsVec2
  speed: number
  velocity: DevtoolsVec2
}

export type SpaceGameDevtoolsSnapshot = {
  appMode: AppMode
  capturedAt: number
  camera: {
    mode: CameraControlMode
    panOffset: DevtoolsVec2
    targetHeadingScreenPosition: DevtoolsVec2 | null
    targetHeadingSelectionEpoch: number
    targetHeadingWorldPosition: DevtoolsVec2 | null
  }
  debug: AppRuntimeDebugSlice
  protocolVersion: 1
  scenario: {
    completed: boolean
    description: string
    directives: {
      cameraMode: CameraControlMode | null
      cameraModeChangesLocked: boolean
      forcedAssistTargetId: string | null
      hiddenBodyIds: string[]
      hiddenUIElements: string[]
      maxCoastPredictionHorizonHours: number | null
      maxTimeWarp: number | null
      maxViewportSize: number | null
      minViewportSize: number | null
    }
    hasCheckpoint: boolean
    promptUi: {
      activePromptId: string | null
      replayPromptId: string | null
    }
    scenarioId: string
    state: unknown
    title: string
  }
  simulation: {
    assistMode: string
    assistTarget: Pick<DevtoolsBodySnapshot, 'id' | 'name'> | null
    assistTargetIndex: number
    bodies: DevtoolsBodySnapshot[]
    coastPredictionHorizonHours: number
    controls: ControlInput
    crashedBodyName: string | null
    elapsed: number
    predictionSampling: TrajectoryPredictionSamplingConfig & {
      currentMaxIntegrationStepSeconds: number
      currentStepSeconds: number
    }
    trajectoryPrediction: TrajectoryPredictionDiagnostics
    spacecraft: DevtoolsSpacecraftSnapshot
    targetHeading: number | null
    timeWarp: number
    timeWarpIndex: number
    timeWarps: number[]
    viewportSize: number
  }
}

export type DevtoolsBridgeRequest =
  | { type: 'dispatch-ui-action'; action: UIUserAction }
  | { type: 'get-snapshot' }
  | { type: 'set-camera-mode'; mode: CameraControlMode }
  | { type: 'set-debug-flag'; flag: WritableDebugFlag; value: boolean }
  | {
      type: 'set-far-coalescing-min-interval-override'
      value: number | null
    }
  | { type: 'set-time-warp-index'; index: number }

export type DevtoolsBridgeResponse =
  | {
      ok: true
      message?: string
      snapshot: SpaceGameDevtoolsSnapshot
    }
  | {
      ok: false
      error: string
      snapshot: SpaceGameDevtoolsSnapshot
    }

export type SpaceGameDevtoolsBridge = {
  getSnapshot(): SpaceGameDevtoolsSnapshot
  handleRequest(request: unknown): DevtoolsBridgeResponse
  protocolVersion: 1
}

declare global {
  interface Window {
    __SPACE_WEB_GAME_DEVTOOLS__?: SpaceGameDevtoolsBridge
  }
}

const debugFlagActions = {
  debugModeEnabled: 'toggleDebugMode',
  debugNoGravityEnabled: 'toggleNoGravityDebug',
  fpsIndicatorEnabled: 'toggleFpsIndicator',
} satisfies Record<WritableDebugFlag, UIUserAction>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isWritableDebugFlag = (value: unknown): value is WritableDebugFlag =>
  typeof value === 'string' && value in debugFlagActions

const cloneVec2 = (vector: Vec2): DevtoolsVec2 => ({
  x: vector.x,
  y: vector.y,
})

const getSpeed = (vector: Vec2) => Math.hypot(vector.x, vector.y)

const createBodySnapshot = (body: Body): DevtoolsBodySnapshot => ({
  color: body.color,
  id: body.id,
  mass: body.mass,
  name: body.name,
  position: cloneVec2(body.position),
  radius: body.radius,
  speed: getSpeed(body.velocity),
  velocity: cloneVec2(body.velocity),
})

const createSpacecraftSnapshot = (
  spacecraft: Spacecraft,
): DevtoolsSpacecraftSnapshot => ({
  ...spacecraft,
  position: cloneVec2(spacecraft.position),
  speed: getSpeed(spacecraft.velocity),
  velocity: cloneVec2(spacecraft.velocity),
})

const cloneScenarioState = (state: unknown): unknown => {
  try {
    return structuredClone(state)
  } catch {
    return null
  }
}

export const createDevtoolsSnapshot = (
  options: Pick<
    DevtoolsBridgeOptions,
    | 'getAppMode'
    | 'getTrajectoryPredictionDiagnostics'
    | 'maxPredictionLoopRevolutions'
    | 'predictionSampling'
    | 'runtime'
    | 'timeWarps'
  >,
): SpaceGameDevtoolsSnapshot => {
  const { runtime, timeWarps } = options
  const bodies = runtime.simulation.state.bodies.map(createBodySnapshot)
  const assistTargetBody =
    runtime.simulation.state.bodies[runtime.simulation.assistTargetIndex]
  const assistTarget = bodies[runtime.simulation.assistTargetIndex]
  const predictionConfig = getTrajectoryPredictionConfig(
    runtime.simulation.coastPredictionHorizonHours * 60 * 60,
    options.predictionSampling,
    options.maxPredictionLoopRevolutions,
  )
  const coastMaxIntegrationStepSeconds = assistTargetBody
    ? getCoastTrajectoryPredictionMaxIntegrationStepSeconds(
        runtime.simulation.state,
        assistTargetBody,
        predictionConfig,
        getCaptureMetricsForState(runtime.simulation.state, assistTargetBody)
          .specificEnergy < 0,
      )
    : predictionConfig.maxIntegrationStepSeconds

  return {
    appMode: options.getAppMode(),
    capturedAt: performance.now(),
    camera: {
      mode: runtime.ui.camera.mode,
      panOffset: cloneVec2(runtime.ui.camera.panOffset),
      targetHeadingScreenPosition: runtime.ui.targetHeadingScreenPosition
        ? cloneVec2(runtime.ui.targetHeadingScreenPosition)
        : null,
      targetHeadingSelectionEpoch: runtime.ui.targetHeadingSelectionEpoch,
      targetHeadingWorldPosition: runtime.ui.targetHeadingWorldPosition
        ? cloneVec2(runtime.ui.targetHeadingWorldPosition)
        : null,
    },
    debug: { ...runtime.debug },
    protocolVersion: 1,
    scenario: {
      completed: runtime.scenario.session.completed,
      description: runtime.scenario.metadata.description,
      directives: {
        cameraMode: runtime.scenario.directives.cameraMode,
        cameraModeChangesLocked:
          runtime.scenario.directives.cameraModeChangesLocked,
        forcedAssistTargetId: runtime.scenario.directives.forcedAssistTargetId,
        hiddenBodyIds: [...runtime.scenario.directives.hiddenBodyIds],
        hiddenUIElements: [
          ...runtime.scenario.directives.hiddenUIElements.values(),
        ],
        maxCoastPredictionHorizonHours:
          runtime.scenario.directives.maxCoastPredictionHorizonHours,
        maxTimeWarp: runtime.scenario.directives.maxTimeWarp,
        maxViewportSize: runtime.scenario.directives.maxViewportSize,
        minViewportSize: runtime.scenario.directives.minViewportSize,
      },
      hasCheckpoint: runtime.scenario.session.checkpoint !== null,
      promptUi: { ...runtime.scenario.session.promptUi },
      scenarioId: runtime.scenario.session.scenarioId,
      state: cloneScenarioState(runtime.scenario.session.state),
      title: runtime.scenario.metadata.title,
    },
    simulation: {
      assistMode: runtime.simulation.assistMode,
      assistTarget: assistTarget
        ? { id: assistTarget.id, name: assistTarget.name }
        : null,
      assistTargetIndex: runtime.simulation.assistTargetIndex,
      bodies,
      coastPredictionHorizonHours:
        runtime.simulation.coastPredictionHorizonHours,
      controls: { ...runtime.simulation.state.controls },
      crashedBodyName: runtime.simulation.crashedBodyName,
      elapsed: runtime.simulation.state.elapsed,
      predictionSampling: {
        ...options.predictionSampling,
        currentMaxIntegrationStepSeconds: coastMaxIntegrationStepSeconds,
        currentStepSeconds: predictionConfig.stepSeconds,
      },
      trajectoryPrediction: options.getTrajectoryPredictionDiagnostics(),
      spacecraft: createSpacecraftSnapshot(runtime.simulation.state.spacecraft),
      targetHeading: runtime.simulation.targetHeading,
      timeWarp: timeWarps[runtime.simulation.timeWarpIndex] ?? 1,
      timeWarpIndex: runtime.simulation.timeWarpIndex,
      timeWarps: [...timeWarps],
      viewportSize: runtime.simulation.viewportSize,
    },
  }
}

export const createDevtoolsBridge = (
  options: DevtoolsBridgeOptions,
): SpaceGameDevtoolsBridge => {
  const getSnapshot = () => createDevtoolsSnapshot(options)
  const ok = (message?: string): DevtoolsBridgeResponse => ({
    ok: true,
    ...(message ? { message } : {}),
    snapshot: getSnapshot(),
  })
  const fail = (error: string): DevtoolsBridgeResponse => ({
    error,
    ok: false,
    snapshot: getSnapshot(),
  })

  const handleSetDebugFlag = (
    flag: WritableDebugFlag,
    value: boolean,
  ): DevtoolsBridgeResponse => {
    if (options.runtime.debug[flag] === value) {
      return ok(`${flag} already ${value ? 'enabled' : 'disabled'}`)
    }

    options.dispatchRuntimeAction(debugFlagActions[flag])

    if (options.runtime.debug[flag] !== value) {
      return fail(
        `unable to update ${flag} while app mode is ${options.getAppMode()}`,
      )
    }

    return ok(`${flag} ${value ? 'enabled' : 'disabled'}`)
  }

  return {
    getSnapshot,
    handleRequest: (request: unknown) => {
      if (!isRecord(request) || typeof request.type !== 'string') {
        return fail('request must be an object with a string type')
      }

      if (request.type === 'get-snapshot') {
        return ok()
      }

      if (request.type === 'dispatch-ui-action') {
        if (!isUIUserAction(request.action)) {
          return fail('dispatch-ui-action requires a known UI action')
        }

        options.dispatchRuntimeAction(request.action)
        return ok(`dispatched ${request.action}`)
      }

      if (request.type === 'set-time-warp-index') {
        if (
          typeof request.index !== 'number' ||
          !Number.isInteger(request.index)
        ) {
          return fail('set-time-warp-index requires an integer index')
        }

        const requestedIndex = request.index
        const constrainedIndex = getConstrainedTimeWarpIndex(
          requestedIndex,
          options.timeWarps,
          options.runtime.scenario.directives.maxTimeWarp,
        )
        options.runtime.simulation.timeWarpIndex = constrainedIndex
        return ok(
          constrainedIndex === requestedIndex
            ? `time warp set to index ${constrainedIndex}`
            : `time warp constrained to index ${constrainedIndex}`,
        )
      }

      if (request.type === 'set-camera-mode') {
        if (!isCameraControlMode(request.mode)) {
          return fail('set-camera-mode requires centered, unlocked, or target')
        }

        return options.runtimeActions.setCameraMode(request.mode)
          ? ok(`camera mode set to ${request.mode}`)
          : fail('camera mode change is locked by the current scenario')
      }

      if (request.type === 'set-debug-flag') {
        if (!isWritableDebugFlag(request.flag)) {
          return fail('set-debug-flag requires a writable debug flag')
        }
        if (typeof request.value !== 'boolean') {
          return fail('set-debug-flag requires a boolean value')
        }

        return handleSetDebugFlag(request.flag, request.value)
      }

      if (request.type === 'set-far-coalescing-min-interval-override') {
        if (
          request.value !== null &&
          (typeof request.value !== 'number' ||
            !Number.isFinite(request.value) ||
            request.value < 0)
        ) {
          return fail(
            'set-far-coalescing-min-interval-override requires null or a non-negative number',
          )
        }

        return options.setTrajectoryPredictionFarCoalescingMinIntervalOverrideSeconds(
          request.value,
        )
          ? ok(
              request.value === null
                ? 'far coalescing override disabled'
                : `far coalescing override set to ${request.value}s`,
            )
          : fail('unable to update far coalescing override')
      }

      return fail(`unknown request type: ${request.type}`)
    },
    protocolVersion: 1,
  }
}

const isBridgeRequestMessage = (
  value: unknown,
): value is {
  id?: unknown
  request: unknown
  type: typeof requestMessageType
} => isRecord(value) && value.type === requestMessageType && 'request' in value

const bindWindowMessageProtocol = (bridge: SpaceGameDevtoolsBridge) => {
  window.addEventListener('message', (event) => {
    if (event.source !== window || !isBridgeRequestMessage(event.data)) {
      return
    }

    window.postMessage(
      {
        id: event.data.id,
        response: bridge.handleRequest(event.data.request),
        type: responseMessageType,
      },
      window.location.origin,
    )
  })
}

const readLocalStorageFlag = () => {
  try {
    return window.localStorage.getItem('space-web-game.devtools') === '1'
  } catch {
    return false
  }
}

export const shouldInstallDevtoolsBridge = () => {
  if (typeof window === 'undefined') {
    return false
  }

  if (import.meta.env.DEV) {
    return true
  }

  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.has('devtools') || readLocalStorageFlag()
}

export const installDevtoolsBridge = (
  options: DevtoolsBridgeOptions,
): SpaceGameDevtoolsBridge | null => {
  if (!shouldInstallDevtoolsBridge()) {
    return null
  }

  const bridge = createDevtoolsBridge(options)
  window[devtoolsBridgeName] = bridge
  bindWindowMessageProtocol(bridge)
  return bridge
}
