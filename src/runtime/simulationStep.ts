import { type AssistMode, shouldCircularizeBurn } from '../assist/orbitalAssist'
import type { KeyboardInput } from '../input/keyboardInput'
import { getConstrainedTimeWarpIndex } from '../scenario/scenarioDirectives'
import { idleControls } from '../simulation/state'
import type {
  Body,
  PhysicsEngine,
  SimulationState,
  TargetHeadingTurn,
} from '../simulation/types'
import {
  add,
  fromAngle,
  length,
  normalize,
  scale,
  sub,
} from '../simulation/vector'
import type { GameQueries } from './gameQueries'
import type { NavigationTimeWarpController } from './navigationTimeWarpController'

type SimulationStepQueries = Pick<
  GameQueries,
  | 'getAssistTarget'
  | 'getAutopilotTurn'
  | 'getCaptureMetrics'
  | 'getCircularizePlan'
  | 'shouldCaptureBurn'
>

type ResolveSimulationControlsOptions = SimulationStepQueries & {
  assistMode: AssistMode
  autopilotRotationRate?: number
  crashedBodyName: string | null
  dt?: number
  keyboardInput: KeyboardInput
  state: SimulationState
  targetHeading: number | null
  targetHeadingTurn?: TargetHeadingTurn | null
}

type ResolvedSimulationControls = {
  assistMode: AssistMode
  controls: SimulationState['controls']
  targetHeading: number | null
  targetHeadingTurn: TargetHeadingTurn | null
}

type ResolvedSimulationControlsWithInputState = ResolvedSimulationControls & {
  manualRcsTurnActive: boolean
}

export type TimeWarpConstraintReason = 'scenario-limit' | 'active-controls'

export type StepSimulationFrameOptions = SimulationStepQueries & {
  assistMode: AssistMode
  autopilotRotationRate: number
  crashedBodyName: string | null
  keyboardInput: KeyboardInput
  maxControlWarp: number
  maxTimeWarp?: number | null
  navigationTimeWarpController?: NavigationTimeWarpController
  nowMs?: number
  physicsEngine: PhysicsEngine
  realDt: number
  state: SimulationState
  targetHeading: number | null
  targetHeadingTurn?: TargetHeadingTurn | null
  timeWarpIndex: number
  timeWarps: number[]
}

export type StepSimulationFrameResult = {
  assistMode: AssistMode
  crashedBodyName: string | null
  state: SimulationState
  targetHeading: number | null
  targetHeadingTurn: TargetHeadingTurn | null
  timeWarpIndex: number
}

export const defaultMaxControlWarp = 100
const temporaryMaxRcsTurnWarp = 15

const targetHeadingDeadZone = 0.015
const targetHeadingTurnBaseAccelerationSeconds = 0.65
const targetHeadingTurnSpeedScale = 0.5
const minAutopilotRotationRate = 0.001

type TargetHeadingTurnProfile = {
  acceleration: number
  cruiseSeconds: number
  durationSeconds: number
  peakSpeed: number
  rampDistance: number
  rampSeconds: number
  totalAngle: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const normalizeAngle = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle))
const hasUsableFuel = (state: SimulationState) =>
  state.spacecraft.fuelCapacity <= 0 || state.spacecraft.fuel > 0

const getSafeAutopilotRotationRate = (rotationRate: number | undefined) =>
  Math.max(
    Math.abs(rotationRate ?? minAutopilotRotationRate),
    minAutopilotRotationRate,
  )

const getTargetHeadingTurnProfile = (
  totalAngle: number,
  maxSpeed: number,
): TargetHeadingTurnProfile => {
  const peakSpeedLimit = maxSpeed * targetHeadingTurnSpeedScale
  const acceleration =
    (maxSpeed / targetHeadingTurnBaseAccelerationSeconds) *
    targetHeadingTurnSpeedScale ** 2
  const rampSeconds = peakSpeedLimit / acceleration
  const maxRampDistance = 0.5 * acceleration * rampSeconds ** 2

  if (totalAngle <= maxRampDistance * 2) {
    const peakSpeed = Math.sqrt(totalAngle * acceleration)
    const triangularRampSeconds = peakSpeed / acceleration

    return {
      acceleration,
      cruiseSeconds: 0,
      durationSeconds: triangularRampSeconds * 2,
      peakSpeed,
      rampDistance: totalAngle / 2,
      rampSeconds: triangularRampSeconds,
      totalAngle,
    }
  }

  const cruiseDistance = totalAngle - maxRampDistance * 2

  return {
    acceleration,
    cruiseSeconds: cruiseDistance / peakSpeedLimit,
    durationSeconds: rampSeconds * 2 + cruiseDistance / peakSpeedLimit,
    peakSpeed: peakSpeedLimit,
    rampDistance: maxRampDistance,
    rampSeconds,
    totalAngle,
  }
}

