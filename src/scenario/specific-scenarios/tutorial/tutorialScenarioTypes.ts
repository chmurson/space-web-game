import {
  createScenarioOrbitProgressState,
  type ScenarioOrbitProgressState,
} from '../../scenarioObjectiveProgress'
import type { TutorialOnboardingState } from './tutorialOnboarding/tutorialOnboardingTypes'

export type TutorialScenarioPhase =
  | 'escape-earth'
  | 'reach-moon'
  | 'orbit-moon'
  | 'return-earth'
  | 'orbit-earth'
  | 'complete'

export type TutorialOrbitProgressState = ScenarioOrbitProgressState & {
  orbitAttemptCheckpointCaptured?: boolean
}

export type EscapeEarthTutorialSceneState = {
  onboarding?: TutorialOnboardingState
  phase: 'escape-earth'
}

export type ReachMoonTutorialSceneState = {
  phase: 'reach-moon'
} & TutorialOrbitProgressState

export type OrbitMoonTutorialSceneState = {
  phase: 'orbit-moon'
} & TutorialOrbitProgressState

export type ReturnEarthTutorialSceneState = {
  phase: 'return-earth'
} & TutorialOrbitProgressState

export type OrbitEarthTutorialSceneState = {
  phase: 'orbit-earth'
} & TutorialOrbitProgressState

export type CompleteTutorialSceneState = {
  completedElapsedGameSeconds?: number
  phase: 'complete'
}

export type TutorialScenarioState =
  | EscapeEarthTutorialSceneState
  | ReachMoonTutorialSceneState
  | OrbitMoonTutorialSceneState
  | ReturnEarthTutorialSceneState
  | OrbitEarthTutorialSceneState
  | CompleteTutorialSceneState

export const createOrbitProgressState = (): TutorialOrbitProgressState => ({
  ...createScenarioOrbitProgressState(),
})

export const createInitialTutorialScenarioState =
  (): EscapeEarthTutorialSceneState => ({
    phase: 'escape-earth',
  })

export const isTutorialScenarioState = (
  value: unknown,
): value is TutorialScenarioState => {
  if (!value || typeof value !== 'object' || !('phase' in value)) {
    return false
  }

  return (
    value.phase === 'escape-earth' ||
    value.phase === 'reach-moon' ||
    value.phase === 'orbit-moon' ||
    value.phase === 'return-earth' ||
    value.phase === 'orbit-earth' ||
    value.phase === 'complete'
  )
}
