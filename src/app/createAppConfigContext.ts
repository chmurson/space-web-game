import * as THREE from 'three'
import { gameConfig } from '../config/gameConfig'
import type {
  TrajectoryPredictionImplementation,
  TrajectoryPredictionSamplingConfig,
} from '../prediction/trajectoryPrediction'
import type { RuntimeScenarioOptions } from '../scenario/runtimeScenario'
import type { GlobalScenarioDirectiveLimits } from '../scenario/scenarioDirectiveTypes'
import { physicsEngines, resolvePhysicsEngine } from '../simulation/physics'
import type { PhysicsEngine } from '../simulation/types'
import {
  readUserSettings,
  type TouchControlSide,
  type TouchTrajectoryControlState,
  type UserSettings,
} from '../userSettingsStorage'
import type { DeveloperFeatureFlags } from './developerFeatureFlags'

export type AppMode = 'menu' | 'game'

export type AppConfigContext = {
  initialAppMode: AppMode
  requestedEngine: string
  physicsEngine: PhysicsEngine
  requestedScenarioId: string
  featureFlags: DeveloperFeatureFlags
  userSettings: UserSettings
  controls: {
    timeWarps: number[]
    autopilotRotationRate: number
  }
  assistTarget: {
    autoSelectNearestSurface: boolean
    switchRangeMultiplier: number
  }
  trajectory: {
    defaultCoastPredictionHorizonHours: number
    minCoastPredictionHorizonHours: number
    maxCoastPredictionHorizonHours: number
    predictionImplementation: TrajectoryPredictionImplementation
    predictionSampling: TrajectoryPredictionSamplingConfig
    maxPredictionLoopRevolutions: number
    rendering: typeof gameConfig.trajectory.rendering
  }
  camera: {
    distance: number
    elevation: number
    defaultViewport: number
    minViewport: number
    maxViewport: number
    spacecraftModelZoomThreshold: number
  }
  runtimeScenarioOptions: RuntimeScenarioOptions
  globalScenarioDirectiveLimits: GlobalScenarioDirectiveLimits
}

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value
  }

  Object.freeze(value)

  for (const nestedValue of Object.values(value)) {
    deepFreeze(nestedValue)
  }

  return value
}

const parseTouchControlSideOverride = (
  value: string | null,
): TouchControlSide | null =>
  value === 'left' || value === 'right' ? value : null

const parseTouchTrajectoryControlStateOverride = (
  value: string | null,
): TouchTrajectoryControlState | null =>
  value === 'hidden' ? value : parseTouchControlSideOverride(value)

export const createAppConfigContext = (): AppConfigContext => {
  const urlParams = new URLSearchParams(window.location.search)
  const initialAppMode: AppMode = urlParams.has('scenario') ? 'game' : 'menu'
  const requestedEngine = urlParams.get('engine') ?? ''
  const physicsEngine = resolvePhysicsEngine(requestedEngine)
  const keplerEngineSelected = physicsEngine === physicsEngines.kepler
  const featureFlags = {
    noHorizonLimit: urlParams.get('nohiroznlimit') === '1',
  }
  const requestedScenarioParam = urlParams.get('scenario')
  const requestedScenarioId = requestedScenarioParam ?? 'earth-moon'
  const storedUserSettings = readUserSettings()
  const userSettings: UserSettings = {
    ...storedUserSettings,
    touchTargetControlSide:
      parseTouchControlSideOverride(urlParams.get('touchTargetSide')) ??
      storedUserSettings.touchTargetControlSide,
    touchTrajectoryControlSide:
      parseTouchTrajectoryControlStateOverride(
        urlParams.get('touchTrajectorySide'),
      ) ?? storedUserSettings.touchTrajectoryControlSide,
    touchWarpControlSide:
      parseTouchControlSideOverride(urlParams.get('touchWarpSide')) ??
      storedUserSettings.touchWarpControlSide,
  }
  const defaultViewport = gameConfig.camera.viewport.default
  const minViewport = defaultViewport / gameConfig.camera.viewport.minDivisor
  const maxViewport = gameConfig.camera.viewport.max

  const controls = {
    timeWarps: [...gameConfig.controls.timeWarps],
    autopilotRotationRate: gameConfig.controls.autopilotRotationRate,
  }

  const assistTarget = {
    autoSelectNearestSurface: gameConfig.assistTarget.autoSelectNearestSurface,
    switchRangeMultiplier: gameConfig.assistTarget.switchRangeMultiplier,
  }

  const predictionImplementation: TrajectoryPredictionImplementation =
    keplerEngineSelected ? 'kepler' : 'euler'

  const trajectory = {
    defaultCoastPredictionHorizonHours:
      gameConfig.trajectory.horizon.defaultHours,
    minCoastPredictionHorizonHours: gameConfig.trajectory.horizon.minHours,
    maxCoastPredictionHorizonHours: featureFlags.noHorizonLimit
      ? gameConfig.trajectory.horizon.maxHours
      : gameConfig.trajectory.horizon.defaultMaxHours,
    predictionImplementation,
    predictionSampling: { ...gameConfig.trajectory.sampling },
    maxPredictionLoopRevolutions: gameConfig.trajectory.loopTrim.maxRevolutions,
    rendering: { ...gameConfig.trajectory.rendering },
  }

  const camera = {
    distance: gameConfig.camera.distance,
    elevation: THREE.MathUtils.degToRad(gameConfig.camera.elevationDegrees),
    defaultViewport,
    minViewport,
    maxViewport,
    spacecraftModelZoomThreshold:
      gameConfig.camera.spacecraftModelZoomThreshold,
  }

  const runtimeScenarioOptions: RuntimeScenarioOptions = {
    defaultCoastPredictionHorizonHours:
      trajectory.defaultCoastPredictionHorizonHours,
    defaultViewportSize: camera.defaultViewport,
    maxCoastPredictionHorizonHours: trajectory.maxCoastPredictionHorizonHours,
    maxViewportSize: camera.maxViewport,
    minCoastPredictionHorizonHours: trajectory.minCoastPredictionHorizonHours,
    minViewportSize: camera.minViewport,
  }
  const globalScenarioDirectiveLimits: GlobalScenarioDirectiveLimits = {
    defaultViewportSize: camera.defaultViewport,
    maxCoastPredictionHorizonHours: trajectory.maxCoastPredictionHorizonHours,
    maxViewportSize: camera.maxViewport,
    minViewportSize: camera.minViewport,
    timeWarps: controls.timeWarps,
  }

  return deepFreeze({
    initialAppMode,
    requestedEngine,
    physicsEngine,
    requestedScenarioId,
    featureFlags,
    userSettings: { ...userSettings },
    controls,
    assistTarget,
    trajectory,
    camera,
    runtimeScenarioOptions,
    globalScenarioDirectiveLimits,
  })
}
