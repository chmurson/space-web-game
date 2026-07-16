import * as THREE from 'three'

import type { KeyboardInput } from '../input/keyboardInput'
import type { PointerCameraInput } from '../input/pointerCameraInput'
import { createBodyDistanceContext } from '../presentation/bodyDistanceContext'
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
import type { FpsMeterFrameSample } from '../ui/hudText'
import { type Ripple, updateRipples } from '../ui/overlayUpdates'
import type { AppRuntimeState } from './appRuntimeState'
import { createBrowserGcProbe } from './browserGcProbe'
import type { GameQueries } from './gameQueries'
import type { RuntimeActions } from './runtimeActions'
import {
  advanceRuntimeScenario,
  applySimulationFrameResult,
} from './runtimeStateTransitions'
import { defaultMaxControlWarp, stepSimulationFrame } from './simulationStep'
import { createTrajectoryPredictionRuntime } from './trajectoryPredictionRuntime'

export const createFrameLoop = (options: {
  gameScene: GameSceneRefs
  hudPresentation: HudPresentation
  keyboardInput: KeyboardInput
  pointerCameraInput?: Pick<PointerCameraInput, 'updateEdgeScroll'>
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
  getFpsMeterVisible?: () => boolean
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
  let meterFps = 60
  let smoothedCpuMs = 0
  const scenarioTrajectoryPredictionRuntime =
    createTrajectoryPredictionRuntime()
  let scenarioTrajectoryPredictionHorizonHours: number | null = null
  let scenarioTrajectoryPredictionInitialized = false
  const browserGcProbe = createBrowserGcProbe()
  const fpsFrameSamples: FpsMeterFrameSample[] = []
  const fpsMeterFpsWindowMs = 1_000
  const fpsFrameSampleWindowMs = 5_000

  const syncDebugSceneVisibility = () => {
    options.gameScene.debugGrid.visible = options.runtime.debug.debugModeEnabled
  }

  const refreshTrajectoryPrediction = () => {
    options.trajectoryPresentation.refreshPrediction()
  }

  const isFpsMeterVisible = () =>
    options.getFpsMeterVisible?.() ?? options.runtime.debug.fpsIndicatorEnabled

  const getActiveTargetDistanceContext = () => {
    const target = options.queries.getAssistTarget()
    const targetMetrics = options.queries.getCaptureMetrics(target)

    return {
      distanceContext: createBodyDistanceContext({
        target,
        targetMetrics,
      }),
      target,
      targetMetrics,
    }
  }

  const getTargetHeadingVisuals = () => {
    const targetHeadingPlan = options.runtime.ui.targetHeadingPlan
    const committedTargetHeading =
      targetHeadingPlan && options.runtime.simulation.targetHeading !== null
        ? options.runtime.simulation.targetHeading
        : null

    return {
      committedTargetHeading,
      committedTargetHeadingScreenPosition:
        committedTargetHeading !== null
          ? (options.runtime.ui.targetHeadingScreenPosition ?? null)
          : null,
      committedTargetHeadingWorldPosition:
        committedTargetHeading !== null
          ? (options.runtime.ui.targetHeadingWorldPosition ?? null)
          : null,
      targetHeading:
        targetHeadingPlan?.heading ?? options.runtime.simulation.targetHeading,
      targetHeadingScreenPosition:
        targetHeadingPlan?.screenPosition ??
        options.runtime.ui.targetHeadingScreenPosition ??
        null,
      targetHeadingWorldPosition:
        targetHeadingPlan?.worldPosition ??
        options.runtime.ui.targetHeadingWorldPosition ??
        null,
      targetHeadingPlanActive: targetHeadingPlan !== null,
    }
  }

  const recordFpsFrameSample = (nowMs: number, cpuMs: number) => {
    fpsFrameSamples.push({
      atMs: nowMs,
      cpuMs,
    })

    const sampleCutoffMs = nowMs - fpsFrameSampleWindowMs
    while (
      fpsFrameSamples.length > 0 &&
      fpsFrameSamples[0].atMs < sampleCutoffMs
    ) {
      fpsFrameSamples.shift()
    }
  }

  const getRollingFps = (nowMs: number) => {
    const sampleCutoffMs = nowMs - fpsMeterFpsWindowMs
    let sampleCount = 0
    let oldestSampleAtMs = nowMs

    for (let index = fpsFrameSamples.length - 1; index >= 0; index -= 1) {
      const sample = fpsFrameSamples[index]
      if (sample.atMs <= sampleCutoffMs) {
        break
      }

      sampleCount += 1
      oldestSampleAtMs = sample.atMs
    }

    const observedWindowMs = nowMs - oldestSampleAtMs
    if (sampleCount < 2 || observedWindowMs < fpsMeterFpsWindowMs * 0.5) {
      return meterFps
    }

    const measuredWindowMs =
      observedWindowMs >= fpsMeterFpsWindowMs * 0.95
        ? fpsMeterFpsWindowMs
        : observedWindowMs

    return (sampleCount * 1_000) / measuredWindowMs
  }

  const animate = (time: number) => {
    const frameStart = performance.now()
    const frameIntervalMs = time - lastTime
    const realDt = Math.min(frameIntervalMs / 1000, 0.1)
    lastTime = time
    const fpsMeterVisible = isFpsMeterVisible()
    browserGcProbe.setEnabled(fpsMeterVisible)
    const prompts = resolveScenarioPrompts(
      options.runtime,
      options.touchControls ? 'mobile' : 'desktop',
    )
    const gameplayPaused =
      (prompts.active?.pausesGameplay ?? false) ||
      (options.getGameplayPaused?.() ?? false)
    options.pointerCameraInput?.updateEdgeScroll(time, realDt)

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

    options.trajectoryPresentation.maybeRefreshPrediction(realDt)
    const getTrajectoryPredictionForHorizonHours = (horizonHours: number) => {
      const predictionOptions = {
        assistMode: options.runtime.simulation.assistMode,
        autopilotRotationRate: options.autopilotRotationRate,
        getAssistPredictionControls:
          options.queries.getAssistPredictionControls,
        getAssistTarget: options.queries.getAssistTarget,
        getCaptureMetrics: options.queries.getCaptureMetrics,
        physicsEngine: options.physicsEngine,
        predictionConfig: options.queries.getPredictionConfig(
          horizonHours * 60 * 60,
        ),
        state: options.runtime.simulation.state,
        timeWarp:
          options.timeWarps[options.runtime.simulation.timeWarpIndex] ?? 1,
      }

      if (
        !scenarioTrajectoryPredictionInitialized ||
        scenarioTrajectoryPredictionHorizonHours !== horizonHours
      ) {
        scenarioTrajectoryPredictionRuntime.refresh(predictionOptions)
        scenarioTrajectoryPredictionInitialized = true
        scenarioTrajectoryPredictionHorizonHours = horizonHours
      } else {
        scenarioTrajectoryPredictionRuntime.maybeRefresh(
          realDt,
          predictionOptions,
        )
      }

      return scenarioTrajectoryPredictionRuntime.getState()
    }

    const scenarioAdvanceResult = advanceRuntimeScenario(
      options.runtime,
      options.globalScenarioDirectiveLimits,
      {
        getTrajectoryPredictionForHorizonHours,
        shouldAdvance: !gameplayPaused,
        trajectoryPrediction:
          options.trajectoryPresentation.getPredictionState(),
      },
    )
    if (scenarioAdvanceResult.refreshTrajectoryPrediction) {
      options.trajectoryPresentation.refreshPrediction()
    }
    options.runtimeActions.updateCamera()
    updateRipples(options.ripples, realDt, {
      camera: options.gameScene.camera,
    })
    const {
      distanceContext,
      target: trailTarget,
      targetMetrics: trailTargetMetrics,
    } = getActiveTargetDistanceContext()
    const trimTrailAroundTarget = trailTargetMetrics.specificEnergy < 0

    //todo: those two presentation could simply receive runtime, and we could just iterate over presentations objects here (altogether with trajectory - just need to change creatoin phase)
    options.bodyPresentation.updateVisuals({
      bodies: options.runtime.simulation.state.bodies,
      distanceContext,
      elapsed: options.runtime.simulation.state.elapsed,
      hiddenBodyIds: options.runtime.scenario.directives.hiddenBodyIds,
      spacecraftPosition: options.runtime.simulation.state.spacecraft.position,
      viewportSize: options.runtime.simulation.viewportSize,
    })

    options.spacecraftPresentation.updateVisuals({
      bodies: options.runtime.simulation.state.bodies,
      elapsed: options.runtime.simulation.state.elapsed,
      isThrusting,
      spacecraft: options.runtime.simulation.state.spacecraft,
      spacecraftLabelIntroUntil: options.runtime.ui.spacecraftLabelIntroUntil,
      trailTarget,
      trimTrailAroundTarget,
      ...getTargetHeadingVisuals(),
      viewportSize: options.runtime.simulation.viewportSize,
    })

    options.trajectoryPresentation.updateVisuals()
    const hudNowMs = performance.now()
    if (fpsMeterVisible) {
      meterFps = getRollingFps(hudNowMs)
    } else if (fpsFrameSamples.length > 0) {
      fpsFrameSamples.length = 0
    }
    options.hudPresentation.update({
      browserGcStats: browserGcProbe.getStats(),
      frameIntervalMs,
      fpsFrameSamples,
      fpsGraphNowMs: fpsMeterVisible ? hudNowMs : 0,
      fpsMeterVisible,
      nowMs: hudNowMs,
      smoothedCpuMs,
      smoothedFps: meterFps,
    })
    options.crashMenu?.syncState()
    options.topMenu?.syncState()
    syncDebugSceneVisibility()
    options.rendererProfiler.render(
      options.gameScene.scene,
      options.gameScene.camera,
      fpsMeterVisible,
    )

    const frameEndMs = performance.now()
    const frameCpuMs = frameEndMs - frameStart
    if (fpsMeterVisible) {
      recordFpsFrameSample(frameEndMs, frameCpuMs)
    }
    if (fpsMeterVisible) {
      browserGcProbe.recordFrame({
        frameIntervalMs,
        nowMs: frameEndMs,
      })
    }
    if (fpsMeterVisible) {
      smoothedCpuMs = THREE.MathUtils.lerp(smoothedCpuMs, frameCpuMs, 0.15)
    }
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
      const {
        distanceContext,
        target: trailTarget,
        targetMetrics: trailTargetMetrics,
      } = getActiveTargetDistanceContext()
      options.bodyPresentation.updateVisuals({
        bodies: options.runtime.simulation.state.bodies,
        distanceContext,
        elapsed: options.runtime.simulation.state.elapsed,
        hiddenBodyIds: options.runtime.scenario.directives.hiddenBodyIds,
        spacecraftPosition:
          options.runtime.simulation.state.spacecraft.position,
        viewportSize: options.runtime.simulation.viewportSize,
      })
      options.spacecraftPresentation.updateVisuals({
        bodies: options.runtime.simulation.state.bodies,
        elapsed: options.runtime.simulation.state.elapsed,
        isThrusting:
          options.runtime.simulation.state.controls.main > 0 &&
          options.runtime.simulation.state.spacecraft.fuel > 0,
        spacecraft: options.runtime.simulation.state.spacecraft,
        spacecraftLabelIntroUntil: options.runtime.ui.spacecraftLabelIntroUntil,
        trailTarget,
        trimTrailAroundTarget: trailTargetMetrics.specificEnergy < 0,
        ...getTargetHeadingVisuals(),
        viewportSize: options.runtime.simulation.viewportSize,
      })
      const fpsMeterVisible = isFpsMeterVisible()
      browserGcProbe.setEnabled(fpsMeterVisible)
      const hudNowMs = performance.now()
      options.hudPresentation.update({
        browserGcStats: browserGcProbe.getStats(),
        frameIntervalMs: 0,
        fpsFrameSamples,
        fpsGraphNowMs: fpsMeterVisible ? hudNowMs : 0,
        fpsMeterVisible,
        nowMs: hudNowMs,
        smoothedCpuMs,
        smoothedFps: meterFps,
      })
      options.crashMenu?.syncState()
      options.topMenu?.syncState()
      syncDebugSceneVisibility()
      requestAnimationFrame(animate)
    },
  }
}
