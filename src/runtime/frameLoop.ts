import * as THREE from 'three'

import type { KeyboardInput } from '../input/keyboardInput'
import type { BodyPresentation } from '../presentation/bodyPresentation'
import type { HudPresentation } from '../presentation/hudPresentation'
import type { SpacecraftPresentation } from '../presentation/spacecraftPresentation'
import type { TrajectoryPresentation } from '../presentation/trajectoryPresentation'
import type { RendererProfiler } from '../render/rendererProfiler'
import { syncRuntimeScenarioDirectives } from '../scenario/scenarioDirectives'
import type { GlobalScenarioDirectiveLimits } from '../scenario/scenarioDirectiveTypes'
import { resolveScenarioPrompts } from '../scenario/scenarioPrompts'
import type { GameSceneRefs } from '../scene/createGameScene'
import type { PhysicsEngine } from '../simulation/types'
import { type Ripple, updateRipples } from '../ui/overlayUpdates'
import type { AppRuntimeState } from './appRuntimeState'
import type { GameQueries } from './gameQueries'
import type { RuntimeActions } from './runtimeActions'
import {
  advanceRuntimeScenario,
  applySimulationFrameResult,
} from './runtimeStateTransitions'
import { defaultMaxControlWarp, stepSimulationFrame } from './simulationStep'