const getTurnDistanceAtElapsed = (
  profile: TargetHeadingTurnProfile,
  elapsedSeconds: number,
) => {
  const elapsed = clamp(elapsedSeconds, 0, profile.durationSeconds)

  if (elapsed <= profile.rampSeconds) {
    return 0.5 * profile.acceleration * elapsed ** 2
  }

  if (elapsed <= profile.rampSeconds + profile.cruiseSeconds) {
    return (
      profile.rampDistance + profile.peakSpeed * (elapsed - profile.rampSeconds)
    )
  }

  const remaining = profile.durationSeconds - elapsed
  return profile.totalAngle - 0.5 * profile.acceleration * remaining ** 2
}

const createTargetHeadingTurn = (
  currentHeading: number,
  targetHeading: number,
  autopilotRotationRate: number | undefined,
): TargetHeadingTurn | null => {
  const delta = normalizeAngle(targetHeading - currentHeading)

  if (Math.abs(delta) < targetHeadingDeadZone) {
    return null
  }

  const safeRotationRate = getSafeAutopilotRotationRate(autopilotRotationRate)
  const profile = getTargetHeadingTurnProfile(Math.abs(delta), safeRotationRate)

  return {
    durationSeconds: profile.durationSeconds,
    elapsedSeconds: 0,
    startHeading: currentHeading,
    targetHeading,
  }
}

const resolveTargetHeadingTurn = (options: {
  autopilotRotationRate: number | undefined
  dt: number | undefined
  getAutopilotTurn: (desiredHeading: number) => number
  state: SimulationState
  targetHeading: number
  targetHeadingTurn: TargetHeadingTurn | null
}): {
  targetHeading: number | null
  targetHeadingTurn: TargetHeadingTurn | null
  turn: number
} => {
  if (options.dt === undefined) {
    if (options.targetHeadingTurn) {
      return {
        targetHeading: options.targetHeading,
        targetHeadingTurn: options.targetHeadingTurn,
        turn:
          Math.sign(
            normalizeAngle(
              options.targetHeadingTurn.targetHeading -
                options.targetHeadingTurn.startHeading,
            ),
          ) || 0,
      }
    }

    const turn = options.getAutopilotTurn(options.targetHeading)

    return {
      targetHeading: turn === 0 ? null : options.targetHeading,
      targetHeadingTurn: turn === 0 ? null : options.targetHeadingTurn,
      turn,
    }
  }

  let targetHeadingTurn =
    options.targetHeadingTurn &&
    Math.abs(
      normalizeAngle(
        options.targetHeadingTurn.targetHeading - options.targetHeading,
      ),
    ) < targetHeadingDeadZone
      ? options.targetHeadingTurn
      : createTargetHeadingTurn(
          options.state.spacecraft.heading,
          options.targetHeading,
          options.autopilotRotationRate,
        )

  if (!targetHeadingTurn) {
    return {
      targetHeading: null,
      targetHeadingTurn: null,
      turn: 0,
    }
  }

  const nextElapsed = Math.min(
    targetHeadingTurn.elapsedSeconds + options.dt,
    targetHeadingTurn.durationSeconds,
  )
  const totalDelta = normalizeAngle(
    targetHeadingTurn.targetHeading - targetHeadingTurn.startHeading,
  )
  const turnSign = Math.sign(totalDelta) || 1
  const profile = getTargetHeadingTurnProfile(
    Math.abs(totalDelta),
    getSafeAutopilotRotationRate(options.autopilotRotationRate),
  )
  const completedAngle = getTurnDistanceAtElapsed(profile, nextElapsed)
  const desiredHeading = normalizeAngle(
    targetHeadingTurn.startHeading + turnSign * completedAngle,
  )
  const stepDelta = normalizeAngle(
    desiredHeading - options.state.spacecraft.heading,
  )
  const safeRotationRate = getSafeAutopilotRotationRate(
    options.autopilotRotationRate,
  )
  const turn =
    options.dt > 0
      ? clamp(stepDelta / (safeRotationRate * options.dt), -1, 1)
      : 0

  if (nextElapsed >= targetHeadingTurn.durationSeconds) {
    return {
      targetHeading: null,
      targetHeadingTurn: null,
      turn,
    }
  }

  targetHeadingTurn = {
    ...targetHeadingTurn,
    elapsedSeconds: nextElapsed,
  }

  return {
    targetHeading: targetHeadingTurn.targetHeading,
    targetHeadingTurn,
    turn,
  }
}

