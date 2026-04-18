import * as THREE from 'three'
import { gameConfig } from '../config/gameConfig'
import type { TrajectoryPredictionSamplingConfig } from '../prediction/trajectoryPrediction'
import {
  createRequestedRuntimeScenario,
  type RuntimeScenarioOptions,
} from '../scenario/runtimeScenario'
import type { GlobalScenarioDirectiveLimits } from '../scenario/scenarioDirectiveTypes'
import { defaultPhysicsEngine, physicsEngines } from '../simulation/physics'
import type { PhysicsEngine } from '../simulation/types'
import { readUserSettings, type UserSettings } from '../userSettingsStorage'
import type { RuntimeScenario } from '../debugScenarioSnapshot'

export type AppMode = 'menu' | 'game'

export type AppConfigContext = {
  initialAppMode: AppMode
  requestedEngine: string
  physicsEngine: PhysicsEngine
  requestedScenarioId: string
  initialScenario: RuntimeScenario
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

export const createAppConfigContext = (): AppConfigContext => {
  const urlParams = new URLSearchParams(window.location.search)
  const initialAppMode: AppMode = urlParams.has('scenario') ? 'game' : 'menu'
  const requestedEngine = urlParams.get('engine') ?? ''
  const physicsEngine = physicsEngines[requestedEngine] ?? defaultPhysicsEngine
  const requestedScenarioId = urlParams.get('scenario') ?? 'earth-moon'
  const initialScenario = createRequestedRuntimeScenario(requestedScenarioId)
  const userSettings = readUserSettings()
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

  const trajectory = {
    defaultCoastPredictionHorizonHours:
      gameConfig.trajectory.horizon.defaultHours,
    minCoastPredictionHorizonHours: gameConfig.trajectory.horizon.minHours,
    maxCoastPredictionHorizonHours: gameConfig.trajectory.horizon.maxHours,
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
    initialScenario,
    userSettings: { ...userSettings },
    controls,
    assistTarget,
    trajectory,
    camera,
    runtimeScenarioOptions,
    globalScenarioDirectiveLimits,
  })
}