export const createFrameLoop = (options: {
  gameScene: GameSceneRefs
  hudPresentation: HudPresentation
  keyboardInput: KeyboardInput
  physicsEngine: PhysicsEngine
  queries: GameQueries
  rendererProfiler: RendererProfiler
  ripples: Ripple[]
  runtime: AppRuntimeState
  runtimeActions: RuntimeActions
  globalScenarioDirectiveLimits: GlobalScenarioDirectiveLimits
  getGameplayPaused?: () => boolean
  crashMenu?: {
    syncState(): void
  }
  topMenu?: {
    syncState(): void
  }
  bodyPresentation: BodyPresentation
  spacecraftPresentation: SpacecraftPresentation
  autopilotRotationRate: number
  timeWarps: number[]
  touchControls?: boolean
  trajectoryPresentation: TrajectoryPresentation
}) => {
  let lastTime = performance.now()
  let smoothedFps = 60
  let smoothedCpuMs = 0

  const refreshTrajectoryPrediction = () => {
    options.trajectoryPresentation.refreshPrediction()
  }

  const animate = (time: number) => {
    const frameStart = performance.now()
    const realDt = Math.min((time - lastTime) / 1000, 0.1)
    lastTime = time
    smoothedFps = THREE.MathUtils.lerp(
      smoothedFps,
      1 / Math.max(realDt, 1 / 240),
      0.12,
    )
    const prompts = resolveScenarioPrompts(
      options.runtime,
      options.touchControls ? 'mobile' : 'desktop',
    )
    const gameplayPaused =
      (prompts.active?.pausesGameplay ?? false) ||
      (options.getGameplayPaused?.() ?? false)

    const isThrusting =
      !gameplayPaused &&
      options.runtime.simulation.state.controls.main > 0 &&
      options.runtime.simulation.state.spacecraft.fuel > 0

    if (!gameplayPaused) {
      const simulationStep = stepSimulationFrame({
        assistMode: options.runtime.simulation.assistMode,
        autopilotRotationRate: options.autopilotRotationRate,
        crashedBodyName: options.runtime.simulation.crashedBodyName,
        getAssistTarget: options.queries.getAssistTarget,
        getAutopilotTurn: options.queries.getAutopilotTurn,
        getCaptureMetrics: options.queries.getCaptureMetrics,
        getCircularizePlan: options.queries.getCircularizePlan,
        keyboardInput: options.keyboardInput,
        maxControlWarp: defaultMaxControlWarp,
        physicsEngine: options.physicsEngine,
        realDt,
        shouldCaptureBurn: options.queries.shouldCaptureBurn,
        state: options.runtime.simulation.state,
        targetHeading: options.runtime.simulation.targetHeading,
        targetHeadingTurn: options.runtime.simulation.targetHeadingTurn ?? null,
        timeWarpIndex: options.runtime.simulation.timeWarpIndex,
        timeWarps: options.timeWarps,
      })
      applySimulationFrameResult(options.runtime, simulationStep)
    }

    advanceRuntimeScenario(
      options.runtime,
      options.globalScenarioDirectiveLimits,
      { shouldAdvance: !gameplayPaused },
    )
    options.runtimeActions.updateCamera()
    updateRipples(options.ripples, realDt, { camera: options.gameScene.camera })
    options.trajectoryPresentation.maybeRefreshPrediction(realDt)

    //todo: those two presentation could simply receive runtime, and we could just iterate over presentations objects here (altogether with trajectory - just need to change creatoin phase)
    options.bodyPresentation.updateVisuals({
      bodies: options.runtime.simulation.state.bodies,
      hiddenBodyIds: options.runtime.scenario.directives.hiddenBodyIds,
      spacecraftPosition: options.runtime.simulation.state.spacecraft.position,
      viewportSize: options.runtime.simulation.viewportSize,
    })

    options.spacecraftPresentation.updateVisuals({
      elapsed: options.runtime.simulation.state.elapsed,
      isThrusting,
      spacecraft: options.runtime.simulation.state.spacecraft,
      spacecraftLabelIntroUntil: options.runtime.ui.spacecraftLabelIntroUntil,
      targetHeading: options.runtime.simulation.targetHeading,
      targetHeadingScreenPosition:
        options.runtime.ui.targetHeadingScreenPosition ?? null,
      targetHeadingWorldPosition:
        options.runtime.ui.targetHeadingWorldPosition ?? null,
      viewportSize: options.runtime.simulation.viewportSize,
    })

    options.trajectoryPresentation.updateVisuals()
    options.hudPresentation.update({ smoothedCpuMs, smoothedFps })
    options.crashMenu?.syncState()
    options.topMenu?.syncState()
    options.rendererProfiler.render(
      options.gameScene.scene,
      options.gameScene.camera,
      options.runtime.debug.performanceDebugEnabled ||
        options.runtime.debug.fpsIndicatorEnabled,
    )

    smoothedCpuMs = THREE.MathUtils.lerp(
      smoothedCpuMs,
      performance.now() - frameStart,
      0.15,
    )
    requestAnimationFrame(animate)
  }

  return {
    refreshTrajectoryPrediction,
    start: () => {
      syncRuntimeScenarioDirectives(
        options.runtime,
        options.globalScenarioDirectiveLimits,
      )
      options.runtimeActions.updateCamera()
      options.bodyPresentation.updateVisuals({
        bodies: options.runtime.simulation.state.bodies,
        hiddenBodyIds: options.runtime.scenario.directives.hiddenBodyIds,
        spacecraftPosition:
          options.runtime.simulation.state.spacecraft.position,
        viewportSize: options.runtime.simulation.viewportSize,
      })
      options.spacecraftPresentation.updateVisuals({
        elapsed: options.runtime.simulation.state.elapsed,
        isThrusting:
          options.runtime.simulation.state.controls.main > 0 &&
          options.runtime.simulation.state.spacecraft.fuel > 0,
        spacecraft: options.runtime.simulation.state.spacecraft,
        spacecraftLabelIntroUntil: options.runtime.ui.spacecraftLabelIntroUntil,
        targetHeading: options.runtime.simulation.targetHeading,
        targetHeadingScreenPosition:
          options.runtime.ui.targetHeadingScreenPosition ?? null,
        targetHeadingWorldPosition:
          options.runtime.ui.targetHeadingWorldPosition ?? null,
        viewportSize: options.runtime.simulation.viewportSize,
      })
      options.hudPresentation.update({ smoothedCpuMs, smoothedFps })
      options.crashMenu?.syncState()
      options.topMenu?.syncState()
      requestAnimationFrame(animate)
    },
  }
}