const resolveSimulationControls = (
  options: ResolveSimulationControlsOptions,
): ResolvedSimulationControlsWithInputState => {
  if (options.crashedBodyName) {
    return {
      assistMode: options.assistMode,
      controls: idleControls(),
      manualRcsTurnActive: false,
      targetHeading: options.targetHeading,
      targetHeadingTurn: null,
    }
  }

  const manualControls = options.keyboardInput.getManualControls()
  let main = manualControls.main
  const manualTurn = manualControls.turn
  let turn = manualTurn
  let assistMode = options.assistMode
  let targetHeading = options.targetHeading
  let targetHeadingTurn = options.targetHeadingTurn ?? null

  if (manualTurn !== 0) {
    assistMode = 'off'
    targetHeading = null
    targetHeadingTurn = null
  } else if (assistMode === 'capture') {
    targetHeadingTurn = null
    const target = options.getAssistTarget()
    const relativeVelocity = sub(
      options.state.spacecraft.velocity,
      target.velocity,
    )
    const desiredHeading = Math.atan2(-relativeVelocity.y, -relativeVelocity.x)
    turn = options.getAutopilotTurn(desiredHeading)

    if (options.shouldCaptureBurn(target)) {
      main = 1
    }
  } else if (assistMode === 'circularize') {
    targetHeadingTurn = null
    const target = options.getAssistTarget()
    const plan = options.getCircularizePlan(target)
    const metrics = options.getCaptureMetrics(target)
    turn = options.getAutopilotTurn(plan.burnHeading)

    if (shouldCircularizeBurn(metrics, plan)) {
      main = 1
    }
  } else if (targetHeading !== null) {
    const resolvedTargetHeadingTurn = resolveTargetHeadingTurn({
      autopilotRotationRate: options.autopilotRotationRate,
      dt: options.dt,
      getAutopilotTurn: options.getAutopilotTurn,
      state: options.state,
      targetHeading,
      targetHeadingTurn,
    })
    turn = resolvedTargetHeadingTurn.turn
    targetHeading = resolvedTargetHeadingTurn.targetHeading
    targetHeadingTurn = resolvedTargetHeadingTurn.targetHeadingTurn
  }

  const controls = {
    main,
    reverse: manualControls.reverse,
    strafe: manualControls.strafe,
    turn,
  }

  if (!hasUsableFuel(options.state)) {
    return {
      assistMode,
      controls: idleControls(),
      manualRcsTurnActive: false,
      targetHeading: null,
      targetHeadingTurn: null,
    }
  }

  return {
    assistMode,
    controls,
    manualRcsTurnActive: manualTurn !== 0,
    targetHeading,
    targetHeadingTurn,
  }
}

const getActiveControlMaxWarp = (
  controls: SimulationState['controls'],
  manualRcsTurnActive: boolean,
  maxControlWarp: number,
) => {
  const linearThrustActive =
    controls.main !== 0 || controls.reverse !== 0 || controls.strafe !== 0

  if (linearThrustActive) {
    return maxControlWarp
  }

  if (manualRcsTurnActive && controls.turn !== 0) {
    return temporaryMaxRcsTurnWarp
  }

  return controls.turn !== 0 ? maxControlWarp : null
}

export const resolveSimulationTimeWarp = (
  options: ResolveSimulationControlsOptions & {
    maxControlWarp: number
    maxTimeWarp: number | null
    timeWarpIndex: number
    timeWarps: number[]
  },
): {
  activeControlMaxWarp: number | null
  reason: TimeWarpConstraintReason | null
  simulationControls: ResolvedSimulationControls
  timeWarpIndex: number
} => {
  const { manualRcsTurnActive, ...simulationControls } =
    resolveSimulationControls(options)
  const activeControlMaxWarp = getActiveControlMaxWarp(
    simulationControls.controls,
    manualRcsTurnActive,
    options.maxControlWarp,
  )
  const scenarioConstrainedTimeWarpIndex = getConstrainedTimeWarpIndex(
    options.timeWarpIndex,
    options.timeWarps,
    options.maxTimeWarp,
  )
  const controlConstrainedTimeWarpIndex = getConstrainedTimeWarpIndex(
    scenarioConstrainedTimeWarpIndex,
    options.timeWarps,
    activeControlMaxWarp,
  )
  let reason: TimeWarpConstraintReason | null = null

  if (controlConstrainedTimeWarpIndex !== scenarioConstrainedTimeWarpIndex) {
    reason = 'active-controls'
  } else if (scenarioConstrainedTimeWarpIndex !== options.timeWarpIndex) {
    reason = 'scenario-limit'
  }

  return {
    activeControlMaxWarp,
    reason,
    simulationControls,
    timeWarpIndex: controlConstrainedTimeWarpIndex,
  }
}

const detectCollision = (state: SimulationState) =>
  state.bodies.find(
    (body) =>
      length(sub(state.spacecraft.position, body.position)) <= body.radius,
  )

