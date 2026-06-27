import {
  createScenarioFromSnapshot,
  createSnapshotFromState,
  type DebugScenarioSnapshot,
  type RuntimeScenario,
  readDebugScenarioSnapshot,
  writeDebugScenarioSnapshot,
} from '../debugScenarioSnapshot'
import type { AssistTargetSelectionMode } from '../runtime/appRuntimeState'
import { idleControls } from '../simulation/state'
import type { SimulationState } from '../simulation/types'
import type { CameraControlMode } from './scenarioDirectiveTypes'
import { getRuntimeScenarioDefinition } from './scenarioRegistry'
import {
  cloneRuntimeScenarioSession,
  createRuntimeScenarioSession,
} from './scenarioSession'

export type RuntimeScenarioOptions = {
  defaultCoastPredictionHorizonHours: number
  defaultViewportSize: number
  maxCoastPredictionHorizonHours: number
  maxViewportSize: number
  minCoastPredictionHorizonHours: number
  minViewportSize: number
}

export type RuntimeScenarioState = {
  assistTargetIndex?: number
  assistTargetSelectionMode?: AssistTargetSelectionMode
  cameraMode: CameraControlMode
  coastPredictionHorizonHours: number
  scenarioSession: ReturnType<typeof createRuntimeScenarioSession>
  state: SimulationState
  viewportSize: number
}

export type LoadedDebugRuntimeScenario = {
  scenario: RuntimeScenario
  runtimeState: RuntimeScenarioState
  snapshot: DebugScenarioSnapshot
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const getScenarioAssistTargetIndex = (scenario: RuntimeScenario) => {
  const assistTargetIndex = scenario.assistTargetIndex
  return typeof assistTargetIndex === 'number' &&
    Number.isInteger(assistTargetIndex) &&
    scenario.bodies.length > 0
    ? clamp(assistTargetIndex, 0, scenario.bodies.length - 1)
    : undefined
}

export const createRequestedRuntimeScenario = (
  requestedScenario: string,
): RuntimeScenario => {
  const definition = getRuntimeScenarioDefinition(requestedScenario)
  if (definition) {
    return definition.createScenario()
  }

  if (requestedScenario === 'debug-snapshot') {
    const snapshot = readDebugScenarioSnapshot()
    if (snapshot) {
      return createScenarioFromSnapshot(snapshot)
    }
  }

  const earthMoonScenario =
    getRuntimeScenarioDefinition('earth-moon')?.createScenario()

  if (!earthMoonScenario) {
    throw new Error('earth-moon scenario not found')
  }
  return earthMoonScenario
}

export const createRuntimeScenarioStateFromId = (
  scenarioId: string,
  options: RuntimeScenarioOptions,
): RuntimeScenarioState =>
  createRuntimeScenarioState(
    createRequestedRuntimeScenario(scenarioId),
    options,
  )

export const createRuntimeScenarioState = (
  scenario: RuntimeScenario,
  options: RuntimeScenarioOptions,
): RuntimeScenarioState => ({
  assistTargetIndex: getScenarioAssistTargetIndex(scenario),
  assistTargetSelectionMode: scenario.assistTargetSelectionMode,
  cameraMode: scenario.cameraMode ?? 'centered',
  coastPredictionHorizonHours: clamp(
    scenario.coastPredictionHorizonHours ??
      options.defaultCoastPredictionHorizonHours,
    options.minCoastPredictionHorizonHours,
    options.maxCoastPredictionHorizonHours,
  ),
  scenarioSession: scenario.scenarioSession
    ? cloneRuntimeScenarioSession(scenario.scenarioSession)
    : createRuntimeScenarioSession(scenario.id),
  state: {
    elapsed: scenario.elapsed ?? 0,
    bodies: scenario.bodies,
    spacecraft: scenario.spacecraft,
    controls: idleControls(),
  },
  viewportSize: clamp(
    scenario.viewportSize ?? options.defaultViewportSize,
    options.minViewportSize,
    options.maxViewportSize,
  ),
})

export const saveRuntimeDebugSnapshot = (
  state: SimulationState,
  options: {
    coastPredictionHorizonHours: number
    assistTargetIndex?: number
    assistTargetSelectionMode?: AssistTargetSelectionMode
    scenarioSession: RuntimeScenarioState['scenarioSession']
    viewportSize: number
  },
) => {
  try {
    writeDebugScenarioSnapshot(createSnapshotFromState(state, options))
    return true
  } catch {
    return false
  }
}

export const loadDebugRuntimeScenario = (
  options: RuntimeScenarioOptions,
): LoadedDebugRuntimeScenario | null => {
  const snapshot = readDebugScenarioSnapshot()
  if (!snapshot) {
    return null
  }

  const scenario = createScenarioFromSnapshot(snapshot)

  return {
    scenario,
    runtimeState: createRuntimeScenarioState(scenario, options),
    snapshot,
  }
}