const createStoppedCollisionState = (
  state: SimulationState,
  body: Body,
): SimulationState => {
  const outward = normalize(sub(state.spacecraft.position, body.position))
  const fallback = fromAngle(state.spacecraft.heading)
  const normal = length(outward) > 0 ? outward : fallback

  return {
    ...state,
    controls: idleControls(),
    spacecraft: {
      ...state.spacecraft,
      position: add(body.position, scale(normal, body.radius)),
      velocity: { ...body.velocity },
    },
  }
}

export const stepSimulationFrame = (
  options: StepSimulationFrameOptions,
): StepSimulationFrameResult => {
  if (options.crashedBodyName) {
    return {
      assistMode: options.assistMode,
      crashedBodyName: options.crashedBodyName,
      state: {
        ...options.state,
        controls: idleControls(),
      },
      targetHeading: options.targetHeading,
      targetHeadingTurn: null,
      timeWarpIndex: options.timeWarpIndex,
    }
  }

  let assistMode = options.assistMode
  let targetHeading = options.targetHeading
  let targetHeadingTurn = options.targetHeadingTurn ?? null
  let state = options.state
  let crashedBodyName = options.crashedBodyName

  const resolvedTimeWarp = resolveSimulationTimeWarp({
    assistMode,
    crashedBodyName,
    getAssistTarget: options.getAssistTarget,
    getAutopilotTurn: options.getAutopilotTurn,
    getCaptureMetrics: options.getCaptureMetrics,
    getCircularizePlan: options.getCircularizePlan,
    keyboardInput: options.keyboardInput,
    maxControlWarp: options.maxControlWarp,
    maxTimeWarp: options.maxTimeWarp ?? null,
    shouldCaptureBurn: options.shouldCaptureBurn,
    state,
    targetHeading,
    targetHeadingTurn,
    timeWarpIndex: options.timeWarpIndex,
    timeWarps: options.timeWarps,
  })

  assistMode = resolvedTimeWarp.simulationControls.assistMode
  targetHeading = resolvedTimeWarp.simulationControls.targetHeading
  targetHeadingTurn = resolvedTimeWarp.simulationControls.targetHeadingTurn
  const timeWarpIndex = options.navigationTimeWarpController
    ? options.navigationTimeWarpController.resolveFrame({
        maxTimeWarp: options.maxTimeWarp ?? null,
        nowMs: options.nowMs ?? performance.now(),
        simulationControlMaxWarp: resolvedTimeWarp.activeControlMaxWarp,
        timeWarpIndex: options.timeWarpIndex,
      })
    : resolvedTimeWarp.timeWarpIndex
  const timeWarp = options.timeWarps[timeWarpIndex] ?? 1
  const physicsStep = 1
  let remaining = Math.min(options.realDt * timeWarp, 3600)

  while (remaining > 0) {
    const dt = Math.min(physicsStep, remaining)
    const controls = resolveSimulationControls({
      assistMode,
      autopilotRotationRate: options.autopilotRotationRate,
      crashedBodyName,
      dt,
      getAssistTarget: options.getAssistTarget,
      getAutopilotTurn: options.getAutopilotTurn,
      getCaptureMetrics: options.getCaptureMetrics,
      getCircularizePlan: options.getCircularizePlan,
      keyboardInput: options.keyboardInput,
      shouldCaptureBurn: options.shouldCaptureBurn,
      state,
      targetHeading,
      targetHeadingTurn,
    })

    assistMode = controls.assistMode
    targetHeading = controls.targetHeading
    targetHeadingTurn = controls.targetHeadingTurn
    state = {
      ...state,
      controls: controls.controls,
    }
    state = options.physicsEngine.step(state, dt)
    const collision = detectCollision(state)

    if (collision) {
      crashedBodyName = collision.name
      assistMode = 'off'
      targetHeading = null
      targetHeadingTurn = null
      state = createStoppedCollisionState(state, collision)
      break
    }

    remaining -= dt
  }

  if (!crashedBodyName && targetHeadingTurn === null) {
    const finalControls = resolveSimulationControls({
      assistMode,
      autopilotRotationRate: options.autopilotRotationRate,
      crashedBodyName,
      getAssistTarget: options.getAssistTarget,
      getAutopilotTurn: options.getAutopilotTurn,
      getCaptureMetrics: options.getCaptureMetrics,
      getCircularizePlan: options.getCircularizePlan,
      keyboardInput: options.keyboardInput,
      shouldCaptureBurn: options.shouldCaptureBurn,
      state,
      targetHeading,
      targetHeadingTurn,
    })

    assistMode = finalControls.assistMode
    targetHeading = finalControls.targetHeading
    targetHeadingTurn = finalControls.targetHeadingTurn
    state = {
      ...state,
      controls: finalControls.controls,
    }
  }

  return {
    assistMode,
    crashedBodyName,
    state,
    targetHeading,
    targetHeadingTurn,
    timeWarpIndex,
  }
}
